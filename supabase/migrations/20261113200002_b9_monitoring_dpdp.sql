-- B9.2 Monitoring, the image clean-up job, and erasure that frees seats.

-- ---------------------------------------------------------------- "last success" for every job
-- job_runs only kept the last run, so a job that failed every time never looked late. last_ok_at is the last ok/warning run.
alter table public.job_runs add column last_ok_at timestamptz;
update public.job_runs set last_ok_at = last_finished_at where last_status in ('ok', 'warning');

create or replace function private.record_job_run(p_job text, p_status text, p_detail jsonb, p_error text) returns void
language sql security definer set search_path = '' as $$
  insert into public.job_runs (job, last_started_at, last_finished_at, last_ok_at, last_status, last_detail, last_error, run_count, error_count)
  values (p_job, now(), now(), case when p_status in ('ok', 'warning') then now() end, p_status, p_detail, left(p_error, 300), 1, case when p_status = 'error' then 1 else 0 end)
  on conflict (job) do update
    set last_started_at = now(), last_finished_at = now(),
        last_ok_at = case when p_status in ('ok', 'warning') then now() else public.job_runs.last_ok_at end,
        last_status = p_status, last_detail = p_detail, last_error = left(p_error, 300),
        run_count = public.job_runs.run_count + 1,
        error_count = public.job_runs.error_count + case when p_status = 'error' then 1 else 0 end
$$;

-- every cron job needs a line here (the admin job-health page, the monitor and a test rely on it)
create or replace function private.job_schedule() returns table (job text, every_minutes integer)
language sql immutable set search_path = '' as $$
  values ('flush-email', 1), ('flush-analytics', 1), ('reconfirmation', 15), ('reminders', 30), ('housekeeping', 1440),
         ('attendance', 30), ('reputation', 15), ('feedback-windows', 60), ('reputation-nightly', 1440),
         ('monitor', 15), ('r2-cleanup', 15)
$$;

-- "late" now means: no SUCCESSFUL run within twice the interval (plus 5 minutes). A job that errors every time is late.
create or replace function private.admin_job_health()
returns table (job text, last_started_at timestamptz, last_finished_at timestamptz, last_status text, last_detail jsonb, last_error text,
               run_count bigint, error_count bigint, every_minutes integer, late boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query
    select s.job, j.last_started_at, j.last_finished_at, j.last_status, j.last_detail, j.last_error, coalesce(j.run_count, 0), coalesce(j.error_count, 0),
           s.every_minutes,
           j.last_ok_at is null or j.last_ok_at < now() - (s.every_minutes * 2 + 5) * interval '1 minute'
      from private.job_schedule() s left join public.job_runs j on j.job = s.job
     order by s.job;
end
$$;

-- ---------------------------------------------------------------- the monitor: tells admins when something is wrong
-- One alert per condition per 24 hours (in the app and by email, through the normal queue).
create function private.monitor_alert(p_key text, p_kind text, p_data jsonb, p_title text, p_body text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  a record;
begin
  if exists (select 1 from public.notifications where kind = 'monitor_alert' and data ->> 'key' = p_key and created_at > now() - interval '24 hours') then
    return false;
  end if;
  perform private.notify_admins('monitor_alert', p_title, p_body, coalesce(p_data, '{}'::jsonb) || jsonb_build_object('key', p_key));
  for a in select user_id from public.user_roles where role = 'admin' loop
    perform private.queue_email(a.user_id, 'admin_alert', coalesce(p_data, '{}'::jsonb) || jsonb_build_object('kind', p_kind), 1);
  end loop;
  return true;
end
$$;

create function private.job_monitor() returns void
language plpgsql security definer set search_path = '' as $$
declare
  j record;
  late integer := 0;
  v_cap integer;
  v_sent integer;
  v_mb integer;
  v_runs bigint;
begin
  begin
    select coalesce(run_count, 0) into v_runs from public.job_runs where job = 'monitor';
    -- jobs that have no success within twice their interval (after the first hour of a new install, so a fresh start does not alarm)
    if coalesce(v_runs, 0) >= 4 then
      for j in
        select s.job, s.every_minutes from private.job_schedule() s left join public.job_runs r on r.job = s.job
         where s.job <> 'monitor' and coalesce(r.last_ok_at, '-infinity') < now() - (s.every_minutes * 2 + 5) * interval '1 minute'
      loop
        late := late + 1;
        perform private.monitor_alert('job_late:' || j.job, 'job_late', jsonb_build_object('job', j.job), 'A scheduled job is not running', j.job || ' has had no successful run in ' || (j.every_minutes * 2) || ' minutes or more.');
      end loop;
    end if;

    -- emails against the daily cap (the cap is the Worker's number, recorded with every flush)
    select coalesce((last_detail ->> 'daily_cap')::integer, 280) into v_cap from public.job_runs where job = 'flush-email';
    v_cap := coalesce(v_cap, 280);
    v_sent := private.emails_sent_today();
    if v_sent >= floor(v_cap * 0.8) then
      perform private.monitor_alert('email_cap:' || to_char(now() at time zone 'utc', 'YYYY-MM-DD'), 'email_cap', jsonb_build_object('sent', v_sent, 'cap', v_cap),
        'Emails are nearly at the daily limit', v_sent || ' of ' || v_cap || ' sent today. The rest go out after midnight UTC.');
    end if;

    -- database size (the free plan has 500 MB)
    v_mb := (pg_database_size(current_database()) / 1048576)::integer;
    if v_mb >= 400 then
      perform private.monitor_alert('db_size', 'db_size', jsonb_build_object('mb', v_mb), 'The database is getting full', 'The database is ' || v_mb || ' MB. The free plan allows 500 MB.');
    end if;

    perform private.record_job_run('monitor', 'ok', jsonb_build_object('late_jobs', late, 'emails_sent_today', v_sent, 'database_mb', v_mb), null);
  exception when others then
    perform private.record_job_run('monitor', 'error', null, sqlerrm);
  end;
end
$$;
revoke all on function private.monitor_alert(text, text, jsonb, text, text), private.job_monitor() from public;
grant execute on function private.job_monitor() to service_role;
select cron.schedule('monitor', '*/15 * * * *', 'select private.job_monitor()');

-- ---------------------------------------------------------------- the image clean-up job (it was never scheduled)
-- Deleted accounts' photos and selfies, replaced images and unreferenced uploads are removed by the Worker. It does one page of each
-- bucket per call and reports where it stopped, so each run continues from the previous run's cursors.
create function private.cron_r2_cleanup() returns void
language plpgsql security definer set search_path = '' as $$
declare
  url text;
  secret text;
  prev jsonb;
begin
  select decrypted_secret into url from vault.decrypted_secrets where name = 'worker_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'job_shared_secret';
  if url is null or secret is null then
    perform private.record_job_run('r2-cleanup', 'skipped', jsonb_build_object('reason', 'worker_url or job_shared_secret is not set in Vault'), null);
    return;
  end if;
  select last_detail -> 'cursors' into prev from public.job_runs where job = 'r2-cleanup';
  perform net.http_post(
    url := rtrim(url, '/') || '/jobs/r2-cleanup',
    headers := jsonb_build_object('content-type', 'application/json', 'x-job-secret', secret),
    body := jsonb_strip_nulls(jsonb_build_object('mediaCursor', prev ->> 'media', 'privateCursor', prev ->> 'private')),
    timeout_milliseconds := 10000
  );
exception when others then
  perform private.record_job_run('r2-cleanup', 'error', null, sqlerrm);
end
$$;
revoke all on function private.cron_r2_cleanup() from public;
grant execute on function private.cron_r2_cleanup() to service_role;
select cron.schedule('r2-cleanup', '*/15 * * * *', 'select private.cron_r2_cleanup()');

-- ---------------------------------------------------------------- housekeeping also trims pg_cron's own history
create or replace function private.job_housekeeping() returns void
language plpgsql security definer set search_path = '' as $$
declare
  a integer; b integer; c integer; d integer; e integer := 0;
begin
  begin
    delete from public.rate_limits where window_start < now() - interval '3 days';
    get diagnostics a = row_count;
    delete from public.email_outbox where status in ('sent', 'failed', 'skipped') and created_at < now() - interval '30 days';
    get diagnostics b = row_count;
    delete from public.notifications where read_at is not null and read_at < now() - interval '90 days';
    get diagnostics c = row_count;
    delete from public.analytics_outbox where status in ('sent', 'failed', 'skipped') and created_at < now() - interval '30 days';
    -- events that never went out (no PostHog key configured, or the Worker is down for days) are dropped after a week, not kept forever
    delete from public.analytics_outbox where status in ('queued', 'sending') and created_at < now() - interval '7 days';
    get diagnostics d = row_count;
    -- pg_cron keeps a row for every run (about 2,900 a day from the two per-minute jobs): keep a week
    begin
      delete from cron.job_run_details where end_time < now() - interval '7 days';
      get diagnostics e = row_count;
    exception when others then
      e := -1;
    end;
    perform private.record_job_run('housekeeping', 'ok', jsonb_build_object('rate_limits', a, 'emails', b, 'notifications', c, 'analytics_events', d, 'cron_history', e), null);
  exception when others then
    perform private.record_job_run('housekeeping', 'error', null, sqlerrm);
  end;
end
$$;

-- ---------------------------------------------------------------- erasing an account frees its upcoming seats
-- Kept on purpose (nothing readable about the person): consents (proof of consent), moderation_actions and banned_identities (the
-- team's record and the ban blocklist hashes), reports about the person, attendance rows without a name, and the audit log.
create or replace function private.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  b record;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if exists (select 1 from public.profiles where id = uid and deleted_at is not null) then
    return; -- already deleted
  end if;

  -- Upcoming seats are released like they are for a ban: the waitlist moves up and hosts are told.
  for b in
    select bk.id, bk.event_id, bk.status, e.host_id, e.title from public.bookings bk join public.events e on e.id = bk.event_id
     where bk.user_id = uid and bk.status in ('requested', 'approved', 'waitlisted', 'confirmed') and e.ends_at > now()
  loop
    perform 1 from public.events where id = b.event_id for update;
    update public.bookings set status = 'cancelled', cancelled_at = now(), cancel_reason = 'account_deleted', waitlisted_at = null where id = b.id;
    perform private.detach_from_squads(uid, b.event_id);
    if b.status in ('approved', 'confirmed') then
      perform private.notify(b.host_id, 'booking_cancelled', 'A guest cancelled', b.title, jsonb_build_object('event_id', b.event_id, 'booking_id', b.id));
    end if;
    if b.status in ('approved', 'confirmed', 'requested') then perform private.promote_waitlist(b.event_id); end if;
  end loop;

  -- Upcoming events of a deleted host are cancelled (their address stays in event_private for the record of the event).
  update public.events set status = 'cancelled', review_note = 'The host deleted their account.'
   where host_id = uid and status in ('draft', 'pending_review', 'published');

  -- Queue the person's images for deletion from R2, then forget the keys.
  insert into public.storage_deletions (bucket, key)
    select 'media', r2_key from public.profile_photos where user_id = uid
  on conflict do nothing;
  insert into public.storage_deletions (bucket, key)
    select 'private', selfie_key from public.verifications where user_id = uid and selfie_key is not null
  on conflict do nothing;
  delete from public.upload_keys where user_id = uid;

  -- Deliberately kept: public.moderation_actions (an append-only record of decisions about this account) and public.banned_identities
  -- (hashes only, so a ban cannot be dodged by erasing the account). Neither holds anything readable about the person.
  -- After-event data (B6): what they gave or received is deleted...
  delete from public.tag_awards where from_user = uid or to_user = uid;
  delete from public.connections where from_user = uid or to_user = uid;
  delete from public.host_ratings where from_user = uid or host_id = uid;
  delete from public.checkins where user_id = uid;
  update public.checkins set checked_in_by = null where checked_in_by = uid;
  delete from public.appeals where user_id = uid;
  delete from public.profile_tips where user_id = uid;
  delete from public.private_feedback where about_user = uid;
  delete from public.notifications where user_id = uid;
  delete from public.email_outbox where user_id = uid;
  delete from public.analytics_outbox where user_id = uid;
  -- ...and the safety record stays without their name.
  update public.private_feedback set from_user = null where from_user = uid;
  update public.safety_reports set reporter_id = null where reporter_id = uid;

  delete from public.user_roles where user_id = uid;
  delete from public.user_blocks where blocker_id = uid or blocked_id = uid;
  delete from public.host_applications where user_id = uid;
  delete from public.verifications where user_id = uid;
  delete from public.profile_photos where user_id = uid;
  delete from public.profile_interests where user_id = uid;
  delete from public.profile_languages where user_id = uid;
  delete from public.profile_private where id = uid;

  update public.profiles
     set first_name = 'Former member', area_id = null, bio_prompts = '[]'::jsonb,
         is_verified = false, deleted_at = now()
   where id = uid;

  -- Sign the person out everywhere and make the login unusable.
  delete from auth.identities where user_id = uid;
  delete from auth.refresh_tokens where user_id = uid::text;
  delete from auth.sessions where user_id = uid;
  update auth.users
     set email = 'deleted-' || uid || '@deleted.invalid', phone = null, encrypted_password = null,
         raw_user_meta_data = '{}'::jsonb, raw_app_meta_data = '{}'::jsonb,
         banned_until = 'infinity', updated_at = now()
   where id = uid;
end
$$;

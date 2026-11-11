-- Reconfirmation, reminders, housekeeping, the email queue the Worker drains, and notification reading.

-- ---------------------------------------------------------------- job status
create function private.record_job_run(p_job text, p_status text, p_detail jsonb, p_error text) returns void
language sql security definer set search_path = '' as $$
  insert into public.job_runs (job, last_started_at, last_finished_at, last_status, last_detail, last_error, run_count, error_count)
  values (p_job, now(), now(), p_status, p_detail, left(p_error, 300), 1, case when p_status = 'error' then 1 else 0 end)
  on conflict (job) do update
    set last_started_at = now(), last_finished_at = now(), last_status = p_status, last_detail = p_detail, last_error = left(p_error, 300),
        run_count = public.job_runs.run_count + 1,
        error_count = public.job_runs.error_count + case when p_status = 'error' then 1 else 0 end
$$;

-- ---------------------------------------------------------------- reconfirmation ("Still coming?")
-- Sent when an approved booking is 24 hours or less from the start. The cutoff is 6 hours before the start.
create function private.send_reconfirmation(p_booking uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
  e public.events;
begin
  select * into b from public.bookings where id = p_booking for update;
  if not found or b.status <> 'approved' then raise exception 'invalid_booking_change'; end if;
  select * into e from public.events where id = b.event_id;
  update public.bookings
     set reconfirm_requested_at = now(),
         reconfirm_by = case when e.starts_at - interval '6 hours' > now() + interval '1 hour' then e.starts_at - interval '6 hours' else now() + interval '2 hours' end
   where id = b.id;
  perform private.queue_email(b.user_id, 'still_coming', private.event_email_data(e.id) || jsonb_build_object('booking_id', b.id, 'reconfirm_token', b.reconfirm_token,
    'reconfirm_by', (select reconfirm_by from public.bookings where id = b.id)), 1);
  perform private.notify(b.user_id, 'still_coming', 'Still coming?', e.title, jsonb_build_object('event_id', e.id, 'booking_id', b.id));
end
$$;

-- The one-tap link in the email. Works without signing in: the token is a random UUID that only travels in the email.
create function private.reconfirm_booking(p_token uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
  e public.events;
begin
  select * into b from public.bookings where reconfirm_token = p_token for update;
  if not found then raise exception 'not_found'; end if;
  select * into e from public.events where id = b.event_id;
  if b.status = 'confirmed' then
    return jsonb_build_object('status', 'confirmed', 'already', true, 'event_id', e.id, 'event_title', e.title);
  end if;
  if b.status <> 'approved' or b.reconfirm_requested_at is null then raise exception 'booking_not_active'; end if;
  if e.starts_at <= now() then raise exception 'event_started'; end if;
  update public.bookings set status = 'confirmed', reconfirmed_at = now() where id = b.id;
  return jsonb_build_object('status', 'confirmed', 'already', false, 'event_id', e.id, 'event_title', e.title);
end
$$;

-- By hand, for testing: admins can send the "Still coming?" email for any approved booking right now.
create function private.admin_send_reconfirmation(p_booking uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'not_allowed'; end if;
  perform private.send_reconfirmation(p_booking);
end
$$;

-- ---------------------------------------------------------------- scheduled jobs (called by pg_cron, see the next migration)
-- Every job records its result in job_runs, even when it fails.
create function private.job_reconfirmation() returns void
language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
  sent integer := 0;
  released integer := 0;
  completed integer;
  ev uuid;
begin
  begin
    for b in
      select bk.* from public.bookings bk join public.events e on e.id = bk.event_id
       where bk.status = 'approved' and bk.reconfirm_requested_at is null and e.status = 'published'
         and e.starts_at <= now() + interval '24 hours' and e.starts_at > now() + interval '6 hours'
    loop
      perform private.send_reconfirmation(b.id);
      sent := sent + 1;
    end loop;

    -- At the cutoff, people who did not answer lose their seat and the waitlist moves up.
    for b in
      select bk.* from public.bookings bk join public.events e on e.id = bk.event_id
       where bk.status = 'approved' and bk.reconfirm_requested_at is not null and bk.reconfirm_by < now() and e.starts_at > now()
       for update of bk
    loop
      update public.bookings set status = 'cancelled', cancelled_at = now(), cancel_reason = 'no_reconfirm' where id = b.id;
      perform private.detach_from_squads(b.user_id, b.event_id);
      perform private.notify(b.user_id, 'seat_released', 'Your seat was released', 'We did not hear back, so we gave your seat to someone else. You can ask to join again.',
        jsonb_build_object('event_id', b.event_id, 'booking_id', b.id));
      released := released + 1;
    end loop;
    for ev in select distinct event_id from public.bookings where cancel_reason = 'no_reconfirm' and cancelled_at > now() - interval '1 minute' loop
      perform private.promote_waitlist(ev);
    end loop;

    completed := private.complete_ended_events();
    perform private.record_job_run('reconfirmation', 'ok', jsonb_build_object('reconfirmations_sent', sent, 'seats_released', released, 'events_completed', completed), null);
  exception when others then
    perform private.record_job_run('reconfirmation', 'error', null, sqlerrm);
  end;
end
$$;

create function private.job_reminders() returns void
language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
  n integer := 0;
begin
  begin
    for b in
      select bk.* from public.bookings bk join public.events e on e.id = bk.event_id
       where bk.status in ('approved', 'confirmed') and bk.reminded_at is null and e.status = 'published'
         and e.starts_at > now() and e.starts_at <= now() + interval '4 hours'
       for update of bk
    loop
      update public.bookings set reminded_at = now() where id = b.id;
      perform private.queue_email(b.user_id, 'day_of_reminder', private.event_email_data(b.event_id) || jsonb_build_object('booking_id', b.id), 2);
      perform private.notify(b.user_id, 'reminder', 'Today: ' || (select title from public.events where id = b.event_id), 'Open the event for the address and details.',
        jsonb_build_object('event_id', b.event_id, 'booking_id', b.id));
      n := n + 1;
    end loop;
    perform private.record_job_run('reminders', 'ok', jsonb_build_object('reminders_sent', n), null);
  exception when others then
    perform private.record_job_run('reminders', 'error', null, sqlerrm);
  end;
end
$$;

create function private.job_housekeeping() returns void
language plpgsql security definer set search_path = '' as $$
declare
  a integer; b integer; c integer;
begin
  begin
    delete from public.rate_limits where window_start < now() - interval '3 days';
    get diagnostics a = row_count;
    delete from public.email_outbox where status in ('sent', 'failed', 'skipped') and created_at < now() - interval '30 days';
    get diagnostics b = row_count;
    delete from public.notifications where read_at is not null and read_at < now() - interval '90 days';
    get diagnostics c = row_count;
    perform private.record_job_run('housekeeping', 'ok', jsonb_build_object('rate_limits', a, 'emails', b, 'notifications', c), null);
  exception when others then
    perform private.record_job_run('housekeeping', 'error', null, sqlerrm);
  end;
end
$$;

-- ---------------------------------------------------------------- the email queue (service role: the Worker)
-- Claims the next emails: critical first, then oldest. Rows stay 'sending' for 10 minutes, then are claimed again,
-- so a crashed run cannot lose an email.
create function private.claim_emails(p_limit integer)
returns table (id bigint, template text, user_id uuid, data jsonb, priority smallint, attempts smallint, to_email text)
language sql security definer set search_path = '' as $$
  with picked as (
    select o.id from public.email_outbox o
     where o.status in ('queued', 'sending') and o.send_after <= now()
     order by o.priority, o.id
     limit greatest(least(p_limit, 50), 0)
     for update skip locked
  ), updated as (
    update public.email_outbox o set status = 'sending', attempts = o.attempts + 1, send_after = now() + interval '10 minutes'
      from picked where o.id = picked.id
    returning o.id, o.template, o.user_id, o.data, o.priority, o.attempts
  )
  select u.id, u.template, u.user_id, u.data, u.priority, u.attempts, pp.email::text
    from updated u left join public.profile_private pp on pp.id = u.user_id
   order by u.priority, u.id
$$;

-- Results from the Worker: [{id, outcome: sent | retry | failed | skipped, message_id?, error?}].
-- A retry goes back in the queue with a growing delay: the first try plus 3 retries, then it is marked failed.
create function private.finish_emails(p_results jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb;
  o public.email_outbox;
begin
  for r in select * from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) loop
    select * into o from public.email_outbox where id = (r ->> 'id')::bigint for update;
    continue when not found;
    case r ->> 'outcome'
      when 'sent' then
        update public.email_outbox set status = 'sent', sent_at = now(), provider_message_id = left(r ->> 'message_id', 100), last_error = null where id = o.id;
      when 'skipped' then
        update public.email_outbox set status = 'skipped', last_error = left(r ->> 'error', 300) where id = o.id;
      when 'retry' then
        if o.attempts >= 4 then
          update public.email_outbox set status = 'failed', last_error = left(r ->> 'error', 300) where id = o.id;
        else
          update public.email_outbox set status = 'queued', send_after = now() + (power(2, o.attempts) * interval '1 minute'), last_error = left(r ->> 'error', 300) where id = o.id;
        end if;
      else
        update public.email_outbox set status = 'failed', last_error = left(r ->> 'error', 300) where id = o.id;
    end case;
  end loop;
end
$$;

create function private.emails_sent_today() returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.email_outbox
   where status = 'sent' and sent_at >= (date_trunc('day', now() at time zone 'utc')) at time zone 'utc'
$$;

-- ---------------------------------------------------------------- notifications and job status for people
create function private.mark_notifications_read(p_ids bigint[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  update public.notifications set read_at = now() where user_id = uid and read_at is null and (p_ids is null or id = any (p_ids));
end
$$;

create function private.admin_job_runs()
returns table (job text, last_finished_at timestamptz, last_status text, last_detail jsonb, last_error text, run_count bigint, error_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'not_allowed'; end if;
  return query select j.job, j.last_finished_at, j.last_status, j.last_detail, j.last_error, j.run_count, j.error_count from public.job_runs j order by j.job;
end
$$;

-- ---------------------------------------------------------------- wrappers
create function public.reconfirm_booking(p_token uuid) returns jsonb language sql set search_path = '' as $$ select private.reconfirm_booking(p_token) $$;
create function public.admin_send_reconfirmation(p_booking uuid) returns void language sql set search_path = '' as $$ select private.admin_send_reconfirmation(p_booking) $$;
create function public.mark_notifications_read(p_ids bigint[] default null) returns void language sql set search_path = '' as $$ select private.mark_notifications_read(p_ids) $$;
create function public.admin_job_runs()
returns table (job text, last_finished_at timestamptz, last_status text, last_detail jsonb, last_error text, run_count bigint, error_count bigint)
language sql stable set search_path = '' as $$ select * from private.admin_job_runs() $$;
create function public.claim_emails(p_limit integer)
returns table (id bigint, template text, user_id uuid, data jsonb, priority smallint, attempts smallint, to_email text)
language sql set search_path = '' as $$ select * from private.claim_emails(p_limit) $$;
create function public.finish_emails(p_results jsonb) returns void language sql set search_path = '' as $$ select private.finish_emails(p_results) $$;
create function public.emails_sent_today() returns integer language sql stable set search_path = '' as $$ select private.emails_sent_today() $$;
create function public.record_job_run(p_job text, p_status text, p_detail jsonb default null, p_error text default null) returns void
language sql set search_path = '' as $$ select private.record_job_run(p_job, p_status, p_detail, p_error) $$;

-- ---------------------------------------------------------------- grants
revoke all on function
  private.record_job_run(text, text, jsonb, text), private.send_reconfirmation(uuid), private.reconfirm_booking(uuid),
  private.admin_send_reconfirmation(uuid), private.job_reconfirmation(), private.job_reminders(), private.job_housekeeping(),
  private.claim_emails(integer), private.finish_emails(jsonb), private.emails_sent_today(), private.mark_notifications_read(bigint[]),
  private.admin_job_runs()
  from public;
-- Service role: the Worker and the job runner.
grant execute on function
  private.record_job_run(text, text, jsonb, text), private.job_reconfirmation(), private.job_reminders(), private.job_housekeeping(),
  private.claim_emails(integer), private.finish_emails(jsonb), private.emails_sent_today()
  to service_role;
revoke all on function
  public.record_job_run(text, text, jsonb, text), public.claim_emails(integer), public.finish_emails(jsonb), public.emails_sent_today()
  from public, anon, authenticated;
grant execute on function
  public.record_job_run(text, text, jsonb, text), public.claim_emails(integer), public.finish_emails(jsonb), public.emails_sent_today()
  to service_role;
-- Signed-in people (admin checks inside).
grant execute on function private.admin_send_reconfirmation(uuid), private.mark_notifications_read(bigint[]), private.admin_job_runs() to authenticated;
revoke all on function public.admin_send_reconfirmation(uuid), public.mark_notifications_read(bigint[]), public.admin_job_runs() from public, anon;
grant execute on function public.admin_send_reconfirmation(uuid), public.mark_notifications_read(bigint[]), public.admin_job_runs() to authenticated;
-- The one-tap link works without signing in.
grant execute on function private.reconfirm_booking(uuid) to anon, authenticated;
revoke all on function public.reconfirm_booking(uuid) from public;
grant execute on function public.reconfirm_booking(uuid) to anon, authenticated;

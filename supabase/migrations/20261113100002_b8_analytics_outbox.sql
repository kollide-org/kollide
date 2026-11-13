-- B8.2 Server-side funnel events. The steps happen inside Postgres functions called straight from the browser, so the Worker never
-- sees them. Triggers queue them here, but ONLY for people who currently allow Analytics; the Worker sends the queue to PostHog
-- (EU) and checks consent again at that moment. The queue holds a user id, an event name and a few non-personal properties.

create table public.analytics_outbox (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id),
  event text not null check (event in ('signed_up', 'profile_completed', 'join_requested', 'request_approved', 'reconfirmed', 'checked_in', 'feedback_given', 'rebooked')),
  properties jsonb not null default '{}'::jsonb,
  dedupe_key text not null check (char_length(dedupe_key) <= 100),
  occurred_at timestamptz not null default now(),
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed', 'skipped')),
  attempts smallint not null default 0,
  last_error text check (char_length(last_error) <= 300),
  send_after timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index analytics_outbox_queue_idx on public.analytics_outbox (id) where status in ('queued', 'sending');
create index analytics_outbox_old_idx on public.analytics_outbox (created_at) where status in ('sent', 'failed', 'skipped');

alter table public.analytics_outbox enable row level security;
revoke all on table public.analytics_outbox from anon, authenticated;
grant select, insert, update, delete on public.analytics_outbox to service_role;
create policy analytics_outbox_closed on public.analytics_outbox for all to anon, authenticated using (false) with check (false);

-- ---------------------------------------------------------------- queueing
-- The only property names that can ever be queued. Anything else is dropped, so a name, an email or free text cannot slip in.
create function private.analytics_allowed_keys() returns text[]
language sql immutable set search_path = '' as $$
  select array['event_id', 'event_type', 'category_id', 'area_id', 'instant', 'same_host', 'method', 'kind', 'booking_status']
$$;

-- Queues one event if the person currently allows Analytics. Never raises: analytics must not break what the person is doing.
create function private.queue_analytics(p_user uuid, p_event text, p_props jsonb, p_dedupe text, p_at timestamptz default now()) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null or not private.has_analytics_consent(p_user) then return; end if;
  insert into public.analytics_outbox (user_id, event, properties, dedupe_key, occurred_at)
  values (p_user, p_event,
          coalesce((select jsonb_object_agg(k, v) from jsonb_each(coalesce(p_props, '{}'::jsonb)) as e (k, v) where k = any (private.analytics_allowed_keys())), '{}'::jsonb),
          p_dedupe, p_at)
  on conflict (user_id, dedupe_key) do nothing;
exception when others then
  null;
end
$$;

create function private.analytics_event_props(p_event uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('event_id', e.id, 'event_type', e.type, 'category_id', e.category_id, 'area_id', e.area_id) from public.events e where e.id = p_event
$$;

-- Withdrawing drops what is still waiting. The first yes queues sign-up, but only for someone who has not finished onboarding
-- (an existing member consenting later would otherwise report an old sign-up as new).
create or replace function private.on_analytics_consent(p_user uuid, p_granted boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not p_granted then
    delete from public.analytics_outbox where user_id = p_user and status in ('queued', 'sending');
    return;
  end if;
  if exists (select 1 from public.profiles where id = p_user and onboarding_completed_at is null) then
    perform private.queue_analytics(p_user, 'signed_up', '{}'::jsonb, 'signed_up', coalesce((select created_at from auth.users where id = p_user), now()));
  end if;
end
$$;

-- ---------------------------------------------------------------- the funnel, as triggers (no existing function is rewritten)
create function private.analytics_on_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.queue_analytics(new.id, 'profile_completed', '{}'::jsonb, 'profile_completed');
  return null;
exception when others then return null;
end
$$;
create trigger analytics_profile_completed after update of onboarding_completed_at on public.profiles
  for each row when (old.onboarding_completed_at is null and new.onboarding_completed_at is not null) execute function private.analytics_on_profile();

create function private.analytics_on_booking() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  props jsonb := private.analytics_event_props(new.event_id);
  same_host boolean;
begin
  if tg_op = 'INSERT' then
    perform private.queue_analytics(new.user_id, 'join_requested', props || jsonb_build_object('booking_status', new.status), 'join:' || new.id);
    if exists (select 1 from public.bookings b where b.user_id = new.user_id and b.status = 'attended' and b.event_id <> new.event_id) then
      same_host := exists (select 1 from public.bookings b join public.events e1 on e1.id = b.event_id join public.events e2 on e2.id = new.event_id
                            where b.user_id = new.user_id and b.status = 'attended' and e1.host_id = e2.host_id and b.event_id <> new.event_id);
      perform private.queue_analytics(new.user_id, 'rebooked', props || jsonb_build_object('same_host', same_host), 'rebooked:' || new.id);
    end if;
    if new.status = 'approved' then
      perform private.queue_analytics(new.user_id, 'request_approved', props || jsonb_build_object('instant', true), 'approved:' || new.id);
    end if;
  elsif new.status = 'approved' and old.status <> 'approved' then
    perform private.queue_analytics(new.user_id, 'request_approved', props || jsonb_build_object('instant', false), 'approved:' || new.id);
  elsif new.status = 'confirmed' and old.status <> 'confirmed' then
    perform private.queue_analytics(new.user_id, 'reconfirmed', props, 'reconfirmed:' || new.id);
  end if;
  return null;
exception when others then return null;
end
$$;
create trigger analytics_bookings after insert or update of status on public.bookings
  for each row execute function private.analytics_on_booking();

create function private.analytics_on_checkin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.queue_analytics(new.user_id, 'checked_in', private.analytics_event_props(new.event_id) || jsonb_build_object('method', new.method), 'checkin:' || new.booking_id);
  return null;
exception when others then return null;
end
$$;
create trigger analytics_checkins after insert on public.checkins for each row execute function private.analytics_on_checkin();

-- One feedback_given per person per event (tags or a host rating, whichever comes first). A private "felt off" note never produces one.
create function private.analytics_on_feedback() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.queue_analytics(new.from_user, 'feedback_given', private.analytics_event_props(new.event_id) || jsonb_build_object('kind', tg_argv[0]), 'feedback:' || new.event_id);
  return null;
exception when others then return null;
end
$$;
create trigger analytics_tags after insert on public.tag_awards for each row execute function private.analytics_on_feedback('tags');
create trigger analytics_host_ratings after insert on public.host_ratings for each row execute function private.analytics_on_feedback('host_rating');

-- ---------------------------------------------------------------- claim and finish (service role: the Worker)
-- Rows whose person no longer allows Analytics are skipped here, even if they were queued while they did.
create function private.claim_analytics_events(p_limit integer)
returns table (id bigint, event text, user_id uuid, properties jsonb, occurred_at timestamptz, attempts smallint)
language plpgsql security definer set search_path = '' as $$
begin
  update public.analytics_outbox o set status = 'skipped', last_error = 'no consent'
   where o.id in (select x.id from public.analytics_outbox x where x.status in ('queued', 'sending') and x.send_after <= now() order by x.id limit 200 for update skip locked)
     and not private.has_analytics_consent(o.user_id);
  return query
    with picked as (
      select x.id from public.analytics_outbox x
       where x.status in ('queued', 'sending') and x.send_after <= now()
       order by x.id limit greatest(least(p_limit, 50), 0) for update skip locked
    ), updated as (
      update public.analytics_outbox o set status = 'sending', attempts = o.attempts + 1, send_after = now() + interval '10 minutes'
        from picked where o.id = picked.id
      returning o.id, o.event, o.user_id, o.properties, o.occurred_at, o.attempts
    )
    select u.id, u.event, u.user_id, u.properties, u.occurred_at, u.attempts from updated u order by u.id;
end
$$;

create function private.finish_analytics_events(p_results jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb;
  o public.analytics_outbox;
begin
  for r in select * from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) loop
    select * into o from public.analytics_outbox where id = (r ->> 'id')::bigint for update;
    continue when not found;
    case r ->> 'outcome'
      when 'sent' then update public.analytics_outbox set status = 'sent', last_error = null where id = o.id;
      when 'skipped' then update public.analytics_outbox set status = 'skipped', last_error = left(r ->> 'error', 300) where id = o.id;
      when 'retry' then
        if o.attempts >= 4 then update public.analytics_outbox set status = 'failed', last_error = left(r ->> 'error', 300) where id = o.id;
        else update public.analytics_outbox set status = 'queued', send_after = now() + (power(2, o.attempts) * interval '1 minute'), last_error = left(r ->> 'error', 300) where id = o.id;
        end if;
      else update public.analytics_outbox set status = 'failed', last_error = left(r ->> 'error', 300) where id = o.id;
    end case;
  end loop;
end
$$;

create function public.claim_analytics_events(p_limit integer)
returns table (id bigint, event text, user_id uuid, properties jsonb, occurred_at timestamptz, attempts smallint)
language sql set search_path = '' as $$ select * from private.claim_analytics_events(p_limit) $$;
create function public.finish_analytics_events(p_results jsonb) returns void
language sql set search_path = '' as $$ select private.finish_analytics_events(p_results) $$;

revoke all on function
  private.analytics_allowed_keys(), private.queue_analytics(uuid, text, jsonb, text, timestamptz), private.analytics_event_props(uuid),
  private.analytics_on_profile(), private.analytics_on_booking(), private.analytics_on_checkin(), private.analytics_on_feedback(),
  private.claim_analytics_events(integer), private.finish_analytics_events(jsonb)
  from public;
grant execute on function private.claim_analytics_events(integer), private.finish_analytics_events(jsonb) to service_role;
revoke all on function public.claim_analytics_events(integer), public.finish_analytics_events(jsonb) from public, anon, authenticated;
grant execute on function public.claim_analytics_events(integer), public.finish_analytics_events(jsonb) to service_role;

-- ---------------------------------------------------------------- the job: a minute-by-minute call to the Worker, only when something waits
create function private.cron_flush_analytics() returns void
language plpgsql security definer set search_path = '' as $$
declare
  url text;
  secret text;
begin
  if not exists (select 1 from public.analytics_outbox where status in ('queued', 'sending') and send_after <= now()) then
    perform private.record_job_run('flush-analytics', 'ok', jsonb_build_object('queued', 0), null);
    return;
  end if;
  select decrypted_secret into url from vault.decrypted_secrets where name = 'worker_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'job_shared_secret';
  if url is null or secret is null then
    perform private.record_job_run('flush-analytics', 'skipped', jsonb_build_object('reason', 'worker_url or job_shared_secret is not set in Vault'), null);
    return;
  end if;
  perform net.http_post(
    url := rtrim(url, '/') || '/jobs/flush-analytics',
    headers := jsonb_build_object('content-type', 'application/json', 'x-job-secret', secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
exception when others then
  perform private.record_job_run('flush-analytics', 'error', null, sqlerrm);
end
$$;
revoke all on function private.cron_flush_analytics() from public;
grant execute on function private.cron_flush_analytics() to service_role;
select cron.schedule('flush-analytics', '* * * * *', 'select private.cron_flush_analytics()');

-- every cron job needs a line here (the admin job-health page and a test rely on it)
create or replace function private.job_schedule() returns table (job text, every_minutes integer)
language sql immutable set search_path = '' as $$
  values ('flush-email', 1), ('flush-analytics', 1), ('reconfirmation', 15), ('reminders', 30), ('housekeeping', 1440),
         ('attendance', 30), ('reputation', 15), ('feedback-windows', 60), ('reputation-nightly', 1440)
$$;

-- ---------------------------------------------------------------- housekeeping and account deletion
create or replace function private.job_housekeeping() returns void
language plpgsql security definer set search_path = '' as $$
declare
  a integer; b integer; c integer; d integer;
begin
  begin
    delete from public.rate_limits where window_start < now() - interval '3 days';
    get diagnostics a = row_count;
    delete from public.email_outbox where status in ('sent', 'failed', 'skipped') and created_at < now() - interval '30 days';
    get diagnostics b = row_count;
    delete from public.notifications where read_at is not null and read_at < now() - interval '90 days';
    get diagnostics c = row_count;
    delete from public.analytics_outbox where status in ('sent', 'failed', 'skipped') and created_at < now() - interval '30 days';
    get diagnostics d = row_count;
    perform private.record_job_run('housekeeping', 'ok', jsonb_build_object('rate_limits', a, 'emails', b, 'notifications', c, 'analytics_events', d), null);
  exception when others then
    perform private.record_job_run('housekeeping', 'error', null, sqlerrm);
  end;
end
$$;

-- The queue is transient delivery state (it holds a user id and an event name until sent, and is purged after 30 days), so it is
-- not part of export_my_data. Deleting the account deletes the person's rows.
create or replace function private.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if exists (select 1 from public.profiles where id = uid and deleted_at is not null) then
    return; -- already deleted
  end if;

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

-- B7.4 Partner links with click counts, and job health.

-- ---------------------------------------------------------------- partner clicks
-- One counter per event per day. No person, no IP, nothing personal: only "how many people we sent".
create table public.partner_click_counts (
  event_id uuid not null references public.events (id) on delete cascade,
  day date not null,
  clicks integer not null default 0 check (clicks >= 0),
  primary key (event_id, day)
);
alter table public.partner_click_counts enable row level security;
revoke all on table public.partner_click_counts from anon, authenticated;
grant select, insert, update, delete on public.partner_click_counts to service_role;
create policy partner_click_counts_closed on public.partner_click_counts for all to anon, authenticated using (false) with check (false);

-- Called by the Worker's /go redirect (service role). A click on anything that is not a published partner event is ignored.
create function private.record_partner_click(p_event uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.events where id = p_event and type = 'partner' and status = 'published') then return; end if;
  insert into public.partner_click_counts (event_id, day, clicks) values (p_event, (now() at time zone 'utc')::date, 1)
  on conflict (event_id, day) do update set clicks = public.partner_click_counts.clicks + 1;
end
$$;

create function private.admin_list_partner_events()
returns table (event_id uuid, title text, status public.event_status, starts_at timestamptz, host_first_name text, partner_url text, referral_code text,
               clicks_7d bigint, clicks_30d bigint, clicks_total bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query
    select e.id, e.title, e.status, e.starts_at, p.first_name, e.partner_url, e.referral_code,
           coalesce(sum(c.clicks) filter (where c.day > (now() at time zone 'utc')::date - 7), 0)::bigint,
           coalesce(sum(c.clicks) filter (where c.day > (now() at time zone 'utc')::date - 30), 0)::bigint,
           coalesce(sum(c.clicks), 0)::bigint
      from public.events e
      join public.profiles p on p.id = e.host_id
      left join public.partner_click_counts c on c.event_id = e.id
     where e.type = 'partner'
     group by e.id, p.first_name
     order by e.starts_at desc;
end
$$;

-- Edits the ticket link and referral code of a partner event at any stage (the host form locks them once published).
create function private.admin_set_partner_link(p_event uuid, p_url text, p_referral text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_url text := btrim(p_url);
  v_ref text := nullif(btrim(p_referral), '');
begin
  perform private.require_admin();
  if v_url is null or v_url !~ '^https://[^[:space:]]+$' or char_length(v_url) > 500 then raise exception 'partner_url_required'; end if;
  if v_ref is not null and v_ref !~ '^[A-Za-z0-9_-]{1,40}$' then raise exception 'invalid_input'; end if;
  update public.events set partner_url = v_url, referral_code = v_ref where id = p_event and type = 'partner';
  if not found then raise exception 'not_found'; end if;
end
$$;

-- The link and code are admin decisions: record them (never recorded before).
drop trigger audit_events on public.events;
create trigger audit_events after insert or update or delete on public.events
  for each row execute function private.audit_change('host_id', 'type', 'title', 'status', 'pricing_mode', 'review_note', 'partner_url', 'referral_code');

-- ---------------------------------------------------------------- job health
-- How often each scheduled job should run. A test makes sure every cron job has a line here.
create function private.job_schedule() returns table (job text, every_minutes integer)
language sql immutable set search_path = '' as $$
  values ('flush-email', 1), ('reconfirmation', 15), ('reminders', 30), ('housekeeping', 1440),
         ('attendance', 30), ('reputation', 15), ('feedback-windows', 60), ('reputation-nightly', 1440)
$$;

create function private.admin_job_health()
returns table (job text, last_started_at timestamptz, last_finished_at timestamptz, last_status text, last_detail jsonb, last_error text,
               run_count bigint, error_count bigint, every_minutes integer, late boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query
    select s.job, j.last_started_at, j.last_finished_at, j.last_status, j.last_detail, j.last_error, coalesce(j.run_count, 0), coalesce(j.error_count, 0),
           s.every_minutes,
           -- late = never ran, or nothing for twice its interval plus 5 minutes
           j.last_finished_at is null or j.last_finished_at < now() - (s.every_minutes * 2 + 5) * interval '1 minute'
      from private.job_schedule() s left join public.job_runs j on j.job = s.job
     order by s.job;
end
$$;

-- Emails sent today (UTC day) against the daily cap. The cap is the Worker's number: it records it with every flush; 280 until then.
create function private.admin_email_usage() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_cap integer;
begin
  perform private.require_admin();
  select coalesce((last_detail ->> 'daily_cap')::integer, 280) into v_cap from public.job_runs where job = 'flush-email';
  v_cap := coalesce(v_cap, 280);
  return jsonb_build_object(
    'sent_today', private.emails_sent_today(), 'daily_cap', v_cap, 'warn_at', floor(v_cap * 0.8)::integer,
    'queued', (select count(*) from public.email_outbox where status in ('queued', 'sending')),
    'failed_24h', (select count(*) from public.email_outbox where status = 'failed' and created_at > now() - interval '24 hours'));
end
$$;

-- ---------------------------------------------------------------- wrappers and grants
create function public.record_partner_click(p_event uuid) returns void language sql set search_path = '' as $$ select private.record_partner_click(p_event) $$;
create function public.admin_list_partner_events()
returns table (event_id uuid, title text, status public.event_status, starts_at timestamptz, host_first_name text, partner_url text, referral_code text,
               clicks_7d bigint, clicks_30d bigint, clicks_total bigint)
language sql stable set search_path = '' as $$ select * from private.admin_list_partner_events() $$;
create function public.admin_set_partner_link(p_event uuid, p_url text, p_referral text default null) returns void
language sql set search_path = '' as $$ select private.admin_set_partner_link(p_event, p_url, p_referral) $$;
create function public.admin_job_health()
returns table (job text, last_started_at timestamptz, last_finished_at timestamptz, last_status text, last_detail jsonb, last_error text,
               run_count bigint, error_count bigint, every_minutes integer, late boolean)
language sql stable set search_path = '' as $$ select * from private.admin_job_health() $$;
create function public.admin_email_usage() returns jsonb language sql stable set search_path = '' as $$ select private.admin_email_usage() $$;

revoke all on function
  private.record_partner_click(uuid), private.admin_list_partner_events(), private.admin_set_partner_link(uuid, text, text),
  private.job_schedule(), private.admin_job_health(), private.admin_email_usage()
  from public;
grant execute on function private.record_partner_click(uuid) to service_role;
grant execute on function private.admin_list_partner_events(), private.admin_set_partner_link(uuid, text, text), private.admin_job_health(), private.admin_email_usage() to authenticated;
revoke all on function public.record_partner_click(uuid) from public, anon, authenticated;
grant execute on function public.record_partner_click(uuid) to service_role;
revoke all on function public.admin_list_partner_events(), public.admin_set_partner_link(uuid, text, text), public.admin_job_health(), public.admin_email_usage() from public, anon;
grant execute on function public.admin_list_partner_events(), public.admin_set_partner_link(uuid, text, text), public.admin_job_health(), public.admin_email_usage() to authenticated;

-- ---------------------------------------------------------------- admin actions that change no audited row
-- Two older admin helpers change nothing that a row trigger sees (an email is queued; attendance may only be flagged), so they
-- record themselves. Every admin action leaves an audit entry.
create function private.audit_event(p_table text, p_pk text, p_data jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.audit_log (actor_id, action, table_name, row_pk, new_data) values ((select auth.uid()), 'UPDATE', p_table, p_pk, p_data)
$$;
revoke all on function private.audit_event(text, text, jsonb) from public;

create or replace function private.admin_send_reconfirmation(p_booking uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'not_allowed'; end if;
  perform private.send_reconfirmation(p_booking);
  perform private.audit_event('bookings', p_booking::text, jsonb_build_object('admin_action', 'send_reconfirmation'));
end
$$;

create or replace function private.admin_finalise_event_now(p_event uuid, p_mark_no_shows boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare
  r text;
begin
  perform private.require_active((select auth.uid()));
  if not private.is_admin() then raise exception 'not_allowed'; end if;
  r := private.finalise_event(p_event, true, p_mark_no_shows);
  perform private.reveal_closed_tags();
  perform private.refresh_reputation();
  perform private.audit_event('events', p_event::text, jsonb_build_object('admin_action', 'finalise_event_now', 'result', r, 'mark_no_shows', p_mark_no_shows));
  return r;
end
$$;

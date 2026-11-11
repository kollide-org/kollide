-- Joining events (B5): bookings, squads, the email outbox, in-app notifications, job status and rate limits.
-- Payments are OFF in v1. The reserved booking states (pending_payment, paid, expired, refunded) are never written;
-- a trigger refuses them. hold_expires_at is reserved for the P1 payment hold.

-- ---------------------------------------------------------------- squads (created before bookings reference them)
create table public.squads (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  creator_id uuid not null references public.profiles (id),
  name text check (char_length(btrim(name)) between 1 and 40),
  meeting_point text not null check (char_length(btrim(meeting_point)) between 3 and 200),
  status text not null default 'forming' check (status in ('forming', 'cancelled')),
  created_at timestamptz not null default now()
);
create index squads_event_idx on public.squads (event_id) where status = 'forming';
create index squads_creator_idx on public.squads (creator_id);

create table public.squad_members (
  squad_id uuid not null references public.squads (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  event_id uuid not null references public.events (id) on delete cascade,
  status text not null default 'requested' check (status in ('requested', 'approved', 'declined', 'left')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  primary key (squad_id, user_id)
);
-- One live squad membership per person per event.
create unique index squad_members_one_per_event on public.squad_members (event_id, user_id) where status in ('requested', 'approved');
create index squad_members_user_idx on public.squad_members (user_id);

-- ---------------------------------------------------------------- bookings
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  status public.booking_status not null default 'requested',
  squad_id uuid references public.squads (id) on delete set null,
  requested_at timestamptz not null default now(),
  waitlisted_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  hold_expires_at timestamptz, -- RESERVED for P1: the 15-minute payment hold
  reconfirm_token uuid not null default gen_random_uuid(),
  reconfirm_requested_at timestamptz,
  reconfirm_by timestamptz,
  reconfirmed_at timestamptz,
  reminded_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text check (char_length(cancel_reason) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- One live booking per person per event. A person who cancelled may request again.
create unique index bookings_one_live on public.bookings (event_id, user_id) where status <> 'cancelled';
create unique index bookings_token_idx on public.bookings (reconfirm_token);
create index bookings_event_status_idx on public.bookings (event_id, status);
create index bookings_user_idx on public.bookings (user_id, status);
create index bookings_squad_idx on public.bookings (squad_id) where squad_id is not null;
create index bookings_waitlist_idx on public.bookings (event_id, waitlisted_at) where status = 'waitlisted';
create index bookings_reconfirm_idx on public.bookings (reconfirm_by) where status = 'approved' and reconfirm_requested_at is not null;

-- Allowed moves. Reserved payment states stay unused in v1, and only reconfirm_booking reaches 'confirmed'.
create function private.enforce_booking_rules() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status in ('pending_payment', 'paid', 'expired', 'refunded') and not private.payments_enabled() then
    raise exception 'payments_disabled' using errcode = 'check_violation';
  end if;
  if tg_op = 'INSERT' then
    if new.status not in ('requested', 'approved', 'waitlisted') then
      raise exception 'invalid_booking_status' using errcode = 'check_violation';
    end if;
  elsif new.status <> old.status then
    if not (
      (old.status = 'requested' and new.status in ('approved', 'waitlisted', 'declined', 'cancelled'))
      or (old.status = 'waitlisted' and new.status in ('approved', 'requested', 'declined', 'cancelled'))
      or (old.status = 'approved' and new.status in ('confirmed', 'cancelled', 'attended', 'no_show'))
      or (old.status = 'confirmed' and new.status in ('cancelled', 'attended', 'no_show'))
    ) then
      raise exception 'invalid_booking_change' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end
$$;
create trigger bookings_rules before insert or update on public.bookings for each row execute function private.enforce_booking_rules();
create trigger bookings_touch before update on public.bookings for each row execute function private.touch_updated_at();
create trigger audit_bookings after insert or update of status or delete on public.bookings
  for each row execute function private.audit_change('event_id', 'user_id', 'status', 'cancel_reason');

-- ---------------------------------------------------------------- email outbox (the Worker sends it, see /jobs/flush-email)
create table public.email_outbox (
  id bigint generated always as identity primary key,
  template text not null check (template in ('request_received', 'booking_approved', 'booking_waitlisted', 'booking_declined',
    'still_coming', 'day_of_reminder', 'event_cancelled')),
  user_id uuid not null references public.profiles (id),
  data jsonb not null default '{}'::jsonb,
  priority smallint not null default 2 check (priority in (1, 2)), -- 1 = critical, 2 = normal
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed', 'skipped')),
  attempts smallint not null default 0,
  last_error text check (char_length(last_error) <= 300),
  send_after timestamptz not null default now(),
  provider_message_id text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index email_outbox_queue_idx on public.email_outbox (priority, id) where status = 'queued';
create index email_outbox_sent_idx on public.email_outbox (sent_at) where status = 'sent';
create index email_outbox_user_idx on public.email_outbox (user_id);

-- ---------------------------------------------------------------- in-app notifications
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id),
  kind text not null check (char_length(kind) between 1 and 40),
  title text not null check (char_length(title) <= 120),
  body text check (char_length(body) <= 300),
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

-- ---------------------------------------------------------------- job status (one row per job: the last run)
create table public.job_runs (
  job text primary key,
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_status text check (last_status in ('ok', 'warning', 'error', 'skipped')),
  last_detail jsonb,
  last_error text check (char_length(last_error) <= 300),
  run_count bigint not null default 0,
  error_count bigint not null default 0
);

-- ---------------------------------------------------------------- rate limits
create table public.rate_limits (
  user_id uuid not null,
  action text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (user_id, action, window_start)
);

-- ---------------------------------------------------------------- RLS and privileges
alter table public.bookings enable row level security;
alter table public.squads enable row level security;
alter table public.squad_members enable row level security;
alter table public.email_outbox enable row level security;
alter table public.notifications enable row level security;
alter table public.job_runs enable row level security;
alter table public.rate_limits enable row level security;
revoke all on table public.bookings, public.squads, public.squad_members, public.email_outbox, public.notifications,
  public.job_runs, public.rate_limits from anon, authenticated;
grant select, insert, update, delete on public.bookings, public.squads, public.squad_members, public.email_outbox,
  public.notifications, public.job_runs, public.rate_limits to service_role;

create function private.is_squad_creator(p_squad uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.squads where id = p_squad and creator_id = (select auth.uid()))
$$;
revoke all on function private.is_squad_creator(uuid) from public;
grant execute on function private.is_squad_creator(uuid) to authenticated;

-- A booking is visible to its owner, the event's host and admins. The reconfirm token is not granted to anyone:
-- it only travels in the email.
grant select (id, event_id, user_id, status, squad_id, requested_at, waitlisted_at, decided_by, decided_at,
  reconfirm_requested_at, reconfirm_by, reconfirmed_at, cancelled_at, cancel_reason, created_at, updated_at)
  on public.bookings to authenticated;
create policy bookings_read on public.bookings for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_event_host(event_id)) or (select private.is_admin()));

-- Forming squads are visible to signed-in members, without the meeting point (members get it from get_squad).
grant select (id, event_id, creator_id, name, status, created_at) on public.squads to authenticated;
create policy squads_read on public.squads for select to authenticated
  using (status = 'forming' or creator_id = (select auth.uid()) or (select private.is_admin()));

grant select on public.squad_members to authenticated;
create policy squad_members_read on public.squad_members for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_squad_creator(squad_id)) or (select private.is_admin()));

create policy email_outbox_closed on public.email_outbox for all to anon, authenticated using (false) with check (false);
create policy rate_limits_closed on public.rate_limits for all to anon, authenticated using (false) with check (false);

grant select on public.notifications to authenticated;
create policy notifications_read on public.notifications for select to authenticated using (user_id = (select auth.uid()));

grant select on public.job_runs to authenticated;
create policy job_runs_admin_read on public.job_runs for select to authenticated using ((select private.is_admin()));

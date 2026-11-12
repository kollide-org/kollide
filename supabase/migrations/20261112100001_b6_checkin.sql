-- B6.1 Check-in and attendance.
-- Each booking has a random check-in token (the QR code). The host or an admin scans it, or taps a name. The
-- `checkins` table is the source of truth for attendance; two hours after an event ends a job turns it into
-- attended / no_show on the booking (finalise_event, called from the jobs in B6.6).

-- ---------------------------------------------------------------- columns
-- Like reconfirm_token: random, unique, never granted to the browser. The owner reads it through my_checkin_token().
alter table public.bookings add column checkin_token uuid not null default gen_random_uuid();
create unique index bookings_checkin_token_idx on public.bookings (checkin_token);

-- Set once, by finalise_event: when attendance was counted and when the 72-hour feedback window closes.
-- Not granted to the browser; people get window state through my_feedback_tasks().
alter table public.events
  add column attendance_finalised_at timestamptz,
  add column feedback_closes_at timestamptz;
create index events_unfinalised_idx on public.events (ends_at) where attendance_finalised_at is null;

-- ---------------------------------------------------------------- new emails
alter table public.email_outbox drop constraint email_outbox_template_check;
alter table public.email_outbox add constraint email_outbox_template_check check (template in (
  'request_received', 'booking_approved', 'booking_waitlisted', 'booking_declined', 'still_coming', 'day_of_reminder', 'event_cancelled',
  'feedback_prompt', 'safety_report_ack', 'admin_alert', 'account_on_hold'));

-- ---------------------------------------------------------------- tables
create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  checked_in_by uuid references public.profiles (id) on delete set null,
  method text not null check (method in ('qr', 'manual')),
  created_at timestamptz not null default now()
);
create index checkins_event_idx on public.checkins (event_id);
create index checkins_user_idx on public.checkins (user_id);

-- Flags for admins to look at (B6 writes them, B7 builds the queue to resolve them). Nothing here changes anyone's
-- account by itself.
create table public.review_flags (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('no_checkins', 'collusion', 'retaliation', 'low_host_score', 'repeat_event_group')),
  subject_user_id uuid references public.profiles (id),
  event_id uuid references public.events (id) on delete cascade,
  ref_key text not null check (char_length(ref_key) <= 200), -- what makes a flag unique, so the nightly job does not repeat it
  details jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  unique (kind, ref_key)
);
create index review_flags_open_idx on public.review_flags (created_at) where status = 'open';

create trigger audit_checkins after insert or delete on public.checkins
  for each row execute function private.audit_change('event_id', 'user_id', 'method', 'checked_in_by');

-- ---------------------------------------------------------------- RLS and privileges (the browser only reads)
alter table public.checkins enable row level security;
alter table public.review_flags enable row level security;
revoke all on table public.checkins, public.review_flags from anon, authenticated;
grant select, insert, update, delete on public.checkins, public.review_flags to service_role;

grant select on public.checkins to authenticated;
create policy checkins_read on public.checkins for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_event_host(event_id)) or (select private.is_admin()));

grant select on public.review_flags to authenticated;
create policy review_flags_admin_read on public.review_flags for select to authenticated using ((select private.is_admin()));

-- ---------------------------------------------------------------- helpers
-- The one place that refuses people who are on hold, suspended or banned. Called by every write function.
create function private.require_active(p_uid uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_uid is null then raise exception 'not_signed_in'; end if;
  if not private.is_user_active(p_uid) then raise exception 'not_active'; end if;
end
$$;

-- Tells every admin about something (in-app only; emails go through queue_email where they are worth it).
create function private.notify_admins(p_kind text, p_title text, p_body text, p_data jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, kind, title, body, data)
  select ur.user_id, p_kind, p_title, p_body, coalesce(p_data, '{}'::jsonb) from public.user_roles ur where ur.role = 'admin'
$$;

-- ---------------------------------------------------------------- check in
-- Host or admin only. From 2 hours before the start to 4 hours after it. Only approved or confirmed bookings.
create function private.check_in_booking(p_booking uuid, p_method text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  b public.bookings;
  e public.events;
  v_id uuid;
begin
  perform private.require_active(uid);
  select * into b from public.bookings where id = p_booking;
  if not found then raise exception 'not_found'; end if;
  select * into e from public.events where id = b.event_id;
  if e.host_id <> uid and not private.is_admin() then raise exception 'not_allowed'; end if;
  if e.status not in ('published', 'completed') then raise exception 'event_not_open'; end if;
  if now() < e.starts_at - interval '2 hours' or now() > e.starts_at + interval '4 hours' then raise exception 'outside_window'; end if;
  if b.status not in ('approved', 'confirmed') then raise exception 'booking_not_active'; end if;
  -- Someone on hold does not attend. The host only learns "not active", never why.
  if not private.is_user_active(b.user_id) then raise exception 'attendee_not_active'; end if;
  begin
    insert into public.checkins (booking_id, event_id, user_id, checked_in_by, method)
    values (b.id, b.event_id, b.user_id, uid, p_method) returning id into v_id;
  exception when unique_violation then
    raise exception 'already_checked_in';
  end;
  return jsonb_build_object('checkin_id', v_id, 'booking_id', b.id, 'user_id', b.user_id, 'method', p_method,
    'first_name', (select first_name from public.profiles where id = b.user_id),
    'photo_key', (select ph.r2_key from public.profile_photos ph where ph.user_id = b.user_id order by ph.position limit 1));
end
$$;

create function private.check_in(p_token uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_booking uuid;
begin
  perform private.require_active((select auth.uid()));
  select id into v_booking from public.bookings where checkin_token = p_token;
  if v_booking is null then raise exception 'not_found'; end if;
  return private.check_in_booking(v_booking, 'qr');
end
$$;

create function private.check_in_manual(p_booking uuid) returns jsonb
language sql security definer set search_path = '' as $$
  select private.check_in_booking(p_booking, 'manual')
$$;

-- The attendee's own QR token. Only for a live booking on an event that has not ended.
create function private.my_checkin_token(p_booking uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  v uuid;
begin
  perform private.require_active(uid);
  select b.checkin_token into v
    from public.bookings b join public.events e on e.id = b.event_id
   where b.id = p_booking and b.user_id = uid and b.status in ('approved', 'confirmed')
     and e.status = 'published' and e.ends_at > now();
  if v is null then raise exception 'not_found'; end if;
  return v;
end
$$;

-- The host's check-in screen: everyone who holds a seat, and who has been ticked off.
create function private.host_checkin_list(p_event uuid)
returns table (booking_id uuid, user_id uuid, first_name text, photo_key text, status public.booking_status, squad_name text,
               checked_in boolean, checked_in_at timestamptz, method text)
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  e public.events;
begin
  perform private.require_active(uid);
  select * into e from public.events where id = p_event;
  if not found then raise exception 'not_found'; end if;
  if e.host_id <> uid and not private.is_admin() then raise exception 'not_allowed'; end if;
  return query
    select b.id, b.user_id, p.first_name,
           (select ph.r2_key from public.profile_photos ph where ph.user_id = b.user_id order by ph.position limit 1),
           b.status, s.name, c.id is not null, c.created_at, c.method
      from public.bookings b
      join public.profiles p on p.id = b.user_id
      left join public.squads s on s.id = b.squad_id
      left join public.checkins c on c.booking_id = b.id
     where b.event_id = p_event and b.status in ('approved', 'confirmed', 'attended', 'no_show')
     order by (c.id is not null), p.first_name, b.requested_at;
end
$$;

-- ---------------------------------------------------------------- counting attendance
-- Two hours after an event ends (or earlier, by an admin): checked in -> attended, everyone else with a seat -> no_show,
-- and the 72-hour feedback window opens. SAFETY RULE: if the event has seats but nobody was checked in at all, the host
-- most likely forgot, so nobody is marked no_show. Admins get a flag instead and decide.
create function private.finalise_event(p_event uuid, p_skip_wait boolean default false, p_mark_no_shows boolean default false) returns text
language plpgsql security definer set search_path = '' as $$
declare
  e public.events;
  b public.bookings;
  seats integer;
  checked integer;
  flagged uuid;
begin
  select * into e from public.events where id = p_event for update;
  if not found or e.status not in ('published', 'completed') then return 'skipped'; end if;
  if e.attendance_finalised_at is not null then return 'already'; end if;
  if e.ends_at > now() or (not p_skip_wait and e.ends_at + interval '2 hours' > now()) then return 'too_early'; end if;

  select count(*) into seats from public.bookings where event_id = p_event and status in ('approved', 'confirmed');
  select count(*) into checked from public.checkins where event_id = p_event;

  if seats > 0 and checked = 0 and not p_mark_no_shows then
    insert into public.review_flags (kind, event_id, ref_key, details)
    values ('no_checkins', p_event, p_event::text, jsonb_build_object('event_title', e.title, 'seats', seats))
    on conflict (kind, ref_key) do nothing
    returning id into flagged;
    if flagged is not null then
      perform private.notify_admins('no_checkins', 'An event ended with no check-ins', e.title, jsonb_build_object('event_id', p_event));
    end if;
    return 'no_checkins';
  end if;

  update public.events set status = 'completed' where id = p_event and status = 'published';
  for b in select * from public.bookings where event_id = p_event and status in ('approved', 'confirmed') for update loop
    if exists (select 1 from public.checkins c where c.booking_id = b.id) then
      update public.bookings set status = 'attended' where id = b.id;
      perform private.notify(b.user_id, 'attended', 'Thanks for coming', e.title, jsonb_build_object('event_id', p_event, 'booking_id', b.id));
    elsif not private.is_user_active(b.user_id) then
      -- Someone who was put on hold could not be checked in. That must not leave a lasting no-show on their record,
      -- even if the hold is later overturned, so their booking is simply left as it was.
      continue;
    else
      update public.bookings set status = 'no_show' where id = b.id;
      perform private.notify(b.user_id, 'no_show', 'We missed you at ' || e.title, 'Plans change. Cancelling in advance helps hosts and keeps your record good.',
        jsonb_build_object('event_id', p_event, 'booking_id', b.id));
    end if;
  end loop;

  update public.events
     set attendance_finalised_at = now(), feedback_closes_at = case when checked > 0 then now() + interval '72 hours' else now() end
   where id = p_event;

  -- The window opens for everyone who was there, the host included.
  if checked > 0 then
    for b in select bk.* from public.bookings bk join public.checkins c on c.booking_id = bk.id where bk.event_id = p_event loop
      perform private.queue_email(b.user_id, 'feedback_prompt', private.event_email_data(p_event) || jsonb_build_object('closes_at', now() + interval '72 hours'), 2);
      perform private.notify(b.user_id, 'feedback_open', 'How was ' || e.title || '?', 'Share a few kind words. It takes a minute.', jsonb_build_object('event_id', p_event));
    end loop;
    perform private.queue_email(e.host_id, 'feedback_prompt', private.event_email_data(p_event) || jsonb_build_object('closes_at', now() + interval '72 hours'), 2);
    perform private.notify(e.host_id, 'feedback_open', 'How was ' || e.title || '?', 'Share a few kind words about your guests.', jsonb_build_object('event_id', p_event));
  end if;
  return 'finalised';
end
$$;

-- ---------------------------------------------------------------- wrappers and grants
create function public.check_in(p_token uuid) returns jsonb language sql set search_path = '' as $$ select private.check_in(p_token) $$;
create function public.check_in_manual(p_booking uuid) returns jsonb language sql set search_path = '' as $$ select private.check_in_manual(p_booking) $$;
create function public.my_checkin_token(p_booking uuid) returns uuid language sql stable set search_path = '' as $$ select private.my_checkin_token(p_booking) $$;
create function public.host_checkin_list(p_event uuid)
returns table (booking_id uuid, user_id uuid, first_name text, photo_key text, status public.booking_status, squad_name text,
               checked_in boolean, checked_in_at timestamptz, method text)
language sql stable set search_path = '' as $$ select * from private.host_checkin_list(p_event) $$;

revoke all on function
  private.require_active(uuid), private.notify_admins(text, text, text, jsonb), private.check_in_booking(uuid, text), private.check_in(uuid),
  private.check_in_manual(uuid), private.my_checkin_token(uuid), private.host_checkin_list(uuid), private.finalise_event(uuid, boolean, boolean)
  from public;
grant execute on function
  private.check_in(uuid), private.check_in_manual(uuid), private.my_checkin_token(uuid), private.host_checkin_list(uuid)
  to authenticated;
grant execute on function private.finalise_event(uuid, boolean, boolean) to service_role;
revoke all on function public.check_in(uuid), public.check_in_manual(uuid), public.my_checkin_token(uuid), public.host_checkin_list(uuid) from public, anon;
grant execute on function public.check_in(uuid), public.check_in_manual(uuid), public.my_checkin_token(uuid), public.host_checkin_list(uuid) to authenticated;

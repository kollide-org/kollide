-- Joining events (B5): the seat-locking join function, the host's decisions, cancelling, the waitlist,
-- and the redefinition of the three stubs that B4 left for bookings.
-- Pattern: logic is SECURITY DEFINER in `private`; `public.<name>` is a thin SECURITY INVOKER wrapper.

-- ---------------------------------------------------------------- helpers
create function private.notify(p_user uuid, p_kind text, p_title text, p_body text, p_data jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, kind, title, body, data) values (p_user, p_kind, p_title, p_body, coalesce(p_data, '{}'::jsonb))
$$;

-- Every state change that needs an email goes through here: the Worker sends the queue (see /jobs/flush-email).
-- Emails never contain the exact address; they point to the event page.
create function private.queue_email(p_user uuid, p_template text, p_data jsonb, p_priority integer default 2) returns void
language sql security definer set search_path = '' as $$
  insert into public.email_outbox (user_id, template, data, priority) values (p_user, p_template, coalesce(p_data, '{}'::jsonb), p_priority)
$$;

-- Counts one action per person per UTC day and refuses once the limit is passed.
create function private.check_rate_limit(p_user uuid, p_action text, p_max integer) returns void
language plpgsql security definer set search_path = '' as $$
declare
  w timestamptz := (date_trunc('day', now() at time zone 'utc')) at time zone 'utc';
  n integer;
begin
  insert into public.rate_limits (user_id, action, window_start, count) values (p_user, p_action, w, 1)
  on conflict (user_id, action, window_start) do update set count = public.rate_limits.count + 1
  returning count into n;
  if n > p_max then raise exception 'rate_limited'; end if;
end
$$;

create function private.event_email_data(p_event uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('event_id', e.id, 'event_title', e.title, 'starts_at', e.starts_at, 'area_name', a.label)
    from public.events e join public.areas a on a.id = e.area_id where e.id = p_event
$$;

-- ---------------------------------------------------------------- the three stubs from B4, now real
-- A requested booking holds a seat (see PAYMENTS_LATER.md). P1 adds pending_payment and paid when payments are on.
create or replace function private.event_taken_seats(p_event uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.bookings
   where event_id = p_event
     and (status in ('requested', 'approved', 'confirmed', 'attended')
          or (status in ('pending_payment', 'paid') and private.payments_enabled()))
$$;

-- Photo keys of up to 5 verified, active people who are going.
create or replace function private.event_attendee_photos(p_event uuid) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(x.key), '{}'::text[]) from (
    select distinct on (b.user_id) ph.r2_key as key
      from public.bookings b
      join public.profiles p on p.id = b.user_id and p.is_verified and p.deleted_at is null
      join public.profile_private pp on pp.id = b.user_id and pp.status = 'active'
      join public.profile_photos ph on ph.user_id = b.user_id
     where b.event_id = p_event and b.status in ('approved', 'confirmed', 'attended')
     order by b.user_id, ph.position
     limit 5
  ) x
$$;

-- The exact address rule: approved or confirmed bookings (the host and admins are handled by get_event_address).
create or replace function private.user_has_booking_access(p_user uuid, p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.bookings where user_id = p_user and event_id = p_event and status in ('approved', 'confirmed'))
$$;

-- ---------------------------------------------------------------- squads helper used when people leave or cancel
create function private.detach_from_squads(p_user uuid, p_event uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  s public.squads;
begin
  -- A creator who leaves ends the squad.
  for s in select * from public.squads where event_id = p_event and creator_id = p_user and status = 'forming' loop
    update public.squads set status = 'cancelled' where id = s.id;
    update public.bookings set squad_id = null where squad_id = s.id;
    update public.squad_members set status = 'left', decided_at = now() where squad_id = s.id and status in ('requested', 'approved');
  end loop;
  update public.squad_members set status = 'left', decided_at = now()
   where event_id = p_event and user_id = p_user and status in ('requested', 'approved');
  update public.bookings set squad_id = null where event_id = p_event and user_id = p_user and squad_id is not null;
end
$$;

-- ---------------------------------------------------------------- the waitlist
-- Oldest first. Runs whenever a seat is freed. A person the host waitlisted (decided_by set) goes straight to approved;
-- someone who was waitlisted automatically on a host-approval event goes back to requested for the host to decide.
create function private.promote_waitlist(p_event uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  e public.events;
  w public.bookings;
  promoted integer := 0;
begin
  select * into e from public.events where id = p_event for update;
  if not found or e.status <> 'published' or e.starts_at <= now() or e.capacity is null then return 0; end if;
  loop
    exit when private.event_taken_seats(p_event) >= e.capacity;
    select * into w from public.bookings where event_id = p_event and status = 'waitlisted'
     order by waitlisted_at, id limit 1 for update;
    exit when not found;
    if e.approval_mode = 'instant' or w.decided_by is not null then
      update public.bookings set status = 'approved', waitlisted_at = null, decided_at = now() where id = w.id;
      perform private.queue_email(w.user_id, 'booking_approved', private.event_email_data(p_event) || jsonb_build_object('booking_id', w.id, 'promoted', true), 1);
      perform private.notify(w.user_id, 'booking_promoted', 'A spot opened up', 'You are in: ' || e.title, jsonb_build_object('event_id', p_event, 'booking_id', w.id));
    else
      update public.bookings set status = 'requested', waitlisted_at = null where id = w.id;
      perform private.notify(w.user_id, 'request_back_in', 'A spot opened up', 'The host will decide on your request for ' || e.title, jsonb_build_object('event_id', p_event, 'booking_id', w.id));
      perform private.notify(e.host_id, 'new_request', 'A request is waiting', e.title, jsonb_build_object('event_id', p_event, 'booking_id', w.id));
    end if;
    promoted := promoted + 1;
  end loop;
  return promoted;
end
$$;

-- ---------------------------------------------------------------- THE join function
-- Every booking path goes through here (request_to_join, and squads). It locks the event row so two people cannot
-- take the last seat at the same moment.
create function private.join_event(p_uid uuid, p_event uuid, p_squad uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me public.profile_private;
  prof public.profiles;
  e public.events;
  age integer;
  taken integer;
  v_status public.booking_status;
  v_id uuid;
  who text;
begin
  if p_uid is null then raise exception 'not_signed_in'; end if;
  select * into me from public.profile_private where id = p_uid;
  if not found or me.status <> 'active' then raise exception 'not_active'; end if;
  select * into prof from public.profiles where id = p_uid;
  if prof.onboarding_completed_at is null then raise exception 'not_onboarded'; end if;
  perform private.check_rate_limit(p_uid, 'join_request', 20);

  -- Serialise everyone who asks for a seat in this event.
  select * into e from public.events where id = p_event for update;
  if not found or e.status <> 'published' then raise exception 'not_found'; end if;
  if e.type = 'partner' then raise exception 'partner_event'; end if;
  if e.host_id = p_uid then raise exception 'own_event'; end if;
  if e.starts_at <= now() then raise exception 'event_started'; end if;
  if not private.is_user_active(e.host_id) then raise exception 'not_found'; end if;
  if exists (select 1 from public.user_blocks
              where (blocker_id = p_uid and blocked_id = e.host_id) or (blocker_id = e.host_id and blocked_id = p_uid)) then
    raise exception 'not_allowed'; -- the same answer either way, so nobody learns who blocked whom
  end if;
  if e.women_only and me.gender is distinct from 'woman' then raise exception 'women_only'; end if;
  age := private.age_from_dob(me.date_of_birth);
  if age is null or age < e.min_age or (e.max_age is not null and age > e.max_age) then raise exception 'age_not_allowed'; end if;
  if exists (select 1 from public.bookings where event_id = p_event and user_id = p_uid and status <> 'cancelled') then
    raise exception 'already_requested';
  end if;

  -- ===== PAID EVENTS (P1) =====
  -- Payments are off in v1. P1 replaces the second raise with: create a 'pending_payment' booking with
  -- hold_expires_at = now() + interval '15 minutes', return it, and let the payment webhook confirm it.
  if e.pricing_mode = 'paid' then
    if not private.payments_enabled() then raise exception 'payments_disabled'; end if;
    raise exception 'payments_not_implemented';
  end if;
  -- ===== free, pay at venue and cost split =====

  taken := private.event_taken_seats(p_event);
  if e.capacity is not null and taken >= e.capacity then
    v_status := 'waitlisted';
  elsif e.approval_mode = 'instant' then
    v_status := 'approved';
  else
    v_status := 'requested';
  end if;

  begin
    insert into public.bookings (event_id, user_id, status, squad_id, waitlisted_at)
    values (p_event, p_uid, v_status, p_squad, case when v_status = 'waitlisted' then now() end)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'already_requested';
  end;

  if v_status = 'approved' then
    perform private.queue_email(p_uid, 'booking_approved', private.event_email_data(p_event) || jsonb_build_object('booking_id', v_id), 1);
    perform private.notify(p_uid, 'booking_approved', 'You are in', e.title, jsonb_build_object('event_id', p_event, 'booking_id', v_id));
  elsif v_status = 'waitlisted' then
    perform private.queue_email(p_uid, 'booking_waitlisted', private.event_email_data(p_event) || jsonb_build_object('booking_id', v_id), 2);
    perform private.notify(p_uid, 'booking_waitlisted', 'You are on the waitlist', e.title, jsonb_build_object('event_id', p_event, 'booking_id', v_id));
  else
    perform private.queue_email(p_uid, 'request_received', private.event_email_data(p_event) || jsonb_build_object('booking_id', v_id), 2);
    perform private.notify(p_uid, 'request_received', 'Request sent', e.title, jsonb_build_object('event_id', p_event, 'booking_id', v_id));
  end if;
  who := coalesce(prof.first_name, 'Someone');
  perform private.notify(e.host_id, case when v_status = 'requested' then 'new_request' else 'new_guest' end,
    case when v_status = 'requested' then who || ' asked to join' when v_status = 'approved' then who || ' joined' else who || ' joined the waitlist' end,
    e.title, jsonb_build_object('event_id', p_event, 'booking_id', v_id));
  return jsonb_build_object('booking_id', v_id, 'status', v_status);
end
$$;

create function private.request_to_join(p_event uuid) returns jsonb
language sql security definer set search_path = '' as $$
  select private.join_event((select auth.uid()), p_event, null)
$$;

-- ---------------------------------------------------------------- the host decides
create function private.decide_request(p_booking uuid, p_decision text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  e public.events;
  b public.bookings;
  limit_seats integer;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if p_decision not in ('approve', 'waitlist', 'decline') then raise exception 'invalid_decision'; end if;
  select event_id into b.event_id from public.bookings where id = p_booking;
  if b.event_id is null then raise exception 'not_found'; end if;
  select * into e from public.events where id = b.event_id for update; -- same lock order as joining
  if e.host_id <> uid and not private.is_admin() then raise exception 'not_allowed'; end if;
  if (select status from public.profile_private where id = uid) is distinct from 'active' then raise exception 'not_active'; end if;
  select * into b from public.bookings where id = p_booking for update;
  if b.status not in ('requested', 'waitlisted') then raise exception 'invalid_booking_change'; end if;

  if p_decision = 'approve' then
    if b.status = 'waitlisted' then
      -- Overbooking: approve beyond capacity, up to capacity x (1 + overbook_pct / 100).
      limit_seats := floor(e.capacity * (1 + e.overbook_pct / 100.0));
      if private.event_taken_seats(e.id) + 1 > limit_seats then raise exception 'event_full'; end if;
    end if;
    update public.bookings set status = 'approved', waitlisted_at = null, decided_by = uid, decided_at = now() where id = b.id;
    perform private.queue_email(b.user_id, 'booking_approved', private.event_email_data(e.id) || jsonb_build_object('booking_id', b.id), 1);
    perform private.notify(b.user_id, 'booking_approved', 'You are in', e.title, jsonb_build_object('event_id', e.id, 'booking_id', b.id));
  elsif p_decision = 'waitlist' then
    if b.status = 'waitlisted' then raise exception 'invalid_booking_change'; end if;
    update public.bookings set status = 'waitlisted', waitlisted_at = now(), decided_by = uid, decided_at = now() where id = b.id;
    perform private.queue_email(b.user_id, 'booking_waitlisted', private.event_email_data(e.id) || jsonb_build_object('booking_id', b.id), 2);
    perform private.notify(b.user_id, 'booking_waitlisted', 'You are on the waitlist', e.title, jsonb_build_object('event_id', e.id, 'booking_id', b.id));
    perform private.promote_waitlist(e.id);
  else
    update public.bookings set status = 'declined', waitlisted_at = null, decided_by = uid, decided_at = now() where id = b.id;
    perform private.detach_from_squads(b.user_id, e.id);
    -- Gentle wording: the email and the notice never say "rejected".
    perform private.queue_email(b.user_id, 'booking_declined', private.event_email_data(e.id) || jsonb_build_object('booking_id', b.id), 2);
    perform private.notify(b.user_id, 'booking_declined', 'An update on your request', 'This one is not going to work out. There are more events waiting for you.', jsonb_build_object('event_id', e.id, 'booking_id', b.id));
    perform private.promote_waitlist(e.id);
  end if;
end
$$;

-- ---------------------------------------------------------------- cancelling
create function private.cancel_my_booking(p_booking uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  e public.events;
  b public.bookings;
  held boolean;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select event_id into b.event_id from public.bookings where id = p_booking and user_id = uid;
  if b.event_id is null then raise exception 'not_found'; end if;
  select * into e from public.events where id = b.event_id for update;
  select * into b from public.bookings where id = p_booking for update;
  if b.status not in ('requested', 'approved', 'waitlisted', 'confirmed') then raise exception 'invalid_booking_change'; end if;
  held := b.status in ('requested', 'approved', 'confirmed');
  update public.bookings set status = 'cancelled', cancelled_at = now(), cancel_reason = 'cancelled_by_user', waitlisted_at = null where id = b.id;
  perform private.detach_from_squads(uid, e.id);
  if b.status in ('approved', 'confirmed') then
    perform private.notify(e.host_id, 'booking_cancelled', coalesce((select first_name from public.profiles where id = uid), 'A guest') || ' cancelled', e.title,
      jsonb_build_object('event_id', e.id, 'booking_id', b.id));
  end if;
  if held then perform private.promote_waitlist(e.id); end if;
end
$$;

-- ---------------------------------------------------------------- when an event is cancelled, so are its bookings
create function private.on_event_cancelled() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
begin
  for b in select * from public.bookings where event_id = new.id and status in ('requested', 'approved', 'waitlisted', 'confirmed') for update loop
    update public.bookings set status = 'cancelled', cancelled_at = now(), cancel_reason = 'event_cancelled', waitlisted_at = null where id = b.id;
    perform private.queue_email(b.user_id, 'event_cancelled', private.event_email_data(new.id) || jsonb_build_object('booking_id', b.id), 1);
    perform private.notify(b.user_id, 'event_cancelled', 'An event was cancelled', new.title, jsonb_build_object('event_id', new.id, 'booking_id', b.id));
  end loop;
  update public.squads set status = 'cancelled' where event_id = new.id and status = 'forming';
  update public.squad_members set status = 'left', decided_at = now() where event_id = new.id and status in ('requested', 'approved');
  return null;
end
$$;
create trigger events_cancel_bookings after update of status on public.events
  for each row when (new.status = 'cancelled' and old.status <> 'cancelled') execute function private.on_event_cancelled();

-- ---------------------------------------------------------------- reading
-- The host's inbox: who is asking, shown as profile cards. Phone, date of birth and gender are never included.
-- "Shows up X of Y" and top tags are placeholders until B6 (attendance and reviews).
create function private.host_inbox(p_event uuid)
returns table (
  booking_id uuid, user_id uuid, status public.booking_status, requested_at timestamptz, squad_id uuid, squad_name text,
  first_name text, age integer, area_id smallint, is_verified boolean, photo_keys text[], interest_ids smallint[],
  language_ids smallint[], bio_prompts jsonb, shows_up_attended integer, shows_up_total integer, top_tags jsonb, events_in_common integer
)
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  e public.events;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into e from public.events where id = p_event;
  if not found then raise exception 'not_found'; end if;
  if e.host_id <> uid and not private.is_admin() then raise exception 'not_allowed'; end if;
  return query
    select b.id, b.user_id, b.status, b.requested_at, b.squad_id, s.name,
           p.first_name, private.age_of(b.user_id), p.area_id, p.is_verified,
           coalesce((select array_agg(ph.r2_key order by ph.position) from public.profile_photos ph where ph.user_id = b.user_id), '{}'::text[]),
           coalesce((select array_agg(pi.interest_id order by pi.interest_id) from public.profile_interests pi where pi.user_id = b.user_id), '{}'::smallint[]),
           coalesce((select array_agg(pl.language_id order by pl.language_id) from public.profile_languages pl where pl.user_id = b.user_id), '{}'::smallint[]),
           p.bio_prompts,
           0, 0, '[]'::jsonb,
           (select count(distinct e2.id)::integer
              from public.bookings bb join public.events e2 on e2.id = bb.event_id
             where bb.user_id = b.user_id and bb.status in ('approved', 'confirmed', 'attended') and e2.id <> p_event
               and (e2.host_id = e.host_id
                    or exists (select 1 from public.bookings hb where hb.event_id = e2.id and hb.user_id = e.host_id
                                and hb.status in ('approved', 'confirmed', 'attended'))))
      from public.bookings b
      join public.profiles p on p.id = b.user_id
      left join public.squads s on s.id = b.squad_id
     where b.event_id = p_event and b.status in ('requested', 'waitlisted', 'approved', 'confirmed')
     order by case b.status when 'requested' then 0 when 'waitlisted' then 1 when 'approved' then 2 else 3 end, b.requested_at;
end
$$;

create function private.my_bookings()
returns table (
  booking_id uuid, event_id uuid, status public.booking_status, event_title text, event_status public.event_status,
  starts_at timestamptz, ends_at timestamptz, area_name text, cover_key text, squad_id uuid, cancel_reason text,
  requested_at timestamptz, waitlist_position integer
)
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  return query
    select b.id, e.id, b.status, e.title, e.status, e.starts_at, e.ends_at, a.label, e.cover_key, b.squad_id, b.cancel_reason, b.requested_at,
           case when b.status = 'waitlisted' then
             (select count(*)::integer from public.bookings w where w.event_id = b.event_id and w.status = 'waitlisted'
                 and (w.waitlisted_at, w.id) <= (b.waitlisted_at, b.id)) end
      from public.bookings b
      join public.events e on e.id = b.event_id
      join public.areas a on a.id = e.area_id
     where b.user_id = uid
     order by e.starts_at desc;
end
$$;

-- The person's current booking for one event, or null (a cancelled booking counts as none).
create function private.get_my_booking(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  r jsonb;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select jsonb_build_object('booking_id', b.id, 'status', b.status, 'squad_id', b.squad_id,
           'waitlist_position', case when b.status = 'waitlisted' then
             (select count(*) from public.bookings w where w.event_id = b.event_id and w.status = 'waitlisted' and (w.waitlisted_at, w.id) <= (b.waitlisted_at, b.id)) end)
    into r
    from public.bookings b where b.event_id = p_event and b.user_id = uid and b.status <> 'cancelled';
  return r;
end
$$;

-- ---------------------------------------------------------------- public wrappers
create function public.request_to_join(p_event uuid) returns jsonb
language sql set search_path = '' as $$ select private.request_to_join(p_event) $$;
create function public.decide_request(p_booking uuid, p_decision text) returns void
language sql set search_path = '' as $$ select private.decide_request(p_booking, p_decision) $$;
create function public.cancel_my_booking(p_booking uuid) returns void
language sql set search_path = '' as $$ select private.cancel_my_booking(p_booking) $$;
create function public.get_my_booking(p_event uuid) returns jsonb
language sql stable set search_path = '' as $$ select private.get_my_booking(p_event) $$;
create function public.host_inbox(p_event uuid)
returns table (
  booking_id uuid, user_id uuid, status public.booking_status, requested_at timestamptz, squad_id uuid, squad_name text,
  first_name text, age integer, area_id smallint, is_verified boolean, photo_keys text[], interest_ids smallint[],
  language_ids smallint[], bio_prompts jsonb, shows_up_attended integer, shows_up_total integer, top_tags jsonb, events_in_common integer
) language sql stable set search_path = '' as $$ select * from private.host_inbox(p_event) $$;
create function public.my_bookings()
returns table (
  booking_id uuid, event_id uuid, status public.booking_status, event_title text, event_status public.event_status,
  starts_at timestamptz, ends_at timestamptz, area_name text, cover_key text, squad_id uuid, cancel_reason text,
  requested_at timestamptz, waitlist_position integer
) language sql stable set search_path = '' as $$ select * from private.my_bookings() $$;

-- ---------------------------------------------------------------- grants
revoke all on function
  private.notify(uuid, text, text, text, jsonb), private.queue_email(uuid, text, jsonb, integer), private.check_rate_limit(uuid, text, integer),
  private.event_email_data(uuid), private.detach_from_squads(uuid, uuid), private.promote_waitlist(uuid),
  private.join_event(uuid, uuid, uuid), private.request_to_join(uuid), private.decide_request(uuid, text), private.cancel_my_booking(uuid),
  private.on_event_cancelled(), private.host_inbox(uuid), private.my_bookings(), private.get_my_booking(uuid)
  from public;
-- Signed-in people (each function checks who they are).
grant execute on function
  private.request_to_join(uuid), private.decide_request(uuid, text), private.cancel_my_booking(uuid),
  private.host_inbox(uuid), private.my_bookings(), private.get_my_booking(uuid)
  to authenticated;
-- The job runner (service role) may promote waitlists.
grant execute on function private.promote_waitlist(uuid) to service_role;
revoke all on function
  public.request_to_join(uuid), public.decide_request(uuid, text), public.cancel_my_booking(uuid), public.get_my_booking(uuid),
  public.host_inbox(uuid), public.my_bookings()
  from public, anon;
grant execute on function
  public.request_to_join(uuid), public.decide_request(uuid, text), public.cancel_my_booking(uuid), public.get_my_booking(uuid),
  public.host_inbox(uuid), public.my_bookings()
  to authenticated;

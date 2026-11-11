-- Three stubs that B5 (bookings) redefines with `create or replace`, so the views never change.
-- B5: event_taken_seats counts bookings in requested, approved, confirmed and attended
-- (plus pending_payment and paid once payments are enabled, P1).
create function private.event_taken_seats(p_event uuid) returns integer
language sql stable security definer set search_path = '' as $$ select 0 $$;

-- B5: photo keys of up to 5 verified people who are going.
create function private.event_attendee_photos(p_event uuid) returns text[]
language sql stable security definer set search_path = '' as $$ select '{}'::text[] $$;

-- B5: true when the person has an approved or confirmed booking for the event.
create function private.user_has_booking_access(p_user uuid, p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$ select false $$;

revoke all on function private.event_taken_seats(uuid), private.event_attendee_photos(uuid),
  private.user_has_booking_access(uuid, uuid) from public;
grant execute on function private.event_taken_seats(uuid), private.event_attendee_photos(uuid),
  private.user_has_booking_access(uuid, uuid) to authenticated, service_role;

-- Published events for signed-in members. security_invoker: the caller's RLS applies, so events of hosts who are
-- on hold or deleted do not show. The address, partner link and review notes are never in this view.
create view public.event_cards with (security_invoker = true) as
select
  e.id, e.type, e.title, e.description, e.house_rules,
  e.category_id, c.label as category_name,
  e.area_id, a.label as area_name,
  e.starts_at, e.ends_at, e.capacity, e.overbook_pct, e.approval_mode,
  e.women_only, e.min_age, e.max_age,
  e.pricing_mode, e.price_label, e.house_party, e.cover_key,
  e.host_id, p.first_name as host_first_name, p.is_verified as host_is_verified,
  (e.type = 'partner') as has_partner_link,
  case when e.capacity is null then null else greatest(e.capacity - private.event_taken_seats(e.id), 0) end as spots_left,
  private.event_attendee_photos(e.id) as attendee_avatars
from public.events e
join public.areas a on a.id = e.area_id
left join public.categories c on c.id = e.category_id
join public.profiles p on p.id = e.host_id
where e.status = 'published';

revoke all on table public.event_cards from anon, authenticated;
grant select on public.event_cards to authenticated;

create view public.hub_cards with (security_invoker = true) as
select
  h.id, h.slug, h.title, h.subtitle, h.art_key, h.accent_color, h.starts_on, h.ends_on, h.sort_order,
  (select count(*)::integer from public.hub_events he join public.events e on e.id = he.event_id
    where he.hub_id = h.id and e.status = 'published') as event_count
from public.hubs h
where h.published;

revoke all on table public.hub_cards from anon, authenticated;
grant select on public.hub_cards to anon, authenticated;

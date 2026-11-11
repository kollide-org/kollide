-- Admin moderation, featured slots, hubs, and the read functions (search, featured, hub events, address).

-- ---------------------------------------------------------------- moderation
create function private.approve_event(p_event uuid, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  e public.events;
begin
  if uid is null or not private.is_admin() then raise exception 'not_allowed'; end if;
  select * into e from public.events where id = p_event for update;
  if not found then raise exception 'not_found'; end if;
  if e.status <> 'pending_review' then raise exception 'invalid_status_change'; end if;
  if e.starts_at <= now() then raise exception 'start_in_past'; end if;
  update public.events
     set status = 'published', published_at = now(), reviewed_by = uid, reviewed_at = now(),
         review_note = left(nullif(btrim(p_note), ''), 1000)
   where id = p_event;
end
$$;

create function private.reject_event(p_event uuid, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  e public.events;
  note text := nullif(btrim(p_note), '');
begin
  if uid is null or not private.is_admin() then raise exception 'not_allowed'; end if;
  if note is null then raise exception 'note_required'; end if;
  select * into e from public.events where id = p_event for update;
  if not found then raise exception 'not_found'; end if;
  if e.status <> 'pending_review' then raise exception 'invalid_status_change'; end if;
  update public.events
     set status = 'draft', reviewed_by = uid, reviewed_at = now(), review_note = left(note, 1000)
   where id = p_event;
end
$$;

-- For the B5 cron job (service role only): events that have ended become completed.
create function private.complete_ended_events() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  update public.events set status = 'completed' where status = 'published' and ends_at < now();
  get diagnostics n = row_count;
  return n;
end
$$;

-- ---------------------------------------------------------------- featured slots
create function private.feature_event(p_event uuid, p_position smallint, p_until timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null or not private.is_admin() then raise exception 'not_allowed'; end if;
  if p_position is null or p_position not between 1 and 6 then raise exception 'invalid_position'; end if;
  if not exists (select 1 from public.events where id = p_event and status = 'published') then
    raise exception 'event_not_published';
  end if;
  delete from public.featured_slots where position = p_position and event_id <> p_event;
  insert into public.featured_slots (event_id, position, featured_until, created_by)
  values (p_event, p_position, p_until, uid)
  on conflict (event_id) do update set position = excluded.position, featured_until = excluded.featured_until, created_by = excluded.created_by;
end
$$;

create function private.unfeature_event(p_event uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'not_allowed'; end if;
  delete from public.featured_slots where event_id = p_event;
end
$$;

-- ---------------------------------------------------------------- hubs
-- p_id null creates. The art key must be a hub_art key issued to this admin; the old art is queued for deletion.
create function private.admin_upsert_hub(
  p_id uuid, p_slug text, p_title text, p_subtitle text, p_accent_color text,
  p_starts_on date, p_ends_on date, p_sort_order integer, p_published boolean, p_art_key text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  v_id uuid := p_id;
  old_art text;
begin
  if uid is null or not private.is_admin() then raise exception 'not_allowed'; end if;
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'slug_invalid'; end if;
  if char_length(coalesce(btrim(p_title), '')) not between 3 and 80 then raise exception 'title_invalid'; end if;
  if p_accent_color is null or p_accent_color !~ '^#[0-9a-fA-F]{6}$' then raise exception 'color_invalid'; end if;
  if p_starts_on is not null and p_ends_on is not null and p_ends_on < p_starts_on then raise exception 'dates_invalid'; end if;

  if p_art_key is not null then
    perform private.consume_key(uid, p_art_key, 'hub_art');
  end if;

  begin
    if v_id is null then
      insert into public.hubs (slug, title, subtitle, accent_color, starts_on, ends_on, sort_order, published, art_key)
      values (p_slug, btrim(p_title), nullif(btrim(p_subtitle), ''), p_accent_color, p_starts_on, p_ends_on,
              coalesce(p_sort_order, 0), coalesce(p_published, false), p_art_key)
      returning id into v_id;
    else
      select art_key into old_art from public.hubs where id = v_id for update;
      if not found then raise exception 'not_found'; end if;
      update public.hubs
         set slug = p_slug, title = btrim(p_title), subtitle = nullif(btrim(p_subtitle), ''), accent_color = p_accent_color,
             starts_on = p_starts_on, ends_on = p_ends_on, sort_order = coalesce(p_sort_order, 0),
             published = coalesce(p_published, false), art_key = coalesce(p_art_key, art_key)
       where id = v_id;
      if p_art_key is not null and old_art is not null then
        insert into public.storage_deletions (bucket, key) values ('media', old_art) on conflict do nothing;
      end if;
    end if;
  exception when unique_violation then
    raise exception 'slug_taken';
  end;
  return v_id;
end
$$;

create function private.admin_set_hub_events(p_hub uuid, p_event_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'not_allowed'; end if;
  if not exists (select 1 from public.hubs where id = p_hub) then raise exception 'not_found'; end if;
  if cardinality(p_event_ids) <> (select count(distinct x) from unnest(p_event_ids) as x) then raise exception 'duplicate_events'; end if;
  delete from public.hub_events where hub_id = p_hub;
  insert into public.hub_events (hub_id, event_id, sort_order)
    select p_hub, e, (ord - 1)::integer from unnest(p_event_ids) with ordinality as t (e, ord);
end
$$;

create function private.admin_delete_hub(p_hub uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  old_art text;
begin
  if not private.is_admin() then raise exception 'not_allowed'; end if;
  delete from public.hubs where id = p_hub returning art_key into old_art;
  if not found then raise exception 'not_found'; end if;
  if old_art is not null then
    insert into public.storage_deletions (bucket, key) values ('media', old_art) on conflict do nothing;
  end if;
end
$$;

-- ---------------------------------------------------------------- the exact address
-- Only the host, admins, and people with approved or confirmed bookings (B5 fills user_has_booking_access).
create function private.get_event_address(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  e public.events;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into e from public.events where id = p_event;
  if not found then raise exception 'not_found'; end if;
  if not (
       e.host_id = uid
       or private.is_admin()
       or (e.status in ('published', 'completed') and private.user_has_booking_access(uid, p_event))
     ) then
    raise exception 'not_allowed';
  end if;
  return coalesce(
    (select jsonb_build_object('address', ep.address, 'lat', ep.lat, 'lng', ep.lng, 'directions_note', ep.directions_note)
       from public.event_private ep where ep.event_id = p_event),
    jsonb_build_object('address', null));
end
$$;

-- ---------------------------------------------------------------- read functions (run as the caller)
-- Upcoming published events. p_group_size means "at least this many spots left".
create function public.search_events(
  p_from timestamptz default null, p_to timestamptz default null,
  p_area_ids smallint[] default null, p_category_ids smallint[] default null,
  p_pricing public.pricing_mode[] default null, p_women_only boolean default null,
  p_group_size integer default null, p_types public.event_type[] default null,
  p_limit integer default 20, p_offset integer default 0
) returns setof public.event_cards
language sql stable set search_path = '' as $$
  select c.*
    from public.event_cards c
   where c.ends_at > now()
     and (p_from is null or c.starts_at >= p_from)
     and (p_to is null or c.starts_at < p_to)
     and (p_area_ids is null or c.area_id = any (p_area_ids))
     and (p_category_ids is null or c.category_id = any (p_category_ids))
     and (p_pricing is null or c.pricing_mode = any (p_pricing))
     and (p_types is null or c.type = any (p_types))
     and (p_women_only is not true or c.women_only)
     and (p_group_size is null or c.spots_left is null or c.spots_left >= p_group_size)
   order by c.starts_at, c.id
   limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0)
$$;

create function public.featured_event_cards() returns setof public.event_cards
language sql stable set search_path = '' as $$
  select c.*
    from public.event_cards c
    join public.featured_slots f on f.event_id = c.id
   where (f.featured_until is null or f.featured_until > now()) and c.ends_at > now()
   order by f.position
$$;

create function public.hub_event_cards(p_hub uuid) returns setof public.event_cards
language sql stable set search_path = '' as $$
  select c.*
    from public.event_cards c
    join public.hub_events he on he.event_id = c.id
   where he.hub_id = p_hub and c.ends_at > now()
   order by he.sort_order, c.starts_at
$$;

-- ---------------------------------------------------------------- public wrappers
create function public.approve_event(p_event uuid, p_note text default null) returns void
language sql set search_path = '' as $$ select private.approve_event(p_event, p_note) $$;
create function public.reject_event(p_event uuid, p_note text) returns void
language sql set search_path = '' as $$ select private.reject_event(p_event, p_note) $$;
create function public.complete_ended_events() returns integer
language sql set search_path = '' as $$ select private.complete_ended_events() $$;
create function public.feature_event(p_event uuid, p_position smallint, p_until timestamptz default null) returns void
language sql set search_path = '' as $$ select private.feature_event(p_event, p_position, p_until) $$;
create function public.unfeature_event(p_event uuid) returns void
language sql set search_path = '' as $$ select private.unfeature_event(p_event) $$;
create function public.admin_upsert_hub(
  p_id uuid, p_slug text, p_title text, p_subtitle text, p_accent_color text,
  p_starts_on date, p_ends_on date, p_sort_order integer, p_published boolean, p_art_key text default null
) returns uuid language sql set search_path = '' as $$
  select private.admin_upsert_hub(p_id, p_slug, p_title, p_subtitle, p_accent_color, p_starts_on, p_ends_on, p_sort_order, p_published, p_art_key)
$$;
create function public.admin_set_hub_events(p_hub uuid, p_event_ids uuid[]) returns void
language sql set search_path = '' as $$ select private.admin_set_hub_events(p_hub, p_event_ids) $$;
create function public.admin_delete_hub(p_hub uuid) returns void
language sql set search_path = '' as $$ select private.admin_delete_hub(p_hub) $$;
create function public.get_event_address(p_event uuid) returns jsonb
language sql stable set search_path = '' as $$ select private.get_event_address(p_event) $$;

-- ---------------------------------------------------------------- grants
revoke all on function
  private.approve_event(uuid, text), private.reject_event(uuid, text), private.complete_ended_events(),
  private.feature_event(uuid, smallint, timestamptz), private.unfeature_event(uuid),
  private.admin_upsert_hub(uuid, text, text, text, text, date, date, integer, boolean, text),
  private.admin_set_hub_events(uuid, uuid[]), private.admin_delete_hub(uuid), private.get_event_address(uuid)
  from public;
-- Service role only: the B5 cron job.
grant execute on function private.complete_ended_events() to service_role;
revoke all on function public.complete_ended_events() from public, anon, authenticated;
grant execute on function public.complete_ended_events() to service_role;

grant execute on function
  private.approve_event(uuid, text), private.reject_event(uuid, text),
  private.feature_event(uuid, smallint, timestamptz), private.unfeature_event(uuid),
  private.admin_upsert_hub(uuid, text, text, text, text, date, date, integer, boolean, text),
  private.admin_set_hub_events(uuid, uuid[]), private.admin_delete_hub(uuid), private.get_event_address(uuid)
  to authenticated;
revoke all on function
  public.approve_event(uuid, text), public.reject_event(uuid, text),
  public.feature_event(uuid, smallint, timestamptz), public.unfeature_event(uuid),
  public.admin_upsert_hub(uuid, text, text, text, text, date, date, integer, boolean, text),
  public.admin_set_hub_events(uuid, uuid[]), public.admin_delete_hub(uuid), public.get_event_address(uuid),
  public.search_events(timestamptz, timestamptz, smallint[], smallint[], public.pricing_mode[], boolean, integer, public.event_type[], integer, integer),
  public.featured_event_cards(), public.hub_event_cards(uuid)
  from public, anon;
grant execute on function
  public.approve_event(uuid, text), public.reject_event(uuid, text),
  public.feature_event(uuid, smallint, timestamptz), public.unfeature_event(uuid),
  public.admin_upsert_hub(uuid, text, text, text, text, date, date, integer, boolean, text),
  public.admin_set_hub_events(uuid, uuid[]), public.admin_delete_hub(uuid), public.get_event_address(uuid),
  public.search_events(timestamptz, timestamptz, smallint[], smallint[], public.pricing_mode[], boolean, integer, public.event_type[], integer, integer),
  public.featured_event_cards(), public.hub_event_cards(uuid)
  to authenticated;

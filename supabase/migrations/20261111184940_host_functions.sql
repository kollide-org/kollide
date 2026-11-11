-- Host flow: applying to host, creating, editing, submitting and cancelling events.
-- Same pattern as B2 and B3: logic is SECURITY DEFINER in `private`, `public.<name>` is a thin SECURITY INVOKER wrapper.

-- ---------------------------------------------------------------- host applications
-- Closed for direct writes: apply and review now go through functions (approval grants the host role).
drop policy host_applications_apply on public.host_applications;
drop policy host_applications_admin_review on public.host_applications;
revoke insert, update on public.host_applications from authenticated;

create function private.apply_to_host(p_message text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  msg text := btrim(p_message);
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if (select status from public.profile_private where id = uid) is distinct from 'active' then raise exception 'not_active'; end if;
  if not exists (select 1 from public.profiles where id = uid and onboarding_completed_at is not null) then
    raise exception 'not_onboarded';
  end if;
  if exists (select 1 from public.user_roles where user_id = uid and role in ('host', 'admin')) then
    raise exception 'already_host';
  end if;
  if msg is null or char_length(msg) not between 1 and 1000 then raise exception 'message_invalid'; end if;
  if exists (select 1 from public.host_applications where user_id = uid and status = 'pending') then
    raise exception 'application_pending';
  end if;
  insert into public.host_applications (user_id, message) values (uid, msg);
end
$$;

create function private.review_host_application(p_id uuid, p_approved boolean, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  app public.host_applications;
begin
  if uid is null or not private.is_admin() then raise exception 'not_allowed'; end if;
  select * into app from public.host_applications where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if app.status <> 'pending' then raise exception 'already_reviewed'; end if;
  update public.host_applications
     set status = case when p_approved then 'approved'::public.review_status else 'rejected'::public.review_status end,
         admin_note = nullif(btrim(p_note), ''), reviewed_by = uid, reviewed_at = now()
   where id = p_id;
  if p_approved then
    insert into public.user_roles (user_id, role, granted_by) values (app.user_id, 'host', uid) on conflict do nothing;
  end if;
end
$$;

create function private.admin_list_host_applications()
returns table (id uuid, user_id uuid, first_name text, message text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'not_allowed'; end if;
  return query
    select a.id, a.user_id, p.first_name, a.message, a.created_at
      from public.host_applications a join public.profiles p on p.id = a.user_id
     where a.status = 'pending' order by a.created_at;
end
$$;

-- ---------------------------------------------------------------- create and update
-- One function validates and writes both the public row and the private row (address and notes).
-- p_event is null to create. Only keys in `allowed` are read from p_input; the rest is ignored.
create function private.save_event(p_event uuid, p_input jsonb, p_uid uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  allowed constant text[] := array['type', 'title', 'description', 'category_id', 'area_id', 'starts_at', 'ends_at',
    'capacity', 'overbook_pct', 'approval_mode', 'women_only', 'min_age', 'max_age', 'house_rules', 'pricing_mode',
    'price_paise', 'price_label', 'house_party', 'partner_url', 'referral_code',
    'address', 'lat', 'lng', 'directions_note', 'host_notes'];
  unlocked constant text[] := array['description', 'house_rules', 'address', 'lat', 'lng', 'directions_note', 'host_notes'];
  is_admin boolean := private.is_admin();
  existing public.events;
  filtered jsonb;
  m jsonb;
  v_type public.event_type; v_title text; v_desc text; v_cat smallint; v_area smallint;
  v_start timestamptz; v_end timestamptz; v_cap integer; v_over smallint; v_appr public.approval_mode;
  v_women boolean; v_min smallint; v_max smallint; v_rules text;
  v_pricing public.pricing_mode; v_paise integer; v_label text; v_house boolean; v_purl text; v_ref text;
  v_addr text; v_lat double precision; v_lng double precision; v_dir text; v_notes text;
  v_id uuid;
begin
  filtered := coalesce((select jsonb_object_agg(k, v) from jsonb_each(coalesce(p_input, '{}'::jsonb)) as t (k, v) where k = any (allowed)), '{}'::jsonb);

  if p_event is null then
    m := filtered;
  else
    select * into existing from public.events where id = p_event for update;
    if existing.status = 'draft' then
      null;
    elsif existing.status = 'published' then
      if exists (select 1 from jsonb_object_keys(filtered) as k where k <> all (unlocked)) then raise exception 'event_locked'; end if;
    else
      raise exception 'event_locked';
    end if;
    if filtered ? 'type' and (filtered ->> 'type') is distinct from existing.type::text then raise exception 'type_locked'; end if;
    m := to_jsonb(existing) || coalesce((select to_jsonb(ep) - 'event_id' - 'updated_at' from public.event_private ep where ep.event_id = p_event), '{}'::jsonb) || filtered;
  end if;

  begin
    v_type := coalesce(nullif(m ->> 'type', '')::public.event_type, 'community');
    v_title := btrim(m ->> 'title');
    v_desc := coalesce(m ->> 'description', '');
    v_cat := nullif(m ->> 'category_id', '')::smallint;
    v_area := nullif(m ->> 'area_id', '')::smallint;
    v_start := nullif(m ->> 'starts_at', '')::timestamptz;
    v_end := nullif(m ->> 'ends_at', '')::timestamptz;
    v_cap := nullif(m ->> 'capacity', '')::integer;
    v_pricing := coalesce(nullif(m ->> 'pricing_mode', '')::public.pricing_mode, 'free');
    v_over := coalesce(nullif(m ->> 'overbook_pct', '')::smallint, case when v_pricing = 'free' then 30 else 0 end);
    v_appr := coalesce(nullif(m ->> 'approval_mode', '')::public.approval_mode, 'host_approval');
    v_women := coalesce((m ->> 'women_only')::boolean, false);
    v_min := coalesce(nullif(m ->> 'min_age', '')::smallint, 18);
    v_max := nullif(m ->> 'max_age', '')::smallint;
    v_rules := nullif(btrim(coalesce(m ->> 'house_rules', '')), '');
    v_paise := coalesce(nullif(m ->> 'price_paise', '')::integer, 0);
    v_label := nullif(btrim(coalesce(m ->> 'price_label', '')), '');
    v_house := coalesce((m ->> 'house_party')::boolean, false);
    v_purl := nullif(btrim(coalesce(m ->> 'partner_url', '')), '');
    v_ref := nullif(btrim(coalesce(m ->> 'referral_code', '')), '');
    v_addr := nullif(btrim(coalesce(m ->> 'address', '')), '');
    v_lat := nullif(m ->> 'lat', '')::double precision;
    v_lng := nullif(m ->> 'lng', '')::double precision;
    v_dir := nullif(btrim(coalesce(m ->> 'directions_note', '')), '');
    v_notes := nullif(btrim(coalesce(m ->> 'host_notes', '')), '');
  exception when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow
    or invalid_datetime_format or invalid_parameter_value then
    raise exception 'invalid_input';
  end;

  if v_type <> 'community' and not is_admin then raise exception 'not_allowed'; end if;
  if char_length(coalesce(v_title, '')) not between 3 and 120 then raise exception 'title_invalid'; end if;
  if char_length(v_desc) > 2000 then raise exception 'description_too_long'; end if;
  if v_rules is not null and char_length(v_rules) > 1000 then raise exception 'house_rules_too_long'; end if;
  if v_area is null or not exists (select 1 from public.areas where id = v_area and active) then raise exception 'area_required'; end if;
  if v_cat is not null and not exists (select 1 from public.categories where id = v_cat and active) then raise exception 'category_invalid'; end if;

  if p_event is null or existing.status = 'draft' then
    if v_start is null or v_end is null or v_end <= v_start then raise exception 'dates_invalid'; end if;
    if v_start <= now() then raise exception 'start_in_past'; end if;
  end if;

  if v_house then
    if v_type <> 'community' then raise exception 'house_party_type'; end if;
    v_appr := 'host_approval'; -- house parties always need the host's approval
    if v_cap is null or v_cap > 25 then raise exception 'house_party_limit'; end if;
  end if;
  if v_type <> 'partner' and (v_cap is null or v_cap not between 2 and 500) then raise exception 'capacity_invalid'; end if;
  if v_cap is not null and v_cap not between 2 and 500 then raise exception 'capacity_invalid'; end if;
  if v_over not between 0 and 50 then raise exception 'overbook_invalid'; end if;
  if v_min < 18 or v_min > 99 or (v_max is not null and (v_max < v_min or v_max > 99)) then raise exception 'age_invalid'; end if;

  if v_pricing = 'paid' or v_paise > 0 then
    if not private.payments_enabled() or v_type <> 'kollide' then raise exception 'payments_off'; end if;
  end if;
  if v_pricing in ('pay_at_venue', 'cost_split') and v_label is null then raise exception 'price_label_required'; end if;
  if v_label is not null and char_length(v_label) > 80 then raise exception 'price_label_invalid'; end if;
  if v_type = 'partner' and v_pricing not in ('free', 'pay_at_venue') then raise exception 'pricing_invalid'; end if;

  if v_type = 'partner' then
    if v_purl is null or v_purl !~ '^https://[^[:space:]]+$' or char_length(v_purl) > 500 then raise exception 'partner_url_required'; end if;
  elsif v_purl is not null or v_ref is not null then
    raise exception 'partner_fields_not_allowed';
  end if;
  if v_ref is not null and v_ref !~ '^[A-Za-z0-9_-]{1,40}$' then raise exception 'referral_code_invalid'; end if;
  if v_addr is not null and char_length(v_addr) not between 5 and 300 then raise exception 'address_invalid'; end if;
  if (v_lat is not null and v_lat not between -90 and 90) or (v_lng is not null and v_lng not between -180 and 180) then
    raise exception 'address_invalid';
  end if;
  if (v_dir is not null and char_length(v_dir) > 500) or (v_notes is not null and char_length(v_notes) > 1000) then
    raise exception 'address_invalid';
  end if;

  if p_event is null then
    insert into public.events (host_id, type, title, description, category_id, area_id, starts_at, ends_at, capacity, overbook_pct,
        approval_mode, women_only, min_age, max_age, house_rules, pricing_mode, price_paise, price_label, house_party,
        partner_url, referral_code)
    values (p_uid, v_type, v_title, v_desc, v_cat, v_area, v_start, v_end, v_cap, v_over, v_appr, v_women, v_min, v_max,
        v_rules, v_pricing, v_paise, v_label, v_house, v_purl, v_ref)
    returning id into v_id;
  else
    v_id := p_event;
    update public.events
       set title = v_title, description = v_desc, category_id = v_cat, area_id = v_area, starts_at = v_start, ends_at = v_end,
           capacity = v_cap, overbook_pct = v_over, approval_mode = v_appr, women_only = v_women, min_age = v_min,
           max_age = v_max, house_rules = v_rules, pricing_mode = v_pricing, price_paise = v_paise, price_label = v_label,
           house_party = v_house, partner_url = v_purl, referral_code = v_ref
     where id = v_id;
  end if;

  insert into public.event_private (event_id, address, lat, lng, directions_note, host_notes)
  values (v_id, v_addr, v_lat, v_lng, v_dir, v_notes)
  on conflict (event_id) do update
    set address = excluded.address, lat = excluded.lat, lng = excluded.lng,
        directions_note = excluded.directions_note, host_notes = excluded.host_notes;
  return v_id;
end
$$;

-- Shared by the functions below: the caller must be a host (or admin) and active.
create function private.require_host(p_uid uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_uid is null then raise exception 'not_signed_in'; end if;
  if (select status from public.profile_private where id = p_uid) is distinct from 'active' then raise exception 'not_active'; end if;
  if not exists (select 1 from public.user_roles where user_id = p_uid and role in ('host', 'admin')) then
    raise exception 'not_allowed';
  end if;
end
$$;

-- Returns the event row after checking the caller owns it (or is an admin).
create function private.owned_event(p_uid uuid, p_event uuid) returns public.events
language plpgsql stable security definer set search_path = '' as $$
declare
  e public.events;
begin
  select * into e from public.events where id = p_event;
  if not found then raise exception 'not_found'; end if;
  if e.host_id <> p_uid and not private.is_admin() then raise exception 'not_allowed'; end if;
  return e;
end
$$;

create function private.create_event(p_input jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  perform private.require_host(uid);
  return private.save_event(null, p_input, uid);
end
$$;

create function private.update_event(p_event uuid, p_input jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  perform private.require_host(uid);
  perform private.owned_event(uid, p_event);
  perform private.save_event(p_event, p_input, uid);
end
$$;

create function private.submit_event_for_review(p_event uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  e public.events;
begin
  perform private.require_host(uid);
  e := private.owned_event(uid, p_event);
  if e.status <> 'draft' then raise exception 'event_locked'; end if;
  if e.cover_key is null then raise exception 'cover_required'; end if;
  if e.starts_at <= now() + interval '1 hour' then raise exception 'start_in_past'; end if;
  if e.type <> 'partner' and not exists (
       select 1 from public.event_private where event_id = p_event and address is not null) then
    raise exception 'address_required';
  end if;
  update public.events set status = 'pending_review', submitted_at = now(), review_note = null where id = p_event;
end
$$;

create function private.cancel_event(p_event uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  e public.events;
begin
  perform private.require_host(uid);
  e := private.owned_event(uid, p_event);
  if e.status not in ('draft', 'pending_review', 'published') then raise exception 'event_locked'; end if;
  update public.events set status = 'cancelled', review_note = left(nullif(btrim(p_reason), ''), 1000) where id = p_event;
end
$$;

-- Everything the edit screen needs, including the fields the browser cannot select directly.
create function private.get_event_for_edit(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  e public.events;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  e := private.owned_event(uid, p_event);
  return to_jsonb(e) || coalesce((select to_jsonb(ep) - 'event_id' - 'updated_at' from public.event_private ep where ep.event_id = p_event), '{}'::jsonb);
end
$$;

create function private.my_events()
returns table (id uuid, title text, type public.event_type, status public.event_status, starts_at timestamptz, cover_key text, review_note text)
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  return query
    select e.id, e.title, e.type, e.status, e.starts_at, e.cover_key, e.review_note
      from public.events e where e.host_id = uid order by e.starts_at desc;
end
$$;

-- ---------------------------------------------------------------- public wrappers
create function public.apply_to_host(p_message text) returns void
language sql set search_path = '' as $$ select private.apply_to_host(p_message) $$;
create function public.review_host_application(p_id uuid, p_approved boolean, p_note text default null) returns void
language sql set search_path = '' as $$ select private.review_host_application(p_id, p_approved, p_note) $$;
create function public.admin_list_host_applications()
returns table (id uuid, user_id uuid, first_name text, message text, created_at timestamptz)
language sql stable set search_path = '' as $$ select * from private.admin_list_host_applications() $$;
create function public.create_event(p_input jsonb) returns uuid
language sql set search_path = '' as $$ select private.create_event(p_input) $$;
create function public.update_event(p_event uuid, p_input jsonb) returns void
language sql set search_path = '' as $$ select private.update_event(p_event, p_input) $$;
create function public.submit_event_for_review(p_event uuid) returns void
language sql set search_path = '' as $$ select private.submit_event_for_review(p_event) $$;
create function public.cancel_event(p_event uuid, p_reason text default null) returns void
language sql set search_path = '' as $$ select private.cancel_event(p_event, p_reason) $$;
create function public.get_event_for_edit(p_event uuid) returns jsonb
language sql stable set search_path = '' as $$ select private.get_event_for_edit(p_event) $$;
create function public.my_events()
returns table (id uuid, title text, type public.event_type, status public.event_status, starts_at timestamptz, cover_key text, review_note text)
language sql stable set search_path = '' as $$ select * from private.my_events() $$;

-- ---------------------------------------------------------------- grants (signed-in people only; each function checks the role)
revoke all on function
  private.apply_to_host(text), private.review_host_application(uuid, boolean, text), private.admin_list_host_applications(),
  private.save_event(uuid, jsonb, uuid), private.require_host(uuid), private.owned_event(uuid, uuid),
  private.create_event(jsonb), private.update_event(uuid, jsonb), private.submit_event_for_review(uuid),
  private.cancel_event(uuid, text), private.get_event_for_edit(uuid), private.my_events()
  from public;
grant execute on function
  private.apply_to_host(text), private.review_host_application(uuid, boolean, text), private.admin_list_host_applications(),
  private.create_event(jsonb), private.update_event(uuid, jsonb), private.submit_event_for_review(uuid),
  private.cancel_event(uuid, text), private.get_event_for_edit(uuid), private.my_events()
  to authenticated;
revoke all on function
  public.apply_to_host(text), public.review_host_application(uuid, boolean, text), public.admin_list_host_applications(),
  public.create_event(jsonb), public.update_event(uuid, jsonb), public.submit_event_for_review(uuid),
  public.cancel_event(uuid, text), public.get_event_for_edit(uuid), public.my_events()
  from public, anon;
grant execute on function
  public.apply_to_host(text), public.review_host_application(uuid, boolean, text), public.admin_list_host_applications(),
  public.create_event(jsonb), public.update_event(uuid, jsonb), public.submit_event_for_review(uuid),
  public.cancel_event(uuid, text), public.get_event_for_edit(uuid), public.my_events()
  to authenticated;

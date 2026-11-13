-- B9.1 Hardening: admin functions refuse admins who are on hold, rate limits on the write paths that had none, no sequence
-- privileges for anon, the payments switch cannot be flipped over the REST API, and indexes for the foreign keys that export,
-- deletion and safety queries use.

-- ---------------------------------------------------------------- admin functions: active admins only
-- (The B7 functions already use private.require_admin(); these older ones only checked the role.)
create or replace function private.review_host_application(p_id uuid, p_approved boolean, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  app public.host_applications;
begin
  perform private.require_admin(); -- an admin who is on hold or suspended is refused too
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

create or replace function private.review_verification(p_id uuid, p_approved boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  v public.verifications;
begin
  perform private.require_admin(); -- an admin who is on hold or suspended is refused too
  select * into v from public.verifications where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if v.user_id = uid then raise exception 'not_allowed'; end if; -- nobody reviews their own selfie
  if v.result <> 'pending' then raise exception 'already_reviewed'; end if;

  update public.verifications
     set result = case when p_approved then 'approved'::public.review_status else 'rejected'::public.review_status end,
         reviewer_id = uid, reviewed_at = now(), selfie_key = null
   where id = p_id;
  if v.selfie_key is not null then
    insert into public.storage_deletions (bucket, key) values ('private', v.selfie_key) on conflict do nothing;
  end if;
  if p_approved then
    update public.profiles set is_verified = true where id = v.user_id;
  end if;
end
$$;

create or replace function private.approve_event(p_event uuid, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  e public.events;
begin
  perform private.require_admin(); -- an admin who is on hold or suspended is refused too
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

create or replace function private.reject_event(p_event uuid, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  e public.events;
  note text := nullif(btrim(p_note), '');
begin
  perform private.require_admin(); -- an admin who is on hold or suspended is refused too
  if note is null then raise exception 'note_required'; end if;
  select * into e from public.events where id = p_event for update;
  if not found then raise exception 'not_found'; end if;
  if e.status <> 'pending_review' then raise exception 'invalid_status_change'; end if;
  update public.events
     set status = 'draft', reviewed_by = uid, reviewed_at = now(), review_note = left(note, 1000)
   where id = p_event;
end
$$;

create or replace function private.feature_event(p_event uuid, p_position smallint, p_until timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  perform private.require_admin(); -- an admin who is on hold or suspended is refused too
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

create or replace function private.unfeature_event(p_event uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin(); -- an admin who is on hold or suspended is refused too
  delete from public.featured_slots where event_id = p_event;
end
$$;

create or replace function private.admin_upsert_hub(
  p_id uuid, p_slug text, p_title text, p_subtitle text, p_accent_color text,
  p_starts_on date, p_ends_on date, p_sort_order integer, p_published boolean, p_art_key text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  v_id uuid := p_id;
  old_art text;
begin
  perform private.require_admin(); -- an admin who is on hold or suspended is refused too
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

create or replace function private.admin_set_hub_events(p_hub uuid, p_event_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin(); -- an admin who is on hold or suspended is refused too
  if not exists (select 1 from public.hubs where id = p_hub) then raise exception 'not_found'; end if;
  if cardinality(p_event_ids) <> (select count(distinct x) from unnest(p_event_ids) as x) then raise exception 'duplicate_events'; end if;
  delete from public.hub_events where hub_id = p_hub;
  insert into public.hub_events (hub_id, event_id, sort_order)
    select p_hub, e, (ord - 1)::integer from unnest(p_event_ids) with ordinality as t (e, ord);
end
$$;

create or replace function private.admin_delete_hub(p_hub uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  old_art text;
begin
  perform private.require_admin(); -- an admin who is on hold or suspended is refused too
  delete from public.hubs where id = p_hub returning art_key into old_art;
  if not found then raise exception 'not_found'; end if;
  if old_art is not null then
    insert into public.storage_deletions (bucket, key) values ('media', old_art) on conflict do nothing;
  end if;
end
$$;

create or replace function private.admin_list_host_applications()
returns table (id uuid, user_id uuid, first_name text, message text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin(); -- an admin who is on hold or suspended is refused too
  return query
    select a.id, a.user_id, p.first_name, a.message, a.created_at
      from public.host_applications a join public.profiles p on p.id = a.user_id
     where a.status = 'pending' order by a.created_at;
end
$$;

create or replace function private.admin_list_pending_verifications()
returns table (id uuid, user_id uuid, first_name text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin(); -- an admin who is on hold or suspended is refused too
  return query
    select v.id, v.user_id, p.first_name, v.created_at
      from public.verifications v join public.profiles p on p.id = v.user_id
     where v.result = 'pending' order by v.created_at;
end
$$;

create or replace function private.admin_send_reconfirmation(p_booking uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin(); -- an admin who is on hold or suspended is refused too
  perform private.send_reconfirmation(p_booking);
  perform private.audit_event('bookings', p_booking::text, jsonb_build_object('admin_action', 'send_reconfirmation'));
end
$$;

create or replace function private.admin_job_runs()
returns table (job text, last_finished_at timestamptz, last_status text, last_detail jsonb, last_error text, run_count bigint, error_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin(); -- an admin who is on hold or suspended is refused too
  return query select j.job, j.last_finished_at, j.last_status, j.last_detail, j.last_error, j.run_count, j.error_count from public.job_runs j order by j.job;
end
$$;

-- ---------------------------------------------------------------- rate limits (per person per UTC day; only successful actions count)
-- upload 60, squad_request 30, create_squad 10, apply_to_host 3, create_event 20, submit_event 10; record_consent also has a shared
-- bucket for logged-out visitors (anonymous ids can be made up).
create or replace function private.authorize_upload(
  p_user uuid, p_purpose text, p_event uuid, p_content_type text, p_size integer
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_status public.user_status;
  v_limit integer;
  v_prefix text;
  v_pending integer;
  v_key text;
begin
  if p_content_type is distinct from 'image/webp' then raise exception 'invalid_type'; end if;
  if p_purpose is null or p_purpose not in ('profile_photo', 'event_cover', 'hub_art', 'selfie') then
    raise exception 'invalid_purpose';
  end if;
  v_limit := case when p_purpose = 'selfie' then 512000 else 307200 end; -- hard caps; the browser aims for 150 KB
  if p_size is null or p_size < 1 or p_size > v_limit then raise exception 'too_large'; end if;

  select status into v_status from public.profile_private where id = p_user;
  if not found or v_status <> 'active' then raise exception 'not_active'; end if;
  perform private.check_rate_limit(p_user, 'upload', 60);

  select count(*) into v_pending from public.upload_keys
   where user_id = p_user and purpose = p_purpose and consumed_at is null and created_at > now() - interval '1 hour';

  if p_purpose = 'profile_photo' then
    if v_pending >= 9 then raise exception 'too_many_uploads'; end if;
    v_prefix := 'profiles/';
  elsif p_purpose = 'event_cover' then
    if p_event is null then raise exception 'event_required'; end if;
    -- The caller must be a host or admin, and must own this event (admins may upload for any event).
    if not exists (select 1 from public.user_roles where user_id = p_user and role in ('host', 'admin')) then
      raise exception 'not_allowed';
    end if;
    if not exists (select 1 from public.events e where e.id = p_event and e.status in ('draft', 'pending_review', 'published')
                    and (e.host_id = p_user or exists (select 1 from public.user_roles where user_id = p_user and role = 'admin'))) then
      raise exception 'not_allowed';
    end if;
    if v_pending >= 20 then raise exception 'too_many_uploads'; end if;
    v_prefix := 'events/';
  elsif p_purpose = 'hub_art' then
    if not exists (select 1 from public.user_roles where user_id = p_user and role = 'admin') then
      raise exception 'not_allowed';
    end if;
    v_prefix := 'hubs/';
  else -- selfie
    if exists (select 1 from public.verifications where user_id = p_user and result = 'pending') then
      raise exception 'verification_pending';
    end if;
    if v_pending >= 3 then raise exception 'too_many_uploads'; end if;
    v_prefix := 'selfies/';
  end if;

  v_key := v_prefix || gen_random_uuid() || '.webp';
  insert into public.upload_keys (key, user_id, purpose, event_id, size_limit)
  values (v_key, p_user, p_purpose, p_event, v_limit);
  return v_key;
end
$$;

create or replace function private.request_to_join_squad(p_squad uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  s public.squads;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  perform private.check_rate_limit(uid, 'squad_request', 30);
  select * into s from public.squads where id = p_squad for update;
  if not found or s.status <> 'forming' then raise exception 'not_found'; end if;
  if s.creator_id = uid then raise exception 'already_in_squad'; end if;
  if exists (select 1 from public.squad_members where event_id = s.event_id and user_id = uid and status in ('requested', 'approved')) then
    raise exception 'already_in_squad';
  end if;
  if (select count(*) from public.squad_members where squad_id = p_squad and status = 'approved') >= 6 then raise exception 'squad_full'; end if;
  if exists (select 1 from public.bookings where event_id = s.event_id and user_id = uid and status <> 'cancelled') then
    update public.bookings set squad_id = p_squad where event_id = s.event_id and user_id = uid and status <> 'cancelled';
  else
    perform private.join_event(uid, s.event_id, p_squad);
  end if;
  insert into public.squad_members (squad_id, user_id, event_id, status) values (p_squad, uid, s.event_id, 'requested')
  on conflict (squad_id, user_id) do update set status = 'requested', decided_at = null;
  perform private.notify(s.creator_id, 'squad_request', coalesce((select first_name from public.profiles where id = uid), 'Someone') || ' wants to join your squad',
    coalesce(s.name, 'Your squad'), jsonb_build_object('event_id', s.event_id, 'squad_id', p_squad));
end
$$;

create or replace function private.create_squad(p_event uuid, p_meeting_point text, p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  v_id uuid;
  point text := btrim(p_meeting_point);
  label text := nullif(btrim(p_name), '');
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  perform private.check_rate_limit(uid, 'create_squad', 10);
  if point is null or char_length(point) not between 3 and 200 then raise exception 'meeting_point_invalid'; end if;
  if label is not null and char_length(label) > 40 then raise exception 'name_invalid'; end if;
  if exists (select 1 from public.squad_members where event_id = p_event and user_id = uid and status in ('requested', 'approved')) then
    raise exception 'already_in_squad';
  end if;
  -- The creator needs a booking: make one through the normal path if they do not have one yet.
  if not exists (select 1 from public.bookings where event_id = p_event and user_id = uid and status <> 'cancelled') then
    perform private.join_event(uid, p_event, null);
  end if;
  insert into public.squads (event_id, creator_id, name, meeting_point) values (p_event, uid, label, point) returning id into v_id;
  insert into public.squad_members (squad_id, user_id, event_id, status, decided_at) values (v_id, uid, p_event, 'approved', now());
  update public.bookings set squad_id = v_id where event_id = p_event and user_id = uid and status <> 'cancelled';
  return v_id;
end
$$;

create or replace function private.apply_to_host(p_message text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  msg text := btrim(p_message);
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if (select status from public.profile_private where id = uid) is distinct from 'active' then raise exception 'not_active'; end if;
  perform private.check_rate_limit(uid, 'apply_to_host', 3);
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

create or replace function private.create_event(p_input jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  perform private.require_host(uid);
  perform private.check_rate_limit(uid, 'create_event', 20);
  return private.save_event(null, p_input, uid);
end
$$;

create or replace function private.submit_event_for_review(p_event uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  e public.events;
begin
  perform private.require_host(uid);
  perform private.check_rate_limit(uid, 'submit_event', 10);
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

create or replace function private.record_consent(p_anonymous_id uuid, p_notice_version text, p_preferences boolean, p_analytics boolean, p_marketing boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  v_current text;
  v_at timestamptz := clock_timestamp(); -- not now(): two choices in one transaction must stay in order
begin
  if uid is null and p_anonymous_id is null then raise exception 'anonymous_id_required'; end if;
  if p_preferences is null or p_analytics is null or p_marketing is null then raise exception 'invalid_input'; end if;
  select value #>> '{}' into v_current from public.app_config where key = 'notice_version';
  if p_notice_version is distinct from v_current then raise exception 'notice_version_mismatch'; end if;
  perform private.check_rate_limit(coalesce(uid, p_anonymous_id), 'record_consent', 30);
  -- Anyone can invent anonymous ids, so logged-out choices also share one big daily bucket.
  if uid is null then perform private.check_rate_limit('00000000-0000-4000-8000-00000000c0de', 'record_consent_anonymous', 5000); end if;

  insert into public.consents (user_id, anonymous_id, purpose, notice_version, granted, created_at) values
    (uid, p_anonymous_id, 'preferences', p_notice_version, p_preferences, v_at),
    (uid, p_anonymous_id, 'analytics', p_notice_version, p_analytics, v_at),
    (uid, p_anonymous_id, 'marketing', p_notice_version, p_marketing, v_at);
  if uid is not null then perform private.on_analytics_consent(uid, p_analytics); end if;
end
$$;

-- ---------------------------------------------------------------- grants
-- New tables and sequences were open to anon by default privileges. A sequence privilege lets someone call setval.
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- An admin could set a verification's result directly, skipping review_verification (which deletes the selfie and verifies the
-- profile). The function is the only way now.
revoke update (result, reviewed_at, reviewer_id) on public.verifications from authenticated;

-- ---------------------------------------------------------------- the payments switch is changed by a migration (P1), not through the API
-- Admins could update it with a direct REST call. Reads stay public; every other app_config key stays admin-editable.
drop policy app_config_admin_insert on public.app_config;
drop policy app_config_admin_update on public.app_config;
drop policy app_config_admin_delete on public.app_config;
create policy app_config_admin_insert on public.app_config for insert to authenticated
  with check ((select private.is_admin()) and key <> 'payments_enabled');
create policy app_config_admin_update on public.app_config for update to authenticated
  using ((select private.is_admin()) and key <> 'payments_enabled') with check ((select private.is_admin()) and key <> 'payments_enabled');
create policy app_config_admin_delete on public.app_config for delete to authenticated
  using ((select private.is_admin()) and key <> 'payments_enabled');

-- ---------------------------------------------------------------- indexes for foreign keys that our own queries use
create index tag_awards_from_idx on public.tag_awards (from_user);
create index connections_from_idx on public.connections (from_user);
create index host_ratings_from_idx on public.host_ratings (from_user);
create index private_feedback_from_idx on public.private_feedback (from_user);
create index checkins_checked_in_by_idx on public.checkins (checked_in_by);
create index review_flags_subject_idx on public.review_flags (subject_user_id);
create index moderation_actions_admin_idx on public.moderation_actions (admin_id);
create index safety_reports_reviewed_by_idx on public.safety_reports (reviewed_by);
-- consents_user_idx is a prefix of consents_user_latest_idx
drop index public.consents_user_idx;

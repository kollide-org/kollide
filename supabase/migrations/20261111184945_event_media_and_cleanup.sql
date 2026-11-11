-- Event covers, hub art and cleanup protection (B4).

-- ---------------------------------------------------------------- set_event_cover (was a stub in B3)
create or replace function private.set_event_cover(p_event_id uuid, p_key text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  e public.events;
  old_key text;
begin
  perform private.require_host(uid);
  e := private.owned_event(uid, p_event_id);
  if e.status not in ('draft', 'pending_review', 'published') then raise exception 'event_locked'; end if;

  -- The key must have been issued to this person for this event's cover.
  update public.upload_keys set consumed_at = now()
   where key = p_key and user_id = uid and purpose = 'event_cover' and event_id = p_event_id
     and consumed_at is null and created_at > now() - interval '24 hours';
  if not found then raise exception 'invalid_key'; end if;

  old_key := e.cover_key;
  update public.events set cover_key = p_key where id = p_event_id;
  if old_key is not null then
    insert into public.storage_deletions (bucket, key) values ('media', old_key) on conflict do nothing;
  end if;
end
$$;

-- ---------------------------------------------------------------- authorize_upload: event covers now check ownership
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

-- ---------------------------------------------------------------- the nightly sweep must not delete covers or hub art
create or replace function private.unreferenced_keys(p_bucket text, p_keys text[]) returns text[]
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_bucket = 'media' then
    return coalesce((select array_agg(k) from unnest(p_keys) as k
      where not exists (select 1 from public.profile_photos where r2_key = k)
        and not exists (select 1 from public.events where cover_key = k)
        and not exists (select 1 from public.hubs where art_key = k)), '{}');
  elsif p_bucket = 'private' then
    return coalesce((select array_agg(k) from unnest(p_keys) as k
      where not exists (select 1 from public.verifications where selfie_key = k)), '{}');
  end if;
  raise exception 'invalid_bucket';
end
$$;

-- ---------------------------------------------------------------- deleting an account also cancels the person's upcoming events
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

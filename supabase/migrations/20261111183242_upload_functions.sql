-- Upload and attach functions. Same pattern as B2: the logic is SECURITY DEFINER in `private`,
-- and `public.<name>` is a thin SECURITY INVOKER wrapper. Server-only functions are callable by
-- the service role only; browser functions by signed-in people only.

-- ---------------------------------------------------------------- authorize_upload (service role only)
-- The Worker calls this after verifying the JWT. It checks role and limits and records a new key.
create function private.authorize_upload(
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
    -- B4 adds the check that the caller hosts p_event.
    if not exists (select 1 from public.user_roles where user_id = p_user and role in ('host', 'admin')) then
      raise exception 'not_allowed';
    end if;
    if p_event is null then raise exception 'event_required'; end if;
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

-- Marks an issued key as used. Raises invalid_key unless it was issued to this person for this purpose,
-- is unused, and is under 24 hours old.
create function private.consume_key(p_uid uuid, p_key text, p_purpose text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.upload_keys
     set consumed_at = now()
   where key = p_key and user_id = p_uid and purpose = p_purpose
     and consumed_at is null and created_at > now() - interval '24 hours';
  if not found then raise exception 'invalid_key'; end if;
end
$$;

-- ---------------------------------------------------------------- profile photos
create function private.set_profile_photo(p_position smallint, p_key text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  old_key text;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if (select status from public.profile_private where id = uid) is distinct from 'active' then
    raise exception 'not_active';
  end if;
  if p_position is null or p_position not between 1 and 3 then raise exception 'invalid_position'; end if;

  perform private.consume_key(uid, p_key, 'profile_photo');

  delete from public.profile_photos where user_id = uid and position = p_position returning r2_key into old_key;
  if old_key is not null then
    insert into public.storage_deletions (bucket, key) values ('media', old_key) on conflict do nothing;
  end if;
  insert into public.profile_photos (user_id, r2_key, position) values (uid, p_key, p_position);
end
$$;

create function private.remove_profile_photo(p_position smallint) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  old_key text;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if (select status from public.profile_private where id = uid) is distinct from 'active' then
    raise exception 'not_active';
  end if;
  if not exists (select 1 from public.profile_photos where user_id = uid and position = p_position) then
    raise exception 'photo_not_found';
  end if;
  -- Once onboarded, at least one photo must stay.
  if exists (select 1 from public.profiles where id = uid and onboarding_completed_at is not null)
     and (select count(*) from public.profile_photos where user_id = uid) <= 1 then
    raise exception 'min_photos';
  end if;
  delete from public.profile_photos where user_id = uid and position = p_position returning r2_key into old_key;
  insert into public.storage_deletions (bucket, key) values ('media', old_key) on conflict do nothing;
end
$$;

-- Stub until B4 creates events.
create function private.set_event_cover(p_event_id uuid, p_key text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'events_not_available';
end
$$;

-- ---------------------------------------------------------------- selfies
create function private.submit_selfie(p_key text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if (select status from public.profile_private where id = uid) is distinct from 'active' then
    raise exception 'not_active';
  end if;
  if exists (select 1 from public.verifications where user_id = uid and result = 'pending') then
    raise exception 'verification_pending';
  end if;
  perform private.consume_key(uid, p_key, 'selfie');
  insert into public.verifications (user_id, selfie_key) values (uid, p_key);
end
$$;

-- Admin decision. Clears the stored selfie key and queues the file for deletion.
create function private.review_verification(p_id uuid, p_approved boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  v public.verifications;
begin
  if uid is null or not private.is_admin() then raise exception 'not_allowed'; end if;
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

create function private.admin_list_pending_verifications()
returns table (id uuid, user_id uuid, first_name text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'not_allowed'; end if;
  return query
    select v.id, v.user_id, p.first_name, v.created_at
      from public.verifications v join public.profiles p on p.id = v.user_id
     where v.result = 'pending' order by v.created_at;
end
$$;

-- ---------------------------------------------------------------- cleanup helpers (service role only)
-- Returns the keys that nothing in the database points to.
-- B4 MUST add events.cover_key and the hub art column to the 'media' branch, or the sweep deletes them.
create function private.unreferenced_keys(p_bucket text, p_keys text[]) returns text[]
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_bucket = 'media' then
    return coalesce((select array_agg(k) from unnest(p_keys) as k
      where not exists (select 1 from public.profile_photos where r2_key = k)), '{}');
  elsif p_bucket = 'private' then
    return coalesce((select array_agg(k) from unnest(p_keys) as k
      where not exists (select 1 from public.verifications where selfie_key = k)), '{}');
  end if;
  raise exception 'invalid_bucket';
end
$$;

create function private.claim_deletions(p_limit integer)
returns table (id bigint, bucket text, key text)
language sql stable security definer set search_path = '' as $$
  select d.id, d.bucket, d.key from public.storage_deletions d
   where d.done_at is null order by d.id limit greatest(p_limit, 0)
$$;

create function private.mark_deletions_done(p_ids bigint[]) returns void
language sql security definer set search_path = '' as $$
  update public.storage_deletions set done_at = now() where id = any (p_ids) and done_at is null
$$;

-- Drops old bookkeeping. Returns how many rows went.
create function private.purge_old_upload_keys() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  a integer;
  b integer;
begin
  delete from public.upload_keys where created_at < now() - interval '7 days';
  get diagnostics a = row_count;
  delete from public.storage_deletions where done_at is not null and done_at < now() - interval '30 days';
  get diagnostics b = row_count;
  return a + b;
end
$$;

-- ---------------------------------------------------------------- public wrappers (SECURITY INVOKER)
create function public.authorize_upload(p_user uuid, p_purpose text, p_event uuid, p_content_type text, p_size integer)
returns text language sql set search_path = '' as $$
  select private.authorize_upload(p_user, p_purpose, p_event, p_content_type, p_size)
$$;
create function public.unreferenced_keys(p_bucket text, p_keys text[]) returns text[]
language sql stable set search_path = '' as $$ select private.unreferenced_keys(p_bucket, p_keys) $$;
create function public.claim_deletions(p_limit integer) returns table (id bigint, bucket text, key text)
language sql stable set search_path = '' as $$ select * from private.claim_deletions(p_limit) $$;
create function public.mark_deletions_done(p_ids bigint[]) returns void
language sql set search_path = '' as $$ select private.mark_deletions_done(p_ids) $$;
create function public.purge_old_upload_keys() returns integer
language sql set search_path = '' as $$ select private.purge_old_upload_keys() $$;

create function public.set_profile_photo(p_position smallint, p_key text) returns void
language sql set search_path = '' as $$ select private.set_profile_photo(p_position, p_key) $$;
create function public.remove_profile_photo(p_position smallint) returns void
language sql set search_path = '' as $$ select private.remove_profile_photo(p_position) $$;
create function public.set_event_cover(p_event_id uuid, p_key text) returns void
language sql set search_path = '' as $$ select private.set_event_cover(p_event_id, p_key) $$;
create function public.submit_selfie(p_key text) returns void
language sql set search_path = '' as $$ select private.submit_selfie(p_key) $$;
create function public.review_verification(p_id uuid, p_approved boolean) returns void
language sql set search_path = '' as $$ select private.review_verification(p_id, p_approved) $$;
create function public.admin_list_pending_verifications()
returns table (id uuid, user_id uuid, first_name text, created_at timestamptz)
language sql stable set search_path = '' as $$ select * from private.admin_list_pending_verifications() $$;

-- ---------------------------------------------------------------- grants
-- Service role only.
revoke all on function
  private.authorize_upload(uuid, text, uuid, text, integer), private.unreferenced_keys(text, text[]),
  private.claim_deletions(integer), private.mark_deletions_done(bigint[]), private.purge_old_upload_keys()
  from public;
grant execute on function
  private.authorize_upload(uuid, text, uuid, text, integer), private.unreferenced_keys(text, text[]),
  private.claim_deletions(integer), private.mark_deletions_done(bigint[]), private.purge_old_upload_keys()
  to service_role;
revoke all on function
  public.authorize_upload(uuid, text, uuid, text, integer), public.unreferenced_keys(text, text[]),
  public.claim_deletions(integer), public.mark_deletions_done(bigint[]), public.purge_old_upload_keys()
  from public, anon, authenticated;
grant execute on function
  public.authorize_upload(uuid, text, uuid, text, integer), public.unreferenced_keys(text, text[]),
  public.claim_deletions(integer), public.mark_deletions_done(bigint[]), public.purge_old_upload_keys()
  to service_role;

-- Signed-in people (the functions check admin where needed).
revoke all on function
  private.consume_key(uuid, text, text), private.set_profile_photo(smallint, text),
  private.remove_profile_photo(smallint), private.set_event_cover(uuid, text), private.submit_selfie(text),
  private.review_verification(uuid, boolean), private.admin_list_pending_verifications()
  from public;
grant execute on function
  private.set_profile_photo(smallint, text), private.remove_profile_photo(smallint),
  private.set_event_cover(uuid, text), private.submit_selfie(text),
  private.review_verification(uuid, boolean), private.admin_list_pending_verifications()
  to authenticated;
revoke all on function
  public.set_profile_photo(smallint, text), public.remove_profile_photo(smallint),
  public.set_event_cover(uuid, text), public.submit_selfie(text),
  public.review_verification(uuid, boolean), public.admin_list_pending_verifications()
  from public, anon;
grant execute on function
  public.set_profile_photo(smallint, text), public.remove_profile_photo(smallint),
  public.set_event_cover(uuid, text), public.submit_selfie(text),
  public.review_verification(uuid, boolean), public.admin_list_pending_verifications()
  to authenticated;

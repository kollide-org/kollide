-- B3: onboarding now takes issued photo keys only (placeholders are gone), and deleting an account
-- also queues the person's images for deletion from R2.

create or replace function private.complete_onboarding(
  p_first_name text, p_date_of_birth date, p_gender public.gender, p_area_id smallint,
  p_interest_ids smallint[], p_language_ids smallint[], p_prompts jsonb, p_photo_keys text[],
  p_notice_version text, p_accept_conduct boolean, p_accept_privacy boolean,
  p_last_name text default null, p_phone text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  me public.profile_private;
  v_first text := btrim(p_first_name);
  v_last text := nullif(btrim(p_last_name), '');
  v_phone text := nullif(btrim(p_phone), '');
  prompts jsonb;
  current_notice text;
begin
  if uid is null then raise exception 'not_signed_in'; end if;

  -- Lock the caller's profile so a double submit cannot run twice.
  perform 1 from public.profiles where id = uid for update;
  select * into me from public.profile_private where id = uid;
  if not found then raise exception 'no_profile'; end if;
  if me.status <> 'active' then raise exception 'not_active'; end if;
  if exists (select 1 from public.profiles where id = uid and onboarding_completed_at is not null) then
    raise exception 'already_onboarded';
  end if;

  if v_first is null or char_length(v_first) not between 1 and 40 then raise exception 'first_name_required'; end if;
  if v_last is not null and char_length(v_last) > 60 then raise exception 'last_name_invalid'; end if;
  if v_phone is not null and v_phone !~ '^\+[0-9]{10,15}$' then raise exception 'phone_invalid'; end if;

  if p_date_of_birth is null or p_date_of_birth <= date '1900-01-01' then raise exception 'dob_required'; end if;
  if p_date_of_birth > (current_date - interval '18 years')::date then raise exception 'under_18'; end if;
  if p_gender is null then raise exception 'gender_required'; end if;
  if p_area_id is null or not exists (select 1 from public.areas where id = p_area_id and active) then
    raise exception 'area_required';
  end if;

  perform private.check_reference_ids('interests', p_interest_ids, 1, 10, 'interests_invalid');
  perform private.check_reference_ids('languages', p_language_ids, 1, 5, 'languages_invalid');
  prompts := private.normalize_prompts(p_prompts);

  -- Photos must be keys this person was issued for profile photos (B3), unused and under 24 hours old.
  if p_photo_keys is null or cardinality(p_photo_keys) <> 3
     or cardinality(p_photo_keys) <> (select count(distinct k) from unnest(p_photo_keys) as k)
     or (select count(*) from public.upload_keys
          where user_id = uid and purpose = 'profile_photo' and key = any (p_photo_keys)
            and consumed_at is null and created_at > now() - interval '24 hours') <> 3 then
    raise exception 'photos_required';
  end if;

  if p_accept_conduct is not true or p_accept_privacy is not true then raise exception 'consent_required'; end if;
  select value #>> '{}' into current_notice from public.app_config where key = 'notice_version';
  if p_notice_version is distinct from current_notice then raise exception 'notice_version_mismatch'; end if;

  -- All checks passed: write everything.
  update public.profile_private
     set last_name = v_last, phone = v_phone, date_of_birth = p_date_of_birth, gender = p_gender
   where id = uid;

  delete from public.profile_interests where user_id = uid;
  insert into public.profile_interests (user_id, interest_id) select uid, unnest(p_interest_ids);
  delete from public.profile_languages where user_id = uid;
  insert into public.profile_languages (user_id, language_id) select uid, unnest(p_language_ids);
  update public.upload_keys set consumed_at = now() where user_id = uid and key = any (p_photo_keys);
  delete from public.profile_photos where user_id = uid;
  insert into public.profile_photos (user_id, r2_key, position)
    select uid, k, ord::smallint from unnest(p_photo_keys) with ordinality as t (k, ord);

  insert into public.consents (user_id, purpose, notice_version, granted) values
    (uid, 'code_of_conduct', p_notice_version, true),
    (uid, 'privacy_notice', p_notice_version, true);

  update public.profiles
     set first_name = v_first, area_id = p_area_id, bio_prompts = prompts, onboarding_completed_at = now()
   where id = uid;
end
$$;

create or replace function private.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if exists (select 1 from public.profiles where id = uid and deleted_at is not null) then
    return; -- already deleted
  end if;

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

-- get_my_profile now also returns each photo's position, so the UI can replace or remove the right one.
create or replace function public.get_my_profile() returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id,
    'first_name', p.first_name,
    'area_id', p.area_id,
    'bio_prompts', p.bio_prompts,
    'is_verified', p.is_verified,
    'onboarding_completed_at', p.onboarding_completed_at,
    'deleted_at', p.deleted_at,
    'last_name', pp.last_name,
    'phone', pp.phone,
    'date_of_birth', pp.date_of_birth,
    'gender', pp.gender,
    'email', pp.email,
    'status', pp.status,
    'photo_keys', (select coalesce(jsonb_agg(ph.r2_key order by ph.position), '[]'::jsonb)
                     from public.profile_photos ph where ph.user_id = p.id),
    'photos', (select coalesce(jsonb_agg(jsonb_build_object('position', ph.position, 'key', ph.r2_key) order by ph.position), '[]'::jsonb)
                 from public.profile_photos ph where ph.user_id = p.id),
    'interest_ids', (select coalesce(jsonb_agg(pi.interest_id order by pi.interest_id), '[]'::jsonb)
                       from public.profile_interests pi where pi.user_id = p.id),
    'language_ids', (select coalesce(jsonb_agg(pl.language_id order by pl.language_id), '[]'::jsonb)
                       from public.profile_languages pl where pl.user_id = p.id),
    'roles', (select coalesce(jsonb_agg(ur.role order by ur.role), '[]'::jsonb)
                from public.user_roles ur where ur.user_id = p.id)
  )
  from public.profiles p
  left join public.profile_private pp on pp.id = p.id
  where p.id = (select auth.uid())
$$;

-- Onboarding and account functions.
-- Pattern: the logic is SECURITY DEFINER in the `private` schema (search_path set, checks auth.uid()).
-- public.<name> is a thin SECURITY INVOKER wrapper that the browser calls with supabase.rpc.
-- Supabase's advisors warn about definer functions in `public`, and CI fails on warnings.

-- ---------------------------------------------------------------- shared validation
-- Returns the prompts cleaned up (trimmed) or raises prompts_invalid.
create function private.normalize_prompts(raw jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  item jsonb;
  cleaned jsonb := '[]'::jsonb;
  q text;
  a text;
begin
  if raw is null or jsonb_typeof(raw) <> 'array' or jsonb_array_length(raw) not between 2 and 3 then
    raise exception 'prompts_invalid';
  end if;
  for item in select * from jsonb_array_elements(raw) loop
    if jsonb_typeof(item) <> 'object'
       or jsonb_typeof(item -> 'prompt') <> 'string' or jsonb_typeof(item -> 'answer') <> 'string' then
      raise exception 'prompts_invalid';
    end if;
    q := btrim(item ->> 'prompt');
    a := btrim(item ->> 'answer');
    if char_length(q) not between 1 and 80 or char_length(a) not between 1 and 300 then
      raise exception 'prompts_invalid';
    end if;
    cleaned := cleaned || jsonb_build_array(jsonb_build_object('prompt', q, 'answer', a));
  end loop;
  return cleaned;
end
$$;

-- Raises unless every id exists, is active and appears once. Returns void.
create function private.check_reference_ids(tbl text, ids smallint[], min_n int, max_n int, err text)
returns void language plpgsql stable set search_path = '' as $$
declare
  found int;
begin
  if ids is null or cardinality(ids) not between min_n and max_n
     or cardinality(ids) <> (select count(distinct x) from unnest(ids) as x) then
    raise exception '%', err;
  end if;
  execute format('select count(*) from public.%I where id = any ($1) and active', tbl) into found using ids;
  if found <> cardinality(ids) then
    raise exception '%', err;
  end if;
end
$$;

-- ---------------------------------------------------------------- complete_onboarding
create function private.complete_onboarding(
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

  -- Placeholder keys are accepted until B3 (images). B3 tightens this to server-issued keys.
  if p_photo_keys is null or cardinality(p_photo_keys) <> 3
     or cardinality(p_photo_keys) <> (select count(distinct k) from unnest(p_photo_keys) as k)
     or exists (select 1 from unnest(p_photo_keys) as k
                where k is null or k !~ '^(placeholder|profiles)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$') then
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

-- ---------------------------------------------------------------- update_my_profile
create function private.update_my_profile(
  p_first_name text default null, p_last_name text default null, p_phone text default null,
  p_area_id smallint default null, p_bio_prompts jsonb default null,
  p_interest_ids smallint[] default null, p_language_ids smallint[] default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  v_first text := btrim(p_first_name);
  v_last text := btrim(p_last_name);
  v_phone text := btrim(p_phone);
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if (select status from public.profile_private where id = uid) is distinct from 'active' then
    raise exception 'not_active';
  end if;
  if not exists (select 1 from public.profiles where id = uid and onboarding_completed_at is not null) then
    raise exception 'not_onboarded';
  end if;

  if v_first is not null and char_length(v_first) not between 1 and 40 then raise exception 'first_name_required'; end if;
  if v_last is not null and char_length(v_last) not between 1 and 60 then raise exception 'last_name_invalid'; end if;
  if v_phone is not null and v_phone !~ '^\+[0-9]{10,15}$' then raise exception 'phone_invalid'; end if;
  if p_area_id is not null and not exists (select 1 from public.areas where id = p_area_id and active) then
    raise exception 'area_required';
  end if;
  if p_interest_ids is not null then
    perform private.check_reference_ids('interests', p_interest_ids, 1, 10, 'interests_invalid');
  end if;
  if p_language_ids is not null then
    perform private.check_reference_ids('languages', p_language_ids, 1, 5, 'languages_invalid');
  end if;

  update public.profiles
     set first_name = coalesce(v_first, first_name),
         area_id = coalesce(p_area_id, area_id),
         bio_prompts = coalesce(case when p_bio_prompts is null then null else private.normalize_prompts(p_bio_prompts) end, bio_prompts)
   where id = uid;
  update public.profile_private
     set last_name = coalesce(v_last, last_name), phone = coalesce(v_phone, phone)
   where id = uid;

  if p_interest_ids is not null then
    delete from public.profile_interests where user_id = uid;
    insert into public.profile_interests (user_id, interest_id) select uid, unnest(p_interest_ids);
  end if;
  if p_language_ids is not null then
    delete from public.profile_languages where user_id = uid;
    insert into public.profile_languages (user_id, language_id) select uid, unnest(p_language_ids);
  end if;
end
$$;

-- ---------------------------------------------------------------- delete_my_account
-- Anonymises the account. Keeps a tombstone profile row (no personal data) so other people's history
-- stays intact, plus consent rows (proof, no personal data) and audit rows (ids only).
-- R2 objects for photos and selfies are removed by the nightly cleanup job (B3).
create function private.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if exists (select 1 from public.profiles where id = uid and deleted_at is not null) then
    return; -- already deleted
  end if;

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

-- ---------------------------------------------------------------- public wrappers (SECURITY INVOKER)
create function public.complete_onboarding(
  p_first_name text, p_date_of_birth date, p_gender public.gender, p_area_id smallint,
  p_interest_ids smallint[], p_language_ids smallint[], p_prompts jsonb, p_photo_keys text[],
  p_notice_version text, p_accept_conduct boolean, p_accept_privacy boolean,
  p_last_name text default null, p_phone text default null
) returns void language sql set search_path = '' as $$
  select private.complete_onboarding(
    p_first_name, p_date_of_birth, p_gender, p_area_id, p_interest_ids, p_language_ids, p_prompts,
    p_photo_keys, p_notice_version, p_accept_conduct, p_accept_privacy, p_last_name, p_phone)
$$;

create function public.update_my_profile(
  p_first_name text default null, p_last_name text default null, p_phone text default null,
  p_area_id smallint default null, p_bio_prompts jsonb default null,
  p_interest_ids smallint[] default null, p_language_ids smallint[] default null
) returns void language sql set search_path = '' as $$
  select private.update_my_profile(
    p_first_name, p_last_name, p_phone, p_area_id, p_bio_prompts, p_interest_ids, p_language_ids)
$$;

create function public.delete_my_account() returns void language sql set search_path = '' as $$
  select private.delete_my_account()
$$;

-- Read-only functions run as the caller. Every query filters on auth.uid() explicitly, because an
-- admin's RLS would otherwise let them see other people's rows.
create function public.get_my_profile() returns jsonb language sql stable set search_path = '' as $$
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

-- Everything Kollide holds about the caller. Add each new table that stores personal data
-- (bookings, tags, reports, ...) here when it is created.
create function public.export_my_data() returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = (select auth.uid())),
    'private', (select to_jsonb(pp) from public.profile_private pp where pp.id = (select auth.uid())),
    'photos', (select coalesce(jsonb_agg(to_jsonb(ph) order by ph.position), '[]'::jsonb)
                 from public.profile_photos ph where ph.user_id = (select auth.uid())),
    'interests', (select coalesce(jsonb_agg(i.slug order by i.slug), '[]'::jsonb)
                    from public.profile_interests pi join public.interests i on i.id = pi.interest_id
                   where pi.user_id = (select auth.uid())),
    'languages', (select coalesce(jsonb_agg(l.slug order by l.slug), '[]'::jsonb)
                    from public.profile_languages pl join public.languages l on l.id = pl.language_id
                   where pl.user_id = (select auth.uid())),
    'roles', (select coalesce(jsonb_agg(ur.role), '[]'::jsonb)
                from public.user_roles ur where ur.user_id = (select auth.uid())),
    'host_applications', (select coalesce(jsonb_agg(to_jsonb(ha)), '[]'::jsonb)
                            from public.host_applications ha where ha.user_id = (select auth.uid())),
    'verifications', (select coalesce(jsonb_agg(jsonb_build_object(
                        'id', v.id, 'result', v.result, 'reviewed_at', v.reviewed_at, 'created_at', v.created_at)), '[]'::jsonb)
                        from public.verifications v where v.user_id = (select auth.uid())),
    'consents', (select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at), '[]'::jsonb)
                   from public.consents c where c.user_id = (select auth.uid())),
    'blocks', (select coalesce(jsonb_agg(to_jsonb(b)), '[]'::jsonb)
                 from public.user_blocks b where b.blocker_id = (select auth.uid()))
  )
  where (select auth.uid()) is not null
$$;

-- ---------------------------------------------------------------- grants
revoke all on function
  private.normalize_prompts(jsonb), private.check_reference_ids(text, smallint[], int, int, text),
  private.complete_onboarding(text, date, public.gender, smallint, smallint[], smallint[], jsonb, text[], text, boolean, boolean, text, text),
  private.update_my_profile(text, text, text, smallint, jsonb, smallint[], smallint[]),
  private.delete_my_account()
  from public;
grant execute on function
  private.normalize_prompts(jsonb), private.check_reference_ids(text, smallint[], int, int, text),
  private.complete_onboarding(text, date, public.gender, smallint, smallint[], smallint[], jsonb, text[], text, boolean, boolean, text, text),
  private.update_my_profile(text, text, text, smallint, jsonb, smallint[], smallint[]),
  private.delete_my_account()
  to authenticated;

revoke all on function
  public.complete_onboarding(text, date, public.gender, smallint, smallint[], smallint[], jsonb, text[], text, boolean, boolean, text, text),
  public.update_my_profile(text, text, text, smallint, jsonb, smallint[], smallint[]),
  public.delete_my_account(), public.get_my_profile(), public.export_my_data()
  from public, anon;
grant execute on function
  public.complete_onboarding(text, date, public.gender, smallint, smallint[], smallint[], jsonb, text[], text, boolean, boolean, text, text),
  public.update_my_profile(text, text, text, smallint, jsonb, smallint[], smallint[]),
  public.delete_my_account(), public.get_my_profile(), public.export_my_data()
  to authenticated;

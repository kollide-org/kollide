begin;
select * from no_plan();

-- Demo users from seed.sql: 1 admin (Asha), 2 host (Dev), 3 member (Meera), 4 member (Kabir), 5 member (Noor).
create function pg_temp.act_as(n int) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', ('00000000-0000-4000-8000-00000000000' || n)::uuid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.act_as_uid(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.act_as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
end $$;
create function pg_temp.n(stmt text) returns int language plpgsql as $$
declare c int;
begin
  execute stmt;
  get diagnostics c = row_count;
  return c;
end $$;
-- Creates a brand-new sign-up the way Supabase Auth does (the trigger makes the profile rows).
create function pg_temp.sign_up(uid uuid, mail text) returns void language sql as $$
  insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', mail, now(), '{}', '{}',
    now(), now(), '', '', '', '')
$$;
-- Calls complete_onboarding with valid defaults; override one argument at a time.
create function pg_temp.onboard(
  first text default 'Zoya', dob date default date '1995-05-05', gender public.gender default 'woman',
  area smallint default 1, interests smallint[] default array[1, 2]::smallint[], languages smallint[] default array[1]::smallint[],
  prompts jsonb default '[{"prompt":"A perfect Saturday","answer":"Long walks"},{"prompt":"Hidden talent","answer":"Cooking"}]',
  photos text[] default array['profiles/11111111-1111-4111-8111-111111111111.webp',
    'profiles/22222222-2222-4222-8222-222222222222.webp', 'profiles/33333333-3333-4333-8333-333333333333.webp'],
  notice text default 'v1', conduct boolean default true, privacy boolean default true,
  last_name text default 'Khan', phone text default '+919999999999'
) returns void language sql as $$
  select public.complete_onboarding(first, dob, gender, area, interests, languages, prompts, photos, notice, conduct, privacy, last_name, phone)
$$;

select pg_temp.sign_up('00000000-0000-4000-8000-0000000000a1', 'zoya@kollide.test');
-- Keys the Worker would have issued for this person (B3: only issued keys can be attached).
insert into public.upload_keys (key, user_id, purpose, size_limit) values
  ('profiles/11111111-1111-4111-8111-111111111111.webp', '00000000-0000-4000-8000-0000000000a1', 'profile_photo', 307200),
  ('profiles/22222222-2222-4222-8222-222222222222.webp', '00000000-0000-4000-8000-0000000000a1', 'profile_photo', 307200),
  ('profiles/33333333-3333-4333-8333-333333333333.webp', '00000000-0000-4000-8000-0000000000a1', 'profile_photo', 307200);

-- ===== the sign-up trigger =====
select is((select count(*)::int from public.profiles where id = '00000000-0000-4000-8000-0000000000a1'), 1,
  'a new sign-up gets a profile row');
select is((select email::text from public.profile_private where id = '00000000-0000-4000-8000-0000000000a1'), 'zoya@kollide.test',
  'a new sign-up gets a profile_private row with their email');
select is((select status from public.profile_private where id = '00000000-0000-4000-8000-0000000000a1'), 'active'::public.user_status,
  'a new sign-up starts active');
select is((select onboarding_completed_at from public.profiles where id = '00000000-0000-4000-8000-0000000000a1'), null,
  'a new sign-up has not finished onboarding');
select is((select count(*)::int from public.profiles), 6, 'the trigger did not disturb the 5 seeded profiles');

-- ===== who may call it =====
select pg_temp.act_as_anon();
select throws_ok($$select pg_temp.onboard()$$, '42501', null, 'a stranger (anon) CANNOT call complete_onboarding');

reset role; select pg_temp.act_as(3);
select throws_ok($$select pg_temp.onboard()$$, 'P0001', 'already_onboarded', 'an already-onboarded member CANNOT onboard again');

-- ===== validation (each failure writes nothing) =====
reset role; select pg_temp.act_as_uid('00000000-0000-4000-8000-0000000000a1');
select throws_ok($$select pg_temp.onboard(dob := (current_date - interval '17 years 364 days')::date)$$, 'P0001', 'under_18', 'under 18 is rejected');
select throws_ok($$select pg_temp.onboard(dob := null)$$, 'P0001', 'dob_required', 'a missing date of birth is rejected');
select throws_ok($$select pg_temp.onboard(conduct := false)$$, 'P0001', 'consent_required', 'a missing code of conduct consent is rejected');
select throws_ok($$select pg_temp.onboard(privacy := false)$$, 'P0001', 'consent_required', 'a missing privacy notice consent is rejected');
select throws_ok($$select pg_temp.onboard(notice := 'v0')$$, 'P0001', 'notice_version_mismatch', 'consent for an old notice version is rejected');
select throws_ok($$select pg_temp.onboard(first := '   ')$$, 'P0001', 'first_name_required', 'an empty first name is rejected');
select throws_ok($$select pg_temp.onboard(gender := null)$$, 'P0001', 'gender_required', 'a missing gender is rejected');
select throws_ok($$select pg_temp.onboard(area := null)$$, 'P0001', 'area_required', 'a missing area is rejected');
select throws_ok($$select pg_temp.onboard(area := 32000::smallint)$$, 'P0001', 'area_required', 'an unknown area is rejected');
select throws_ok($$select pg_temp.onboard(interests := array[]::smallint[])$$, 'P0001', 'interests_invalid', 'no interests is rejected');
select throws_ok($$select pg_temp.onboard(interests := array[1,1]::smallint[])$$, 'P0001', 'interests_invalid', 'duplicate interests are rejected');
select throws_ok($$select pg_temp.onboard(interests := array[1,2,3,4,5,6,7,8,9,10,11]::smallint[])$$, 'P0001', 'interests_invalid', 'more than 10 interests is rejected');
select throws_ok($$select pg_temp.onboard(languages := array[1,2,3,4,5,6]::smallint[])$$, 'P0001', 'languages_invalid', 'more than 5 languages is rejected');
select throws_ok($$select pg_temp.onboard(prompts := '[{"prompt":"One","answer":"Only"}]')$$, 'P0001', 'prompts_invalid', 'a single prompt is rejected');
select throws_ok($$select pg_temp.onboard(prompts := '[{"prompt":"a","answer":"b"},{"prompt":"a","answer":"b"},{"prompt":"a","answer":"b"},{"prompt":"a","answer":"b"}]')$$,
  'P0001', 'prompts_invalid', 'four prompts are rejected');
select throws_ok($$select pg_temp.onboard(prompts := '[{"prompt":"a","answer":""},{"prompt":"a","answer":"b"}]')$$, 'P0001', 'prompts_invalid', 'an empty answer is rejected');
select throws_ok($$select pg_temp.onboard(photos := array['profiles/11111111-1111-4111-8111-111111111111.webp','profiles/22222222-2222-4222-8222-222222222222.webp'])$$,
  'P0001', 'photos_required', 'two photos are rejected');
select throws_ok($$select pg_temp.onboard(photos := array['profiles/11111111-1111-4111-8111-111111111111.webp','profiles/11111111-1111-4111-8111-111111111111.webp','profiles/33333333-3333-4333-8333-333333333333.webp'])$$,
  'P0001', 'photos_required', 'duplicate photos are rejected');
select throws_ok($$select pg_temp.onboard(photos := array['x.webp','y.webp','z.webp'])$$, 'P0001', 'photos_required', 'photo keys in the wrong format are rejected');
select throws_ok($$select pg_temp.onboard(phone := '12345')$$, 'P0001', 'phone_invalid', 'a malformed phone number is rejected');

reset role;
select is((select onboarding_completed_at from public.profiles where id = '00000000-0000-4000-8000-0000000000a1'), null,
  'after all those failures the profile is still not onboarded');
select is((select count(*)::int from public.consents where user_id = '00000000-0000-4000-8000-0000000000a1'), 0, 'and no consent was recorded');
select is((select count(*)::int from public.profile_photos where user_id = '00000000-0000-4000-8000-0000000000a1'), 0, 'and no photo was saved');

-- on-hold users are refused
update public.profile_private set status = 'on_hold' where id = '00000000-0000-4000-8000-0000000000a1';
select pg_temp.act_as_uid('00000000-0000-4000-8000-0000000000a1');
select throws_ok($$select pg_temp.onboard()$$, 'P0001', 'not_active', 'an on-hold user CANNOT onboard');
reset role;
update public.profile_private set status = 'active' where id = '00000000-0000-4000-8000-0000000000a1';

-- ===== the happy path =====
select pg_temp.act_as_uid('00000000-0000-4000-8000-0000000000a1');
select lives_ok($$select pg_temp.onboard()$$, 'a valid onboarding succeeds');
select throws_ok($$select pg_temp.onboard()$$, 'P0001', 'already_onboarded', 'and cannot be repeated');
select ok((select onboarding_completed_at from public.profiles where id = '00000000-0000-4000-8000-0000000000a1') is not null,
  'onboarding_completed_at is set');
select is((select first_name from public.profiles where id = '00000000-0000-4000-8000-0000000000a1'), 'Zoya', 'the first name is saved');
select is((select array_agg(purpose::text order by purpose::text) from public.consents where user_id = '00000000-0000-4000-8000-0000000000a1'),
  array['code_of_conduct', 'privacy_notice'], 'consent is recorded for the code of conduct and the privacy notice');
select is((select count(*)::int from public.consents where user_id = '00000000-0000-4000-8000-0000000000a1'
  and notice_version = 'v1' and granted and created_at is not null), 2, 'with the notice version, granted, and a timestamp');
select is((select count(*)::int from public.profile_photos where user_id = '00000000-0000-4000-8000-0000000000a1'), 3, 'three photos are saved');
select is((select count(*)::int from public.profile_interests where user_id = '00000000-0000-4000-8000-0000000000a1'), 2, 'interests are saved');
select is((select phone from public.profile_private where id = '00000000-0000-4000-8000-0000000000a1'), '+919999999999', 'the owner CAN read their phone');

reset role; select pg_temp.act_as(3);
select is((select count(*)::int from public.profile_cards where id = '00000000-0000-4000-8000-0000000000a1'), 1,
  'another member sees the new card once onboarding is done');
select is((select count(*)::int from public.profile_private where id = '00000000-0000-4000-8000-0000000000a1'), 0,
  'but cannot read the new member''s private details');

select * from finish();
rollback;

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
  photos text[] default array['placeholder/11111111-1111-4111-8111-111111111111.webp',
    'placeholder/22222222-2222-4222-8222-222222222222.webp', 'placeholder/33333333-3333-4333-8333-333333333333.webp'],
  notice text default 'v1', conduct boolean default true, privacy boolean default true,
  last_name text default 'Khan', phone text default '+919999999999'
) returns void language sql as $$
  select public.complete_onboarding(first, dob, gender, area, interests, languages, prompts, photos, notice, conduct, privacy, last_name, phone)
$$;

select pg_temp.sign_up('00000000-0000-4000-8000-0000000000a1', 'zoya@kollide.test');

-- ===== who may call the account functions =====
select pg_temp.act_as_anon();
select throws_ok($$select public.get_my_profile()$$, '42501', null, 'a stranger CANNOT call get_my_profile');
select throws_ok($$select public.export_my_data()$$, '42501', null, 'a stranger CANNOT call export_my_data');
select throws_ok($$select public.update_my_profile(p_first_name := 'x')$$, '42501', null, 'a stranger CANNOT call update_my_profile');
select throws_ok($$select public.delete_my_account()$$, '42501', null, 'a stranger CANNOT call delete_my_account');
select throws_ok($$select private.delete_my_account()$$, '42501', null, 'a stranger CANNOT reach the private implementation');

-- ===== update_my_profile =====
reset role; select pg_temp.act_as_uid('00000000-0000-4000-8000-0000000000a1');
select throws_ok($$select public.update_my_profile(p_first_name := 'Early')$$, 'P0001', 'not_onboarded', 'a user who has not onboarded CANNOT use update_my_profile');
reset role; select pg_temp.act_as(3);
select lives_ok($$select public.update_my_profile(p_first_name := 'Meera J', p_bio_prompts := '[{"prompt":"A","answer":"B"},{"prompt":"C","answer":"D"}]')$$,
  'a member CAN update their own profile');
select is((select first_name from public.profiles where id = '00000000-0000-4000-8000-000000000003'), 'Meera J', 'the first name changed');
select is((select area_id is not null from public.profiles where id = '00000000-0000-4000-8000-000000000003'), true, 'fields left out stay unchanged');
select lives_ok($$select public.update_my_profile(p_interest_ids := array[1,2,3]::smallint[])$$, 'interests can be replaced');
select is((select count(*)::int from public.profile_interests where user_id = '00000000-0000-4000-8000-000000000003'), 3, 'the interests were replaced');
select throws_ok($$select public.update_my_profile(p_interest_ids := array[1,1]::smallint[])$$, 'P0001', 'interests_invalid', 'duplicate interests are rejected');
select throws_ok($$select public.update_my_profile(p_bio_prompts := '[]')$$, 'P0001', 'prompts_invalid', 'too few prompts are rejected');
select throws_ok($$select public.update_my_profile(p_phone := 'abc')$$, 'P0001', 'phone_invalid', 'a malformed phone is rejected');
select is(pg_temp.n($$update public.profiles set first_name = 'Hacked' where id = '00000000-0000-4000-8000-000000000004'$$), 0,
  'a member CANNOT edit another user''s profile');
reset role;
select is((select first_name from public.profiles where id = '00000000-0000-4000-8000-000000000004'), 'Kabir', 'another user''s profile is untouched');
update public.profile_private set status = 'on_hold' where id = '00000000-0000-4000-8000-000000000005';
select pg_temp.act_as(5);
select throws_ok($$select public.update_my_profile(p_first_name := 'Held')$$, 'P0001', 'not_active', 'an on-hold member CANNOT update their profile');
reset role;
update public.profile_private set status = 'active' where id = '00000000-0000-4000-8000-000000000005';

-- ===== get_my_profile =====
select pg_temp.act_as(1);
select is((select public.get_my_profile() ->> 'id'), '00000000-0000-4000-8000-000000000001', 'get_my_profile returns the caller''s own profile');
select is((select public.get_my_profile() -> 'roles'), '["admin"]'::jsonb, 'including the admin role');
reset role; select pg_temp.act_as(3);
select is((select public.get_my_profile() ->> 'phone'), '+910000000003', 'a member sees their own phone');
select is((select public.get_my_profile() -> 'roles'), '[]'::jsonb, 'a plain member has no roles');
select is((select jsonb_array_length(public.get_my_profile() -> 'photo_keys')), 1, 'photos are included');
reset role; select pg_temp.act_as_uid('00000000-0000-4000-8000-0000000000a1');
select ok((select public.get_my_profile() ->> 'onboarding_completed_at') is null, 'a new user sees onboarding_completed_at as null');

-- ===== export_my_data =====
reset role; select pg_temp.act_as(1);
select is((select public.export_my_data() -> 'private' ->> 'phone'), '+910000000001', 'export includes the caller''s private data');
select ok((select public.export_my_data()::text) not like '%+910000000003%', 'an admin''s export does NOT contain another member''s phone');
select ok((select public.export_my_data()::text) not like '%selfie%', 'export never contains selfie keys');
reset role; select pg_temp.act_as(4);
select ok((select public.export_my_data() -> 'profile' ->> 'first_name') = 'Kabir', 'export holds only the caller''s profile');

-- ===== delete_my_account =====
reset role;
insert into public.consents (user_id, purpose, notice_version, granted) values ('00000000-0000-4000-8000-000000000003', 'privacy_notice', 'v1', true);
insert into public.user_blocks (blocker_id, blocked_id) values ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004');
select pg_temp.act_as(3);
select lives_ok($$select public.delete_my_account()$$, 'a member CAN delete their own account');
select lives_ok($$select public.delete_my_account()$$, 'deleting twice does nothing');
reset role;
select is((select first_name from public.profiles where id = '00000000-0000-4000-8000-000000000003'), 'Former member', 'the profile is anonymised');
select ok((select deleted_at from public.profiles where id = '00000000-0000-4000-8000-000000000003') is not null, 'and marked deleted');
select is((select count(*)::int from public.profile_private where id = '00000000-0000-4000-8000-000000000003'), 0, 'private details are gone');
select is((select count(*)::int from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000003'), 0, 'photos are gone');
select is((select count(*)::int from public.profile_interests where user_id = '00000000-0000-4000-8000-000000000003'), 0, 'interests are gone');
select is((select count(*)::int from public.user_blocks where blocker_id = '00000000-0000-4000-8000-000000000003'), 0, 'blocks are gone');
select is((select count(*)::int from public.consents where user_id = '00000000-0000-4000-8000-000000000003'), 1, 'the consent record is kept');
select is((select email from auth.users where id = '00000000-0000-4000-8000-000000000003'), 'deleted-00000000-0000-4000-8000-000000000003@deleted.invalid',
  'the login email is anonymised');
select is((select count(*)::int from auth.identities where user_id = '00000000-0000-4000-8000-000000000003'), 0, 'sign-in identities are removed');
select ok((select banned_until from auth.users where id = '00000000-0000-4000-8000-000000000003') > now() + interval '100 years', 'the login is permanently disabled');
select is((select first_name from public.profiles where id = '00000000-0000-4000-8000-000000000004'), 'Kabir', 'other users are untouched');
select is((select count(*)::int from public.profile_private where id = '00000000-0000-4000-8000-000000000004'), 1, 'other users'' private details are untouched');
select pg_temp.act_as(4);
select is((select count(*)::int from public.profile_cards where id = '00000000-0000-4000-8000-000000000003'), 0, 'the deleted member no longer shows as a card');
reset role; select pg_temp.act_as(3);
select throws_ok($$select public.update_my_profile(p_first_name := 'Ghost')$$, 'P0001', 'not_active', 'a deleted account CANNOT keep editing');

select * from finish();
rollback;

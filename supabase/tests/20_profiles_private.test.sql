begin;
select * from no_plan();

-- Demo users from seed.sql: 1 admin (Asha), 2 host (Dev), 3 member (Meera), 4 member (Kabir), 5 member (Noor).
create function pg_temp.act_as(n int) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', ('00000000-0000-4000-8000-00000000000' || n)::uuid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.n(stmt text) returns int language plpgsql as $$
declare c int;
begin
  execute stmt;
  get diagnostics c = row_count;
  return c;
end $$;
-- Number of rows a write statement changed, as the current role (so RLS applies).
create function pg_temp.act_as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
end $$;

-- ===== profiles =====
select pg_temp.act_as_anon();
select throws_ok($$select * from public.profiles$$, '42501', null, 'a stranger (anon) CANNOT read profiles');
select throws_ok($$select * from public.profile_private$$, '42501', null, 'a stranger CANNOT read profile_private');

reset role; select pg_temp.act_as(3);
select is((select count(*)::int from public.profiles), 5, 'a member CAN read the 5 active profiles');
select is(pg_temp.n($$update public.profiles set first_name = 'Meera J' where id = '00000000-0000-4000-8000-000000000003'$$),
  1, 'the owner CAN edit their own first name');
select is(pg_temp.n($$update public.profiles set first_name = 'Hacked' where id = '00000000-0000-4000-8000-000000000004'$$),
  0, 'another member CANNOT edit someone else''s profile');
select throws_ok($$update public.profiles set is_verified = true where id = '00000000-0000-4000-8000-000000000003'$$, '42501',
  null, 'the owner CANNOT verify themselves');
select throws_ok($$update public.profiles set onboarding_completed_at = null where id = '00000000-0000-4000-8000-000000000003'$$, '42501',
  null, 'the owner CANNOT change onboarding_completed_at directly');
select throws_ok($$insert into public.profiles (id) values ('00000000-0000-4000-8000-000000000009')$$, '42501',
  null, 'a member CANNOT insert profiles');
select throws_ok($$delete from public.profiles where id = '00000000-0000-4000-8000-000000000003'$$, '42501',
  null, 'a member CANNOT delete profiles');
select throws_ok($$update public.profiles set bio_prompts = '[1,2,3,4]' where id = '00000000-0000-4000-8000-000000000003'$$, '23514',
  null, 'bio prompts are limited to 3');

-- ===== profile_private =====
select is((select count(*)::int from public.profile_private), 1, 'a member CAN read only their own profile_private row');
select is((select count(*)::int from public.profile_private where id <> '00000000-0000-4000-8000-000000000003'), 0,
  'another member''s phone, date of birth and gender are NOT readable');
select throws_ok($$update public.profile_private set status = 'active'$$, '42501', null, 'the owner CANNOT write profile_private (B2 functions do)');
select throws_ok($$update public.profile_private set date_of_birth = date '2001-01-01'$$, '42501', null, 'the owner CANNOT change their date of birth directly');
select throws_ok($$insert into public.profile_private (id) values ('00000000-0000-4000-8000-000000000009')$$, '42501', null, 'a member CANNOT insert profile_private');

reset role; select pg_temp.act_as(1);
select is((select count(*)::int from public.profile_private), 5, 'an admin CAN read all profile_private rows');
select throws_ok($$update public.profile_private set status = 'banned'$$, '42501', null, 'an admin CANNOT write profile_private directly (via later functions)');

-- ===== on-hold users disappear from other members =====
reset role;
update public.profile_private set status = 'on_hold' where id = '00000000-0000-4000-8000-000000000004';
select pg_temp.act_as(3);
select is((select count(*)::int from public.profiles where id = '00000000-0000-4000-8000-000000000004'), 0,
  'an on-hold member is hidden from other members');
reset role; select pg_temp.act_as(4);
select is((select count(*)::int from public.profiles where id = '00000000-0000-4000-8000-000000000004'), 1,
  'an on-hold member still sees their own profile');
select is(private.current_user_status(), 'on_hold'::public.user_status, 'current_user_status() reports on_hold');
reset role;
select is((select count(*)::int from public.audit_log where table_name = 'profile_private' and new_data = '{"status":"on_hold"}'),
  1, 'the status change is audited with the status only (no phone or date of birth)');
update public.profile_private set status = 'active' where id = '00000000-0000-4000-8000-000000000004';

-- ===== 18+ and phone format are enforced by the database =====
select throws_ok($$update public.profile_private set date_of_birth = (current_date - interval '17 years 364 days')::date
  where id = '00000000-0000-4000-8000-000000000003'$$, '23514', null, 'a 17-year-old date of birth is rejected');
select lives_ok($$update public.profile_private set date_of_birth = (current_date - interval '18 years')::date
  where id = '00000000-0000-4000-8000-000000000003'$$, 'exactly 18 is accepted');
select throws_ok($$update public.profile_private set phone = '12345' where id = '00000000-0000-4000-8000-000000000003'$$, '23514',
  null, 'a malformed phone number is rejected');

-- ===== helpers =====
select is(private.age_from_dob(null), null, 'age_from_dob(null) is null');
select is(private.age_from_dob((current_date - interval '30 years' - interval '1 day')::date), 30, 'age_from_dob calculates whole years');
select is(has_function_privilege('anon', 'private.is_admin()', 'execute'), false, 'anon CANNOT execute the private helpers');
select is(has_function_privilege('anon', 'private.age_of(uuid)', 'execute'), false, 'anon CANNOT execute age_of');

select * from finish();
rollback;

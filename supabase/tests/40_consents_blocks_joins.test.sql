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

-- ===== consents =====
select pg_temp.act_as_anon();
select lives_ok($$insert into public.consents (anonymous_id, purpose, notice_version, granted)
  values ('11111111-1111-4111-8111-111111111111', 'analytics', 'v1', true)$$, 'a logged-out visitor CAN record a cookie choice');
select throws_ok($$insert into public.consents (user_id, purpose, notice_version, granted)
  values ('00000000-0000-4000-8000-000000000003', 'analytics', 'v1', true)$$, '42501', null, 'a stranger CANNOT record consent as a member');
select throws_ok($$insert into public.consents (purpose, notice_version, granted) values ('analytics', 'v1', true)$$, '42501',
  null, 'a consent needs a user or an anonymous id');
select throws_ok($$select * from public.consents$$, '42501', null, 'a stranger CANNOT read consents (not even their own)');

reset role; select pg_temp.act_as(3);
select lives_ok($$insert into public.consents (user_id, purpose, notice_version, granted)
  values ('00000000-0000-4000-8000-000000000003', 'terms', 'v1', true)$$, 'a member CAN record their own consent');
select throws_ok($$insert into public.consents (user_id, purpose, notice_version, granted)
  values ('00000000-0000-4000-8000-000000000004', 'terms', 'v1', true)$$, '42501', null, 'a member CANNOT record consent for someone else');
select is((select count(*)::int from public.consents), 1, 'a member CAN read only their own consents');
select throws_ok($$update public.consents set granted = false$$, '42501', null, 'consents CANNOT be edited (append-only)');
select throws_ok($$delete from public.consents$$, '42501', null, 'consents CANNOT be deleted by the owner');

reset role; select pg_temp.act_as(5);
select is((select count(*)::int from public.consents), 0, 'another member CANNOT read them');

reset role; select pg_temp.act_as(1);
select is((select count(*)::int from public.consents), 2, 'an admin CAN read all consents');

-- ===== user_blocks =====
reset role; select pg_temp.act_as(3);
select lives_ok($$insert into public.user_blocks (blocker_id, blocked_id) values ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004')$$,
  'a member CAN block someone');
select throws_ok($$insert into public.user_blocks (blocker_id, blocked_id) values ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003')$$,
  '23514', null, 'a member CANNOT block themselves');
select throws_ok($$insert into public.user_blocks (blocker_id, blocked_id) values ('00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000004')$$,
  '42501', null, 'a member CANNOT create a block for someone else');
select is((select count(*)::int from public.user_blocks), 1, 'the blocker CAN read their blocks');

reset role; select pg_temp.act_as(4);
select is((select count(*)::int from public.user_blocks), 0, 'the blocked person CANNOT see that they are blocked');
select is(pg_temp.n($$delete from public.user_blocks$$), 0, 'the blocked person CANNOT remove the block');

reset role; select pg_temp.act_as(1);
select is((select count(*)::int from public.user_blocks), 0, 'even an admin CANNOT read a member''s block list');

reset role; select pg_temp.act_as(3);
select is(pg_temp.n($$delete from public.user_blocks$$), 1, 'the blocker CAN unblock');

reset role; select pg_temp.act_as_anon();
select throws_ok($$select * from public.user_blocks$$, '42501', null, 'a stranger CANNOT read user_blocks');

-- ===== profile_interests and profile_languages =====
reset role; select pg_temp.act_as(3);
select lives_ok($$insert into public.profile_interests (user_id, interest_id) select '00000000-0000-4000-8000-000000000003', id from public.interests where slug = 'hiking'$$,
  'a member CAN add an interest to their own profile');
select throws_ok($$insert into public.profile_interests (user_id, interest_id) select '00000000-0000-4000-8000-000000000004', id from public.interests where slug = 'hiking'$$,
  '42501', null, 'a member CANNOT add an interest to someone else');
select is(pg_temp.n($$delete from public.profile_interests where user_id = '00000000-0000-4000-8000-000000000004'$$), 0,
  'a member CANNOT remove someone else''s interest');
select ok((select count(*) from public.profile_interests where user_id = '00000000-0000-4000-8000-000000000004') > 0, 'a member CAN read other members'' interests');
select is(pg_temp.n($$delete from public.profile_languages where user_id = '00000000-0000-4000-8000-000000000003'$$), 2,
  'the owner CAN remove their own languages');
select throws_ok($$insert into public.profile_languages (user_id, language_id) select '00000000-0000-4000-8000-000000000004', id from public.languages limit 1$$,
  '42501', null, 'a member CANNOT add a language to someone else');

reset role; select pg_temp.act_as_anon();
select throws_ok($$select * from public.profile_interests$$, '42501', null, 'a stranger CANNOT read profile_interests');
select throws_ok($$select * from public.profile_languages$$, '42501', null, 'a stranger CANNOT read profile_languages');

-- ===== profile_photos =====
reset role; select pg_temp.act_as(3);
select is((select count(*)::int from public.profile_photos), 5, 'a member CAN read profile photos');
select throws_ok($$insert into public.profile_photos (user_id, r2_key, position) values ('00000000-0000-4000-8000-000000000003', 'x.webp', 2)$$,
  '42501', null, 'a member CANNOT insert photos directly (B3 does)');
select throws_ok($$update public.profile_photos set r2_key = 'x.webp'$$, '42501', null, 'a member CANNOT update photos');
select throws_ok($$delete from public.profile_photos$$, '42501', null, 'a member CANNOT delete photos');

reset role; select pg_temp.act_as_anon();
select throws_ok($$select * from public.profile_photos$$, '42501', null, 'a stranger CANNOT read profile photos');

select * from finish();
rollback;

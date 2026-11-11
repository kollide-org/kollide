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

select pg_temp.act_as_anon();
select throws_ok($$select * from public.profile_cards$$, '42501', null, 'a stranger (anon) CANNOT read profile_cards');

reset role; select pg_temp.act_as(3);
select is((select count(*)::int from public.profile_cards), 5, 'a signed-in member CAN read the 5 cards');
select is((select count(*)::int from public.profile_cards where age >= 18), 5, 'every card shows an age of 18 or more');
select is((select array_length(photo_keys, 1) from public.profile_cards where id = '00000000-0000-4000-8000-000000000004'), 1,
  'a card includes photo keys');
select ok((select cardinality(interest_ids) from public.profile_cards where id = '00000000-0000-4000-8000-000000000004') > 0,
  'a card includes interest ids');

reset role;
select is((select count(*)::int from information_schema.columns
  where table_schema = 'public' and table_name = 'profile_cards'
    and column_name in ('date_of_birth', 'dob', 'phone', 'last_name', 'email', 'gender', 'status')),
  0, 'profile_cards has no date of birth, phone, last name, email, gender or status column');

update public.profile_private set status = 'suspended' where id = '00000000-0000-4000-8000-000000000004';
select pg_temp.act_as(3);
select is((select count(*)::int from public.profile_cards), 4, 'a suspended member disappears from other members'' cards');
reset role; select pg_temp.act_as(4);
select is((select count(*)::int from public.profile_cards where id = '00000000-0000-4000-8000-000000000004'), 1,
  'a suspended member still sees their own card');

reset role;
update public.profile_private set status = 'active' where id = '00000000-0000-4000-8000-000000000004';
update public.profiles set onboarding_completed_at = null where id = '00000000-0000-4000-8000-000000000005';
select pg_temp.act_as(3);
select is((select count(*)::int from public.profile_cards), 4, 'a profile that has not finished onboarding is not a card yet');

reset role; select pg_temp.act_as(3);
select throws_ok($$update public.profile_cards set first_name = 'x'$$, '42501', null, 'a member CANNOT write through the view');

select * from finish();
rollback;

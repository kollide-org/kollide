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

-- ===== app_config =====
select pg_temp.act_as_anon();
select is((select value from public.app_config where key = 'payments_enabled'), 'false'::jsonb,
  'a stranger (anon) CAN read payments_enabled and it is false');
select is(private.payments_enabled(), false, 'payments_enabled() is false in v1');
select throws_ok($$insert into public.app_config (key, value) values ('x_flag', 'true')$$, '42501',
  null, 'a stranger CANNOT insert into app_config');
select throws_ok($$update public.app_config set value = 'true'$$, '42501',
  null, 'a stranger CANNOT update app_config');

reset role; select pg_temp.act_as(3);
select is((select count(*)::int from public.app_config), 2, 'a member CAN read app_config (payments_enabled and notice_version)');
select is(pg_temp.n($$update public.app_config set value = 'true' where key = 'payments_enabled'$$),
  0, 'a member CANNOT change payments_enabled (no rows updated)');
select throws_ok($$insert into public.app_config (key, value) values ('x_flag', 'true')$$, '42501',
  null, 'a member CANNOT insert into app_config');
select is(pg_temp.n($$delete from public.app_config$$),
  0, 'a member CANNOT delete from app_config');

reset role; select pg_temp.act_as(2);
select is(pg_temp.n($$update public.app_config set value = 'true' where key = 'payments_enabled'$$),
  0, 'a host (not admin) CANNOT change payments_enabled');

reset role; select pg_temp.act_as(1);
select is(pg_temp.n($$update public.app_config set value = 'true' where key = 'payments_enabled'$$),
  1, 'an admin CAN change app_config');
select is((select updated_by from public.app_config where key = 'payments_enabled'),
  '00000000-0000-4000-8000-000000000001'::uuid, 'updated_by records the admin');
select throws_ok($$update public.app_config set value = '"yes"' where key = 'payments_enabled'$$, '23514',
  null, 'payments_enabled must be a boolean');
select is((select count(*)::int from public.admin_audit_log(null, null, null, null, null, 200, null) where table_name = 'app_config' and action = 'UPDATE'),
  1, 'the app_config change is audited');
update public.app_config set value = 'false' where key = 'payments_enabled';

-- ===== reference tables =====
reset role; select pg_temp.act_as_anon();
select is((select count(*)::int from public.areas) >= 30, true, 'a stranger CAN read areas (30+ Bengaluru areas)');
select results_eq($$select count(*)::int from public.positive_tags$$, array[8], 'a stranger CAN read the 8 positive tags');
select results_eq($$select count(*)::int from public.host_rating_tags$$, array[3], 'a stranger CAN read the 3 host rating tags');

select throws_ok(format('insert into public.%I (slug, label) values (''zz-test'', ''ZZ'')', t), '42501',
  null, t || ': a stranger CANNOT insert')
from unnest(array['areas', 'interests', 'languages', 'positive_tags', 'host_rating_tags', 'categories']) as t;

reset role; select pg_temp.act_as(3);
select throws_ok(format('insert into public.%I (slug, label) values (''zz-test'', ''ZZ'')', t), '42501',
  null, t || ': a member CANNOT insert')
from unnest(array['areas', 'interests', 'languages', 'positive_tags', 'host_rating_tags', 'categories']) as t;
select is(pg_temp.n($$update public.areas set label = 'Hacked'$$),
  0, 'a member CANNOT update areas');
select is(pg_temp.n($$delete from public.categories$$),
  0, 'a member CANNOT delete categories');

reset role; select pg_temp.act_as(1);
select lives_ok(format('insert into public.%I (slug, label) values (''zz-test'', ''ZZ'')', t),
  t || ': an admin CAN insert')
from unnest(array['areas', 'interests', 'languages', 'positive_tags', 'host_rating_tags', 'categories']) as t;
select is(pg_temp.n($$update public.areas set label = 'ZZ renamed' where slug = 'zz-test'$$),
  1, 'an admin CAN update areas');
select is(pg_temp.n($$delete from public.areas where slug = 'zz-test'$$),
  1, 'an admin CAN delete areas');
select is((select count(*)::int from public.admin_audit_log(null, null, null, null, null, 200, null) where table_name = 'areas'),
  3, 'admin writes to reference tables are audited (insert, update, delete)');

select * from finish();
rollback;

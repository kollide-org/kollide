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

-- ===== user_roles =====
select pg_temp.act_as_anon();
select throws_ok($$select * from public.user_roles$$, '42501', null, 'a stranger CANNOT read user_roles');

reset role; select pg_temp.act_as(3);
select is((select count(*)::int from public.user_roles), 0, 'a member with no role sees no roles');
select throws_ok($$insert into public.user_roles (user_id, role) values ('00000000-0000-4000-8000-000000000003', 'admin')$$, '42501',
  null, 'a member CANNOT make themselves admin');
select throws_ok($$insert into public.user_roles (user_id, role) values ('00000000-0000-4000-8000-000000000003', 'host')$$, '42501',
  null, 'a member CANNOT make themselves host');

reset role; select pg_temp.act_as(2);
select is((select count(*)::int from public.user_roles), 1, 'a host CAN read only their own role');
select throws_ok($$insert into public.user_roles (user_id, role) values ('00000000-0000-4000-8000-000000000002', 'admin')$$, '42501',
  null, 'a host CANNOT escalate to admin');
select is(pg_temp.n($$delete from public.user_roles$$), 0, 'a host CANNOT delete roles');
select is(private.has_role('host'), true, 'has_role(host) is true for the host');
select is(private.is_admin(), false, 'is_admin() is false for the host');

reset role; select pg_temp.act_as(1);
select is((select count(*)::int from public.user_roles), 2, 'an admin CAN read all roles');
select is(private.is_admin(), true, 'is_admin() is true for the admin');
select lives_ok($$insert into public.user_roles (user_id, role, granted_by) values ('00000000-0000-4000-8000-000000000003', 'host', '00000000-0000-4000-8000-000000000001')$$,
  'an admin CAN grant host');
select is((select count(*)::int from public.audit_log where table_name = 'user_roles' and action = 'INSERT'
  and new_data ->> 'user_id' = '00000000-0000-4000-8000-000000000003'), 1, 'the role grant is audited');
select is(pg_temp.n($$delete from public.user_roles where user_id = '00000000-0000-4000-8000-000000000003'$$),
  1, 'an admin CAN revoke a role');
select is((select count(*)::int from public.audit_log where table_name = 'user_roles' and action = 'DELETE'), 1, 'the revoke is audited');

-- ===== host_applications =====
reset role; select pg_temp.act_as(3);
select lives_ok($$insert into public.host_applications (user_id, message) values ('00000000-0000-4000-8000-000000000003', 'I run a weekly board game night.')$$,
  'a member CAN apply to host');
select throws_ok($$insert into public.host_applications (user_id, message) values ('00000000-0000-4000-8000-000000000003', 'again')$$, '23505',
  null, 'only one pending application at a time');
select throws_ok($$insert into public.host_applications (user_id, message) values ('00000000-0000-4000-8000-000000000005', 'for someone else')$$, '42501',
  null, 'a member CANNOT apply on behalf of someone else');
select throws_ok($$insert into public.host_applications (user_id, message, status) values ('00000000-0000-4000-8000-000000000003', 'x', 'approved')$$, '42501',
  null, 'a member CANNOT insert an already-approved application');
select is((select count(*)::int from public.host_applications), 1, 'the applicant CAN read their own application');
select is(pg_temp.n($$update public.host_applications set status = 'approved'$$), 0,
  'the applicant CANNOT approve their own application');

reset role; select pg_temp.act_as(5);
select is((select count(*)::int from public.host_applications), 0, 'another member CANNOT read it');

reset role; select pg_temp.act_as_anon();
select throws_ok($$select * from public.host_applications$$, '42501', null, 'a stranger CANNOT read host applications');

reset role; select pg_temp.act_as(1);
select is((select count(*)::int from public.host_applications), 1, 'an admin CAN read applications');
select is(pg_temp.n($$update public.host_applications set status = 'approved', admin_note = 'Welcome',
  reviewed_by = '00000000-0000-4000-8000-000000000001', reviewed_at = now()$$),
  1, 'an admin CAN review an application');
select is((select new_data from public.audit_log where table_name = 'host_applications' order by id desc limit 1),
  '{"status":"approved","user_id":"00000000-0000-4000-8000-000000000003","reviewed_by":"00000000-0000-4000-8000-000000000001"}'::jsonb,
  'the review is audited without the private admin note');

reset role;
update public.profile_private set status = 'on_hold' where id = '00000000-0000-4000-8000-000000000004';
select pg_temp.act_as(4);
select throws_ok($$insert into public.host_applications (user_id, message) values ('00000000-0000-4000-8000-000000000004', 'let me host')$$, '42501',
  null, 'an on-hold member CANNOT apply to host');

-- ===== verifications =====
reset role;
insert into public.verifications (user_id, selfie_key) values ('00000000-0000-4000-8000-000000000003', 'selfies/secret-key.webp');
select pg_temp.act_as(3);
select is((select count(*)::int from public.verifications), 1, 'the owner CAN read their own verification result');
select throws_ok($$select selfie_key from public.verifications$$, '42501', null, 'the owner CANNOT read the selfie key');
select throws_ok($$select * from public.verifications$$, '42501', null, 'select * is refused because the selfie key is not granted');
select is(pg_temp.n($$update public.verifications set result = 'approved'$$), 0,
  'the owner CANNOT approve their own verification');

reset role; select pg_temp.act_as(5);
select is((select count(*)::int from public.verifications), 0, 'another member CANNOT read it');

reset role; select pg_temp.act_as(1);
select is((select count(*)::int from public.verifications), 1, 'an admin CAN read the verification result');
select throws_ok($$select selfie_key from public.verifications$$, '42501', null, 'an admin CANNOT read the selfie key through the API (Worker only)');
select is(pg_temp.n($$update public.verifications set result = 'approved', reviewed_at = now()$$), 1,
  'an admin CAN review a verification');
reset role;
select is((select count(*)::int from public.audit_log where table_name = 'verifications' and new_data::text like '%selfie%'), 0,
  'the selfie key never appears in the audit log');

select * from finish();
rollback;

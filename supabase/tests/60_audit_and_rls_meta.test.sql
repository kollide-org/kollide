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

-- ===== every public table is locked down =====
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity), 0,
  'every public table has RLS enabled');
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
    and not exists (select 1 from pg_policy p where p.polrelid = c.oid)), 0,
  'every public table has at least one explicit policy');
select is((select count(*)::int from information_schema.role_table_grants
  where table_schema = 'public' and grantee = 'anon' and privilege_type <> 'SELECT'
    ), 0,
  'anon has no write privileges anywhere (a cookie choice goes through record_consent)');
select is(has_table_privilege('anon', 'public.profile_private', 'select'), false, 'anon CANNOT select profile_private');
select is(has_table_privilege('authenticated', 'public.audit_log', 'insert'), false, 'authenticated CANNOT insert into audit_log');

-- ===== audit_log =====
reset role;
update public.profiles set is_verified = false where id = '00000000-0000-4000-8000-000000000003';
select is((select new_data from public.audit_log where table_name = 'profiles' order by id desc limit 1), '{"is_verified":false}'::jsonb,
  'an is_verified change is audited with that column only');
select is((select count(*)::int from public.audit_log where old_data::text like '%phone%' or new_data::text like '%phone%'
  or old_data::text like '%date_of_birth%' or new_data::text like '%date_of_birth%'), 0,
  'no phone or date of birth ever enters the audit log');
select throws_ok($$update public.audit_log set action = 'DELETE'$$, 'P0001', 'audit_log is append-only', 'audit_log rows CANNOT be edited');
select throws_ok($$delete from public.audit_log$$, 'P0001', 'audit_log is append-only', 'audit_log rows CANNOT be deleted');
select throws_ok($$truncate public.audit_log$$, 'P0001', 'audit_log is append-only', 'audit_log CANNOT be truncated');

select pg_temp.act_as_anon();
select throws_ok($$select * from public.audit_log$$, '42501', null, 'a stranger CANNOT read the audit log');
select throws_ok($$select * from public.admin_audit_log()$$, '42501', null, 'anon CANNOT call the audit viewer');
reset role; select pg_temp.act_as(3);
select throws_ok($$select count(*) from public.audit_log$$, '42501', null, 'a member CANNOT read the audit log');
select throws_ok($$select * from public.admin_audit_log()$$, 'P0001', 'not_allowed', 'a member CANNOT use the audit viewer');
select throws_ok($$insert into public.audit_log (action, table_name) values ('INSERT', 'x')$$, '42501', null, 'a member CANNOT write the audit log');
reset role; select pg_temp.act_as(1);
select ok((select count(*) from public.admin_audit_log()) > 0, 'an admin CAN read the audit log through the viewer');
select throws_ok($$select count(*) from public.audit_log$$, '42501', null, 'but NOT the table directly (the viewer masks private feedback authors)');
select throws_ok($$insert into public.audit_log (action, table_name) values ('INSERT', 'x')$$, '42501', null, 'an admin CANNOT write the audit log directly');

-- ===== reserved payment values and the switch =====
reset role;
select is((select array_agg(e.enumlabel::text order by e.enumsortorder)
  from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'booking_status'),
  array['requested','approved','waitlisted','declined','confirmed','attended','no_show','cancelled','pending_payment','paid','expired','refunded'],
  'booking_status includes the reserved P1 states');
select ok((select obj_description('public.booking_status'::regtype, 'pg_type')) like '%RESERVED for P1%', 'the reserved booking states are documented');
select is(private.payments_enabled(), false, 'payments_enabled() is false');
select is(private.age_from_dob((current_date - interval '40 years')::date), 40, 'age_from_dob works');

select * from finish();
rollback;

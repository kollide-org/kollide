begin;
select * from no_plan();

-- ================================================================ B9: the catalog stays hardened as new migrations arrive
-- These read the live catalog, so a function or grant added later that breaks a rule fails here.

-- ---------------------------------------------------------------- functions
select is((select coalesce(array_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text), '{}')
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname in ('public', 'private')
              and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
              and not ('search_path=""' = any (coalesce(p.proconfig, '{}')))),
  '{}'::text[], 'every function in public and private has EXACTLY search_path = "" (not "public", not unset)');

select is((select count(*)::int from pg_proc where pronamespace = 'public'::regnamespace and prosecdef), 0,
  'no SECURITY DEFINER function lives in public (the API schema): they are all in private behind thin wrappers');

-- Who may call what without signing in. A new anon-executable function must be added here on purpose.
select is((select coalesce(array_agg(format('%s.%s(%s)', n.nspname, p.proname, oidvectortypes(p.proargtypes)) order by n.nspname, p.proname), '{}')
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname in ('public', 'private') and p.prorettype <> 'trigger'::regtype
              and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
              and has_function_privilege('anon', p.oid, 'execute')),
  array['private.payments_enabled()', 'private.reconfirm_booking(uuid)', 'private.record_consent(uuid, text, boolean, boolean, boolean)',
        'public.reconfirm_booking(uuid)', 'public.record_consent(uuid, text, boolean, boolean, boolean)'],
  'the only functions a visitor who is not signed in can run');

-- Every public function is a thin invoker wrapper: SECURITY INVOKER, so the caller's own permissions apply.
select is((select count(*)::int from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef), 0, 'and every public function runs as the caller');

-- ---------------------------------------------------------------- tables, columns and sequences
select is((select count(*)::int from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon' and privilege_type <> 'SELECT'), 0,
  'anon has no write privilege on any table');
select is((select count(*)::int from information_schema.column_privileges where table_schema = 'public' and grantee = 'anon' and privilege_type in ('INSERT', 'UPDATE')), 0,
  'nor on any column');
select is((select string_agg(table_name || ':' || privs, ', ' order by table_name) from (
             select table_name, string_agg(privilege_type, '+' order by privilege_type) privs from information_schema.role_table_grants
              where table_schema = 'public' and grantee = 'authenticated' and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
              group by table_name) x),
  'app_config:DELETE+INSERT+UPDATE, areas:DELETE+INSERT+UPDATE, categories:DELETE+INSERT+UPDATE, host_rating_tags:DELETE+INSERT+UPDATE, interests:DELETE+INSERT+UPDATE, languages:DELETE+INSERT+UPDATE, positive_tags:DELETE+INSERT+UPDATE, profile_interests:DELETE+INSERT, profile_languages:DELETE+INSERT, user_blocks:DELETE, user_roles:DELETE+INSERT',
  'signed-in people can write only these tables directly (each behind admin or own-row RLS); everything else goes through functions');
select is((select string_agg(table_name || '.' || column_name || ':' || privilege_type, ', ' order by table_name, column_name) from information_schema.column_privileges
            where table_schema = 'public' and grantee = 'authenticated' and privilege_type in ('INSERT', 'UPDATE')
              and (table_name, privilege_type) not in (select table_name, privilege_type from information_schema.role_table_grants where table_schema = 'public' and grantee = 'authenticated')),
  'profiles.area_id:UPDATE, profiles.bio_prompts:UPDATE, profiles.first_name:UPDATE, user_blocks.blocked_id:INSERT, user_blocks.blocker_id:INSERT',
  'and only these columns (a verification result can no longer be set directly)');
select is((select count(*)::int from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'S'
              and (has_sequence_privilege('anon', c.oid, 'USAGE') or has_sequence_privilege('anon', c.oid, 'UPDATE') or has_sequence_privilege('anon', c.oid, 'SELECT'))), 0,
  'anon has no privilege on any sequence');

-- every view in public applies the caller's own permissions
select is((select coalesce(array_agg(c.relname::text order by c.relname::text), '{}') from pg_class c
            where c.relnamespace = 'public'::regnamespace and c.relkind = 'v' and not coalesce((select 'security_invoker=true' = any (c.reloptions)), false)),
  '{}'::text[], 'every public view is security_invoker');

-- the matviews and private views are not readable by visitors
select is((select count(*)::int from pg_class c where c.relnamespace = 'private'::regnamespace and c.relkind in ('v', 'm', 'r') and has_table_privilege('anon', c.oid, 'select')), 0,
  'a visitor cannot read anything in the private schema');

select * from finish();
rollback;

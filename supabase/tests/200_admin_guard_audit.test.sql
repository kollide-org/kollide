begin;
select * from no_plan();

-- Demo users from seed.sql: 1 admin (Asha), 2 host (Dev), 3 member (Meera), 4 member (Kabir), 5 member (Noor).
\set u1 '00000000-0000-4000-8000-000000000001'
\set u2 '00000000-0000-4000-8000-000000000002'
\set u3 '00000000-0000-4000-8000-000000000003'
\set u4 '00000000-0000-4000-8000-000000000004'
\set u5 '00000000-0000-4000-8000-000000000005'

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
create function pg_temp.act_as_service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  execute 'set local role service_role';
end $$;
-- A brand-new sign-up the way Supabase Auth does it (the trigger makes the profile rows). Returns the id.
create function pg_temp.sign_up(uid uuid, mail text) returns uuid language sql as $$
  insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', mail, now(), '{}', '{}',
    now(), now(), '', '', '', '')
  returning id
$$;

-- An event that has ended and been counted: the people in p_present were checked in (-> attended), the people in p_absent
-- held a seat but were not (-> no_show), and the 72-hour feedback window is open. Hosted by user 2 unless told otherwise.
create function pg_temp.mk_done_event(p_title text, p_present uuid[], p_absent uuid[] default '{}', p_ended_ago interval default interval '3 hours',
  p_host uuid default '00000000-0000-4000-8000-000000000002') returns uuid language plpgsql as $$
declare v uuid; u uuid; b uuid;
begin
  insert into public.events (host_id, type, title, area_id, starts_at, ends_at, capacity, approval_mode, status, published_at, pricing_mode)
  values (p_host, 'community', p_title, 1, now() - p_ended_ago - interval '2 hours', now() - p_ended_ago, 20, 'instant', 'published', now(), 'free')
  returning id into v;
  foreach u in array p_present loop
    insert into public.bookings (event_id, user_id, status) values (v, u, 'approved') returning id into b;
    insert into public.checkins (booking_id, event_id, user_id, checked_in_by, method) values (b, v, u, p_host, 'manual');
  end loop;
  foreach u in array p_absent loop
    insert into public.bookings (event_id, user_id, status) values (v, u, 'approved');
  end loop;
  perform private.finalise_event(v);
  return v;
end $$;

-- ================================================================ B7: nobody but an admin can use an admin function, and every admin action is audited
\set z '00000000-0000-4000-8000-0000000009aa'

-- Runs a statement as someone (0 = anon, n = seed user n) and reports what happened: 'ok' or 'SQLSTATE:message'.
create function pg_temp.try_as(p_user int, p_sql text) returns text language plpgsql as $$
begin
  if p_user = 0 then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    execute 'set local role anon';
  else
    perform set_config('request.jwt.claims', json_build_object('sub', ('00000000-0000-4000-8000-00000000000' || p_user)::uuid, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
  end if;
  begin
    execute p_sql;
    execute 'reset role';
    return 'ok';
  exception when others then
    execute 'reset role';
    return sqlstate || ':' || sqlerrm;
  end;
end $$;

create temp table admin_fns (name text primary key, call text not null);
insert into admin_fns values
  ('admin_audit_log', 'select * from public.admin_audit_log()'),
  ('admin_audit_tables', 'select public.admin_audit_tables()'),
  ('admin_delete_hub', 'select public.admin_delete_hub(''Z'')'),
  ('admin_email_usage', 'select public.admin_email_usage()'),
  ('admin_finalise_event_now', 'select public.admin_finalise_event_now(''Z'')'),
  ('admin_get_report', 'select public.admin_get_report(''Z'')'),
  ('admin_job_health', 'select * from public.admin_job_health()'),
  ('admin_job_runs', 'select * from public.admin_job_runs()'),
  ('admin_lift_hold', 'select public.admin_lift_hold(''Z'', ''because'')'),
  ('admin_list_appeals', 'select * from public.admin_list_appeals()'),
  ('admin_list_flags', 'select * from public.admin_list_flags()'),
  ('admin_list_host_applications', 'select * from public.admin_list_host_applications()'),
  ('admin_list_partner_events', 'select * from public.admin_list_partner_events()'),
  ('admin_list_pending_verifications', 'select * from public.admin_list_pending_verifications()'),
  ('admin_list_reports', 'select * from public.admin_list_reports()'),
  ('admin_resolve_flag', 'select public.admin_resolve_flag(''Z'', ''reviewed'')'),
  ('admin_resolve_report', 'select public.admin_resolve_report(''Z'', ''dismiss'')'),
  ('admin_search_users', 'select * from public.admin_search_users()'),
  ('admin_send_reconfirmation', 'select public.admin_send_reconfirmation(''Z'')'),
  ('admin_set_hub_events', 'select public.admin_set_hub_events(''Z'', array[]::uuid[])'),
  ('admin_set_partner_link', 'select public.admin_set_partner_link(''Z'', ''https://x.test/a'')'),
  ('admin_set_user_status', 'select public.admin_set_user_status(''Z'', ''warn'', ''because'')'),
  ('admin_start_review', 'select public.admin_start_review(''Z'')'),
  ('admin_upsert_hub', 'select public.admin_upsert_hub(null, ''zz'', ''Test hub'', null, ''#A63A50'', null, null, 0, false, null)'),
  ('admin_user_detail', 'select public.admin_user_detail(''Z'')'),
  ('approve_event', 'select public.approve_event(''Z'', null)'),
  ('feature_event', 'select public.feature_event(''Z'', 1::smallint)'),
  ('reject_event', 'select public.reject_event(''Z'', ''no'')'),
  ('resolve_appeal', 'select public.resolve_appeal(''Z'', ''upheld'')'),
  ('review_host_application', 'select public.review_host_application(''Z'', true)'),
  ('review_verification', 'select public.review_verification(''Z'', true)'),
  ('unfeature_event', 'select public.unfeature_event(''Z'')');
update admin_fns set call = replace(call, 'Z', :'z');

-- ---------------------------------------------------------------- coverage: a NEW admin function cannot slip in untested
-- Every public function whose private body checks for the admin role must either be in the list above or be one of these, which
-- are also open to the host of the event (and are tested for that in 110/120/140).
create temp table shared_fns (name text primary key);
insert into shared_fns values ('decide_request'), ('get_event_address'), ('host_checkin_list'), ('host_inbox');

create temp table found_fns as
select p.proname::text as name
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prokind = 'f'
   and exists (select 1 from pg_proc q join pg_namespace qn on qn.oid = q.pronamespace
                where qn.nspname = 'private' and q.proname = substring(p.prosrc from 'private\.([a-z_0-9]+)\(')
                  and (q.prosrc ~ 'is_admin\(\)' or q.prosrc ~ 'require_admin\(\)' or q.prosrc ~ 'has_role'));
select is((select coalesce(array_agg(name order by name), '{}') from found_fns where name not in (select name from admin_fns) and name not in (select name from shared_fns)),
  '{}'::text[], 'every function that checks for the admin role is covered by this test (add new ones to admin_fns)');
select is((select coalesce(array_agg(name order by name), '{}') from admin_fns where name not in (select name from found_fns)),
  '{}'::text[], 'and every function in the list really exists and checks for the admin role');
select ok((select count(*) from admin_fns) >= 30, 'the list is not empty');

-- ---------------------------------------------------------------- nobody but an admin
select is(pg_temp.try_as(0, call) ~ '^42501:', true, name || ': anon is refused') from admin_fns order by name;
select is(pg_temp.try_as(3, call), 'P0001:not_allowed', name || ': a member is refused') from admin_fns order by name;
select is(pg_temp.try_as(2, call), 'P0001:not_allowed', name || ': a host is refused') from admin_fns order by name;
-- an admin on hold is refused too
update public.profile_private set status = 'on_hold' where id = :'u1';
select is(pg_temp.try_as(1, call), 'P0001:not_active', name || ': an admin who is on hold is refused')
  from admin_fns order by name;
update public.profile_private set status = 'active' where id = :'u1';

-- the shared ones refuse strangers
select is(pg_temp.try_as(0, 'select public.host_inbox(''' || :'z' || ''')') ~ '^42501:', true, 'host_inbox: anon is refused');
select is(pg_temp.try_as(3, 'select * from public.host_inbox(''' || :'z' || ''')'), 'P0001:not_found', 'host_inbox: an unknown event is not found');

-- ================================================================ every admin action writes to the audit log
create function pg_temp.audited(p_sql text) returns text language plpgsql as $$
declare
  before_n bigint; after_n bigint; res text;
begin
  select count(*) into before_n from public.audit_log;
  res := pg_temp.try_as(1, p_sql);
  select count(*) into after_n from public.audit_log;
  return case when res <> 'ok' then res when after_n > before_n then 'audited' else 'NOT AUDITED' end;
end $$;

-- fixtures
insert into public.host_applications (user_id, message) values (:'u3', 'I would like to host');
select id as app from public.host_applications where user_id = :'u3' \gset
insert into public.events (host_id, type, title, area_id, starts_at, ends_at, capacity, approval_mode, status, pricing_mode, submitted_at, cover_key)
  values (:'u2', 'community', 'Pending A', 1, now() + interval '5 days', now() + interval '5 days 2 hours', 10, 'instant', 'pending_review', 'free', now(), 'events/11111111-1111-4111-8111-111111111111.webp'),
         (:'u2', 'community', 'Pending B', 1, now() + interval '5 days', now() + interval '5 days 2 hours', 10, 'instant', 'pending_review', 'free', now(), 'events/22222222-2222-4222-8222-222222222222.webp');
select id as pa from public.events where title = 'Pending A' \gset
select id as pb from public.events where title = 'Pending B' \gset
insert into public.verifications (user_id) values (:'u4');
select id as ver from public.verifications where user_id = :'u4' \gset
select pg_temp.mk_done_event('Audit event', array[:'u3', :'u4']::uuid[], '{}', interval '3 hours') as ea \gset
select id as bk from public.bookings where event_id = :'ea' and user_id = :'u3' \gset
-- a second ended event, nobody checked in, for the on-demand finalise
insert into public.events (host_id, type, title, area_id, starts_at, ends_at, capacity, approval_mode, status, published_at, pricing_mode)
  values (:'u2', 'community', 'Ended empty', 1, now() - interval '5 hours', now() - interval '3 hours', 10, 'instant', 'published', now(), 'free');
select id as ee from public.events where title = 'Ended empty' \gset
insert into public.bookings (event_id, user_id, status) values (:'ee', :'u4', 'approved');
select id as bk2 from public.bookings where event_id = :'ee' \gset
-- an upcoming approved booking for the reconfirmation helper
insert into public.events (host_id, type, title, area_id, starts_at, ends_at, capacity, approval_mode, status, published_at, pricing_mode)
  values (:'u2', 'community', 'Upcoming', 1, now() + interval '5 days', now() + interval '5 days 2 hours', 10, 'instant', 'published', now(), 'free');
select id as up from public.events where title = 'Upcoming' \gset
insert into public.bookings (event_id, user_id, status) values (:'up', :'u5', 'approved');
select id as bk3 from public.bookings where event_id = :'up' \gset
-- a hold with a report, a flag, a tip with an appeal, a partner event
update public.profile_private set status = 'on_hold' where id = :'u5';
insert into public.safety_reports (reporter_id, subject_type, subject_id, subject_user_id, reason, held) values (:'u3', 'user', :'u5', :'u5', 'other', true), (:'u3', 'user', :'u4', :'u4', 'other', false);
select id as rep from public.safety_reports where subject_user_id = :'u5' \gset
select id as rep2 from public.safety_reports where subject_user_id = :'u4' \gset
insert into public.review_flags (kind, subject_user_id, ref_key) values ('collusion', :'u4', 'audit-test');
select id as flg from public.review_flags where ref_key = 'audit-test' \gset
insert into public.appeals (user_id, kind, message) values (:'u5', 'account_status', 'please');
select id as apl from public.appeals where user_id = :'u5' \gset
insert into public.events (host_id, type, title, area_id, starts_at, ends_at, status, published_at, pricing_mode, partner_url)
  values (:'u2', 'partner', 'Partner night', 1, now() + interval '9 days', now() + interval '9 days 2 hours', 'published', now(), 'free', 'https://tickets.test/a');
select id as part from public.events where title = 'Partner night' \gset
update public.profile_private set status = 'active' where id = :'u5'; -- (the report row above is enough: the hold is re-applied by the first action below)

create temp table actions (name text, call text, expect text default 'audited');
insert into actions (name, call) values
  ('review_host_application', format('select public.review_host_application(%L, true, ''Welcome'')', :'app')),
  ('approve_event', format('select public.approve_event(%L, null)', :'pa')),
  ('reject_event', format('select public.reject_event(%L, ''Not this time'')', :'pb')),
  ('feature_event', format('select public.feature_event(%L, 1::smallint)', :'pa')),
  ('unfeature_event', format('select public.unfeature_event(%L)', :'pa')),
  ('admin_upsert_hub', 'select public.admin_upsert_hub(null, ''audit-hub'', ''Audit hub'', null, ''#A63A50'', null, null, 0, false, null)'),
  ('admin_set_hub_events', format('select public.admin_set_hub_events((select id from public.hubs where slug = ''audit-hub''), array[%L]::uuid[])', :'pa')),
  ('admin_delete_hub', 'select public.admin_delete_hub((select id from public.hubs where slug = ''audit-hub''))'),
  ('review_verification', format('select public.review_verification(%L, true)', :'ver')),
  ('admin_send_reconfirmation', format('select public.admin_send_reconfirmation(%L)', :'bk3')),
  ('admin_finalise_event_now', format('select public.admin_finalise_event_now(%L)', :'ee')),
  ('admin_set_user_status', format('select public.admin_set_user_status(%L, ''warn'', ''A warning for the audit test'', ''Please be kind'')', :'u3')),
  ('admin_lift_hold', format('select public.admin_lift_hold(%L, ''Lifting the hold'')', :'u4')),
  ('admin_start_review', format('select public.admin_start_review(%L)', :'rep')),
  ('admin_resolve_report', format('select public.admin_resolve_report(%L, ''dismiss'')', :'rep')),
  ('admin_resolve_flag', format('select public.admin_resolve_flag(%L, ''reviewed'', ''ok'')', :'flg')),
  ('resolve_appeal', format('select public.resolve_appeal(%L, ''upheld'', ''We looked'')', :'apl')),
  ('admin_set_partner_link', format('select public.admin_set_partner_link(%L, ''https://tickets.test/b'', ''kol-2'')', :'part'));
-- admin_lift_hold needs someone on hold
update public.profile_private set status = 'on_hold' where id = :'u4';
select is(pg_temp.audited(call), 'audited', name || ' writes to the audit log') from actions order by ctid;

-- the actions that only read (lists, detail, health) need no audit entry (control: the check really can fail)
select is(pg_temp.audited('select * from public.admin_list_reports()'), 'NOT AUDITED', 'control: reading a list writes no audit entry');
select is(pg_temp.try_as(1, 'select * from public.admin_audit_log()'), 'ok', 'the audit viewer works for an admin');
select ok((select count(*) from public.audit_log where table_name = 'moderation_actions') >= 2, 'moderation decisions are audited with the admin and the reason');
select ok(exists (select 1 from public.audit_log where table_name = 'moderation_actions' and actor_id = :'u1' and new_data ->> 'reason' like 'A warning%'), 'including who decided and why');
select ok(exists (select 1 from public.audit_log where table_name = 'events' and new_data ->> 'partner_url' = 'https://tickets.test/b'), 'a partner link change is audited with the new link');
select ok(exists (select 1 from public.audit_log where table_name = 'events' and new_data ->> 'admin_action' = 'finalise_event_now'), 'counting attendance on demand is audited');

select * from finish();
rollback;

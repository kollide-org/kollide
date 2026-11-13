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


create function pg_temp.n(stmt text) returns int language plpgsql as $$
declare c int;
begin
  execute stmt;
  get diagnostics c = row_count;
  return c;
end $$;
-- ================================================================ B9: every paid path is refused while payments_enabled = false

-- ================================================================ B9: rate limits, "last success" and the monitor
create function pg_temp.limit_at(uid uuid, act text, n integer) returns void language sql as $$
  insert into public.rate_limits (user_id, action, window_start, count) values (uid, act, (date_trunc('day', now() at time zone 'utc')) at time zone 'utc', n)
$$;
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
\set z '00000000-0000-4000-8000-0000000009aa'

-- ---------------------------------------------------------------- rate limits on the paths that had none
select pg_temp.limit_at(:'u4', 'apply_to_host', 3);
select is(pg_temp.try_as(4, 'select public.apply_to_host(''I would like to host'')'), 'P0001:rate_limited', 'apply_to_host: 3 a day');
select pg_temp.limit_at(:'u3', 'create_squad', 10);
select is(pg_temp.try_as(3, format('select public.create_squad(%L, %L)', :'z', 'Gate 2')), 'P0001:rate_limited', 'create_squad: 10 a day');
select pg_temp.limit_at(:'u3', 'squad_request', 30);
select is(pg_temp.try_as(3, format('select public.request_to_join_squad(%L)', :'z')), 'P0001:rate_limited', 'request_to_join_squad: 30 a day');
select pg_temp.limit_at(:'u2', 'create_event', 20);
select is(pg_temp.try_as(2, 'select public.create_event(''{}''::jsonb)'), 'P0001:rate_limited', 'create_event: 20 a day');
select pg_temp.limit_at(:'u2', 'submit_event', 10);
select is(pg_temp.try_as(2, format('select public.submit_event_for_review(%L)', :'z')), 'P0001:rate_limited', 'submit_event_for_review: 10 a day');
select pg_temp.limit_at(:'u5', 'upload', 60);
select throws_ok(format('select private.authorize_upload(%L, %L, null, %L, 1000)', :'u5', 'profile_photo', 'image/webp'), 'P0001', 'rate_limited', 'authorize_upload: 60 a day');
select is(pg_temp.try_as(3, format('select public.create_squad(%L, %L)', :'z', 'x')), 'P0001:rate_limited', 'the limit stays once reached');
-- the limits are per person: someone else is not affected, and a person under the limit is not refused for that reason
select isnt(pg_temp.try_as(5, format('select public.create_squad(%L, %L)', :'z', 'Gate 2')), 'P0001:rate_limited', 'another person is not rate limited');
-- logged-out consent: rotating anonymous ids does not get round the shared daily bucket
select pg_temp.limit_at('00000000-0000-4000-8000-00000000c0de', 'record_consent_anonymous', 5000);
select is(pg_temp.try_as(0, format('select public.record_consent(%L, %L, true, true, true)', gen_random_uuid(), 'v1')), 'P0001:rate_limited', 'logged-out choices share one daily bucket, whatever anonymous id they use');
select is(pg_temp.try_as(3, 'select public.record_consent(null, ''v1'', true, true, true)'), 'ok', 'while a signed-in person is unaffected');
delete from public.rate_limits;

-- ---------------------------------------------------------------- "last success" and late jobs
select private.record_job_run('reputation', 'ok', null, null);
select ok((select last_ok_at is not null from public.job_runs where job = 'reputation'), 'an ok run records the last success');
select private.record_job_run('reputation', 'error', null, 'boom');
select ok((select last_ok_at is not null and last_status = 'error' from public.job_runs where job = 'reputation'), 'an error keeps the previous success time');
select private.record_job_run('attendance', 'skipped', null, null);
select is((select last_ok_at from public.job_runs where job = 'attendance'), null, 'a skipped run is not a success');
select private.record_job_run('feedback-windows', 'warning', null, null);
select ok((select last_ok_at is not null from public.job_runs where job = 'feedback-windows'), 'a warning is');
update public.job_runs set last_ok_at = now() - interval '5 hours' where job = 'reputation';
select private.record_job_run('reputation', 'error', null, 'still broken');
select pg_temp.act_as(1);
select is((select late from public.admin_job_health() where job = 'reputation'), true, 'a job that keeps failing is late (before, it looked fine)');
select is((select late from public.admin_job_health() where job = 'feedback-windows'), false, 'a job that succeeded recently is not');
reset role;

-- ---------------------------------------------------------------- the monitor
select ok(exists (select 1 from cron.job where jobname = 'monitor'), 'the monitor is scheduled');
delete from public.job_runs;
delete from public.notifications;
delete from public.email_outbox;
select private.job_monitor();
select is((select count(*)::int from public.notifications where kind = 'monitor_alert' and data ->> 'key' like 'job_late:%'), 0, 'a fresh install does not raise alarms in its first hour');
update public.job_runs set run_count = 10 where job = 'monitor';
select private.record_job_run('flush-email', 'ok', jsonb_build_object('daily_cap', 280), null);
select private.job_monitor();
select ok(exists (select 1 from public.notifications where user_id = :'u1' and kind = 'monitor_alert' and data ->> 'key' = 'job_late:reputation-nightly'), 'a job with no success for twice its interval alerts the admins in the app');
select ok(exists (select 1 from public.email_outbox where user_id = :'u1' and template = 'admin_alert' and data ->> 'kind' = 'job_late' and data ->> 'job' = 'reputation-nightly'), 'and by email');
select ok(not exists (select 1 from public.notifications where data ->> 'key' = 'job_late:flush-email'), 'a healthy job does not');
select ok(not exists (select 1 from public.notifications where data ->> 'key' = 'job_late:monitor'), 'the monitor does not report itself');
select is((select count(*)::int from public.email_outbox where template = 'admin_alert' and data ->> 'job' = 'reputation-nightly'), 1, 'one email per admin (there is one)');
select private.job_monitor();
select is((select count(*)::int from public.email_outbox where template = 'admin_alert' and data ->> 'job' = 'reputation-nightly'), 1, 'not repeated within 24 hours');
update public.notifications set created_at = now() - interval '25 hours' where kind = 'monitor_alert';
select private.job_monitor();
select is((select count(*)::int from public.email_outbox where template = 'admin_alert' and data ->> 'job' = 'reputation-nightly'), 2, 'but again after a day, if it is still wrong');
select ok(not (select data::text from public.email_outbox where template = 'admin_alert' and data ->> 'kind' = 'job_late' limit 1) ~* '@|first_name|email', 'alert emails carry no personal data');
select is((select last_status from public.job_runs where job = 'monitor'), 'ok', 'the monitor records itself');

-- emails against the cap: 80% of the cap the Worker last recorded
delete from public.notifications; delete from public.email_outbox;
select private.record_job_run('flush-email', 'ok', jsonb_build_object('daily_cap', 10), null);
insert into public.email_outbox (user_id, template, data, status, sent_at) select :'u3', 'request_received', '{}', 'sent', now() from generate_series(1, 7);
select private.job_monitor();
select is((select count(*)::int from public.email_outbox where template = 'admin_alert' and data ->> 'kind' = 'email_cap'), 0, '7 of 10 is below 80%: no alert');
insert into public.email_outbox (user_id, template, data, status, sent_at) values (:'u3', 'request_received', '{}', 'sent', now());
select private.job_monitor();
select is((select count(*)::int from public.email_outbox where template = 'admin_alert' and data ->> 'kind' = 'email_cap'), 1, '8 of 10 is 80%: alert');
select is((select (data ->> 'sent')::int from public.email_outbox where template = 'admin_alert' and data ->> 'kind' = 'email_cap'), 8, 'with the numbers');

-- database size: the alert itself (a test database is far below 400 MB)
select is(private.monitor_alert('db_size', 'db_size', jsonb_build_object('mb', 450), 'The database is getting full', 'x'), true, 'a size alert is raised');
select is(private.monitor_alert('db_size', 'db_size', jsonb_build_object('mb', 450), 'The database is getting full', 'x'), false, 'once a day');
select ok((private.job_monitor(), 1) is not null and (select (last_detail ->> 'database_mb')::int < 400 from public.job_runs where job = 'monitor'), 'and the monitor reads the real size, which is below the line here');

-- ---------------------------------------------------------------- housekeeping trims pg_cron's history; the image job is scheduled
insert into cron.job_run_details (jobid, runid, command, status, start_time, end_time) select jobid, (select coalesce(max(runid), 0) + 1 from cron.job_run_details), 'select 1', 'succeeded', now() - interval '9 days', now() - interval '9 days' from cron.job limit 1;
select private.job_housekeeping();
select is((select count(*)::int from cron.job_run_details where end_time < now() - interval '8 days'), 0, 'pg_cron history older than a week is purged');
insert into public.analytics_outbox (user_id, event, dedupe_key, status, created_at) values (:'u3', 'checked_in', 'stale-1', 'queued', now() - interval '8 days'), (:'u3', 'checked_in', 'fresh-1', 'queued', now());
select private.job_housekeeping();
select is((select count(*)::int from public.analytics_outbox where dedupe_key in ('stale-1', 'fresh-1')), 1, 'queued analytics events older than a week are dropped (no PostHog key means they would wait forever), recent ones stay');
select is((select count(*)::int from cron.job where jobname = 'r2-cleanup'), 1, 'the image clean-up job is scheduled');
delete from public.job_runs where job = 'r2-cleanup';
select private.cron_r2_cleanup();
select ok((select last_status in ('skipped', 'ok') from public.job_runs where job = 'r2-cleanup'), 'it calls the Worker (or says why it cannot: Vault secrets missing)');

select * from finish();
rollback;

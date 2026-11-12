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

-- ================================================================ reports, flags, appeals, privacy, partners, jobs, audit viewer (B7.2 - B7.4)
\set r1 '00000000-0000-4000-8000-0000000003a1'
\set r2 '00000000-0000-4000-8000-0000000003a2'
select pg_temp.sign_up(:'r1', 'r1@example.test'), pg_temp.sign_up(:'r2', 'r2@example.test');

-- user 4 attended an event with users 3 and 5, so each of them can report user 4 and the hold applies
select pg_temp.mk_done_event('Report context', array[:'u3', :'u4', :'u5']::uuid[]) as rc \gset
select pg_temp.act_as(3);
select public.report('user', :'u4', 'harassment', 'First report');
reset role; select pg_temp.act_as(5);
select public.report('user', :'u4', 'unsafe', 'Second report');
reset role;
select id as ra from public.safety_reports where reporter_id = :'u3' \gset
select id as rb from public.safety_reports where reporter_id = :'u5' \gset
-- a note about user 4 from reviewer r1 (the admin must never learn who)
insert into public.private_feedback (event_id, from_user, about_user, issue_code, note) values (:'rc', :'u5', :'u4', 'disrespectful', 'NOTE-FROM-A-REVIEWER');

-- ---------------------------------------------------------------- the queue
select pg_temp.act_as(1);
select is((select count(*)::int from public.admin_list_reports()), 2, 'two reports wait');
select is((select count(*)::int from public.admin_list_reports('open')), 2, 'both open');
select is((select reporter_first_name from public.admin_list_reports() order by created_at limit 1), 'Meera', 'the queue shows the reporter''s first name');
select is((select subject_first_name || ':' || subject_status::text from public.admin_list_reports() limit 1), 'Kabir:on_hold', 'and the subject with their status');
select lives_ok(format('select public.admin_start_review(%L)', :'ra'), 'an admin takes a report');
select is((select status::text from public.admin_list_reports('reviewing')), 'reviewing', 'it moves to reviewing');
select is((select reviewer_first_name from public.admin_list_reports('reviewing')), 'Asha', 'with the reviewer');

-- ---------------------------------------------------------------- the detail never names a feedback author
select ok((public.admin_get_report(:'ra') -> 'private_feedback')::text like '%NOTE-FROM-A-REVIEWER%', 'the admin can read the private note...');
select ok(not (public.admin_get_report(:'ra')::text ~* '0000000000000000000000000005|from_user|Noor'), '...but nothing says who wrote it');
select is((public.admin_get_report(:'ra') -> 'private_feedback' -> 0 ->> 'month'), to_char(now(), 'YYYY-MM'), 'only the month, so a small event cannot point to one person');
select is((jsonb_array_length(public.admin_get_report(:'ra') -> 'other_reports')), 1, 'the detail lists the other report about the same person');
select is((public.admin_get_report(:'ra') -> 'reporter' ->> 'first_name'), 'Meera', 'and who reported');
select is((public.admin_get_report(:'ra') ->> 'details'), 'First report', 'with the details');
select throws_ok(format('select public.admin_get_report(%L)', '00000000-0000-4000-8000-0000000009ff'), 'P0001', 'not_found', 'an unknown report is not found');

-- ---------------------------------------------------------------- dismissing keeps the hold while another report still holds the person
select lives_ok(format('select public.admin_resolve_report(%L, %L, %L)', :'ra', 'dismiss', 'Nothing found'), 'dismiss the first report');
reset role;
select is((select status::text from public.profile_private where id = :'u4'), 'on_hold', 'the person stays on hold: another report about them is still waiting');
select is((select status::text from public.safety_reports where id = :'ra'), 'dismissed', 'the report is dismissed');
select is((select action_taken from public.safety_reports where id = :'ra'), 'dismiss', 'with the outcome');
select pg_temp.act_as(1);
select throws_ok(format('select public.admin_resolve_report(%L, %L)', :'ra', 'dismiss'), 'P0001', 'already_resolved', 'a report is resolved once');
select lives_ok(format('select public.admin_resolve_report(%L, %L, %L)', :'rb', 'dismiss', 'Also nothing'), 'dismiss the second');
reset role;
select is((select status::text from public.profile_private where id = :'u4'), 'active', 'now the hold is lifted');
select is((select count(*)::int from public.notifications where user_id = :'u4' and kind = 'moderation_reactivate'), 1, 'and the person is told once');
select is((select count(*)::int from public.notifications where user_id = :'u3' and kind = 'report_reviewed'), 1, 'the reporter hears only that it was reviewed');
select ok(not exists (select 1 from public.notifications where user_id = :'u3' and kind = 'report_reviewed' and (body ~* 'dismiss|warn|suspend|ban' or title ~* 'dismiss|warn|suspend|ban')), 'never what was decided');

-- ---------------------------------------------------------------- warn, suspend, ban from a report
select pg_temp.act_as(3);
select public.report('user', :'u4', 'harassment', 'Third report');
reset role;
select id as rc2 from public.safety_reports where details = 'Third report' \gset
select pg_temp.act_as(1);
select throws_ok(format('select public.admin_resolve_report(%L, %L)', :'rc2', 'warn'), 'P0001', 'reason_required', 'a warning needs a reason');
select lives_ok(format('select public.admin_resolve_report(%L, %L, %L, %L)', :'rc2', 'warn', 'First offence', 'Please be kinder'), 'warn');
reset role;
select is((select status::text from public.profile_private where id = :'u4'), 'active', 'a warning lifts the hold it caused');
select is((select body from public.notifications where user_id = :'u4' and kind = 'moderation_warn'), 'Please be kinder', 'and tells the person');
select is((select report_id from public.moderation_actions where user_id = :'u4' and action = 'warn'), :'rc2'::uuid, 'the decision is linked to the report');
select is((select action_taken || ':' || status::text from public.safety_reports where id = :'rc2'), 'warn:resolved', 'the report is resolved');

select pg_temp.act_as(5);
select public.report('user', :'u4', 'unsafe', 'Fourth report');
reset role;
select id as rd from public.safety_reports where details = 'Fourth report' \gset
select pg_temp.act_as(1);
select lives_ok(format('select public.admin_resolve_report(%L, %L, %L, %L)', :'rd', 'suspend', 'Second offence', 'Suspended while we talk'), 'suspend from a report');
reset role;
select is((select status::text from public.profile_private where id = :'u4'), 'suspended', 'suspended');
select pg_temp.act_as(1);
select throws_ok(format('select public.admin_resolve_report(%L, %L, %L)', :'rd', 'explode', 'x'), 'P0001', 'invalid_action', 'only known outcomes');
select lives_ok(format('select public.admin_lift_hold(%L, %L)', :'u4', 'Talked it through'), 'lift the suspension');
select throws_ok(format('select public.admin_lift_hold(%L, %L)', :'u4', 'twice'), 'P0001', 'invalid_transition', 'an active person has no hold to lift');
select throws_ok(format('select public.admin_lift_hold(%L, %L)', :'u3', 'x'), 'P0001', 'reason_required', 'a reason is required');
reset role;

-- ---------------------------------------------------------------- flags
insert into public.review_flags (kind, subject_user_id, event_id, ref_key, details) values
  ('retaliation', :'u4', :'rc', 'old-retaliation', jsonb_build_object('reviewer_id', :'u5')),
  ('collusion', :'u3', null, 'col-1', '{"tags": 6}'::jsonb);
select pg_temp.act_as(1);
select is((select count(*)::int from public.admin_list_flags()), 2, 'open flags are listed');
select ok(not exists (select 1 from public.admin_list_flags() where details ? 'reviewer_id'), 'a flag never names a reviewer, even an old one');
select is((select count(*)::int from public.admin_list_flags('dismissed')), 0, 'flags can be filtered by status');
select lives_ok(format('select public.admin_resolve_flag(%L, %L, %L)', (select id from public.review_flags where ref_key = 'col-1'), 'dismissed', 'A friend group'), 'resolve a flag');
select throws_ok(format('select public.admin_resolve_flag(%L, %L)', (select id from public.review_flags where ref_key = 'col-1'), 'reviewed'), 'P0001', 'already_resolved', 'once');
select throws_ok(format('select public.admin_resolve_flag(%L, %L)', (select id from public.review_flags where ref_key = 'col-1'), 'deleted'), 'P0001', 'invalid_decision', 'only reviewed or dismissed');
select is((select count(*)::int from public.admin_list_flags()), 1, 'it leaves the open list');
reset role;
select is((select resolution_note from public.review_flags where ref_key = 'col-1'), 'A friend group', 'with the note');

-- ---------------------------------------------------------------- appeals queue
insert into public.profile_tips (user_id, issue_code, message) values (:'u3', 'other', 'A gentle note');
insert into public.appeals (user_id, kind, tip_id, message, due_at) values
  (:'u3', 'tip', (select id from public.profile_tips where user_id = :'u3'), 'This is unfair', now() - interval '2 hours'),
  (:'u4', 'account_status', null, 'I was held by mistake', now() + interval '30 hours');
select pg_temp.act_as(1);
select is((select count(*)::int from public.admin_list_appeals()), 2, 'open appeals are listed');
select is((select first_name from public.admin_list_appeals() limit 1), 'Meera', 'the one closest to its deadline comes first');
select is((select overdue from public.admin_list_appeals() limit 1), true, 'and is marked overdue');
select is((select tip_message from public.admin_list_appeals() limit 1), 'A gentle note', 'with the note being appealed');
reset role;

-- ---------------------------------------------------------------- partner links and click counts
select count(*)::int as before_partners from public.events where type = 'partner' \gset
insert into public.events (host_id, type, title, area_id, starts_at, ends_at, status, published_at, pricing_mode, partner_url, referral_code)
  values (:'u2', 'partner', 'Concert night', 1, now() + interval '9 days', now() + interval '9 days 3 hours', 'published', now(), 'free', 'https://tickets.test/c', 'kol-1'),
         (:'u2', 'partner', 'Draft concert', 1, now() + interval '9 days', now() + interval '9 days 3 hours', 'draft', null, 'free', 'https://tickets.test/d', null);
select id as pe from public.events where title = 'Concert night' \gset
select id as pd from public.events where title = 'Draft concert' \gset
select pg_temp.act_as_service();
select lives_ok(format('select public.record_partner_click(%L)', :'pe'), 'the Worker records a click');
select public.record_partner_click(:'pe');
select public.record_partner_click(:'pe');
select public.record_partner_click(:'pd'); -- a draft: ignored
select public.record_partner_click(:'ra'); -- not an event: ignored
reset role;
select is((select clicks from public.partner_click_counts where event_id = :'pe'), 3, 'clicks add up per day');
select is((select count(*)::int from public.partner_click_counts where event_id = :'pd'), 0, 'a click on an unpublished event is ignored');
select pg_temp.act_as(3);
select throws_ok(format('select public.record_partner_click(%L)', :'pe'), '42501', null, 'a member CANNOT record clicks');
select throws_ok($$select * from public.partner_click_counts$$, '42501', null, 'or read the counters');
reset role; select pg_temp.act_as(1);
select is((select count(*)::int from public.admin_list_partner_events()), :before_partners + 2, 'the admin sees every partner event');
select is((select clicks_total from public.admin_list_partner_events() where event_id = :'pe'), 3::bigint, 'the admin sees the total');
select is((select clicks_7d from public.admin_list_partner_events() where event_id = :'pe'), 3::bigint, 'and the last 7 days');
select is((select partner_url from public.admin_list_partner_events() where event_id = :'pe'), 'https://tickets.test/c', 'with the ticket link');
select throws_ok(format('select public.admin_set_partner_link(%L, %L)', :'pe', 'http://insecure.test'), 'P0001', 'partner_url_required', 'a link must be https');
select throws_ok(format('select public.admin_set_partner_link(%L, %L, %L)', :'pe', 'https://tickets.test/x', 'bad code!'), 'P0001', 'invalid_input', 'a referral code is letters, numbers, dash and underscore');
select lives_ok(format('select public.admin_set_partner_link(%L, %L, %L)', :'pe', 'https://tickets.test/new', 'kol-9'), 'an admin can change the link of a published partner event');
select throws_ok(format('select public.admin_set_partner_link(%L, %L)', :'rc', 'https://tickets.test/x'), 'P0001', 'not_found', 'only partner events');
select is((select referral_code from public.admin_list_partner_events() where event_id = :'pe'), 'kol-9', 'the code changed');
reset role;

-- ---------------------------------------------------------------- the audit viewer
select pg_temp.act_as(1);
select ok((select count(*) from public.admin_audit_log(p_actor => :'u1')) > 0, 'filter by actor');
select ok((select count(*) = count(*) filter (where action = 'UPDATE') from public.admin_audit_log(p_action => 'UPDATE')), 'filter by action');
select ok((select count(*) = count(*) filter (where table_name = 'safety_reports') from public.admin_audit_log(p_table => 'safety_reports')), 'filter by table');
select is((select count(*)::int from public.admin_audit_log(p_from => now() + interval '1 day')), 0, 'filter by date: nothing in the future');
select ok((select count(*) from public.admin_audit_log(p_from => now() - interval '1 day', p_to => now() + interval '1 day')) > 0, 'and a range that includes now');
select is((select count(*)::int from public.admin_audit_log(p_limit => 2)), 2, 'the page size is respected');
select ok((select max(id) from public.admin_audit_log(p_before => (select min(id) from public.admin_audit_log(p_limit => 2)))) < (select min(id) from public.admin_audit_log(p_limit => 2)), 'keyset paging goes backwards from the last id');
select is((select actor_first_name from public.admin_audit_log(p_table => 'moderation_actions') limit 1), 'Asha', 'the actor is named');
select ok('safety_reports' = any (public.admin_audit_tables()), 'the table filter has its list');
reset role;
-- older private-feedback audit rows recorded the author: the viewer masks them
insert into public.audit_log (actor_id, action, table_name, row_pk, new_data)
  values (:'u5', 'INSERT', 'private_feedback', 'x', jsonb_build_object('from_user', :'u5', 'about_user', :'u4', 'issue_code', 'unsafe', 'note', 'SECRET'));
select pg_temp.act_as(1);
select ok(not exists (select 1 from public.admin_audit_log(p_table => 'private_feedback') where new_data ? 'from_user' or new_data ? 'note' or new_data ? 'event_id'), 'private feedback authors, notes and events are masked in the viewer');
select ok(exists (select 1 from public.admin_audit_log(p_table => 'private_feedback')), 'but the rows are there');
select is((select count(*)::int from public.admin_audit_log(p_table => 'private_feedback') where actor_id is not null or actor_first_name is not null), 0, 'and they show no actor: the actor of such a row is its author');
select is((select count(*)::int from public.admin_audit_log(p_actor => :'u5', p_table => 'private_feedback')), 0, 'filtering by a person and the table does not list what they wrote');
select is((select count(*)::int from public.admin_audit_log(p_actor => :'u5') where table_name = 'private_feedback'), 0, 'filtering by a person alone never returns private feedback rows');
reset role;

-- ---------------------------------------------------------------- job health
delete from public.job_runs; -- (pg_cron also records runs while the tests run; start from nothing)
select pg_temp.act_as(1);
select is((select count(*)::int from public.admin_job_health()), 8, 'every scheduled job is listed');
select ok((select bool_and(late) from public.admin_job_health()), 'jobs that never ran are late');
reset role;
select private.record_job_run('reputation', 'ok', null, null);
update public.job_runs set last_finished_at = now() - interval '2 hours' where job = 'reputation';
select private.record_job_run('attendance', 'ok', null, null);
select pg_temp.act_as(1);
select is((select late from public.admin_job_health() where job = 'attendance'), false, 'a job that just ran is not late');
select is((select late from public.admin_job_health() where job = 'reputation'), true, 'a job that is overdue (15 min jobs: nothing for 2 hours) is late');
reset role;
select is((select count(*)::int from (select jobname from cron.job except select job from private.job_schedule()) x), 0, 'every cron job has a schedule line (so none can be missing from the page)');
select is((select count(*)::int from (select job from private.job_schedule() except select jobname from cron.job) x), 0, 'and every schedule line is a real cron job');

-- ---------------------------------------------------------------- email usage against the cap
select private.record_job_run('flush-email', 'ok', jsonb_build_object('sent_today', 10, 'daily_cap', 280), null);
insert into public.email_outbox (user_id, template, data, status, sent_at) values (:'u3', 'request_received', '{}', 'sent', now()), (:'u3', 'request_received', '{}', 'sent', now()), (:'u3', 'request_received', '{}', 'queued', null);
select pg_temp.act_as(1);
select is((select (public.admin_email_usage() ->> 'sent_today')::int), 2, 'emails sent today');
select is((select (public.admin_email_usage() ->> 'daily_cap')::int), 280, 'against the cap');
select is((select (public.admin_email_usage() ->> 'warn_at')::int), 224, 'with the warning point at 80%');
select ok((public.admin_email_usage() ->> 'queued')::int >= 1, 'and what is waiting');
reset role;
select private.record_job_run('flush-email', 'ok', jsonb_build_object('daily_cap', 100), null);
select pg_temp.act_as(1);
select is((select (public.admin_email_usage() ->> 'daily_cap')::int), 100, 'the cap follows what the Worker last recorded');
reset role;

-- ---------------------------------------------------------------- app config is readable by everyone and editable only as before (read-only in the UI)
select is((select value from public.app_config where key = 'payments_enabled'), 'false'::jsonb, 'payments are off');

select * from finish();
rollback;

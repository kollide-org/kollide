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

-- ================================================================ reports, holds, appeals (B6.4)
\set hx '00000000-0000-4000-8000-0000000001b1'
\set cx '00000000-0000-4000-8000-0000000001b2'
\set x1 '00000000-0000-4000-8000-0000000001b3'
\set y1 '00000000-0000-4000-8000-0000000001b4'
select pg_temp.sign_up(:'hx', 'host@example.test'), pg_temp.sign_up(:'cx', 'creator@example.test'),
       pg_temp.sign_up(:'x1', 'x1@example.test'), pg_temp.sign_up(:'y1', 'y1@example.test');
insert into public.user_roles (user_id, role) values (:'hx', 'host');

select pg_temp.mk_done_event('Shared event', array[:'u3', :'u4', :'u5']::uuid[]) as evx \gset
select pg_temp.mk_done_event('Admin hosted', array[:'u3']::uuid[], '{}', interval '3 hours', :'u1') as eva \gset
select pg_temp.mk_done_event('Other host event', array[:'u3']::uuid[], '{}', interval '3 hours', :'hx') as evh \gset
insert into public.events (host_id, type, title, area_id, starts_at, ends_at, capacity, approval_mode, status, published_at, pricing_mode)
  values (:'u2', 'community', 'Future event', 1, now() + interval '10 days', now() + interval '10 days 2 hours', 20, 'instant', 'published', now(), 'free');
select id as evf from public.events where title = 'Future event' \gset
insert into public.event_private (event_id, address) values (:'evf', '12 Church Street, Bengaluru');
insert into public.bookings (event_id, user_id, status) values (:'evf', :'u4', 'approved'), (:'evf', :'u5', 'approved');
-- a squad created by user 6 (cx) at the shared event, with user 3 approved
insert into public.squads (event_id, creator_id, meeting_point) values (:'evx', :'cx', 'Gate 2');
select id as sq from public.squads where creator_id = :'cx' \gset
insert into public.squad_members (squad_id, user_id, event_id, status) values (:'sq', :'cx', :'evx', 'approved'), (:'sq', :'u3', :'evx', 'approved');

-- ---------------------------------------------------------------- an ordinary report: instant hold
select pg_temp.act_as(3);
select throws_ok(format('select public.report(%L, %L, %L, null)', 'user', :'u3', 'harassment'), 'P0001', 'not_allowed', 'you CANNOT report yourself');
select throws_ok(format('select public.report(%L, %L, %L, null)', 'user', '00000000-0000-4000-8000-0000000009ff', 'harassment'), 'P0001', 'not_found', 'an unknown subject is refused');
select throws_ok(format('select public.report(%L, %L, %L, null)', 'user', :'u4', 'nonsense'), 'P0001', 'invalid_reason', 'the reason must be from the list');
select throws_ok(format('select public.report(%L, %L, %L, null)', 'robot', :'u4', 'spam'), 'P0001', 'invalid_subject', 'the subject type must be user, event or squad');
select lives_ok(format('select public.report(%L, %L, %L, %L)', 'user', :'u4', 'harassment', 'made me uncomfortable'), 'a report from someone who shares an event is accepted');
reset role;
select is((select status::text from public.profile_private where id = :'u4'), 'on_hold', 'the subject is on hold immediately');
select is((select count(*)::int from public.safety_reports where subject_user_id = :'u4' and held), 1, 'the report is saved and marked as the one that held them');
select is((select count(*)::int from public.email_outbox where template = 'safety_report_ack' and user_id = :'u3'), 1, 'the reporter gets an acknowledgement');
select is((select count(*)::int from public.email_outbox where template = 'admin_alert' and user_id = :'u1' and data ->> 'kind' = 'safety_report'), 1, 'admins get an alert email');
select is((select count(*)::int from public.email_outbox where template = 'account_on_hold' and user_id = :'u4'), 1, 'the subject is told neutrally by email');
select ok(not exists (select 1 from public.email_outbox where template = 'account_on_hold' and data::text ~* 'u3|harass|reporter'), 'which never names the reporter or the reason');
select is((select count(*)::int from public.notifications where user_id = :'u4' and kind = 'account_on_hold'), 1, 'and in the app');
select ok(exists (select 1 from public.audit_log where table_name = 'safety_reports' and action = 'INSERT'), 'the report has an audit entry');
select ok(exists (select 1 from public.audit_log where table_name = 'profile_private' and action = 'UPDATE' and new_data ->> 'status' = 'on_hold'), 'and so does the status change');
select is((select count(*)::int from public.notifications where user_id = :'u1' and kind = 'safety_report'), 1, 'admins see it in the app too');

-- who can see reports
select pg_temp.act_as(4);
select is((select count(*)::int from public.safety_reports), 0, 'the subject CANNOT see reports about them');
reset role; select pg_temp.act_as(5);
select is((select count(*)::int from public.safety_reports), 0, 'a stranger CANNOT see reports');
select throws_ok($$insert into public.safety_reports (reporter_id, subject_type, subject_id, subject_user_id, reason) values (null, 'user', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'spam')$$, '42501', null, 'a member CANNOT write reports directly');
reset role; select pg_temp.act_as(3);
select is((select count(*)::int from public.safety_reports), 1, 'the reporter sees their own report');
select throws_ok($$select held from public.safety_reports$$, '42501', null, 'but not whether it held anyone');
select throws_ok($$select outcome from public.safety_reports$$, '42501', null, 'nor the admins'' outcome');
select pg_temp.act_as_anon();
select throws_ok($$select count(*) from public.safety_reports$$, '42501', null, 'anon CANNOT read reports');

-- ---------------------------------------------------------------- guard rails
-- Joining an event days ahead is not enough to share it: the event must have started.
reset role;
insert into public.bookings (event_id, user_id, status) values (:'evf', :'x1', 'approved'), (:'evf', :'y1', 'approved');
select ok(not private.shares_event(:'x1', :'y1'), 'two people booked on an event that has not started do NOT share it yet');
update public.events set starts_at = now() - interval '1 hour', ends_at = now() + interval '1 hour' where id = :'evf';
select ok(private.shares_event(:'x1', :'y1'), 'once it has started they do');
update public.events set starts_at = now() + interval '10 days', ends_at = now() + interval '10 days 2 hours' where id = :'evf';
delete from public.bookings where user_id in (:'x1', :'y1');
select pg_temp.act_as_uid(:'x1');
select lives_ok(format('select public.report(%L, %L, %L, null)', 'user', :'y1', 'spam'), 'a report from a stranger is saved');
reset role;
select is((select status::text from public.profile_private where id = :'y1'), 'active', 'the subject stays active');
select is((select status::text from public.safety_reports where subject_user_id = :'y1'), 'open', 'and the report waits for an admin');
select pg_temp.act_as(3);
select lives_ok(format('select public.report(%L, %L, %L, null)', 'user', :'u1', 'other'), 'an admin can be reported');
select lives_ok(format('select public.report(%L, %L, %L, null)', 'event', :'evh', 'unsafe'), 'an event can be reported');
reset role;
select is((select status::text from public.profile_private where id = :'u1'), 'active', 'but an admin is never put on hold');
select is((select status::text from public.profile_private where id = :'hx'), 'on_hold', 'the host is on hold');
select pg_temp.act_as(3);
select lives_ok(format('select public.report(%L, %L, %L, null)', 'squad', :'sq', 'unsafe'), 'a squad can be reported');
reset role;
select is((select status::text from public.profile_private where id = :'cx'), 'on_hold', 'a report about a squad the reporter is in holds its creator');
update public.profile_private set status = 'suspended' where id = :'u5';
select pg_temp.act_as(3);
select lives_ok(format('select public.report(%L, %L, %L, null)', 'user', :'u5', 'harassment'), 'a suspended account can be reported');
reset role;
select is((select status::text from public.profile_private where id = :'u5'), 'suspended', 'it stays suspended');
update public.profile_private set status = 'active' where id = :'u5';
-- the rate limit: 5 reports a day
select pg_temp.act_as_uid(:'x1');
select public.report('user', :'y1', 'spam', null);
select public.report('user', :'y1', 'spam', null);
select public.report('user', :'y1', 'spam', null);
select public.report('user', :'y1', 'spam', null);
select throws_ok(format('select public.report(%L, %L, %L, null)', 'user', :'y1', 'spam'), 'P0001', 'rate_limited', 'at most 5 reports a day');
-- someone on hold can still report
reset role; select pg_temp.act_as(4);
select ok(not ((select public.report('user', :'y1', 'other', null)) ? 'held'), 'a member on hold can still report, and the answer never says whether anyone was put on hold');

-- ---------------------------------------------------------------- on hold is blocked everywhere (user 4 is on hold)
select throws_ok(format('select public.request_to_join(%L)', :'evf'), 'P0001', 'not_active', 'on hold: CANNOT request to join');
select throws_ok(format('select public.create_squad(%L, %L)', :'evf', 'Gate 1'), 'P0001', 'not_active', 'on hold: CANNOT create a squad');
select throws_ok(format('select public.request_to_join_squad(%L)', :'sq'), 'P0001', 'not_active', 'on hold: CANNOT ask to join a squad');
select throws_ok(format('select public.give_tags(%L, %L, array[1]::smallint[])', :'evx', :'u5'), 'P0001', 'not_active', 'on hold: CANNOT give tags');
select throws_ok(format('select public.submit_private_feedback(%L, %L, %L)', :'evx', :'u5', 'other'), 'P0001', 'not_active', 'on hold: CANNOT write private feedback');
select throws_ok(format('select public.rate_host(%L, 5, 5, 5)', :'evx'), 'P0001', 'not_active', 'on hold: CANNOT rate a host');
select throws_ok(format('select public.tap_meet_again(%L, %L)', :'evx', :'u5'), 'P0001', 'not_active', 'on hold: CANNOT tap meet again');
select throws_ok($$select * from public.my_feedback_tasks()$$, 'P0001', 'not_active', 'on hold: nothing to give feedback on');
select throws_ok($$select * from public.my_connections()$$, 'P0001', 'not_active', 'on hold: no connections list');
select throws_ok(format('select public.check_in_manual(%L)', '00000000-0000-4000-8000-0000000009ff'), 'P0001', 'not_active', 'on hold: CANNOT check anyone in');
select throws_ok(format('select * from public.host_checkin_list(%L)', :'evf'), 'P0001', 'not_active', 'on hold: CANNOT open the check-in list');
select throws_ok(format('select public.my_checkin_token(%L)', '00000000-0000-4000-8000-0000000009ff'), 'P0001', 'not_active', 'on hold: CANNOT get a QR token');
select throws_ok($$select public.apply_to_host('please')$$, 'P0001', 'not_active', 'on hold: CANNOT apply to host');
select throws_ok(format('select public.get_event_address(%L)', :'evf'), 'P0001', 'not_allowed', 'on hold: the exact address is withheld');
reset role; select pg_temp.act_as(5);
select lives_ok(format('select public.get_event_address(%L)', :'evf'), 'an active guest still gets the address');
-- a held HOST (user hx) is blocked from every host function
reset role; select pg_temp.act_as_uid(:'hx');
select throws_ok($$select public.create_event('{}'::jsonb)$$, 'P0001', 'not_active', 'a host on hold: CANNOT create events');
select throws_ok(format('select * from public.host_inbox(%L)', :'evf'), 'P0001', 'not_active', 'a host on hold: CANNOT open the inbox');
reset role;
select set_config('request.jwt.claims', null, true);
insert into public.bookings (event_id, user_id, status) values (:'evh', :'u5', 'requested');
select id as brq from public.bookings where event_id = :'evh' and user_id = :'u5' \gset
select pg_temp.act_as_uid(:'hx');
select throws_ok(format('select public.decide_request(%L, %L)', :'brq', 'approve'), 'P0001', 'not_active', 'a host on hold: CANNOT decide requests');
-- a held squad creator cannot approve people
reset role;
select set_config('request.jwt.claims', null, true); -- back to "no caller" for the setup inserts
insert into public.squads (event_id, creator_id, meeting_point) values (:'evf', :'u4', 'Gate 3');
select id as sq4 from public.squads where creator_id = :'u4' \gset
insert into public.squad_members (squad_id, user_id, event_id, status) values (:'sq4', :'u5', :'evf', 'requested');
select pg_temp.act_as(4);
select throws_ok(format('select public.decide_squad_request(%L, %L, true)', :'sq4', :'u5'), 'P0001', 'not_active', 'a squad creator on hold: CANNOT approve requests');
-- but a held member can always step back and ask for help
select lives_ok(format('select public.cancel_my_booking(%L)', (select id from public.bookings where event_id = :'evf' and user_id = :'u4')), 'on hold: can still cancel a booking');
select lives_ok($$select public.export_my_data()$$, 'on hold: can still export their data');

-- ---------------------------------------------------------------- appeals
reset role; select pg_temp.act_as(3);
select throws_ok($$select public.create_appeal('account_status', null, 'why')$$, 'P0001', 'not_allowed', 'an active member has nothing to appeal');
reset role; select pg_temp.act_as(4);
select throws_ok($$select public.create_appeal('account_status', null, '   ')$$, 'P0001', 'message_invalid', 'an appeal needs a message');
select lives_ok($$select public.create_appeal('account_status', null, 'I did nothing wrong, please check.')$$, 'a member on hold can appeal');
select throws_ok($$select public.create_appeal('account_status', null, 'again')$$, 'P0001', 'already_appealed', 'one open appeal at a time');
select is((select count(*)::int from public.appeals), 1, 'they see their own appeal');
reset role;
select is((select due_at - created_at from public.appeals where user_id = :'u4'), interval '48 hours', 'the response target is 48 hours');
select is((select count(*)::int from public.email_outbox where template = 'admin_alert' and data ->> 'kind' = 'appeal'), 1, 'admins are alerted to the appeal');
select id as ap4 from public.appeals where user_id = :'u4' \gset
select pg_temp.act_as(5);
select is((select count(*)::int from public.appeals), 0, 'a stranger CANNOT see someone else''s appeal');
select throws_ok(format('select public.resolve_appeal(%L, %L)', :'ap4', 'overturned'), 'P0001', 'not_allowed', 'a member CANNOT resolve appeals');
select throws_ok($$insert into public.appeals (user_id, kind, message) values ('00000000-0000-4000-8000-000000000005', 'account_status', 'x')$$, '42501', null, 'a member CANNOT write appeals directly');
reset role; select pg_temp.act_as(1);
select throws_ok(format('select public.resolve_appeal(%L, %L)', :'ap4', 'maybe'), 'P0001', 'invalid_decision', 'a decision is upheld or overturned');
select lives_ok(format('select public.resolve_appeal(%L, %L, %L)', :'ap4', 'overturned', 'Reported in error'), 'an admin resolves it');
select throws_ok(format('select public.resolve_appeal(%L, %L)', :'ap4', 'upheld'), 'P0001', 'already_resolved', 'once');
reset role;
select is((select status::text from public.profile_private where id = :'u4'), 'active', 'overturned: the member is active again');
select is((select status::text from public.safety_reports where subject_user_id = :'u4' and held), 'dismissed', 'and the report that held them is closed');
select is((select count(*)::int from public.notifications where user_id = :'u4' and kind = 'appeal_resolved'), 1, 'they are told');

-- an appeal against a tip
insert into public.profile_tips (user_id, issue_code, message) values (:'u3', 'other', 'A gentle note.');
select id as tip from public.profile_tips where user_id = :'u3' \gset
select pg_temp.act_as(5);
select throws_ok(format('select public.create_appeal(%L, %L, %L)', 'tip', :'tip', 'not mine'), 'P0001', 'not_found', 'you CANNOT appeal someone else''s tip');
reset role; select pg_temp.act_as(3);
select lives_ok(format('select public.create_appeal(%L, %L, %L)', 'tip', :'tip', 'This is unfair'), 'a member can appeal their own tip');
reset role;
select id as aptip from public.appeals where user_id = :'u3' \gset
select pg_temp.act_as(1);
select public.resolve_appeal(:'aptip', 'upheld', 'We looked carefully');
reset role;
select is((select status from public.profile_tips where id = :'tip'), 'active', 'upheld: the tip stays');
-- overdue appeals: one alert each
update public.appeals set status = 'open', resolved_at = null, resolved_by = null, due_at = now() - interval '1 hour' where id = :'aptip';
select private.job_feedback_windows();
select is((select count(*)::int from public.email_outbox where template = 'admin_alert' and data ->> 'kind' = 'appeal_overdue'), 1, 'an appeal past its 48 hours alerts the admins');
select private.job_feedback_windows();
select is((select count(*)::int from public.email_outbox where template = 'admin_alert' and data ->> 'kind' = 'appeal_overdue'), 1, 'only once');
select pg_temp.act_as(1);
select public.resolve_appeal(:'aptip', 'overturned', null);
reset role;
select is((select status from public.profile_tips where id = :'tip'), 'removed', 'overturned: the tip is removed');

select * from finish();
rollback;

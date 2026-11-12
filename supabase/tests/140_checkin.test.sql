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

-- ================================================================ check-in (B6.1)
-- An event that is on right now (started an hour ago, ends in an hour), hosted by user 2.
create function pg_temp.mk_live_event(p_title text, p_host uuid default '00000000-0000-4000-8000-000000000002') returns uuid language sql as $$
  insert into public.events (host_id, type, title, area_id, starts_at, ends_at, capacity, approval_mode, status, published_at, pricing_mode)
  values (p_host, 'community', p_title, 1, now() - interval '1 hour', now() + interval '1 hour', 20, 'instant', 'published', now(), 'free')
  returning id
$$;

select pg_temp.mk_live_event('Live event') as ev \gset
select pg_temp.mk_live_event('Other host live event', :'u3') as evo \gset
insert into public.bookings (event_id, user_id, status) values (:'ev', :'u3', 'approved'), (:'ev', :'u4', 'approved'), (:'ev', :'u5', 'approved');
update public.bookings set status = 'confirmed' where event_id = :'ev' and user_id = :'u4'; -- only the reconfirm path does this in the app
select id as b3, checkin_token as t3 from public.bookings where event_id = :'ev' and user_id = :'u3' \gset
select id as b4, checkin_token as t4 from public.bookings where event_id = :'ev' and user_id = :'u4' \gset
select id as b5 from public.bookings where event_id = :'ev' and user_id = :'u5' \gset

-- ---------------------------------------------------------------- the token stays private
select pg_temp.act_as(4);
select throws_ok($$select checkin_token from public.bookings$$, '42501', null, 'a member CANNOT read check-in tokens from the table');
select throws_ok(format('select public.my_checkin_token(%L)', :'b3'), 'P0001', 'not_found', 'a member CANNOT get someone else''s QR token');
reset role; select pg_temp.act_as(3);
select is((select public.my_checkin_token(:'b3')), :'t3'::uuid, 'the owner can get their own QR token');
select pg_temp.act_as_anon();
select throws_ok($$select public.check_in('00000000-0000-4000-8000-0000000000ff')$$, '42501', null, 'anon CANNOT check anyone in');

-- ---------------------------------------------------------------- who may check people in
reset role; select pg_temp.act_as(4);
select throws_ok(format('select public.check_in(%L)', :'t3'), 'P0001', 'not_allowed', 'an ordinary member CANNOT check someone in');
select throws_ok(format('select public.check_in_manual(%L)', :'b3'), 'P0001', 'not_allowed', 'an ordinary member CANNOT check someone in by hand');
reset role; select pg_temp.act_as(3);
select throws_ok(format('select public.check_in(%L)', :'t4'), 'P0001', 'not_allowed', 'the host of ANOTHER event cannot use a token from this event');
select throws_ok($$select public.check_in('11111111-2222-4333-8444-555555555555')$$, 'P0001', 'not_found', 'an unknown token is refused');

-- ---------------------------------------------------------------- the host checks in by QR and by hand
reset role; select pg_temp.act_as(2);
select is((select public.check_in(:'t3') ->> 'first_name'), (select first_name from public.profiles where id = :'u3'), 'the host checks someone in by QR and sees their name');
select is((select method from public.checkins where booking_id = :'b3'), 'qr', 'the check-in records the QR method');
select throws_ok(format('select public.check_in(%L)', :'t3'), 'P0001', 'already_checked_in', 'a second scan is refused');
select is((select public.check_in_manual(:'b4') ->> 'method'), 'manual', 'the host can tick someone off by hand');
select is((select count(*)::int from public.host_checkin_list(:'ev') where checked_in), 2, 'the host list shows two people ticked off');
select is((select count(*)::int from public.host_checkin_list(:'ev')), 3, 'the host list shows everyone holding a seat');
reset role; select pg_temp.act_as(3);
select throws_ok(format('select * from public.host_checkin_list(%L)', :'ev'), 'P0001', 'not_allowed', 'a member CANNOT open the host check-in list');

-- ---------------------------------------------------------------- an admin can check in too; seat and window rules
reset role; select pg_temp.act_as(1);
select throws_ok(format('update public.bookings set status = %L where id = %L', 'attended', :'b5'), '42501', null, 'nobody can write a booking straight from the browser, not even an admin');
reset role;
select pg_temp.mk_live_event('Requested only') as evr \gset
insert into public.bookings (event_id, user_id, status) values (:'evr', :'u5', 'requested');
select id as br from public.bookings where event_id = :'evr' \gset
select pg_temp.act_as(1);
select throws_ok(format('select public.check_in_manual(%L)', :'br'), 'P0001', 'booking_not_active', 'only approved or confirmed bookings can be checked in');
reset role;

-- an attendee on hold is not let in, and the host only hears "not active"
update public.profile_private set status = 'on_hold' where id = :'u5';
select pg_temp.act_as(2);
select throws_ok(format('select public.check_in_manual(%L)', :'b5'), 'P0001', 'attendee_not_active', 'someone on hold is not checked in');
reset role;
update public.profile_private set status = 'active' where id = :'u5';

-- the time window: 2 hours before the start to 4 hours after
update public.events set starts_at = now() + interval '3 hours', ends_at = now() + interval '5 hours' where id = :'ev';
select pg_temp.act_as(2);
select throws_ok(format('select public.check_in_manual(%L)', :'b5'), 'P0001', 'outside_window', 'too early: more than 2 hours before the start');
reset role;
update public.events set starts_at = now() + interval '1 hour 59 minutes', ends_at = now() + interval '4 hours' where id = :'ev';
select pg_temp.act_as(2);
select lives_ok(format('select public.check_in_manual(%L)', :'b5'), 'just inside the window: 1h59 before the start');
reset role;
delete from public.checkins where booking_id = :'b5';
update public.events set starts_at = now() - interval '4 hours 1 minute', ends_at = now() - interval '2 hours' where id = :'ev';
select pg_temp.act_as(2);
select throws_ok(format('select public.check_in_manual(%L)', :'b5'), 'P0001', 'outside_window', 'too late: more than 4 hours after the start');
reset role;
update public.events set starts_at = now() - interval '3 hours 59 minutes', ends_at = now() - interval '2 hours' where id = :'ev';
select pg_temp.act_as(2);
select lives_ok(format('select public.check_in_manual(%L)', :'b5'), 'just inside the window: 3h59 after the start');
reset role;
delete from public.checkins where booking_id = :'b5';

-- a cancelled event cannot be used
update public.events set status = 'cancelled' where id = :'evo';
select pg_temp.act_as(3);
select throws_ok(format('select public.check_in_manual(%L)', :'b5'), 'P0001', 'not_allowed', 'user 3 hosts a different event');
reset role;
update public.events set status = 'cancelled' where id = :'ev';
select pg_temp.act_as(2);
select throws_ok(format('select public.check_in_manual(%L)', :'b5'), 'P0001', 'event_not_open', 'a cancelled event cannot be checked into');
reset role;

-- ---------------------------------------------------------------- the records
select pg_temp.act_as(4);
select is((select count(*)::int from public.checkins), 1, 'a member sees only their own check-in');
select throws_ok($$insert into public.checkins (booking_id, event_id, user_id, method) select id, event_id, user_id, 'manual' from public.bookings limit 1$$, '42501', null,
  'a member CANNOT write check-ins directly');
reset role; select pg_temp.act_as(5);
select is((select count(*)::int from public.checkins), 0, 'a stranger sees no check-ins');
select pg_temp.act_as_anon();
select throws_ok($$select count(*) from public.checkins$$, '42501', null, 'anon CANNOT read check-ins');
reset role;
select ok(exists (select 1 from public.audit_log where table_name = 'checkins' and action = 'INSERT'), 'a check-in is written to the audit log');

-- ================================================================ counting attendance
-- A fresh event with three seats. Two are checked in; the third is not.
create function pg_temp.mk_past_event(p_title text) returns uuid language sql as $$
  insert into public.events (host_id, type, title, area_id, starts_at, ends_at, capacity, approval_mode, status, published_at, pricing_mode)
  values ('00000000-0000-4000-8000-000000000002', 'community', p_title, 1, now() - interval '5 hours', now() - interval '3 hours', 20, 'instant', 'published', now(), 'free')
  returning id
$$;
select pg_temp.mk_past_event('Counted event') as ec \gset
insert into public.bookings (event_id, user_id, status) values (:'ec', :'u3', 'approved'), (:'ec', :'u4', 'approved'), (:'ec', :'u5', 'approved');
update public.bookings set status = 'confirmed' where event_id = :'ec' and user_id = :'u4';
insert into public.checkins (booking_id, event_id, user_id, checked_in_by, method)
  select id, event_id, user_id, :'u2', 'manual' from public.bookings where event_id = :'ec' and user_id in (:'u3', :'u4');

select is(private.finalise_event(:'ec', false, false), 'finalised', 'attendance is counted two hours after the event ends');
select is((select status::text from public.bookings where event_id = :'ec' and user_id = :'u3'), 'attended', 'a checked-in booking becomes attended');
select is((select status::text from public.bookings where event_id = :'ec' and user_id = :'u4'), 'attended', 'a checked-in confirmed booking becomes attended');
select is((select status::text from public.bookings where event_id = :'ec' and user_id = :'u5'), 'no_show', 'a seat that was not checked in becomes no_show');
select is((select status::text from public.events where id = :'ec'), 'completed', 'the event is completed');
select ok((select feedback_closes_at between now() + interval '71 hours 59 minutes' and now() + interval '72 hours 1 minute' from public.events where id = :'ec'), 'the feedback window is open for 72 hours');
select is(private.finalise_event(:'ec', false, false), 'already', 'counting twice does nothing');
select is((select count(*)::int from public.email_outbox where template = 'feedback_prompt' and data ->> 'event_id' = :'ec'), 3, 'the two guests and the host get a feedback prompt');
select is((select count(*)::int from public.notifications where kind = 'attended' and data ->> 'event_id' = :'ec'), 2, 'attended guests are told in the app');
select is((select count(*)::int from public.notifications where kind = 'no_show' and data ->> 'event_id' = :'ec'), 1, 'a no-show is told gently in the app');

-- someone put on hold before the event could not be checked in: no lasting no-show for them
select pg_temp.mk_past_event('Held guest') as eh \gset
insert into public.bookings (event_id, user_id, status) values (:'eh', :'u3', 'approved'), (:'eh', :'u4', 'approved');
insert into public.checkins (booking_id, event_id, user_id, checked_in_by, method) select id, event_id, user_id, :'u2', 'manual' from public.bookings where event_id = :'eh' and user_id = :'u3';
update public.profile_private set status = 'on_hold' where id = :'u4';
select is(private.finalise_event(:'eh', false, false), 'finalised', 'the event is counted');
select is((select status::text from public.bookings where event_id = :'eh' and user_id = :'u4'), 'approved', 'a person on hold who was not checked in is NOT marked no_show');
select is((select status::text from public.bookings where event_id = :'eh' and user_id = :'u3'), 'attended', 'while the person who was checked in is attended');
update public.profile_private set status = 'active' where id = :'u4';

-- too early
insert into public.events (host_id, type, title, area_id, starts_at, ends_at, capacity, approval_mode, status, published_at, pricing_mode)
  values (:'u2', 'community', 'Too early', 1, now() - interval '3 hours', now() - interval '1 hour', 20, 'instant', 'published', now(), 'free');
select id as ete from public.events where title = 'Too early' \gset
select is(private.finalise_event(:'ete', false, false), 'too_early', 'attendance is not counted before 2 hours after the end');

-- SAFETY RULE: nobody checked in at all -> nobody is marked no_show, admins get a flag instead
select pg_temp.mk_past_event('Forgetful host') as ez \gset
insert into public.bookings (event_id, user_id, status) values (:'ez', :'u3', 'approved'), (:'ez', :'u4', 'approved');
select is(private.finalise_event(:'ez', false, false), 'no_checkins', 'an event with seats but no check-ins is held back');
select is((select count(*)::int from public.bookings where event_id = :'ez' and status = 'approved'), 2, 'nobody is marked no_show because the host forgot');
select is((select count(*)::int from public.review_flags where kind = 'no_checkins' and event_id = :'ez'), 1, 'admins get a flag');
select is(private.finalise_event(:'ez', false, false), 'no_checkins', 'the next run still holds it back');
select is((select count(*)::int from public.review_flags where kind = 'no_checkins' and event_id = :'ez'), 1, 'the flag is not repeated');
select is((select count(*)::int from public.notifications where kind = 'no_checkins' and user_id = :'u1'), 1, 'the admin is told once');
select is((select attendance_finalised_at from public.events where id = :'ez'), null, 'the event stays open for an admin to decide');

-- admin on demand: only admins, only ended events
select pg_temp.act_as(2);
select throws_ok(format('select public.admin_finalise_event_now(%L)', :'ez'), 'P0001', 'not_allowed', 'a host CANNOT finish an event on demand');
reset role; select pg_temp.act_as(1);
select is((select public.admin_finalise_event_now(:'ete')), 'finalised', 'an admin can finish an event on demand, skipping only the 2-hour wait');
select is((select public.admin_finalise_event_now(:'ez', true)), 'finalised', 'an admin can close a no-check-in event and mark the no-shows');
reset role;
select is((select count(*)::int from public.bookings where event_id = :'ez' and status = 'no_show'), 2, 'then the seats become no_show');

-- the scheduled job
update public.events set ends_at = now() - interval '2 hours 1 minute', starts_at = now() - interval '4 hours' where id = :'ete';
select pg_temp.mk_past_event('Job event') as ej \gset
insert into public.bookings (event_id, user_id, status) values (:'ej', :'u3', 'approved');
insert into public.checkins (booking_id, event_id, user_id, checked_in_by, method) select id, event_id, user_id, :'u2', 'qr' from public.bookings where event_id = :'ej';
select private.job_finalise_attendance();
select is((select status::text from public.bookings where event_id = :'ej'), 'attended', 'the job counts attendance');
select is((select last_status from public.job_runs where job = 'attendance'), 'ok', 'the job records itself');
select is((select count(*)::int from cron.job where jobname in ('attendance', 'reputation', 'feedback-windows', 'reputation-nightly')), 4, 'the four B6 jobs are scheduled');

select * from finish();
rollback;

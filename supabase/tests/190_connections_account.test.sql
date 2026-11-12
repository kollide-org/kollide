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

-- ================================================================ meet again (B6.5) and account data (B6.7)
select pg_temp.mk_done_event('Meet event', array[:'u3', :'u4', :'u5']::uuid[]) as em \gset
select pg_temp.mk_done_event('Elsewhere', array[:'u3']::uuid[]) as ee \gset

-- ---------------------------------------------------------------- one-way taps are private
select pg_temp.act_as(3);
select throws_ok(format('select public.tap_meet_again(%L, %L)', :'em', :'u3'), 'P0001', 'not_allowed', 'you CANNOT tap yourself');
select throws_ok(format('select public.tap_meet_again(%L, %L)', :'ee', :'u4'), 'P0001', 'not_allowed', 'you CANNOT tap someone who was not at that event');
select is((select public.tap_meet_again(:'em', :'u4') ->> 'mutual'), 'false', 'a first tap is not a connection');
select is((select count(*)::int from public.my_connections()), 0, 'and nothing shows yet');
select is((select count(*)::int from public.connections), 1, 'you can see the taps you made');
reset role; select pg_temp.act_as(4);
select is((select count(*)::int from public.connections), 0, 'the person tapped CANNOT see that they were tapped');
select is((select count(*)::int from public.my_connections()), 0, 'and has no connection yet');
select is((select count(*)::int from public.notifications where user_id = :'u4' and kind = 'connection'), 0, 'nor is there any notice');
select throws_ok($$insert into public.connections (event_id, from_user, to_user) select event_id, to_user, from_user from public.connections$$, '42501', null, 'a member CANNOT write taps directly');
reset role; select pg_temp.act_as(5);
select is((select count(*)::int from public.connections), 0, 'a stranger sees no taps');
select pg_temp.act_as_anon();
select throws_ok($$select count(*) from public.connections$$, '42501', null, 'anon CANNOT read taps');

-- ---------------------------------------------------------------- a mutual tap is a connection
reset role; select pg_temp.act_as(4);
select is((select public.tap_meet_again(:'em', :'u3') ->> 'mutual'), 'true', 'when both tap, it is a connection');
select is((select count(*)::int from public.my_connections()), 1, 'it shows for the second person');
select is((select first_name from public.my_connections()), (select first_name from public.profiles where id = :'u3'), 'with a first name only');
reset role; select pg_temp.act_as(3);
select is((select count(*)::int from public.my_connections()), 1, 'and for the first');
select is((select count(*)::int from public.notifications where user_id = :'u3' and kind = 'connection'), 1, 'both are told once it is mutual');
select is((select count(*)::int from public.review_flags where kind = 'repeat_event_group'), 0, 'two people are not a group');

-- three people who all tap each other: admins hear about it
reset role; select pg_temp.act_as(5);
select public.tap_meet_again(:'em', :'u3');
select public.tap_meet_again(:'em', :'u4');
reset role; select pg_temp.act_as(3);
select public.tap_meet_again(:'em', :'u5');
reset role; select pg_temp.act_as(4);
select is((select public.tap_meet_again(:'em', :'u5') ->> 'mutual'), 'true', 'the third pair completes the group');
reset role;
select is((select count(*)::int from public.review_flags where kind = 'repeat_event_group' and event_id = :'em'), 1, 'admins get a "suggest a repeat event" flag');
select is((select count(*)::int from public.notifications where user_id = :'u1' and kind = 'repeat_event_group'), 1, 'and a notification, once');

-- blocks and windows
insert into public.user_blocks (blocker_id, blocked_id) values (:'u3', :'u4');
select pg_temp.act_as(3);
select is((select count(*)::int from public.my_connections()), 1, 'a blocked person disappears from connections (only user 5 is left)');
select pg_temp.act_as(4);
select throws_ok(format('select public.tap_meet_again(%L, %L)', :'em', :'u3'), 'P0001', 'not_allowed', 'blocked people CANNOT tap each other');
reset role;
delete from public.user_blocks;
update public.events set feedback_closes_at = now() - interval '1 minute' where id = :'em';
select pg_temp.act_as(5);
select throws_ok(format('select public.tap_meet_again(%L, %L)', :'em', :'u2'), 'P0001', 'feedback_closed', 'no taps after the window closes');
reset role;

-- ---------------------------------------------------------------- export and delete
select pg_temp.act_as(3);
select ok(public.export_my_data() ? 'checkins' and public.export_my_data() ? 'tags_given' and public.export_my_data() ? 'meet_again_taps'
  and public.export_my_data() ? 'reports_filed' and public.export_my_data() ? 'appeals' and public.export_my_data() ? 'bookings', 'the export has every B6 section');
select is((select jsonb_array_length(public.export_my_data() -> 'checkins')), 2, 'with this person''s own check-ins');
reset role; select pg_temp.act_as(1);
select is((select jsonb_array_length(public.export_my_data() -> 'private_feedback_written')), 0, 'an admin''s export has only what the admin wrote (not everyone''s notes)');
reset role;

-- user 3 wrote a note, filed a report, gave tags; user 4 received a tip. Deleting user 3 removes what they gave and received.
select pg_temp.mk_done_event('Delete event', array[:'u3', :'u4']::uuid[]) as ed \gset
insert into public.private_feedback (event_id, from_user, about_user, issue_code, note) values (:'ed', :'u3', :'u4', 'other', 'kept without a name');
insert into public.private_feedback (event_id, from_user, about_user, issue_code, note) values (:'ed', :'u4', :'u3', 'other', 'about the leaver');
insert into public.safety_reports (reporter_id, subject_type, subject_id, subject_user_id, reason) values (:'u3', 'user', :'u4', :'u4', 'other'), (:'u4', 'user', :'u3', :'u3', 'other');
insert into public.tag_awards (event_id, from_user, to_user, tag_ids) values (:'ed', :'u3', :'u4', array[1]::smallint[]), (:'ed', :'u4', :'u3', array[1]::smallint[]);
insert into public.profile_tips (user_id, issue_code, message) values (:'u3', 'other', 'tip for the leaver');
insert into public.host_ratings (event_id, from_user, host_id, as_described, felt_safe, well_organised) values (:'ed', :'u3', :'u2', 5, 5, 5);
select pg_temp.act_as(3);
select public.delete_my_account();
reset role;
select is((select count(*)::int from public.tag_awards where from_user = :'u3' or to_user = :'u3'), 0, 'deleting: tags given and received are gone');
select is((select count(*)::int from public.connections where from_user = :'u3' or to_user = :'u3'), 0, 'taps are gone');
select is((select count(*)::int from public.checkins where user_id = :'u3'), 0, 'check-ins are gone');
select is((select count(*)::int from public.host_ratings where from_user = :'u3'), 0, 'ratings they gave are gone');
select is((select count(*)::int from public.profile_tips where user_id = :'u3'), 0, 'tips about them are gone');
select is((select count(*)::int from public.private_feedback where about_user = :'u3'), 0, 'notes about them are gone');
select is((select count(*)::int from public.private_feedback where note = 'kept without a name' and from_user is null), 1, 'a note they wrote stays, without their name');
select is((select count(*)::int from public.safety_reports where subject_user_id = :'u4' and reporter_id is null), 1, 'a report they filed stays, without their name');
select is((select count(*)::int from public.safety_reports where subject_user_id = :'u3'), 1, 'a report about them stays for the safety team');
select is((select count(*)::int from public.notifications where user_id = :'u3'), 0, 'their notifications are gone');
select is((select first_name from public.profiles where id = :'u3'), 'Former member', 'the profile is anonymised');
select is((select count(*)::int from public.bookings where user_id = :'u3' and status = 'attended'), 3, 'their attendance rows stay, anonymised, for the record');

-- ---------------------------------------------------------------- review flags are for admins only
select pg_temp.act_as(5);
select is((select count(*)::int from public.review_flags), 0, 'a member CANNOT see review flags');
select throws_ok($$insert into public.review_flags (kind, ref_key) values ('collusion', 'x')$$, '42501', null, 'a member CANNOT write review flags');
select throws_ok($$update public.review_flags set status = 'dismissed'$$, '42501', null, 'a member CANNOT resolve review flags');
select pg_temp.act_as_anon();
select throws_ok($$select count(*) from public.review_flags$$, '42501', null, 'anon CANNOT read review flags');
reset role; select pg_temp.act_as(1);
select ok((select count(*)::int from public.review_flags) >= 1, 'an admin can read review flags');
reset role;

select * from finish();
rollback;

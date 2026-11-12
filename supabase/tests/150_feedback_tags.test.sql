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

-- ================================================================ tags, double-blind reveal and host ratings (B6.2)
-- Event A: users 3, 4, 5 were there (host: user 2). Event B: only user 4 and 5.
select pg_temp.mk_done_event('Event A', array[:'u3', :'u4', :'u5']::uuid[]) as ea \gset
select pg_temp.mk_done_event('Event B', array[:'u4', :'u5']::uuid[]) as eb \gset
-- Event C has ended but attendance was not counted yet, so there is no window.
insert into public.events (host_id, type, title, area_id, starts_at, ends_at, capacity, approval_mode, status, published_at, pricing_mode)
  values (:'u2', 'community', 'Event C', 1, now() - interval '3 hours', now() - interval '1 hour', 20, 'instant', 'published', now(), 'free');
select id as ec from public.events where title = 'Event C' \gset
insert into public.bookings (event_id, user_id, status) values (:'ec', :'u3', 'approved');
insert into public.checkins (booking_id, event_id, user_id, checked_in_by, method) select id, event_id, user_id, :'u2', 'manual' from public.bookings where event_id = :'ec';

-- ---------------------------------------------------------------- who can give tags
select pg_temp.act_as(3);
select throws_ok(format('select public.give_tags(%L, %L, array[1]::smallint[])', :'ea', :'u3'), 'P0001', 'not_allowed', 'you CANNOT tag yourself');
select throws_ok(format('select public.give_tags(%L, %L, array[1]::smallint[])', :'eb', :'u4'), 'P0001', 'not_allowed', 'you CANNOT tag someone at an event you were not at');
select throws_ok(format('select public.give_tags(%L, %L, array[1]::smallint[])', :'ea', '00000000-0000-4000-8000-0000000000aa'), 'P0001', 'not_allowed', 'you CANNOT tag someone who was not at the event');
select throws_ok(format('select public.give_tags(%L, %L, array[1]::smallint[])', :'ec', :'u2'), 'P0001', 'feedback_closed', 'no window yet: attendance has not been counted');
reset role; select pg_temp.act_as(5);
select throws_ok(format('select public.give_tags(%L, %L, array[1]::smallint[])', :'eb', :'u3'), 'P0001', 'not_allowed', 'user 3 was not at event B, so user 5 CANNOT review them there');
reset role; select pg_temp.act_as(1);
select throws_ok(format('select public.give_tags(%L, %L, array[1]::smallint[])', :'ea', :'u3'), 'P0001', 'not_allowed', 'an admin who was not there CANNOT give tags either');
reset role; select pg_temp.act_as_anon();
select throws_ok(format('select public.give_tags(%L, %L, array[1]::smallint[])', :'ea', :'u3'), '42501', null, 'anon CANNOT give tags');

-- ---------------------------------------------------------------- tag rules
reset role; select pg_temp.act_as(3);
select throws_ok(format('select public.give_tags(%L, %L, array[1,2,3,4]::smallint[])', :'ea', :'u4'), 'P0001', 'too_many_tags', 'at most 3 tags per person');
select throws_ok(format('select public.give_tags(%L, %L, array[]::smallint[])', :'ea', :'u4'), 'P0001', 'invalid_tags', 'at least one tag');
select throws_ok(format('select public.give_tags(%L, %L, array[1,1]::smallint[])', :'ea', :'u4'), 'P0001', 'invalid_tags', 'the same tag twice is refused');
select throws_ok(format('select public.give_tags(%L, %L, array[999]::smallint[])', :'ea', :'u4'), 'P0001', 'invalid_tags', 'a tag that is not on the list is refused');
reset role;
update public.positive_tags set active = false where id = 3;
select pg_temp.act_as(3);
select throws_ok(format('select public.give_tags(%L, %L, array[3]::smallint[])', :'ea', :'u4'), 'P0001', 'invalid_tags', 'a retired tag is refused');
reset role;
update public.positive_tags set active = true where id = 3;
select pg_temp.act_as(3);
select lives_ok(format('select public.give_tags(%L, %L, array[1,2,3]::smallint[])', :'ea', :'u4'), 'three tags are accepted');
select throws_ok($$select revealed_at from public.tag_awards$$, '42501', null, 'the giver CANNOT read revealed_at: they must not learn whether the other person tagged them back');
select throws_ok(format('select public.give_tags(%L, %L, array[4]::smallint[])', :'ea', :'u4'), 'P0001', 'already_submitted', 'you CANNOT review the same person twice at one event');
select is((select count(*)::int from public.tag_awards), 1, 'the giver can see what they gave');
reset role; select pg_temp.act_as(4);
select is((select count(*)::int from public.tag_awards), 0, 'the receiver CANNOT see tags about them (not even hidden ones)');
select throws_ok($$insert into public.tag_awards (event_id, from_user, to_user, tag_ids) select event_id, to_user, from_user, tag_ids from public.tag_awards$$, '42501', null, 'a member CANNOT write tags directly');

-- ---------------------------------------------------------------- double-blind: hidden until both sides submitted
reset role;
refresh materialized view private.user_reputation;
select is((select top_tags from private.user_reputation where user_id = :'u4'), '[]'::jsonb, 'a hidden tag does not count towards the profile yet');
select pg_temp.act_as(4);
select lives_ok(format('select public.give_tags(%L, %L, array[2]::smallint[])', :'ea', :'u3'), 'the other side answers');
reset role;
select is((select count(*)::int from public.tag_awards where event_id = :'ea' and revealed_at is not null), 2, 'when the other side has answered, both are revealed');
select is((select count(*)::int from public.tag_awards where event_id = :'ea' and revealed_at is not null), 2, 'both directions are revealed together');
refresh materialized view private.user_reputation;
select is((select jsonb_array_length(top_tags) from private.user_reputation where user_id = :'u4'), 3, 'the revealed tags now count (3 tags)');
select is((select jsonb_array_length(top_tags) from private.user_reputation where user_id = :'u3'), 1, 'the other person got their one tag');

-- ---------------------------------------------------------------- reveal when the window closes
select pg_temp.act_as(5);
select lives_ok(format('select public.give_tags(%L, %L, array[5]::smallint[])', :'ea', :'u3'), 'user 5 tags user 3: the other side has not answered');
reset role;
select is(private.reveal_closed_tags(), 0, 'while the window is open nothing is revealed early');
update public.events set feedback_closes_at = now() - interval '1 minute' where id = :'ea';
select is(private.reveal_closed_tags(), 1, 'once the window has closed the rest is revealed');
select ok((select revealed_at is not null from public.tag_awards where event_id = :'ea' and from_user = :'u5'), 'the one-sided tag is revealed');
select pg_temp.act_as(4);
select throws_ok(format('select public.give_tags(%L, %L, array[1]::smallint[])', :'ea', :'u5'), 'P0001', 'feedback_closed', 'after 72 hours nobody can give tags');
reset role;
update public.events set feedback_closes_at = now() + interval '72 hours' where id = :'ea';

-- ---------------------------------------------------------------- the host takes part too
select pg_temp.act_as(3);
select lives_ok(format('select public.give_tags(%L, %L, array[1]::smallint[])', :'ea', :'u2'), 'a guest can tag the host');
reset role; select pg_temp.act_as(2);
select lives_ok(format('select public.give_tags(%L, %L, array[1]::smallint[])', :'ea', :'u5'), 'the host can tag a guest');

-- ---------------------------------------------------------------- what is left to do
reset role; select pg_temp.act_as(3);
select is((select count(*)::int from public.my_feedback_tasks()), 1, 'one event is waiting for feedback (event C has no window)');
select is((select jsonb_array_length(people) from public.my_feedback_tasks() where event_id = :'ea'), 3, 'three other people: the host and two guests');
select ok((select (select (p ->> 'tagged')::boolean from jsonb_array_elements(people) p where p ->> 'user_id' = :'u4') from public.my_feedback_tasks() where event_id = :'ea'),
  'tagged people are marked');
select ok((select can_rate_host from public.my_feedback_tasks() where event_id = :'ea'), 'a checked-in guest can rate the host');
reset role; select pg_temp.act_as(2);
select ok(not (select can_rate_host from public.my_feedback_tasks() where event_id = :'ea'), 'the host cannot rate themselves');
reset role; select pg_temp.act_as(1);
select is((select count(*)::int from public.my_feedback_tasks()), 0, 'an admin who was not there has nothing to do');

-- ---------------------------------------------------------------- blocks hide people from each other
reset role;
insert into public.user_blocks (blocker_id, blocked_id) values (:'u5', :'u3');
select pg_temp.act_as(3);
select is((select jsonb_array_length(people) from public.my_feedback_tasks() where event_id = :'ea'), 2, 'a blocked person is not listed');
reset role;
delete from public.user_blocks;

-- ---------------------------------------------------------------- host ratings
select pg_temp.act_as(3);
select throws_ok(format('select public.rate_host(%L, 6, 5, 5)', :'ea'), 'P0001', 'invalid_rating', 'ratings go from 1 to 5');
select throws_ok(format('select public.rate_host(%L, 0, 5, 5)', :'ea'), 'P0001', 'invalid_rating', 'zero is not a rating');
select lives_ok(format('select public.rate_host(%L, 5, 4, 5)', :'ea'), 'a checked-in guest rates the host');
select throws_ok(format('select public.rate_host(%L, 5, 4, 5)', :'ea'), 'P0001', 'already_submitted', 'one rating per guest per event');
select throws_ok(format('select public.rate_host(%L, 5, 4, 5)', :'eb'), 'P0001', 'not_allowed', 'a guest who was not at the event CANNOT rate its host');
select is((select count(*)::int from public.host_ratings), 1, 'the guest sees their own rating');
reset role; select pg_temp.act_as(2);
select throws_ok(format('select public.rate_host(%L, 5, 5, 5)', :'ea'), 'P0001', 'not_allowed', 'the host CANNOT rate themselves');
select is((select count(*)::int from public.host_ratings), 0, 'the host CANNOT read ratings about them');
reset role; select pg_temp.act_as(4);
select is((select count(*)::int from public.host_ratings), 0, 'another guest CANNOT read someone else''s rating');
select throws_ok($$insert into public.host_ratings (event_id, from_user, host_id, as_described, felt_safe, well_organised) values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002', 5, 5, 5)$$,
  '42501', null, 'a member CANNOT write host ratings directly');
reset role;
update public.events set feedback_closes_at = now() - interval '1 minute' where id = :'ea';
select pg_temp.act_as(5);
select throws_ok(format('select public.rate_host(%L, 5, 5, 5)', :'ea'), 'P0001', 'feedback_closed', 'no ratings once the window is closed');
reset role;

-- the host score view (private) averages the ratings; admins read it through the nightly check
select is((select overall from private.host_scores where host_id = :'u2'), 4.67, 'the host score is the average of the three scores');
select pg_temp.act_as_anon();
select throws_ok($$select * from private.host_scores$$, '42501', null, 'anon CANNOT read host scores');
reset role; select pg_temp.act_as(2);
select throws_ok($$select * from private.host_scores$$, '42501', null, 'a host CANNOT read host scores');

select * from finish();
rollback;

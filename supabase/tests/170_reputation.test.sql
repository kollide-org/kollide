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

-- ================================================================ reputation (B6.3)
-- User 3 (Meera): three events attended, one missed, plus one attended 400 days ago.
select pg_temp.mk_done_event('Rep 1', array[:'u3', :'u4']::uuid[]) as e1 \gset
select pg_temp.mk_done_event('Rep 2', array[:'u3', :'u4']::uuid[]) as e2 \gset
select pg_temp.mk_done_event('Rep 3', array[:'u3']::uuid[], array[:'u4']::uuid[]) as e3 \gset
select pg_temp.mk_done_event('Rep 4', array[:'u4']::uuid[], array[:'u3']::uuid[]) as e4 \gset
select pg_temp.mk_done_event('Rep old', array[:'u3']::uuid[], '{}', interval '400 days') as eold \gset

refresh materialized view private.user_reputation;

-- ---------------------------------------------------------------- numbers
select pg_temp.act_as(5);
select is((select events_attended from public.profile_cards where id = :'u3'), 4, 'events attended counts every attended booking (also older than a year)');
select is((select shows_up_attended from public.profile_cards where id = :'u3'), 3, 'shows up: 3 attended in the last 12 months...');
select is((select shows_up_total from public.profile_cards where id = :'u3'), 4, '...of 4 (3 attended + 1 no-show; the 400-day-old event is outside the window)');
select is((select shows_up_attended || ' of ' || shows_up_total from public.profile_cards where id = :'u4'), '3 of 4', 'user 4 shows up 3 of 4 too');
select is((select is_new from public.profile_cards where id = :'u3'), false, 'someone with history is not new');
select is((select is_new from public.profile_cards where id = :'u5'), true, 'someone with no history is "New to Kollide"');
select is((select events_attended || '/' || shows_up_total from public.profile_cards where id = :'u5'), '0/0', 'and shows 0 of 0');
select is((select top_tags from public.profile_cards where id = :'u5'), '[]'::jsonb, 'with no tags');

-- the host has history too once their events are counted
select is((select is_new from public.profile_cards where id = :'u2'), false, 'a host whose events were counted is not new');

-- ---------------------------------------------------------------- top 3 tags
reset role;
-- user 4 is tagged by user 3 and the host (user 2) across two events. Tags are revealed in pairs once both sides have answered.
select pg_temp.act_as(3);
select public.give_tags(:'e1', :'u4', array[1, 8]::smallint[]);  -- warm, reliable
select public.give_tags(:'e2', :'u4', array[1, 7]::smallint[]);  -- warm, thoughtful
reset role; select pg_temp.act_as(4);
select public.give_tags(:'e1', :'u3', array[2]::smallint[]);
select public.give_tags(:'e2', :'u3', array[2]::smallint[]);
select public.give_tags(:'e1', :'u2', array[1, 4]::smallint[]);
reset role; select pg_temp.act_as(2);
select public.give_tags(:'e1', :'u4', array[8, 7, 5]::smallint[]); -- reliable, thoughtful, easy-to-talk-to (answers user 4: revealed)
select public.give_tags(:'e2', :'u4', array[1]::smallint[]);        -- warm (hidden until user 4 answers)
select public.give_tags(:'e1', :'u3', array[4]::smallint[]);        -- one-sided: stays hidden
reset role; select pg_temp.act_as(4);
select public.give_tags(:'e2', :'u2', array[5]::smallint[]);        -- answers: reveals the host's warm tag
reset role;
refresh materialized view private.user_reputation;
select is((select jsonb_array_length(top_tags) from private.user_reputation where user_id = :'u4'), 3, 'only the top 3 tags are kept');
select is((select top_tags -> 0 ->> 'slug' from private.user_reputation where user_id = :'u4'), 'warm', 'ordered by how often they were given: warm first');
select is((select (top_tags -> 0 ->> 'count')::int from private.user_reputation where user_id = :'u4'), 3, 'warm was given three times');
select is((select (top_tags -> 2 ->> 'count')::int from private.user_reputation where user_id = :'u4'), 2, 'and the third tag twice (the one given once is left out)');
select is((select count(*)::int from public.tag_awards where from_user = :'u2' and to_user = :'u3' and revealed_at is null), 1, 'a one-sided tag is still hidden');
select is((select count(*)::int from jsonb_array_elements((select top_tags from private.user_reputation where user_id = :'u3')) t where t ->> 'slug' = 'made-me-feel-welcome'), 0, 'and hidden tags are not in the top tags');
select pg_temp.act_as(5);
select is((select jsonb_array_length(top_tags) from public.profile_cards where id = :'u4'), 3, 'the profile card shows the tags');

-- tags from an event older than 12 months do not count
reset role;
select pg_temp.mk_done_event('Rep old tags', array[:'u3', :'u5']::uuid[], '{}', interval '400 days') as eot \gset
insert into public.tag_awards (event_id, from_user, to_user, tag_ids, revealed_at) values (:'eot', :'u3', :'u5', array[1]::smallint[], now());
refresh materialized view private.user_reputation;
select is((select top_tags from private.user_reputation where user_id = :'u5'), '[]'::jsonb, 'tags from events older than a year do not count');

-- ---------------------------------------------------------------- the host inbox shows the real numbers
select pg_temp.mk_done_event('Inbox host event', array[]::uuid[]) as dummy \gset
insert into public.events (host_id, type, title, area_id, starts_at, ends_at, capacity, approval_mode, status, published_at, pricing_mode)
  values (:'u2', 'community', 'Future event', 1, now() + interval '5 days', now() + interval '5 days 2 hours', 20, 'host_approval', 'published', now(), 'free');
select id as ef from public.events where title = 'Future event' \gset
insert into public.bookings (event_id, user_id, status) values (:'ef', :'u3', 'requested'), (:'ef', :'u5', 'requested');
select pg_temp.act_as(2);
select is((select shows_up_attended || ' of ' || shows_up_total from public.host_inbox(:'ef') where user_id = :'u3'), '3 of 4', 'the host inbox shows "shows up 3 of 4"');
select is((select shows_up_total from public.host_inbox(:'ef') where user_id = :'u5'), 0, 'and 0 for someone new');
select is((select jsonb_array_length(top_tags) from public.host_inbox(:'ef') where user_id = :'u3'), 1, 'and their top tags');
reset role; select pg_temp.act_as(4);
select throws_ok(format('select * from public.host_inbox(%L)', :'ef'), 'P0001', 'not_allowed', 'a member CANNOT open someone else''s inbox');

-- ---------------------------------------------------------------- privacy of the numbers
select pg_temp.act_as_anon();
select throws_ok($$select * from public.profile_cards$$, '42501', null, 'anon CANNOT read profile cards');
select throws_ok($$select * from private.user_reputation$$, '42501', null, 'anon CANNOT read the reputation view');
reset role; select pg_temp.act_as(5);
select throws_ok($$refresh materialized view private.user_reputation$$, '42501', null, 'a member CANNOT refresh it');
select throws_ok($$select private.refresh_reputation()$$, '42501', null, 'nor call the refresh function');

-- ---------------------------------------------------------------- the refresh job
reset role;
select private.job_refresh_reputation();
select is((select last_status from public.job_runs where job = 'reputation'), 'ok', 'the refresh job records itself');

-- a deleted or held member's card follows the existing profile rules (held members are hidden from others)
update public.profile_private set status = 'on_hold' where id = :'u3';
select pg_temp.act_as(5);
select is((select count(*)::int from public.profile_cards where id = :'u3'), 0, 'a member on hold disappears from other members'' cards');

select * from finish();
rollback;

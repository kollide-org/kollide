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

-- ================================================================ consent: record_consent and the analytics helper (B8.1)
\set anon1 '11111111-1111-4111-8111-1111111111a1'
\set anon2 '11111111-1111-4111-8111-1111111111a2'

-- ---------------------------------------------------------------- a logged-out visitor
select pg_temp.act_as_anon();
select lives_ok(format('select public.record_consent(%L, %L, true, false, false)', :'anon1', 'v1'), 'a visitor records a choice');
select throws_ok(format('select public.record_consent(%L, %L, true, true, true)', :'anon1', 'v0'), 'P0001', 'notice_version_mismatch', 'a choice for an old or made-up notice version is refused');
select throws_ok($$select public.record_consent(null, 'v1', true, true, true)$$, 'P0001', 'anonymous_id_required', 'a visitor needs an anonymous id');
select throws_ok(format('select public.record_consent(%L, %L, null, true, true)', :'anon1', 'v1'), 'P0001', 'invalid_input', 'every category needs a yes or no');
select throws_ok($$select * from public.consents$$, '42501', null, 'a visitor CANNOT read consents');
select throws_ok($$select * from public.my_consent()$$, '42501', null, 'or my_consent');
select throws_ok(format('select public.analytics_consent_ok(%L)', :'u3'), '42501', null, 'or ask whether a member allows analytics');
reset role;
select is((select count(*)::int from public.consents where anonymous_id = :'anon1'), 3, 'one choice writes the three purposes together');
select is((select string_agg(purpose::text || ':' || granted::text, ',' order by purpose::text) from public.consents where anonymous_id = :'anon1'), 'analytics:false,marketing:false,preferences:true', 'with the right answers');

-- ---------------------------------------------------------------- the rate limit: 30 choices a day per anonymous id
select pg_temp.act_as_anon();
select public.record_consent(:'anon2', 'v1', true, true, true) from generate_series(1, 30);
select throws_ok(format('select public.record_consent(%L, %L, true, true, true)', :'anon2', 'v1'), 'P0001', 'rate_limited', 'the 31st choice in a day is refused');
select lives_ok(format('select public.record_consent(%L, %L, true, true, true)', :'anon1', 'v1'), 'while another visitor is unaffected');
reset role;

-- ---------------------------------------------------------------- a signed-in person
select pg_temp.act_as(3);
reset role;
select is(private.has_analytics_consent(:'u3'), false, 'no choice yet: analytics is off');
select pg_temp.act_as(3);
select lives_ok(format('select public.record_consent(%L, %L, true, true, false)', :'anon1', 'v1'), 'after signing in the choice is recorded again with the user and the anonymous id');
select is((select count(*)::int from public.consents), 3, 'the member sees only their own rows');
reset role;
select is((select count(*)::int from public.consents where user_id = :'u3' and anonymous_id = :'anon1'), 3, 'each row holds both ids: that is the link');
select is(private.has_analytics_consent(:'u3'), true, 'analytics is on');
select is(private.has_analytics_consent(:'u4'), false, 'and only for the person who chose');
select is(private.has_analytics_consent(null), false, 'nobody means no');

-- a visitor's earlier choice never counts for a user until it is recorded with the user id
select pg_temp.act_as(4);
reset role;
select is(private.has_analytics_consent(:'u4'), false, 'an anonymous yes does not make a member say yes');

-- the latest choice wins, even within one transaction
select pg_temp.act_as(3);
select public.record_consent(null, 'v1', true, false, true);
reset role;
select is(private.has_analytics_consent(:'u3'), false, 'withdrawing switches analytics off straight away');
select pg_temp.act_as(3);
select public.record_consent(null, 'v1', true, true, true);
reset role;
select is(private.has_analytics_consent(:'u3'), true, 'and choosing again switches it on');

-- ---------------------------------------------------------------- my_consent: a new device adopts the stored choice
select pg_temp.act_as(3);
select is((select count(*)::int from public.my_consent()), 3, 'one row per purpose');
select is((select granted from public.my_consent() where purpose = 'analytics'), true, 'the latest answer');
select is((select notice_version from public.my_consent() where purpose = 'analytics'), 'v1', 'and the version it was given for');
reset role; select pg_temp.act_as(5);
select is((select count(*)::int from public.my_consent()), 0, 'nobody else sees it');
reset role;

-- ---------------------------------------------------------------- a new notice version asks again
update public.app_config set value = '"v2"'::jsonb where key = 'notice_version';
select is(private.has_analytics_consent(:'u3'), false, 'a new notice version means "not yet" until the person chooses again');
select pg_temp.act_as(3);
select throws_ok(format('select public.record_consent(null, %L, true, true, true)', 'v1'), 'P0001', 'notice_version_mismatch', 'and the old version can no longer be recorded');
select lives_ok(format('select public.record_consent(null, %L, true, true, true)', 'v2'), 'the new one can');
reset role;
select is(private.has_analytics_consent(:'u3'), true, 'then it is on again');
update public.app_config set value = '"v1"'::jsonb where key = 'notice_version';

-- ---------------------------------------------------------------- the Worker's question
select pg_temp.act_as_service();
select is((select public.analytics_consent_ok(:'u3')), true, 'the Worker can ask: yes');
select is((select public.analytics_consent_ok(:'u4')), false, 'and no');
reset role;
select pg_temp.act_as(3);
select throws_ok(format('select public.analytics_consent_ok(%L)', :'u3'), '42501', null, 'a member CANNOT use it');
select throws_ok(format('select private.has_analytics_consent(%L)', :'u3'), '42501', null, 'nor the private helper');
reset role;

select * from finish();
rollback;

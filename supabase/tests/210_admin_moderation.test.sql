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

-- ================================================================ moderation: hold, suspend, ban, reactivate, blocklist (B7.1)
\set v '00000000-0000-4000-8000-0000000002a1'
\set g '00000000-0000-4000-8000-0000000002a2'
\set w '00000000-0000-4000-8000-0000000002a3'
\set a2 '00000000-0000-4000-8000-0000000002a4'
\set n1 '00000000-0000-4000-8000-0000000002a5'
select pg_temp.sign_up(:'v', 'victim@example.test'), pg_temp.sign_up(:'g', 'guest@example.test'), pg_temp.sign_up(:'w', 'waiter@example.test'), pg_temp.sign_up(:'a2', 'admin2@example.test');
update public.profile_private set phone = '+919812345678' where id = :'v';
insert into public.user_roles (user_id, role) values (:'a2', 'admin');

-- ---------------------------------------------------------------- guards
select pg_temp.act_as(1);
select throws_ok(format('select public.admin_set_user_status(%L, %L, %L)', :'u3', 'hold', 'x'), 'P0001', 'reason_required', 'a reason of at least 3 characters is required');
select throws_ok(format('select public.admin_set_user_status(%L, %L, %L)', :'u1', 'suspend', 'myself'), 'P0001', 'not_allowed', 'an admin CANNOT moderate themselves');
select throws_ok(format('select public.admin_set_user_status(%L, %L, %L)', :'a2', 'ban', 'another admin'), 'P0001', 'not_allowed', 'an admin CANNOT moderate another admin');
select throws_ok(format('select public.admin_set_user_status(%L, %L, %L)', :'u3', 'explode', 'because'), 'P0001', 'invalid_action', 'only known actions');
select throws_ok(format('select public.admin_set_user_status(%L, %L, %L)', :'u3', 'reactivate', 'already fine'), 'P0001', 'invalid_transition', 'an active person cannot be reactivated');
select throws_ok(format('select public.admin_set_user_status(%L, %L, %L, %L)', :'u3', 'warn', 'because', repeat('x', 301)), 'P0001', 'note_too_long', 'the note to the person is short');
select throws_ok(format('select public.admin_set_user_status(%L, %L, %L)', '00000000-0000-4000-8000-0000000009ff', 'hold', 'nobody'), 'P0001', 'not_found', 'an unknown person is not found');

-- ---------------------------------------------------------------- warn, note, hold, suspend, reactivate
select lives_ok(format('select public.admin_set_user_status(%L, %L, %L, %L)', :'u3', 'warn', 'Rude in chat', 'Please be kind to everyone'), 'an admin can warn');
select lives_ok(format('select public.admin_set_user_status(%L, %L, %L, %L)', :'u3', 'note', 'Checking in', 'We have a question about your profile'), 'an admin can send a plain note');
reset role;
select is((select status::text from public.profile_private where id = :'u3'), 'active', 'a warning or a note does not change the status');
select is((select body from public.notifications where user_id = :'u3' and kind = 'moderation_warn'), 'Please be kind to everyone', 'the person gets the admin''s note in the app');
select is((select data ->> 'note' from public.email_outbox where user_id = :'u3' and template = 'moderation_notice' and data ->> 'action' = 'warn'), 'Please be kind to everyone', 'and by email');
select pg_temp.act_as(1);
select lives_ok(format('select public.admin_set_user_status(%L, %L, %L)', :'u3', 'hold', 'Pending review'), 'hold');
select throws_ok(format('select public.admin_set_user_status(%L, %L, %L)', :'u3', 'hold', 'again'), 'P0001', 'invalid_transition', 'a held person cannot be held again');
select lives_ok(format('select public.admin_set_user_status(%L, %L, %L)', :'u3', 'suspend', 'Confirmed'), 'a held person can be suspended');
reset role;
select is((select status::text from public.profile_private where id = :'u3'), 'suspended', 'suspended');
select is((select count(*)::int from public.moderation_actions where user_id = :'u3'), 4, 'every decision is recorded with its reason');
select throws_ok($$update public.moderation_actions set reason = 'edited'$$, 'P0001', 'moderation_actions is append-only', 'the record cannot be edited');
select throws_ok($$delete from public.moderation_actions$$, 'P0001', 'moderation_actions is append-only', 'or deleted');
-- a suspended person is blocked like a held one
select pg_temp.act_as(3);
select throws_ok(format('select public.give_tags(%L, %L, array[1]::smallint[])', '00000000-0000-4000-8000-0000000009aa', :'u4'), 'P0001', 'not_active', 'a suspended person is blocked from write functions');
reset role; select pg_temp.act_as(1);
select lives_ok(format('select public.admin_set_user_status(%L, %L, %L)', :'u3', 'reactivate', 'Sorted out'), 'reactivate');
reset role;
select is((select status::text from public.profile_private where id = :'u3'), 'active', 'active again');

-- ---------------------------------------------------------------- ban: full lockout
select pg_temp.mk_done_event('Ban context', array[:'v', :'g']::uuid[]) as ctx \gset
insert into public.events (host_id, type, title, area_id, starts_at, ends_at, capacity, approval_mode, status, published_at, pricing_mode)
  values (:'v', 'community', 'Victim hosts', 1, now() + interval '4 days', now() + interval '4 days 2 hours', 5, 'instant', 'published', now(), 'free'),
         (:'u2', 'community', 'Victim joins', 1, now() + interval '4 days', now() + interval '4 days 2 hours', 2, 'instant', 'published', now(), 'free');
select id as vh from public.events where title = 'Victim hosts' \gset
select id as vj from public.events where title = 'Victim joins' \gset
insert into public.bookings (event_id, user_id, status) values (:'vh', :'g', 'approved'), (:'vj', :'v', 'approved'), (:'vj', :'u5', 'approved');
insert into public.bookings (event_id, user_id, status, waitlisted_at) values (:'vj', :'w', 'waitlisted', now());
insert into auth.sessions (id, user_id, created_at, updated_at) values (gen_random_uuid(), :'v', now(), now());

select pg_temp.act_as(1);
select lives_ok(format('select public.admin_set_user_status(%L, %L, %L, %L)', :'v', 'ban', 'Repeated harassment', 'Your account was closed'), 'an admin can ban');
reset role;
select is((select status::text from public.profile_private where id = :'v'), 'banned', 'banned');
select is((select banned_until::text from auth.users where id = :'v'), 'infinity', 'sign-in is blocked');
select is((select count(*)::int from auth.sessions where user_id = :'v'), 0, 'every session is signed out');
select is((select status::text from public.events where id = :'vh'), 'cancelled', 'their upcoming event is cancelled');
select is((select status::text from public.bookings where event_id = :'vh' and user_id = :'g'), 'cancelled', 'and its guest is released');
select is((select count(*)::int from public.email_outbox where user_id = :'g' and template = 'event_cancelled'), 1, 'who is told by email');
select is((select status::text from public.bookings where event_id = :'vj' and user_id = :'v'), 'cancelled', 'their own upcoming booking is released');
select is((select cancel_reason from public.bookings where event_id = :'vj' and user_id = :'v'), 'account_removed', 'for the right reason');
select is((select status::text from public.bookings where event_id = :'vj' and user_id = :'w'), 'approved', 'and the waitlist moves up');
select is((select status::text from public.events where id = :'ctx'), 'completed', 'past events are left alone');
select is((select count(*)::int from public.banned_identities where user_id = :'v'), 2, 'the blocklist holds an email hash and a phone hash');
select is((select count(*)::int from public.banned_identities where hash like '%victim%' or hash like '%9812345678%'), 0, 'never the readable value');
select is((select count(*)::int from public.audit_log where table_name = 'banned_identities' and new_data::text ~ '[0-9a-f]{64}'), 0, 'and the audit log never holds a hash');
select is((select count(*)::int from public.email_outbox where user_id = :'v' and template = 'moderation_notice' and data ->> 'action' = 'ban'), 1, 'the banned person is told by email');

-- the blocklist refuses the same person coming back, even after deleting their account
select pg_temp.act_as_uid(:'v');
select lives_ok($$select public.delete_my_account()$$, 'a banned person can still erase their data (their right)');
reset role;
select is((select count(*)::int from public.banned_identities where user_id = :'v'), 2, 'but the blocklist stays');
select throws_ok(format('select pg_temp.sign_up(%L, %L)', :'n1', 'Victim@Example.test'), 'P0001', 'not_allowed', 'a new sign-up with the same email (any capitals) is refused');
select pg_temp.sign_up(:'n1', 'someone.new@example.test');
select throws_ok(format('update public.profile_private set phone = %L where id = %L', '+919812345678', :'n1'), 'P0001', 'not_allowed', 'and so is the same phone number');
select lives_ok(format('update public.profile_private set phone = %L where id = %L', '+919800000000', :'n1'), 'while other people are fine');

-- lifting a ban clears the blocklist, even for someone who erased their data
select pg_temp.act_as(1);
select lives_ok(format('select public.admin_set_user_status(%L, %L, %L)', :'v', 'reactivate', 'Ban lifted on review'), 'an admin can lift a ban');
reset role;
select is((select count(*)::int from public.banned_identities where user_id = :'v'), 0, 'the blocklist rows are removed');
select is((select count(*)::int from public.moderation_actions where user_id = :'v' and action = 'reactivate'), 1, 'and the lifting is recorded (the account was already erased, so there is nothing else to restore)');

-- what the person can export, and what survives deleting the account
select pg_temp.act_as(3);
select is((select jsonb_array_length(public.export_my_data() -> 'moderation_notices')), 5, 'the export lists what the team told the person');
select ok(not (public.export_my_data() -> 'moderation_notices')::text ~* 'Rude in chat|Pending review|Confirmed|Sorted out|Asha', 'but not the internal reasons or the admin');
select ok((public.export_my_data() -> 'moderation_notices')::text like '%Please be kind to everyone%', 'the note they were sent is there');
reset role;
select pg_temp.act_as(2);
select is((select jsonb_array_length(public.export_my_data() -> 'moderation_notices')), 0, 'and other people see none of it');
reset role;
select ok((select count(*) from public.moderation_actions where user_id = :'v') >= 2, 'decisions about a deleted account are kept (append-only record)');

-- a living account: ban, then reactivate restores sign-in and the blocklist is cleared
\set live '00000000-0000-4000-8000-0000000002a6'
select pg_temp.sign_up(:'live', 'live.user@example.test');
select pg_temp.act_as(1);
select public.admin_set_user_status(:'live', 'ban', 'Test ban');
reset role;
select is((select count(*)::int from public.banned_identities where user_id = :'live'), 1, 'a ban with an email only blocklists the email');
select pg_temp.act_as(1);
select public.admin_set_user_status(:'live', 'reactivate', 'Test unban');
reset role;
select is((select banned_until from auth.users where id = :'live'), null, 'reactivating restores sign-in');
select is((select status::text from public.profile_private where id = :'live'), 'active', 'and the status');
select is((select count(*)::int from public.banned_identities where user_id = :'live'), 0, 'and clears the blocklist');

-- ---------------------------------------------------------------- users: search and detail
select pg_temp.act_as(1);
select is((select count(*)::int from public.admin_search_users('meer')), 1, 'search by first name');
select is((select user_id from public.admin_search_users('meera')), :'u3'::uuid, 'finds the right person');
select is((select count(*)::int from public.admin_search_users('guest@example')), 1, 'search by email');
select is((select count(*)::int from public.admin_search_users(:'u4')), 1, 'search by id');
select is((select count(*)::int from public.admin_search_users(null, 'suspended')), 0, 'filter by status');
select is((select phone_hint from public.admin_search_users('someone.new')), '••••0000', 'a phone is shown only as its last four digits');
select is((select count(*)::int from public.admin_search_users(null, null, 3, 0)), 3, 'the page size is respected');
select is((select count(*)::int from public.admin_search_users('former member')), 0, 'deleted accounts are not listed');
select is((select jsonb_typeof(public.admin_user_detail(:'u3') -> 'moderation')), 'array', 'user detail has the moderation history');
select is((select jsonb_array_length(public.admin_user_detail(:'u3') -> 'moderation')), 5, 'with every decision');
select ok(public.admin_user_detail(:'u3') ? 'verification' and public.admin_user_detail(:'u3') ? 'reputation' and public.admin_user_detail(:'u3') ? 'flags', 'plus verification, reputation and flags');
select ok(not (public.admin_user_detail(:'u3')::text ~* 'selfie|date_of_birth|\+91'), 'but no selfie, date of birth or full phone number');
select throws_ok(format('select public.admin_user_detail(%L)', '00000000-0000-4000-8000-0000000009ff'), 'P0001', 'not_found', 'an unknown user is not found');

select * from finish();
rollback;

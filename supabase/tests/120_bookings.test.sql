begin;
select * from no_plan();

-- Demo users from seed.sql: 1 admin (Asha), 2 host (Dev), 3 member (Meera), 4 member (Kabir), 5 member (Noor).
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
create function pg_temp.n(stmt text) returns int language plpgsql as $$
declare c int;
begin
  execute stmt;
  get diagnostics c = row_count;
  return c;
end $$;
-- Creates a brand-new sign-up the way Supabase Auth does (the trigger makes the profile rows).
create function pg_temp.sign_up(uid uuid, mail text) returns void language sql as $$
  insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', mail, now(), '{}', '{}',
    now(), now(), '', '', '', '')
$$;
-- Calls complete_onboarding with valid defaults; override one argument at a time.
create function pg_temp.onboard(
  first text default 'Zoya', dob date default date '1995-05-05', gender public.gender default 'woman',
  area smallint default 1, interests smallint[] default array[1, 2]::smallint[], languages smallint[] default array[1]::smallint[],
  prompts jsonb default '[{"prompt":"A perfect Saturday","answer":"Long walks"},{"prompt":"Hidden talent","answer":"Cooking"}]',
  photos text[] default array['profiles/11111111-1111-4111-8111-111111111111.webp',
    'profiles/22222222-2222-4222-8222-222222222222.webp', 'profiles/33333333-3333-4333-8333-333333333333.webp'],
  notice text default 'v1', conduct boolean default true, privacy boolean default true,
  last_name text default 'Khan', phone text default '+919999999999'
) returns void language sql as $$
  select public.complete_onboarding(first, dob, gender, area, interests, languages, prompts, photos, notice, conduct, privacy, last_name, phone)
$$;

create function pg_temp.act_as_service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  execute 'set local role service_role';
end $$;
-- A valid community event input. Override fields by concatenating jsonb: pg_temp.ev('{"capacity": 30}').
create function pg_temp.ev(extra jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('title', 'Sunday board games', 'description', 'Bring a game.', 'area_id', 1, 'category_id', 1,
    'starts_at', (now() + interval '10 days')::text, 'ends_at', (now() + interval '10 days 3 hours')::text,
    'capacity', 12, 'address', '12 Church Street, Bengaluru', 'pricing_mode', 'free') || extra
$$;

-- A published event hosted by user 2 (Dev). Returns its id. Capacity and mode are parameters.
create function pg_temp.mk_event(p_title text, p_capacity int, p_mode text default 'host_approval', p_extra jsonb default '{}') returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into public.events (host_id, type, title, area_id, starts_at, ends_at, capacity, overbook_pct, approval_mode, status, published_at, women_only, min_age, max_age, pricing_mode, price_label)
  values ('00000000-0000-4000-8000-000000000002', 'community', p_title, 1, now() + interval '10 days', now() + interval '10 days 2 hours', p_capacity,
          coalesce((p_extra ->> 'overbook_pct')::int, 0), p_mode::public.approval_mode, coalesce(p_extra ->> 'status', 'published')::public.event_status, case when coalesce(p_extra ->> 'status', 'published') = 'published' then now() end, coalesce((p_extra ->> 'women_only')::boolean, false),
          coalesce((p_extra ->> 'min_age')::int, 18), (p_extra ->> 'max_age')::int, coalesce((p_extra ->> 'pricing_mode')::public.pricing_mode, 'free'), p_extra ->> 'price_label')
  returning id into v;
  return v;
end $$;

-- Users: 1 admin (Asha, woman), 2 host (Dev, man), 3 Meera (woman, 29), 4 Kabir (man, 32), 5 Noor (non-binary, 28).
select pg_temp.mk_event('Cap 2', 2) as cap2 \gset
select pg_temp.mk_event('Instant 2', 2, 'instant') as inst1 \gset
select pg_temp.mk_event('Overbook', 2, 'host_approval', '{"overbook_pct": 50}') as over \gset
select pg_temp.mk_event('Women only', 5, 'host_approval', '{"women_only": true}') as women \gset
select pg_temp.mk_event('Age 30 plus', 5, 'host_approval', '{"min_age": 30}') as age30 \gset

-- ===================================================== who may call
select pg_temp.act_as_anon();
select throws_ok(format('select public.request_to_join(%L)', :'cap2'), '42501', null, 'a stranger CANNOT request to join');
select throws_ok($$select public.my_bookings()$$, '42501', null, 'a stranger CANNOT read bookings');

-- ===================================================== requesting: seats, waitlist, notifications, emails
reset role; select pg_temp.act_as(3);
select is((public.request_to_join(:'cap2') ->> 'status'), 'requested', 'the first request for a host-approval event is "requested"');
select throws_ok(format('select public.request_to_join(%L)', :'cap2'), 'P0001', 'already_requested', 'asking twice is refused');
reset role; select pg_temp.act_as(4);
select is((public.request_to_join(:'cap2') ->> 'status'), 'requested', 'the second request takes the last seat (a requested booking holds a seat)');
reset role;
select is((select spots_left from public.event_cards where title = 'Cap 2'), 0, 'spots_left counts requested seats (stub is now real)');
select pg_temp.act_as(5);
select is((public.request_to_join(:'cap2') ->> 'status'), 'waitlisted', 'the third request goes straight to the waitlist');
select is((public.get_my_booking(:'cap2') ->> 'waitlist_position')::int, 1, 'with waitlist position 1');
reset role;
select is((select count(*)::int from public.email_outbox where template = 'request_received' and user_id = '00000000-0000-4000-8000-000000000003' and priority = 2), 1, 'a request-received email is queued (normal priority)');
select is((select count(*)::int from public.email_outbox where template = 'booking_waitlisted' and user_id = '00000000-0000-4000-8000-000000000005'), 1, 'a waitlisted email is queued');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-8000-000000000002' and kind = 'new_request'), 2, 'the host gets in-app notices for the requests');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-8000-000000000003' and kind = 'request_received'), 1, 'the requester gets an in-app notice');

-- instant events approve at once
select pg_temp.act_as(3);
select is((public.request_to_join(:'inst1') ->> 'status'), 'approved', 'an instant event approves at once');
reset role;
select is((select priority from public.email_outbox where template = 'booking_approved' and user_id = '00000000-0000-4000-8000-000000000003'), 1::smallint, 'approval emails are critical priority');
select pg_temp.act_as(4);
select is((public.request_to_join(:'inst1') ->> 'status'), 'approved', 'the second person on a 2-seat instant event is approved too');
reset role; select pg_temp.act_as(5);
select is((public.request_to_join(:'inst1') ->> 'status'), 'waitlisted', 'the next person on a full instant event is waitlisted');

-- ===================================================== the rules in the join function
reset role; select pg_temp.act_as(4);
select throws_ok(format('select public.request_to_join(%L)', :'women'), 'P0001', 'women_only', 'a man CANNOT join a women-only event');
reset role; select pg_temp.act_as(5);
select throws_ok(format('select public.request_to_join(%L)', :'women'), 'P0001', 'women_only', 'women-only means woman: a non-binary person is refused');
reset role; select pg_temp.act_as(3);
select is((public.request_to_join(:'women') ->> 'status'), 'requested', 'a woman CAN join a women-only event');
select throws_ok(format('select public.request_to_join(%L)', :'age30'), 'P0001', 'age_not_allowed', 'a 29-year-old CANNOT join a 30+ event');
reset role; select pg_temp.act_as(4);
select is((public.request_to_join(:'age30') ->> 'status'), 'requested', 'a 32-year-old CAN join a 30+ event');

reset role; select pg_temp.act_as(2);
select throws_ok(format('select public.request_to_join(%L)', :'cap2'), 'P0001', 'own_event', 'a host CANNOT join their own event');

-- partner, draft and past events cannot be joined
reset role;
select id as partner_id from public.events where type = 'partner' limit 1 \gset
select pg_temp.mk_event('Draft one', 5, 'host_approval', '{"status":"draft"}') as draft_id \gset
select pg_temp.mk_event('Past one', 5) as past_id \gset
update public.events set starts_at = now() - interval '2 hours', ends_at = now() - interval '1 hour' where id = :'past_id';
select pg_temp.act_as(3);
select throws_ok(format('select public.request_to_join(%L)', :'partner_id'), 'P0001', 'partner_event', 'partner events have no requests (tickets are bought on the partner site)');
select throws_ok(format('select public.request_to_join(%L)', :'draft_id'), 'P0001', 'not_found', 'a draft event cannot be joined');
select throws_ok(format('select public.request_to_join(%L)', :'past_id'), 'P0001', 'event_started', 'an event that has started cannot be joined');

-- blocks (either direction) and user status
reset role;
select pg_temp.mk_event('Block test', 5) as blk \gset
insert into public.user_blocks (blocker_id, blocked_id) values ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000005');
select pg_temp.act_as(5);
select throws_ok(format('select public.request_to_join(%L)', :'blk'), 'P0001', 'not_allowed', 'a person the host blocked CANNOT request');
reset role;
delete from public.user_blocks;
insert into public.user_blocks (blocker_id, blocked_id) values ('00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000002');
select pg_temp.act_as(5);
select throws_ok(format('select public.request_to_join(%L)', :'blk'), 'P0001', 'not_allowed', 'a person who blocked the host CANNOT request either (same answer)');
reset role;
delete from public.user_blocks;
update public.profile_private set status = 'on_hold' where id = '00000000-0000-4000-8000-000000000005';
select pg_temp.act_as(5);
select throws_ok(format('select public.request_to_join(%L)', :'blk'), 'P0001', 'not_active', 'an on-hold member CANNOT request');
reset role;
update public.profile_private set status = 'active' where id = '00000000-0000-4000-8000-000000000005';
select pg_temp.sign_up('00000000-0000-4000-8000-0000000000c1', 'new@kollide.test');
select pg_temp.act_as_uid('00000000-0000-4000-8000-0000000000c1');
select throws_ok(format('select public.request_to_join(%L)', :'blk'), 'P0001', 'not_onboarded', 'someone who has not finished onboarding CANNOT request');

-- ===================================================== the paid branch (P1 seam)
reset role;
update public.app_config set value = 'true' where key = 'payments_enabled';
insert into public.events (host_id, type, title, area_id, starts_at, ends_at, capacity, pricing_mode, price_paise, status, published_at)
values ('00000000-0000-4000-8000-000000000001', 'kollide', 'Paid supper', 1, now() + interval '9 days', now() + interval '9 days 2 hours', 8, 'paid', 50000, 'published', now())
returning id as paid_id \gset
update public.app_config set value = 'false' where key = 'payments_enabled';
select pg_temp.act_as(3);
select throws_ok(format('select public.request_to_join(%L)', :'paid_id'), 'P0001', 'payments_disabled', 'a paid event raises payments_disabled while the switch is off');
reset role;
update public.app_config set value = 'true' where key = 'payments_enabled';
select pg_temp.act_as(3);
select throws_ok(format('select public.request_to_join(%L)', :'paid_id'), 'P0001', 'payments_not_implemented', 'even with the switch on, the paid branch waits for P1');
reset role;
update public.app_config set value = 'false' where key = 'payments_enabled';
select throws_ok($$insert into public.bookings (event_id, user_id, status) select id, '00000000-0000-4000-8000-000000000004', 'paid' from public.events limit 1$$, '23514', null, 'the reserved "paid" state cannot be written');
select throws_ok($$insert into public.bookings (event_id, user_id, status) select id, '00000000-0000-4000-8000-000000000004', 'pending_payment' from public.events limit 1$$, '23514', null, 'nor "pending_payment"');
select throws_ok($$insert into public.bookings (event_id, user_id, status) select id, '00000000-0000-4000-8000-0000000000c1', 'confirmed' from public.events limit 1$$, '23514', null, 'a booking cannot be created straight as "confirmed"');

-- ===================================================== the rate limit (20 requests a day)
reset role;
select count(pg_temp.mk_event('Rate ' || n, 50)) from generate_series(1, 21) n;
update public.rate_limits set count = 19 where user_id = '00000000-0000-4000-8000-000000000003' and action = 'join_request';
select pg_temp.act_as(3);
select lives_ok($$select public.request_to_join((select id from public.events where title = 'Rate 1'))$$, 'the 20th request of the day is allowed');
select throws_ok($$select public.request_to_join((select id from public.events where title = 'Rate 2'))$$, 'P0001', 'rate_limited', 'the 21st is refused');
reset role;
delete from public.rate_limits; -- the rest of this file asks for many seats

-- ===================================================== the host decides
reset role; select pg_temp.act_as(3);
select id as b3 from public.bookings where event_id = :'cap2' and user_id = '00000000-0000-4000-8000-000000000003' \gset
reset role; select pg_temp.act_as(4);
select id as b4 from public.bookings where event_id = :'cap2' and user_id = '00000000-0000-4000-8000-000000000004' \gset
reset role;
select id as b5 from public.bookings where event_id = :'cap2' and user_id = '00000000-0000-4000-8000-000000000005' \gset
-- Inside one test transaction now() never changes, so make the auto-waitlisted request clearly the oldest.
update public.bookings set waitlisted_at = now() - interval '1 hour' where id = :'b5';
select pg_temp.act_as(3);
select throws_ok(format('select public.decide_request(%L, ''approve'')', :'b3'), 'P0001', 'not_allowed', 'a member CANNOT decide on requests');
reset role; select pg_temp.act_as(2);
select throws_ok(format('select public.decide_request(%L, ''maybe'')', :'b3'), 'P0001', 'invalid_decision', 'an unknown decision is refused');
select lives_ok(format('select public.decide_request(%L, ''approve'')', :'b3'), 'the host CAN approve');
reset role;
select is((select status from public.bookings where id = :'b3'), 'approved'::public.booking_status, 'the booking is approved');
select is((select count(*)::int from public.email_outbox where template = 'booking_approved' and user_id = '00000000-0000-4000-8000-000000000003' and data ->> 'booking_id' = :'b3'), 1, 'an approval email is queued');
select pg_temp.act_as(2);
select throws_ok(format('select public.decide_request(%L, ''approve'')', :'b3'), 'P0001', 'invalid_booking_change', 'a booking cannot be decided twice');
-- host-waitlisted people are promoted to approved when a seat opens
select lives_ok(format('select public.decide_request(%L, ''waitlist'')', :'b4'), 'the host CAN waitlist a request');
reset role;
select is((select status from public.bookings where id = :'b4'), 'waitlisted'::public.booking_status, 'the request is waitlisted');
select is((select status from public.bookings where id = :'b5'), 'requested'::public.booking_status, 'waitlisting a request frees its seat: the person who was auto-waitlisted moves back to "requested" for the host to decide');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-8000-000000000002' and kind = 'new_request' and data ->> 'booking_id' = :'b5'), 1, 'and the host is told that a request is waiting again');
select pg_temp.act_as(4);
select throws_ok(format('select public.decide_request(%L, ''approve'')', :'b4'), 'P0001', 'not_allowed', 'the waitlisted person CANNOT approve themselves');
reset role; select pg_temp.act_as(2);
select lives_ok(format('select public.decide_request(%L, ''decline'')', :'b5'), 'the host CAN decline');
reset role;
select is((select template from public.email_outbox where user_id = '00000000-0000-4000-8000-000000000005' order by id desc limit 1), 'booking_declined', 'a decline queues the gentle "declined" email');
select is((select title from public.notifications where user_id = '00000000-0000-4000-8000-000000000005' order by id desc limit 1), 'An update on your request', 'the notice never says "rejected"');
select is((select status from public.bookings where id = :'b4'), 'approved'::public.booking_status, 'declining frees a seat: the host-waitlisted person is promoted straight to approved');
select is((select data ->> 'promoted' from public.email_outbox where template = 'booking_approved' and data ->> 'booking_id' = :'b4'), 'true', 'with a promotion email');

-- ===================================================== overbooking limits
select pg_temp.act_as(3);
select public.request_to_join(:'over') as _a \gset
reset role; select pg_temp.act_as(4);
select public.request_to_join(:'over') as _b \gset
reset role; select pg_temp.act_as(5);
select (public.request_to_join(:'over') ->> 'status') as over5 \gset
select is(:'over5'::text, 'waitlisted', 'the third request on a 2-seat event is waitlisted');
reset role;
select id as ob from public.bookings where event_id = :'over' and user_id = '00000000-0000-4000-8000-000000000005' \gset
select pg_temp.act_as(2);
select lives_ok(format('select public.decide_request(%L, ''approve'')', :'ob'), 'the host CAN approve one over capacity (limit is 2 x 1.5 = 3)');
reset role;
select pg_temp.sign_up('00000000-0000-4000-8000-0000000000c2', 'a@kollide.test');
select pg_temp.sign_up('00000000-0000-4000-8000-0000000000c3', 'b@kollide.test');
update public.profiles set onboarding_completed_at = now() where id in ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000c3');
update public.profile_private set date_of_birth = date '1990-01-01', gender = 'man' where id in ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000c3');
select pg_temp.act_as_uid('00000000-0000-4000-8000-0000000000c2');
select (public.request_to_join(:'over') ->> 'status') as over_c2 \gset
select is(:'over_c2'::text, 'waitlisted', 'a 4th person is waitlisted');
reset role;
select id as oc2 from public.bookings where event_id = :'over' and user_id = '00000000-0000-4000-8000-0000000000c2' \gset
select pg_temp.act_as(2);
select throws_ok(format('select public.decide_request(%L, ''approve'')', :'oc2'), 'P0001', 'event_full', 'but NOT beyond capacity x (1 + overbook)');

-- ===================================================== cancelling and the waitlist
reset role; select pg_temp.act_as(3);
select id as inst_b3 from public.bookings where event_id = :'inst1' and user_id = '00000000-0000-4000-8000-000000000003' \gset
select lives_ok(format('select public.cancel_my_booking(%L)', :'inst_b3'), 'a member CAN cancel their booking');
reset role;
select is((select status from public.bookings where event_id = :'inst1' and user_id = '00000000-0000-4000-8000-000000000005'), 'approved'::public.booking_status, 'on an instant event the waitlist is promoted to approved when someone cancels');
select is((select cancel_reason from public.bookings where id = :'inst_b3'), 'cancelled_by_user', 'the reason is recorded');
select pg_temp.act_as(4);
select throws_ok(format('select public.cancel_my_booking(%L)', :'inst_b3'), 'P0001', 'not_found', 'nobody can cancel someone else''s booking');
reset role; select pg_temp.act_as(3);
select is((public.request_to_join(:'inst1') ->> 'status'), 'waitlisted', 'a person who cancelled may ask again');

-- waitlist order: oldest first
reset role;
select pg_temp.mk_event('Order test', 2, 'instant') as ord \gset
select pg_temp.act_as(3); select public.request_to_join(:'ord') as _o1 \gset
reset role; select pg_temp.act_as(4); select public.request_to_join(:'ord') as _o2 \gset
reset role; select pg_temp.act_as(5); select public.request_to_join(:'ord') as _o3 \gset
reset role; select pg_temp.act_as_uid('00000000-0000-4000-8000-0000000000c2'); select public.request_to_join(:'ord') as _o4 \gset
reset role;
update public.bookings set waitlisted_at = now() - interval '2 hours' where event_id = :'ord' and user_id = '00000000-0000-4000-8000-0000000000c2';
select pg_temp.act_as(3);
select id as ord_b3 from public.bookings where event_id = :'ord' and user_id = '00000000-0000-4000-8000-000000000003' \gset
select public.cancel_my_booking(:'ord_b3') as _c \gset
reset role;
select is((select status from public.bookings where event_id = :'ord' and user_id = '00000000-0000-4000-8000-0000000000c2'), 'approved'::public.booking_status, 'the longest-waiting person is promoted first');
select is((select status from public.bookings where event_id = :'ord' and user_id = '00000000-0000-4000-8000-000000000005'), 'waitlisted'::public.booking_status, 'and the next one keeps waiting');

-- ===================================================== the address rule (full test)
reset role;
select pg_temp.mk_event('Address test', 5) as adr \gset
insert into public.event_private (event_id, address) values (:'adr', '1 Secret Lane, Bengaluru');
select pg_temp.act_as(3); select public.request_to_join(:'adr') as _a3 \gset
reset role; select pg_temp.act_as(4); select public.request_to_join(:'adr') as _a4 \gset
reset role; select pg_temp.act_as(5); select public.request_to_join(:'adr') as _a5 \gset
reset role;
select id as ab3 from public.bookings where event_id = :'adr' and user_id = '00000000-0000-4000-8000-000000000003' \gset
select id as ab4 from public.bookings where event_id = :'adr' and user_id = '00000000-0000-4000-8000-000000000004' \gset
select id as ab5 from public.bookings where event_id = :'adr' and user_id = '00000000-0000-4000-8000-000000000005' \gset
select pg_temp.act_as(3);
select throws_ok(format('select public.get_event_address(%L)', :'adr'), 'P0001', 'not_allowed', 'a "requested" person CANNOT see the address');
reset role; select pg_temp.act_as(2);
select public.decide_request(:'ab3', 'approve') as _d \gset
select public.decide_request(:'ab4', 'decline') as _d2 \gset
reset role; select pg_temp.act_as(3);
select is((select public.get_event_address(:'adr') ->> 'address'), '1 Secret Lane, Bengaluru', 'an approved person CAN see the address');
reset role; select pg_temp.act_as(4);
select throws_ok(format('select public.get_event_address(%L)', :'adr'), 'P0001', 'not_allowed', 'a declined person CANNOT');
reset role; select pg_temp.act_as(5);
select throws_ok(format('select public.get_event_address(%L)', :'adr'), 'P0001', 'not_allowed', 'a requested person still CANNOT');
reset role;
select pg_temp.act_as(3);
select lives_ok(format('select public.cancel_my_booking(%L)', :'ab3'), 'the approved person cancels');
select throws_ok(format('select public.get_event_address(%L)', :'adr'), 'P0001', 'not_allowed', 'and loses access to the address');

-- ===================================================== reconfirmation, cutoff, reminders
reset role;
select pg_temp.mk_event('Soon', 5, 'instant') as soon \gset
update public.events set starts_at = now() + interval '20 hours', ends_at = now() + interval '22 hours' where id = :'soon';
select pg_temp.act_as(3); select public.request_to_join(:'soon') as _s \gset
reset role;
select id as sb3 from public.bookings where event_id = :'soon' and user_id = '00000000-0000-4000-8000-000000000003' \gset
select pg_temp.act_as_service();
reset role;
select private.job_reconfirmation();
select is((select count(*)::int from public.email_outbox where template = 'still_coming' and (data ->> 'booking_id') = :'sb3'), 1, 'the job sends "Still coming?" for events within 24 hours');
select is((select priority from public.email_outbox where template = 'still_coming' limit 1), 1::smallint, 'it is a critical email');
select ok((select reconfirm_by from public.bookings where id = :'sb3') between now() + interval '13 hours' and now() + interval '15 hours', 'the cutoff is 6 hours before the start');
select private.job_reconfirmation();
select is((select count(*)::int from public.email_outbox where template = 'still_coming' and (data ->> 'booking_id') = :'sb3'), 1, 'it is not sent twice');
select is((select last_status from public.job_runs where job = 'reconfirmation'), 'ok', 'the job records its run');
select pg_temp.act_as_anon();
reset role;
select reconfirm_token as tok from public.bookings where id = :'sb3' \gset
select pg_temp.act_as_anon();
select is((public.reconfirm_booking(:'tok'::uuid) ->> 'status'), 'confirmed', 'the one-tap link confirms without signing in');
select is((public.reconfirm_booking(:'tok'::uuid) ->> 'already'), 'true', 'and a second tap is harmless');
select throws_ok($$select public.reconfirm_booking('00000000-0000-4000-8000-0000000000dd')$$, 'P0001', 'not_found', 'an unknown token is refused');
select throws_ok($$select * from public.bookings$$, '42501', null, 'a stranger CANNOT read bookings');
reset role;
select is((select status from public.bookings where id = :'sb3'), 'confirmed'::public.booking_status, 'the booking is confirmed');

-- unconfirmed bookings lose their seat at the cutoff and the waitlist moves up
select pg_temp.mk_event('Cutoff', 2, 'instant') as cut \gset
update public.events set starts_at = now() + interval '20 hours', ends_at = now() + interval '22 hours' where id = :'cut';
select pg_temp.act_as(4); select public.request_to_join(:'cut') as _c1 \gset
reset role; select pg_temp.act_as_uid('00000000-0000-4000-8000-0000000000c3'); select public.request_to_join(:'cut') as _c3 \gset
reset role; select pg_temp.act_as(5); select public.request_to_join(:'cut') as _c2 \gset
reset role;
select private.job_reconfirmation();
update public.bookings set reconfirm_by = now() - interval '1 minute' where event_id = :'cut' and user_id = '00000000-0000-4000-8000-000000000004';
select private.job_reconfirmation();
select is((select cancel_reason from public.bookings where event_id = :'cut' and user_id = '00000000-0000-4000-8000-000000000004'), 'no_reconfirm', 'an unconfirmed booking is released at the cutoff');
select is((select status from public.bookings where event_id = :'cut' and user_id = '00000000-0000-4000-8000-000000000005'), 'approved'::public.booking_status, 'and the waitlist is promoted');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-8000-000000000004' and kind = 'seat_released'), 1, 'the person is told in the app');

-- day-of reminders
select pg_temp.mk_event('Tonight', 5, 'instant') as tonight \gset
update public.events set starts_at = now() + interval '3 hours', ends_at = now() + interval '5 hours' where id = :'tonight';
select pg_temp.act_as(3); select public.request_to_join(:'tonight') as _t \gset
reset role;
select private.job_reminders();
select is((select count(*)::int from public.email_outbox where template = 'day_of_reminder' and user_id = '00000000-0000-4000-8000-000000000003'), 1, 'the reminder job sends a reminder for events starting within 4 hours');
select private.job_reminders();
select is((select count(*)::int from public.email_outbox where template = 'day_of_reminder' and user_id = '00000000-0000-4000-8000-000000000003'), 1, 'only once');
select is((select count(*)::int from public.email_outbox where template = 'day_of_reminder' and data::text like '%Secret Lane%'), 0, 'emails never contain the address');

-- the by-hand test trigger for admins
select pg_temp.act_as(3);
select throws_ok(format('select public.admin_send_reconfirmation(%L)', :'sb3'), 'P0001', 'not_allowed', 'a member CANNOT trigger a reconfirmation by hand');
reset role;
select pg_temp.mk_event('By hand', 5, 'instant') as byhand \gset
select pg_temp.act_as(4); select public.request_to_join(:'byhand') as _h \gset
reset role;
select id as hb from public.bookings where event_id = :'byhand' and user_id = '00000000-0000-4000-8000-000000000004' \gset
select pg_temp.act_as(1);
select lives_ok(format('select public.admin_send_reconfirmation(%L)', :'hb'), 'an admin CAN send "Still coming?" by hand');
reset role;
select is((select count(*)::int from public.email_outbox where template = 'still_coming' and (data ->> 'booking_id') = :'hb'), 1, 'and the email is queued');

-- ===================================================== cancelling an event cancels its bookings
select pg_temp.mk_event('Will be cancelled', 5, 'instant') as wbc \gset
select pg_temp.act_as(3); select public.request_to_join(:'wbc') as _w1 \gset
reset role;
update public.events set status = 'cancelled' where id = :'wbc';
select is((select status from public.bookings where event_id = :'wbc'), 'cancelled'::public.booking_status, 'cancelling an event cancels its bookings');
select is((select cancel_reason from public.bookings where event_id = :'wbc'), 'event_cancelled', 'with the reason');
select is((select priority from public.email_outbox where template = 'event_cancelled' and user_id = '00000000-0000-4000-8000-000000000003'), 1::smallint, 'and a critical email');

-- ===================================================== reading bookings, the host inbox, cards
select pg_temp.act_as(3);
select ok((select count(*) from public.my_bookings()) >= 3, 'a member CAN list their bookings');
select is((select count(*)::int from public.bookings where user_id = '00000000-0000-4000-8000-000000000004'), 0, 'a member CANNOT read other people''s bookings');
select throws_ok($$select reconfirm_token from public.bookings$$, '42501', null, 'nobody can read the reconfirm token through the API');
select throws_ok($$update public.bookings set status = 'approved'$$, '42501', null, 'bookings CANNOT be edited directly');
select throws_ok(format('select * from public.host_inbox(%L)', :'cap2'), 'P0001', 'not_allowed', 'a member CANNOT open the host inbox');
reset role; select pg_temp.act_as(4);
select throws_ok(format('select * from public.host_inbox(%L)', :'cap2'), 'P0001', 'not_allowed', 'another host CANNOT open the inbox');
reset role; select pg_temp.act_as(2);
select ok((select count(*) from public.host_inbox(:'over')) >= 3, 'the host CAN open their inbox');
select is((select count(*)::int from information_schema.routines r join information_schema.parameters p on p.specific_name = r.specific_name where r.routine_name = 'host_inbox' and p.parameter_name in ('phone', 'date_of_birth', 'gender', 'email', 'last_name')), 0, 'the inbox has no phone, date of birth, gender, email or last name');
select is((select shows_up_total from public.host_inbox(:'over') limit 1), 0, 'a person with no history shows up 0 of 0 (real numbers are tested in 170_reputation)');
reset role; select pg_temp.act_as(1);
select ok((select count(*) from public.host_inbox(:'over')) >= 3, 'an admin CAN open any inbox');
reset role; select pg_temp.act_as(3);
select ok((select spots_left from public.event_cards where title = 'Cap 2') is not null, 'cards show spots left');

reset role;
select pg_temp.mk_event('Avatars', 5, 'instant') as av \gset
select pg_temp.act_as(4); select public.request_to_join(:'av') as _av \gset
reset role;
select is(private.event_attendee_photos(:'av'), (select array_agg(ph.r2_key) from public.profile_photos ph where ph.user_id = '00000000-0000-4000-8000-000000000004'), 'verified attendees'' photos show on the card');
select pg_temp.act_as(3);
select throws_ok($$select * from public.email_outbox$$, '42501', null, 'a member CANNOT read the email outbox');
select throws_ok($$select * from public.rate_limits$$, '42501', null, 'a member CANNOT read rate limits');
select is((select count(*)::int from public.notifications where user_id <> '00000000-0000-4000-8000-000000000003'), 0, 'a member sees only their own notifications');
select lives_ok($$select public.mark_notifications_read()$$, 'a member CAN mark their notifications read');
select is((select count(*)::int from public.notifications where read_at is null), 0, 'all of them');
select is((select count(*)::int from public.job_runs), 0, 'a member sees no job status');
reset role; select pg_temp.act_as(1);
select ok((select count(*) from public.admin_job_runs()) >= 1, 'an admin CAN read job status');
reset role; select pg_temp.act_as(3);
select throws_ok($$select * from public.admin_job_runs()$$, 'P0001', 'not_allowed', 'a member CANNOT');

select * from finish();
rollback;

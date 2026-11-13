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
create function pg_temp.ev(extra jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('title', 'Paid test', 'description', 'x', 'area_id', 1, 'category_id', 1,
    'starts_at', (now() + interval '10 days')::text, 'ends_at', (now() + interval '10 days 3 hours')::text,
    'capacity', 12, 'address', '12 Church Street, Bengaluru', 'pricing_mode', 'free') || extra
$$;
insert into public.events (host_id, type, title, area_id, starts_at, ends_at, capacity, approval_mode, status, published_at, pricing_mode)
  values (:'u2', 'community', 'Free event', 1, now() + interval '5 days', now() + interval '5 days 2 hours', 10, 'instant', 'published', now(), 'free');
select id as fe from public.events where title = 'Free event' \gset
insert into public.bookings (event_id, user_id, status) values (:'fe', :'u3', 'approved');
select id as fb from public.bookings where event_id = :'fe' \gset

select is(private.payments_enabled(), false, 'payments are off');

-- ---------------------------------------------------------------- events: price and pricing mode
select throws_ok($$update public.events set pricing_mode = 'paid' where title = 'Free event'$$, '23514', 'payments_off', 'an existing event CANNOT be switched to paid');
select throws_ok($$update public.events set price_paise = 100 where title = 'Free event'$$, '23514', 'payments_off', 'nor given a price');
select throws_ok($$update public.events set type = 'kollide', pricing_mode = 'paid' where title = 'Free event'$$, '23514', 'payments_off', 'nor turned into a Kollide event with a price');
select throws_ok($$insert into public.events (host_id, type, title, area_id, starts_at, ends_at, capacity, pricing_mode, price_paise)
  values ('00000000-0000-4000-8000-000000000002', 'kollide', 'Paid insert', 1, now() + interval '3 days', now() + interval '3 days 2 hours', 10, 'paid', 500)$$, '23514', 'payments_off', 'a paid event CANNOT be inserted, even as a Kollide event');
select pg_temp.act_as(2);
select throws_ok(format('select public.create_event(%L)', (pg_temp.ev('{"pricing_mode": "paid"}'))::text), 'P0001', 'payments_off', 'a host CANNOT create a paid event');
select lives_ok(format('select public.create_event(%L)', (pg_temp.ev())::text), 'a host can create a free one');
select id as de from public.events where title = 'Paid test' \gset
select throws_ok(format('select public.update_event(%L, %L)', :'de', '{"pricing_mode": "paid"}'), 'P0001', 'payments_off', 'a host CANNOT update it to paid');
select throws_ok(format('select public.update_event(%L, %L)', :'de', '{"price_paise": 100}'), 'P0001', null, 'nor set a price');
reset role;

-- ---------------------------------------------------------------- bookings: the reserved payment states
select throws_ok(format('insert into public.bookings (event_id, user_id, status) values (%L, %L, %L)', :'fe', :'u4', s), '23514', 'payments_disabled', 'a booking CANNOT be inserted as ' || s)
  from unnest(array['pending_payment', 'paid', 'expired', 'refunded']) s;
select throws_ok(format('update public.bookings set status = %L where id = %L', s, :'fb'), '23514', 'payments_disabled', 'a booking CANNOT move to ' || s)
  from unnest(array['pending_payment', 'paid', 'expired', 'refunded']) s;
select pg_temp.act_as(3);
select throws_ok(format('update public.bookings set status = %L where id = %L', 'paid', :'fb'), '42501', null, 'a member CANNOT write a booking at all');
reset role;

-- ---------------------------------------------------------------- an admin cannot turn the switch on over the API
select pg_temp.act_as(1);
select is((select count(*)::int from (select 1 from public.app_config where key = 'payments_enabled') x), 1, 'the switch is readable');
select is(pg_temp.n($$update public.app_config set value = 'true' where key = 'payments_enabled'$$), 0, 'but an admin updating it changes nothing');
reset role;
select is(private.payments_enabled(), false, 'still off');

-- ---------------------------------------------------------------- a missing row means off
delete from public.app_config where key = 'payments_enabled';
select is(private.payments_enabled(), false, 'with the row deleted payments are still off');
insert into public.app_config (key, value) values ('payments_enabled', 'false');

-- ---------------------------------------------------------------- seats: paid states only count when payments are on
alter table public.bookings disable trigger bookings_rules;
insert into public.bookings (event_id, user_id, status) values (:'fe', :'u4', 'paid'), (:'fe', :'u5', 'pending_payment');
select is(private.event_taken_seats(:'fe'), 1, 'while off, paid and pending_payment rows hold no seat (only the one approved booking)');
update public.app_config set value = 'true' where key = 'payments_enabled';
select is(private.event_taken_seats(:'fe'), 3, 'when on, they do (the switch is the only thing that changes this)');
delete from public.bookings where status in ('paid', 'pending_payment');
alter table public.bookings enable trigger bookings_rules;

-- ---------------------------------------------------------------- switched on, the rules still hold (P1 will relax them deliberately)
select lives_ok($$update public.events set type = 'kollide', pricing_mode = 'paid', price_paise = 500 where title = 'Free event'$$, 'with payments on a Kollide event can be paid');
select throws_ok($$update public.events set type = 'community' where title = 'Free event'$$, '23514', 'payments_off', 'but a community event never can');
select throws_ok(format('insert into public.bookings (event_id, user_id, status) values (%L, %L, %L)', :'fe', :'u4', 'paid'), '23514', 'invalid_booking_status', 'and a booking still cannot be INSERTED as paid');
select throws_ok(format('update public.bookings set status = %L where id = %L', 'paid', :'fb'), '23514', 'invalid_booking_change', 'or moved there by hand');
update public.app_config set value = 'false' where key = 'payments_enabled';
select is(private.payments_enabled(), false, 'off again');
select throws_ok(format('select private.join_event(%L, %L, null)', :'u4', :'fe'), 'P0001', 'payments_disabled', 'joining a paid event is refused when payments are off');

select * from finish();
rollback;

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

-- Setup: user 2 is a host (seed), user 4 becomes a second host, user 1 is the admin. Users 3 and 5 are plain members.
insert into public.user_roles (user_id, role) values ('00000000-0000-4000-8000-000000000004', 'host');

-- ===================================================== who can create events
select pg_temp.act_as_anon();
select throws_ok($$select public.create_event(pg_temp.ev())$$, '42501', null, 'a stranger CANNOT create an event');
reset role; select pg_temp.act_as(3);
select throws_ok($$select public.create_event(pg_temp.ev())$$, 'P0001', 'not_allowed', 'a plain member CANNOT create an event');
select throws_ok($$insert into public.events (host_id, type, title, area_id, starts_at, ends_at, capacity) values ('00000000-0000-4000-8000-000000000003', 'community', 'Direct', 1, now() + interval '2 days', now() + interval '2 days 1 hour', 5)$$,
  '42501', null, 'nobody can insert into events directly');

reset role; select pg_temp.act_as(2);
select lives_ok($$select public.create_event(pg_temp.ev())$$, 'a host CAN create a community event');
select throws_ok($$select public.create_event(pg_temp.ev('{"type":"kollide"}'))$$, 'P0001', 'not_allowed', 'a host CANNOT create a Kollide-run event');
select throws_ok($$select public.create_event(pg_temp.ev('{"type":"partner","partner_url":"https://example.com/t"}'))$$, 'P0001', 'not_allowed', 'a host CANNOT create a partner event');
reset role;
select id as sun_id from public.events where title = 'Sunday board games' \gset
select is((select status from public.events where title = 'Sunday board games'), 'draft'::public.event_status, 'a new event starts as a draft');
select is((select overbook_pct from public.events where title = 'Sunday board games'), 30::smallint, 'a free event defaults to 30% overbooking');
select is((select address from public.event_private where event_id = (select id from public.events where title = 'Sunday board games')), '12 Church Street, Bengaluru',
  'the address is stored in event_private');

reset role; select pg_temp.act_as(1);
select lives_ok($$select public.create_event(pg_temp.ev('{"type":"kollide","title":"Kollide supper club","pricing_mode":"cost_split","price_label":"About ₹400 each, split on the night"}'))$$, 'an admin CAN create a Kollide-run event (cost split)');
select lives_ok($$select public.create_event(pg_temp.ev('{"type":"partner","title":"Comedy night","partner_url":"https://example.com/tickets/1","referral_code":"KOLLIDE","pricing_mode":"pay_at_venue","price_label":"Tickets from ₹499 on the partner site","capacity":null}'))$$,
  'an admin CAN create a partner event');
select throws_ok($$select public.create_event(pg_temp.ev('{"type":"partner","title":"No link"}'))$$, 'P0001', 'partner_url_required', 'a partner event needs an https link');
select throws_ok($$select public.create_event(pg_temp.ev('{"type":"partner","title":"Bad link","partner_url":"http://example.com"}'))$$, 'P0001', 'partner_url_required', 'a partner link must be https');
select throws_ok($$select public.create_event(pg_temp.ev('{"partner_url":"https://example.com"}'))$$, 'P0001', 'partner_fields_not_allowed', 'only partner events carry a partner link');

-- ===================================================== validation
reset role; select pg_temp.act_as(2);
select throws_ok($$select public.create_event(pg_temp.ev('{"house_party":true,"capacity":26}'))$$, 'P0001', 'house_party_limit', 'a house party is limited to 25 guests');
select lives_ok($$select public.create_event(pg_temp.ev('{"title":"House party","house_party":true,"capacity":25,"approval_mode":"instant"}'))$$, 'a house party of 25 is fine');
reset role;
select is((select approval_mode from public.events where title = 'House party'), 'host_approval'::public.approval_mode, 'a house party forces host approval');
select pg_temp.act_as(2);
select throws_ok($$select public.create_event(pg_temp.ev('{"title":"Too small","capacity":1}'))$$, 'P0001', 'capacity_invalid', 'capacity must be at least 2');
select throws_ok($$select public.create_event(pg_temp.ev('{"capacity":null}'))$$, 'P0001', 'capacity_invalid', 'a non-partner event needs a capacity');
select throws_ok($$select public.create_event(pg_temp.ev('{"title":"ab"}'))$$, 'P0001', 'title_invalid', 'a title needs 3 characters');
select throws_ok($$select public.create_event(pg_temp.ev('{"area_id":null}'))$$, 'P0001', 'area_required', 'an area is required');
select throws_ok($$select public.create_event(pg_temp.ev('{"area_id":999}'))$$, 'P0001', 'area_required', 'an unknown area is refused');
select throws_ok($$select public.create_event(pg_temp.ev('{"min_age":17}'))$$, 'P0001', 'age_invalid', 'the minimum age is 18');
select throws_ok($$select public.create_event(pg_temp.ev('{"min_age":30,"max_age":25}'))$$, 'P0001', 'age_invalid', 'the maximum age cannot be below the minimum');
select throws_ok(format('select public.create_event(pg_temp.ev(%L::jsonb))', jsonb_build_object('ends_at', (now() + interval '9 days')::text)::text), 'P0001', 'dates_invalid', 'an event cannot end before it starts');
select throws_ok(format('select public.create_event(pg_temp.ev(%L::jsonb))', jsonb_build_object('starts_at', (now() - interval '1 day')::text, 'ends_at', (now() + interval '1 hour')::text)::text), 'P0001', 'start_in_past', 'an event cannot start in the past');
select throws_ok($$select public.create_event(pg_temp.ev('{"capacity":"lots"}'))$$, 'P0001', 'invalid_input', 'garbage input is refused');
select throws_ok($$select public.create_event(pg_temp.ev('{"pricing_mode":"pay_at_venue"}'))$$, 'P0001', 'price_label_required', 'pay at venue needs a price label');
select lives_ok($$select public.create_event(pg_temp.ev('{"title":"Pay at venue","pricing_mode":"pay_at_venue","price_label":"₹300 at the venue"}'))$$, 'pay at venue with a label works');
reset role;
select is((select overbook_pct from public.events where title = 'Pay at venue'), 0::smallint, 'only free events default to overbooking');
select pg_temp.act_as(2);

-- payments are off
select throws_ok($$select public.create_event(pg_temp.ev('{"pricing_mode":"paid","price_paise":30000}'))$$, 'P0001', 'payments_off', 'paid pricing is refused while payments are off');
select throws_ok($$select public.create_event(pg_temp.ev('{"price_paise":100}'))$$, 'P0001', 'payments_off', 'a price above 0 is refused while payments are off');
reset role; select pg_temp.act_as(1);
select throws_ok($$select public.create_event(pg_temp.ev('{"type":"kollide","pricing_mode":"paid","price_paise":30000}'))$$, 'P0001', 'payments_off', 'even an admin CANNOT create a paid Kollide event while payments are off');
reset role;
select throws_ok($$insert into public.events (host_id, type, title, area_id, starts_at, ends_at, capacity, pricing_mode, price_paise)
  values ('00000000-0000-4000-8000-000000000002', 'kollide', 'Sneaky', 1, now() + interval '2 days', now() + interval '2 days 1 hour', 5, 'paid', 100)$$,
  '23514', 'payments_off', 'even the database owner CANNOT insert a paid event while payments are off (trigger)');

-- P1 seam: with the switch on, paid is allowed for Kollide-run events only
update public.app_config set value = 'true' where key = 'payments_enabled';
select pg_temp.act_as(1);
select lives_ok($$select public.create_event(pg_temp.ev('{"type":"kollide","title":"Paid supper","pricing_mode":"paid","price_paise":50000}'))$$, 'with payments on, a Kollide-run event CAN be paid');
reset role; select pg_temp.act_as(2);
select throws_ok($$select public.create_event(pg_temp.ev('{"pricing_mode":"paid","price_paise":30000}'))$$, 'P0001', 'payments_off', 'but a community event still CANNOT be paid');
reset role;
update public.app_config set value = 'false' where key = 'payments_enabled';
delete from public.events where title = 'Paid supper';

-- ===================================================== edit rules
select pg_temp.act_as(2);
select lives_ok($$select public.update_event((select id from public.events where title = 'Sunday board games'), '{"description":"Bring two games.","capacity":14}')$$, 'the host CAN edit their draft');
reset role;
select is((select capacity from public.events where title = 'Sunday board games'), 14, 'the edit was saved');
select is((select address from public.event_private where event_id = (select id from public.events where title = 'Sunday board games')), '12 Church Street, Bengaluru', 'fields left out stay as they were');
select pg_temp.act_as(4);
select throws_ok(format('select public.update_event(%L, ''{"description":"hijack"}'')', :'sun_id'), 'P0001', 'not_allowed', 'another host CANNOT edit it');
reset role; select pg_temp.act_as(3);
select throws_ok(format('select public.update_event(%L, ''{"description":"hijack"}'')', :'sun_id'), 'P0001', 'not_allowed', 'a member CANNOT edit it');
reset role; select pg_temp.act_as(2);
select throws_ok($$select public.update_event((select id from public.events where title = 'Sunday board games'), '{"type":"kollide"}')$$, 'P0001', 'type_locked', 'the type cannot change');
select throws_ok($$select public.update_event('00000000-0000-4000-8000-0000000000ff', '{}')$$, 'P0001', 'not_found', 'an unknown event is refused');

-- ===================================================== submitting, approving, rejecting
select throws_ok($$select public.submit_event_for_review((select id from public.events where title = 'Sunday board games'))$$, 'P0001', 'cover_required', 'a cover is needed to submit');
reset role;
update public.events set cover_key = 'events/11111111-1111-4111-8111-111111111111.webp' where title = 'Sunday board games';
update public.event_private set address = null where event_id = (select id from public.events where title = 'Sunday board games');
select pg_temp.act_as(2);
select throws_ok($$select public.submit_event_for_review((select id from public.events where title = 'Sunday board games'))$$, 'P0001', 'address_required', 'an address is needed to submit');
select lives_ok($$select public.update_event((select id from public.events where title = 'Sunday board games'), '{"address":"12 Church Street, Bengaluru"}')$$, 'the address is added');
reset role; select pg_temp.act_as(4);
select throws_ok(format('select public.submit_event_for_review(%L)', :'sun_id'), 'P0001', 'not_allowed', 'another host CANNOT submit it');
reset role; select pg_temp.act_as(2);
select lives_ok($$select public.submit_event_for_review((select id from public.events where title = 'Sunday board games'))$$, 'the host CAN submit it');
reset role;
select is((select status from public.events where title = 'Sunday board games'), 'pending_review'::public.event_status, 'it is pending review');
select pg_temp.act_as(2);
select throws_ok($$select public.update_event((select id from public.events where title = 'Sunday board games'), '{"description":"x"}')$$, 'P0001', 'event_locked', 'a submitted event is locked');
select throws_ok($$select public.approve_event((select id from public.events where title = 'Sunday board games'), 'ok')$$, 'P0001', 'not_allowed', 'a host CANNOT approve their own event');
reset role; select pg_temp.act_as(3);
select throws_ok($$select public.approve_event((select id from public.events where title = 'Sunday board games'), 'ok')$$, 'P0001', 'not_allowed', 'a member CANNOT approve');
reset role; select pg_temp.act_as(1);
select throws_ok($$select public.reject_event((select id from public.events where title = 'Sunday board games'), '  ')$$, 'P0001', 'note_required', 'a rejection needs a note');
select lives_ok($$select public.reject_event((select id from public.events where title = 'Sunday board games'), 'Please add the dress code.')$$, 'an admin CAN reject with a note');
reset role;
select is((select status from public.events where title = 'Sunday board games'), 'draft'::public.event_status, 'a rejected event goes back to draft');
select pg_temp.act_as(2);
select is((select review_note from public.my_events() where title = 'Sunday board games'), 'Please add the dress code.', 'the host sees the admin''s note');
select lives_ok($$select public.submit_event_for_review((select id from public.events where title = 'Sunday board games'))$$, 'the host CAN resubmit');
reset role; select pg_temp.act_as(1);
select lives_ok($$select public.approve_event((select id from public.events where title = 'Sunday board games'), 'Looks good')$$, 'an admin CAN approve');
reset role;
select is((select status from public.events where title = 'Sunday board games'), 'published'::public.event_status, 'the event is published');
select ok((select published_at from public.events where title = 'Sunday board games') is not null, 'with a publish time');
select throws_ok($$select public.approve_event((select id from public.events where title = 'Sunday board games'), 'again')$$, 'P0001', 'invalid_status_change', 'a published event cannot be approved again');

-- editing a published event: only descriptive fields
select pg_temp.act_as(2);
select lives_ok($$select public.update_event((select id from public.events where title = 'Sunday board games'), '{"description":"Bring two games and a snack."}')$$, 'the host CAN change the description of a published event');
select throws_ok($$select public.update_event((select id from public.events where title = 'Sunday board games'), '{"capacity":50}')$$, 'P0001', 'event_locked', 'but NOT the capacity');
select throws_ok($$select public.update_event((select id from public.events where title = 'Sunday board games'), '{"women_only":true}')$$, 'P0001', 'event_locked', 'nor who may come');

-- invalid direct status changes are refused by the database
reset role;
select throws_ok($$update public.events set status = 'draft' where title = 'Sunday board games'$$, '23514', 'invalid_status_change', 'published to draft is refused');
select lives_ok($$update public.events set status = 'completed' where title = 'Sunday board games'$$, 'published to completed is allowed');
select throws_ok($$update public.events set status = 'published' where title = 'Sunday board games'$$, '23514', 'invalid_status_change', 'completed is final');

-- cancel
select pg_temp.act_as(2);
select lives_ok($$select public.cancel_event((select id from public.events where title = 'House party'), 'Host is unwell')$$, 'the host CAN cancel a draft');
reset role; select id as pav_id from public.events where title = 'Pay at venue' \gset
select pg_temp.act_as(4);
select throws_ok(format('select public.cancel_event(%L, ''x'')', :'pav_id'), 'P0001', 'not_allowed', 'another host CANNOT cancel it');
reset role;
select is((select status from public.events where title = 'House party'), 'cancelled'::public.event_status, 'the event is cancelled');
select pg_temp.act_as(2);
select throws_ok($$select public.cancel_event((select id from public.events where title = 'House party'), 'again')$$, 'P0001', 'event_locked', 'a cancelled event is final');
reset role;

-- ===================================================== who can see events
-- Fresh published events for the visibility tests.
select pg_temp.act_as(2);
select public.create_event(pg_temp.ev('{"title":"Visible published","pricing_mode":"free","women_only":true,"capacity":6}')) as vis_id \gset
select public.create_event(pg_temp.ev('{"title":"Hidden draft"}')) as draft_id \gset
reset role;
update public.events set status = 'pending_review', cover_key = 'events/22222222-2222-4222-8222-222222222222.webp' where title = 'Pay at venue';
update public.events set status = 'pending_review', cover_key = 'events/33333333-3333-4333-8333-333333333333.webp' where id = :'vis_id';
update public.events set status = 'published', published_at = now() where id = :'vis_id';

select pg_temp.act_as_anon();
select ok((select count(*) from public.events where id = :'vis_id') = 1, 'a stranger CAN read a published event');
select is((select count(*)::int from public.events where id = :'draft_id'), 0, 'a stranger CANNOT read a draft');
select is((select count(*)::int from public.events where title = 'Pay at venue'), 0, 'a stranger CANNOT read a pending event');
select throws_ok($$select partner_url from public.events$$, '42501', null, 'a stranger CANNOT read partner links directly');
select throws_ok($$select referral_code from public.events$$, '42501', null, 'a stranger CANNOT read referral codes');
select throws_ok($$select review_note from public.events$$, '42501', null, 'a stranger CANNOT read review notes');
select throws_ok($$select * from public.event_private$$, '42501', null, 'a stranger CANNOT read event_private');
select throws_ok($$select * from public.event_cards$$, '42501', null, 'a stranger CANNOT read event_cards (signed-in only)');

reset role; select pg_temp.act_as(3);
select is((select count(*)::int from public.events where id = :'draft_id'), 0, 'a member CANNOT read a draft');
select throws_ok($$select partner_url from public.events$$, '42501', null, 'a member CANNOT read partner links directly');
select is((select count(*)::int from public.event_private), 0, 'a member CANNOT read any event_private row');

reset role; select pg_temp.act_as(2);
select is((select count(*)::int from public.events where id = :'draft_id'), 1, 'the host CAN read their own draft');
select ok((select count(*) from public.event_private where event_id = :'draft_id') = 1, 'and its private row');
reset role; select pg_temp.act_as(4);
select is((select count(*)::int from public.events where id = :'draft_id'), 0, 'another host CANNOT read it');
reset role; select pg_temp.act_as(1);
select is((select count(*)::int from public.events where id = :'draft_id'), 1, 'an admin CAN read any event');
select ok((select count(*) from public.event_private where event_id = :'draft_id') = 1, 'and any private row');
select is((select (public.get_event_for_edit(:'draft_id') ->> 'title')), 'Hidden draft', 'an admin CAN load any event for editing');
reset role; select pg_temp.act_as(3);
select throws_ok(format($$select public.get_event_for_edit(%L)$$, :'draft_id'), 'P0001', 'not_allowed', 'a member CANNOT load an event for editing');

-- ===================================================== the address rule
reset role; select pg_temp.act_as_anon();
select throws_ok(format($$select public.get_event_address(%L)$$, :'vis_id'), '42501', null, 'a stranger CANNOT get an address');
reset role; select pg_temp.act_as(3);
select throws_ok(format($$select public.get_event_address(%L)$$, :'vis_id'), 'P0001', 'not_allowed', 'a member without a booking CANNOT get the address');
reset role; select pg_temp.act_as(4);
select throws_ok(format($$select public.get_event_address(%L)$$, :'vis_id'), 'P0001', 'not_allowed', 'another host CANNOT get the address');
reset role; select pg_temp.act_as(2);
select is((select public.get_event_address(:'vis_id') ->> 'address'), '12 Church Street, Bengaluru', 'the host CAN get the address');
reset role; select pg_temp.act_as(1);
select is((select public.get_event_address(:'vis_id') ->> 'address'), '12 Church Street, Bengaluru', 'an admin CAN get the address');
select throws_ok($$select public.get_event_address('00000000-0000-4000-8000-0000000000ff')$$, 'P0001', 'not_found', 'an unknown event is refused');
reset role; select pg_temp.act_as(3);
select is((select count(*)::int from information_schema.columns where table_name = 'event_cards' and column_name in ('address', 'lat', 'lng', 'host_notes', 'directions_note', 'partner_url', 'referral_code', 'review_note')), 0,
  'event_cards never contains the address, notes, partner link or review note');

-- ===================================================== cards and search
reset role;
-- Several published events with different attributes (inserted directly as the owner).
insert into public.events (host_id, type, title, area_id, category_id, starts_at, ends_at, capacity, pricing_mode, price_label, status, published_at, women_only, partner_url) values
  ('00000000-0000-4000-8000-000000000002', 'community', 'S1 early free',      2, 2, now() + interval '3 days',  now() + interval '3 days 2 hours',  8,  'free',         null,            'published', now(), false, null),
  ('00000000-0000-4000-8000-000000000002', 'community', 'S2 later venue',     3, 2, now() + interval '20 days', now() + interval '20 days 2 hours', 20, 'pay_at_venue', '₹300 at the venue', 'published', now(), false, null),
  ('00000000-0000-4000-8000-000000000001', 'kollide',   'S3 split',           2, 3, now() + interval '8 days',  now() + interval '8 days 2 hours',  4,  'cost_split',   '₹250 each',     'published', now(), false, null),
  ('00000000-0000-4000-8000-000000000001', 'partner',   'S4 partner no cap',  2, 3, now() + interval '5 days',  now() + interval '5 days 2 hours',  null, 'free',       null,            'published', now(), false, 'https://example.com/x');
-- A past published event must not show.
insert into public.events (host_id, type, title, area_id, starts_at, ends_at, capacity, status, published_at)
values ('00000000-0000-4000-8000-000000000002', 'community', 'Past event', 1, now() - interval '5 days', now() - interval '5 days' + interval '2 hours', 5, 'published', now());

select pg_temp.act_as(3);
select ok((select count(*) from public.event_cards) >= 5, 'a member CAN read event_cards');
select is((select count(*)::int from public.event_cards where title in ('Hidden draft', 'Pay at venue', 'House party')), 0, 'cards show published events only');
select is((select spots_left from public.event_cards where title = 'S1 early free'), 8, 'spots left equals capacity until bookings exist (B5)');
select is((select spots_left from public.event_cards where title = 'S4 partner no cap'), null, 'a partner event has no spots count');
select is((select attendee_avatars from public.event_cards where title = 'S1 early free'), '{}'::text[], 'no attendee avatars until bookings exist (B5)');
select ok((select host_first_name from public.event_cards where title = 'S1 early free') = 'Dev', 'the card shows the host first name');
select is((select host_is_verified from public.event_cards where title = 'S1 early free'), true, 'and the host verified badge');
select is((select area_name from public.event_cards where title = 'S1 early free'), 'Koramangala', 'and the area name');
select ok((select has_partner_link from public.event_cards where title = 'S4 partner no cap'), 'partner cards flag the link without exposing it');

select is((select count(*)::int from public.search_events() where title like 'S_ %' or title = 'Past event'), 4, 'search returns upcoming events only (the past one is hidden)');
select is((select array_agg(title order by starts_at) from public.search_events() where title like 'S_ %'), array['S1 early free', 'S4 partner no cap', 'S3 split', 'S2 later venue'], 'search is ordered by start time');
select is((select count(*)::int from public.search_events(p_from := now() + interval '4 days', p_to := now() + interval '10 days') where title like 'S_ %'), 2, 'the date range filter works');
select is((select count(*)::int from public.search_events(p_area_ids := array[2]::smallint[]) where title like 'S_ %'), 3, 'the area filter works');
select is((select count(*)::int from public.search_events(p_category_ids := array[3]::smallint[]) where title like 'S_ %'), 2, 'the category filter works');
select is((select array_agg(title) from public.search_events(p_pricing := array['pay_at_venue']::public.pricing_mode[]) where title like 'S_ %'), array['S2 later venue'], 'the price type filter works');
select is((select count(*)::int from public.search_events(p_pricing := array['paid']::public.pricing_mode[])), 0, 'no event is paid while payments are off');
select is((select count(*)::int from public.search_events(p_women_only := true) where title in ('Visible published') or title like 'S_ %'), 1, 'the women-only filter works');
select is((select count(*)::int from public.search_events(p_group_size := 6) where title like 'S_ %'), 3, 'the group size filter keeps events with enough spots (and unlimited ones)');
select is((select count(*)::int from public.search_events(p_types := array['kollide']::public.event_type[]) where title like 'S_ %'), 1, 'the type filter works');
select is((select count(*)::int from public.search_events(p_limit := 2)), 2, 'paging limits the results');
select isnt((select id from public.search_events(p_limit := 1, p_offset := 0)), (select id from public.search_events(p_limit := 1, p_offset := 1)), 'and the offset moves on');
reset role; select pg_temp.act_as_anon();
select throws_ok($$select * from public.search_events()$$, '42501', null, 'a stranger CANNOT search events (signed-in only)');

-- ===================================================== hubs and featured slots
-- Start from a clean slate: the demo seed already has a hub and featured slots.
reset role;
delete from public.featured_slots;
delete from public.hubs;
select pg_temp.act_as(1);
select lives_ok($$select public.admin_upsert_hub(null, 'new-years-eve', 'New Year''s Eve in Bengaluru', 'Count down together', '#3B3B98', current_date, current_date + 30, 1, true)$$, 'an admin CAN create a hub');
select lives_ok($$select public.admin_upsert_hub(null, 'secret-hub', 'Secret hub', null, '#F2A93B', null, null, 2, false)$$, 'and an unpublished hub');
select throws_ok($$select public.admin_upsert_hub(null, 'new-years-eve', 'Duplicate slug', null, '#F2A93B', null, null, 3, true)$$, 'P0001', 'slug_taken', 'slugs are unique');
select throws_ok($$select public.admin_upsert_hub(null, 'Bad Slug', 'Bad slug hub', null, '#F2A93B', null, null, 3, true)$$, 'P0001', 'slug_invalid', 'a slug has lowercase letters, digits and dashes only');
select throws_ok($$select public.admin_upsert_hub(null, 'ugly', 'Ugly colour', null, 'red', null, null, 3, true)$$, 'P0001', 'color_invalid', 'a colour is a #RRGGBB value');
select lives_ok($$select public.admin_set_hub_events((select id from public.hubs where slug = 'new-years-eve'), array[(select id from public.events where title = 'S3 split'), (select id from public.events where title = 'S1 early free'), (select id from public.events where title = 'Hidden draft')])$$, 'an admin CAN set a hub''s events (in order)');
select throws_ok($$select public.admin_set_hub_events((select id from public.hubs where slug = 'new-years-eve'), array[(select id from public.events where title = 'S3 split'), (select id from public.events where title = 'S3 split')])$$, 'P0001', 'duplicate_events', 'an event appears once in a hub');

reset role; select pg_temp.act_as(2);
select throws_ok($$select public.admin_upsert_hub(null, 'host-hub', 'Host hub', null, '#F2A93B', null, null, 3, true)$$, 'P0001', 'not_allowed', 'a host CANNOT manage hubs');
select throws_ok($$select public.feature_event((select id from public.events where title = 'S1 early free'), 1::smallint)$$, 'P0001', 'not_allowed', 'a host CANNOT feature events');
reset role; select pg_temp.act_as(3);
select throws_ok($$select public.admin_delete_hub((select id from public.hubs where slug = 'new-years-eve'))$$, 'P0001', 'not_allowed', 'a member CANNOT delete hubs');
select throws_ok($$select public.admin_set_hub_events((select id from public.hubs where slug = 'new-years-eve'), '{}')$$, 'P0001', 'not_allowed', 'a member CANNOT change hub events');

reset role; select pg_temp.act_as_anon();
select is((select count(*)::int from public.hubs), 1, 'a stranger CAN read published hubs (and not unpublished ones)');
select is((select event_count from public.hub_cards where slug = 'new-years-eve'), 2, 'the hub card counts published events only');
select is((select count(*)::int from public.hub_events), 2, 'a stranger sees only published events in a hub');
select throws_ok($$insert into public.hubs (slug, title) values ('direct', 'Direct hub')$$, '42501', null, 'a stranger CANNOT write hubs');
reset role; select pg_temp.act_as(3);
select is((select array_agg(title) from public.hub_event_cards((select id from public.hubs where slug = 'new-years-eve'))), array['S3 split', 'S1 early free'], 'a member gets the hub events in the admin''s order');
select is((select count(*)::int from public.hubs where slug = 'secret-hub'), 0, 'a member CANNOT see an unpublished hub');
reset role; select pg_temp.act_as(1);
select is((select count(*)::int from public.hubs where slug = 'secret-hub'), 1, 'an admin CAN see an unpublished hub');

select throws_ok($$select public.feature_event((select id from public.events where title = 'Hidden draft'), 1::smallint)$$, 'P0001', 'event_not_published', 'only published events can be featured');
select throws_ok($$select public.feature_event((select id from public.events where title = 'S1 early free'), 9::smallint)$$, 'P0001', 'invalid_position', 'slots are 1 to 6');
select lives_ok($$select public.feature_event((select id from public.events where title = 'S1 early free'), 2::smallint)$$, 'an admin CAN feature an event');
select lives_ok($$select public.feature_event((select id from public.events where title = 'S3 split'), 1::smallint)$$, 'and another');
select lives_ok($$select public.feature_event((select id from public.events where title = 'S2 later venue'), 2::smallint)$$, 'a new event takes over an occupied slot');
reset role; select pg_temp.act_as(3);
select is((select array_agg(title) from public.featured_event_cards()), array['S3 split', 'S2 later venue'], 'featured events come back in slot order');
reset role; select pg_temp.act_as(1);
select lives_ok($$select public.feature_event((select id from public.events where title = 'S3 split'), 1::smallint, now() - interval '1 minute')$$, 'a slot can have an end time');
reset role; select pg_temp.act_as(3);
select is((select array_agg(title) from public.featured_event_cards()), array['S2 later venue'], 'an expired slot disappears');
reset role; select pg_temp.act_as(1);
select lives_ok($$select public.unfeature_event((select id from public.events where title = 'S2 later venue'))$$, 'an admin CAN unfeature');
select lives_ok($$select public.admin_delete_hub((select id from public.hubs where slug = 'secret-hub'))$$, 'an admin CAN delete a hub');

-- ===================================================== covers and the cleanup sweep
reset role;
insert into public.upload_keys (key, user_id, purpose, size_limit, event_id) values
  ('events/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp', '00000000-0000-4000-8000-000000000002', 'event_cover', 307200, (select id from public.events where title = 'Hidden draft')),
  ('events/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp', '00000000-0000-4000-8000-000000000004', 'event_cover', 307200, (select id from public.events where title = 'Hidden draft'));
select pg_temp.act_as(2);
select throws_ok($$select public.set_event_cover((select id from public.events where title = 'Hidden draft'), 'events/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp')$$, 'P0001', 'invalid_key', 'a key issued to someone else CANNOT be used');
select lives_ok($$select public.set_event_cover((select id from public.events where title = 'Hidden draft'), 'events/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp')$$, 'the host CAN attach their issued cover');
select throws_ok($$select public.set_event_cover((select id from public.events where title = 'Hidden draft'), 'events/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp')$$, 'P0001', 'invalid_key', 'a cover key works once');
reset role; select pg_temp.act_as(4);
select throws_ok(format('select public.set_event_cover(%L, ''events/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp'')', :'draft_id'), 'P0001', 'not_allowed', 'another host CANNOT set the cover of someone else''s event');
reset role; select pg_temp.act_as_anon();
select throws_ok($$select public.set_event_cover('00000000-0000-4000-8000-0000000000e1', 'events/x')$$, '42501', null, 'a stranger CANNOT set a cover');
reset role; select pg_temp.act_as_service();
select is(public.unreferenced_keys('media', array['events/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp', 'events/99999999-9999-4999-8999-999999999999.webp']), array['events/99999999-9999-4999-8999-999999999999.webp'],
  'the cleanup sweep keeps event covers');
reset role; select pg_temp.act_as(3);
select throws_ok($$select public.complete_ended_events()$$, '42501', null, 'a member CANNOT run the completion job');
reset role; select pg_temp.act_as_service();
select is(public.complete_ended_events(), 1, 'the completion job completes the one event that has ended');
select is((select status from public.events where title = 'Past event'), 'completed'::public.event_status, 'and it is now completed');

-- ===================================================== deleting a host's account cancels their upcoming events
reset role;
select pg_temp.act_as(4);
select public.create_event(pg_temp.ev('{"title":"Gone host event"}')) as gone_id \gset
select lives_ok($$select public.delete_my_account()$$, 'a host deletes their account');
reset role;
select is((select status from public.events where id = :'gone_id'), 'cancelled'::public.event_status, 'their upcoming event is cancelled');

select * from finish();
rollback;

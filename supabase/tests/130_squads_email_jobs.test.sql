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


select pg_temp.mk_event('Squad event', 40, 'instant') as sq \gset
select pg_temp.mk_event('Squad women', 40, 'instant', '{"women_only": true}') as sqw \gset
-- Extra members: eight more people so a squad can reach its limit.
select pg_temp.sign_up(('00000000-0000-4000-8000-0000000001' || lpad(n::text, 2, '0'))::uuid, 'sq' || n || '@kollide.test') from generate_series(1, 8) n;
update public.profiles set onboarding_completed_at = now(), is_verified = false where id::text like '00000000-0000-4000-8000-0000000001%';
update public.profile_private set date_of_birth = date '1992-02-02', gender = 'man' where id::text like '00000000-0000-4000-8000-0000000001%';

-- ===================================================== squads
select pg_temp.act_as_anon();
select throws_ok(format('select public.create_squad(%L, ''Gate 2'')', :'sq'), '42501', null, 'a stranger CANNOT create a squad');
reset role; select pg_temp.act_as(3);
select throws_ok(format('select public.create_squad(%L, ''ab'')', :'sq'), 'P0001', 'meeting_point_invalid', 'a squad needs a meeting point');
select public.create_squad(:'sq', 'Cafe near Gate 2 at 5pm', 'Board gamers') as squad \gset
select is((select count(*)::int from public.bookings where event_id = :'sq' and user_id = '00000000-0000-4000-8000-000000000003'), 1, 'creating a squad also books the creator through the normal join path');
select is((select status from public.bookings where event_id = :'sq' and user_id = '00000000-0000-4000-8000-000000000003'), 'approved'::public.booking_status, 'an instant event approves the creator');
select throws_ok(format('select public.create_squad(%L, ''Another point'')', :'sq'), 'P0001', 'already_in_squad', 'a person can lead only one squad per event');
select is((select member_count from public.event_squads(:'sq')), 1, 'the squad starts with its creator');
select is((select complete from public.event_squads(:'sq')), false, 'it is "forming" until it has 4 members');
select throws_ok($$select meeting_point from public.squads$$, '42501', null, 'the meeting point is not readable from the table');

-- requests and the creator's approval
reset role;
select pg_temp.act_as_uid('00000000-0000-4000-8000-000000000101');
select lives_ok(format('select public.request_to_join_squad(%L)', :'squad'), 'a member CAN ask to join a squad');
select throws_ok(format('select public.get_squad(%L)', :'squad'), 'P0001', 'not_allowed', 'but cannot see the meeting point until approved');
select throws_ok(format('select public.request_to_join_squad(%L)', :'squad'), 'P0001', 'already_in_squad', 'asking twice is refused');
select throws_ok(format('select public.decide_squad_request(%L, %L, true)', :'squad', '00000000-0000-4000-8000-000000000101'), 'P0001', 'not_allowed', 'a member CANNOT approve their own request');
reset role; select pg_temp.act_as(2);
select throws_ok(format('select public.decide_squad_request(%L, %L, true)', :'squad', '00000000-0000-4000-8000-000000000101'), 'P0001', 'not_allowed', 'the event host does NOT approve squad members: the creator does');
reset role; select pg_temp.act_as(3);
select lives_ok(format('select public.decide_squad_request(%L, %L, true)', :'squad', '00000000-0000-4000-8000-000000000101'), 'the squad creator CAN approve');
select is((select jsonb_array_length(public.get_squad(:'squad') -> 'members')), 2, 'the creator sees both members');
reset role; select pg_temp.act_as_uid('00000000-0000-4000-8000-000000000101');
select is((public.get_squad(:'squad') ->> 'meeting_point'), 'Cafe near Gate 2 at 5pm', 'an approved member CAN see the meeting point');
select is((select count(*)::int from public.bookings where event_id = :'sq' and user_id = '00000000-0000-4000-8000-000000000101' and squad_id is not null), 1, 'the member''s own booking is linked to the squad');

-- size limit: 6 members
reset role;
do $$
declare n int; sq uuid := (select id from public.squads where name = 'Board gamers'); creator uuid := '00000000-0000-4000-8000-000000000003';
begin
  -- people 102 to 105 join and the creator approves them (squad becomes 6 with the creator and 101)
  for n in 102..105 loop
    perform set_config('request.jwt.claims', json_build_object('sub', ('00000000-0000-4000-8000-000000000' || n)::uuid, 'role', 'authenticated')::text, true);
    set local role authenticated;
    perform public.request_to_join_squad(sq);
    reset role;
    perform set_config('request.jwt.claims', json_build_object('sub', creator, 'role', 'authenticated')::text, true);
    set local role authenticated;
    perform public.decide_squad_request(sq, ('00000000-0000-4000-8000-000000000' || n)::uuid, true);
    reset role;
  end loop;
end $$;
select is((select count(*)::int from public.squad_members where squad_id = :'squad' and status = 'approved'), 6, 'a squad can have 6 members');
select pg_temp.act_as_uid('00000000-0000-4000-8000-000000000106');
select throws_ok(format('select public.request_to_join_squad(%L)', :'squad'), 'P0001', 'squad_full', 'a 7th person CANNOT join');
select is((select complete from public.event_squads(:'sq')), true, 'a squad with 4 or more members is complete');
select is((select spots_left from public.event_squads(:'sq')), 0, 'and shows no spots left');

-- leaving, declining, disbanding
reset role; select pg_temp.act_as_uid('00000000-0000-4000-8000-000000000105');
select lives_ok(format('select public.leave_squad(%L)', :'squad'), 'a member CAN leave');
select is((select squad_id from public.bookings where event_id = :'sq' and user_id = '00000000-0000-4000-8000-000000000105'), null, 'and their booking stays but leaves the squad');
select is((select status from public.bookings where event_id = :'sq' and user_id = '00000000-0000-4000-8000-000000000105'), 'approved'::public.booking_status, 'their event booking is untouched');
reset role; select pg_temp.act_as(3);
select throws_ok(format('select public.leave_squad(%L)', :'squad'), 'P0001', 'creator_cannot_leave', 'the creator cannot leave (they disband instead)');
reset role; select pg_temp.act_as_uid('00000000-0000-4000-8000-000000000106');
select lives_ok(format('select public.request_to_join_squad(%L)', :'squad'), 'a place opened, so another person CAN ask');
reset role; select pg_temp.act_as(3);
select lives_ok(format('select public.decide_squad_request(%L, %L, false)', :'squad', '00000000-0000-4000-8000-000000000106'), 'the creator CAN decline');
reset role;
select is((select title from public.notifications where user_id = '00000000-0000-4000-8000-000000000106' order by id desc limit 1), 'An update on your squad request', 'with gentle wording');
select is((select status from public.bookings where event_id = :'sq' and user_id = '00000000-0000-4000-8000-000000000106'), 'approved'::public.booking_status, 'a declined squad request leaves their event booking alone');
select pg_temp.act_as_uid('00000000-0000-4000-8000-000000000104');
select throws_ok(format('select public.disband_squad(%L)', :'squad'), 'P0001', 'not_allowed', 'a member CANNOT disband the squad');
reset role; select pg_temp.act_as(3);
select lives_ok(format('select public.disband_squad(%L)', :'squad'), 'the creator CAN disband it');
select is((select count(*)::int from public.bookings where squad_id = :'squad'), 0, 'bookings are detached');
select is((select count(*)::int from public.event_squads(:'sq')), 0, 'and it no longer shows as forming');

-- squad members still obey the event rules (one join path)
reset role; select pg_temp.act_as(3);
select public.create_squad(:'sqw', 'Gate 1', null) as squadw \gset
reset role; select pg_temp.act_as_uid('00000000-0000-4000-8000-000000000101');
select throws_ok(format('select public.request_to_join_squad(%L)', :'squadw'), 'P0001', 'women_only', 'a man CANNOT join a squad for a women-only event (the join rules apply)');
reset role;
select is((select count(*)::int from public.squad_members where squad_id = :'squadw' and user_id = '00000000-0000-4000-8000-000000000101'), 0, 'and nothing was recorded');

-- ===================================================== the email queue (service role)
reset role;
delete from public.email_outbox;
insert into public.email_outbox (template, user_id, data, priority) values
  ('day_of_reminder', '00000000-0000-4000-8000-000000000003', '{"n":1}', 2),
  ('request_received', '00000000-0000-4000-8000-000000000003', '{"n":2}', 2),
  ('booking_approved', '00000000-0000-4000-8000-000000000004', '{"n":3}', 1),
  ('still_coming', '00000000-0000-4000-8000-000000000004', '{"n":4}', 1);
select pg_temp.act_as(3);
select throws_ok($$select * from public.claim_emails(5)$$, '42501', null, 'a member CANNOT claim emails');
select throws_ok($$select public.finish_emails('[]')$$, '42501', null, 'a member CANNOT report email results');
reset role; select pg_temp.act_as_service();
select is((select array_agg(data ->> 'n' order by priority, id) from public.claim_emails(3)), array['3', '4', '1'], 'critical emails are claimed first, then the oldest');
select is((select count(*)::int from public.claim_emails(5)), 1, 'claimed emails are not claimed again');
reset role;
select is((select status from public.email_outbox where data ->> 'n' = '3'), 'sending', 'claimed emails are marked as sending');
select is((select attempts from public.email_outbox where data ->> 'n' = '3'), 1::smallint, 'and counted as an attempt');
select is((select to_email from (select o.id, pp.email::text as to_email from public.email_outbox o join public.profile_private pp on pp.id = o.user_id where o.data ->> 'n' = '3') x), 'kabir.member@kollide.test', 'the recipient address comes from the private table');
select pg_temp.act_as_service();
select public.finish_emails(jsonb_build_array(
  jsonb_build_object('id', (select id from public.email_outbox where data ->> 'n' = '3'), 'outcome', 'sent', 'message_id', '<abc@brevo>'),
  jsonb_build_object('id', (select id from public.email_outbox where data ->> 'n' = '4'), 'outcome', 'retry', 'error', 'timeout'),
  jsonb_build_object('id', (select id from public.email_outbox where data ->> 'n' = '2'), 'outcome', 'skipped', 'error', 'not on the staging allow-list')));
reset role;
select is((select status from public.email_outbox where data ->> 'n' = '3'), 'sent', 'a sent email is marked sent');
select is((select provider_message_id from public.email_outbox where data ->> 'n' = '3'), '<abc@brevo>', 'with the provider id');
select is((select status from public.email_outbox where data ->> 'n' = '2'), 'skipped', 'a skipped email is marked skipped');
select is((select status from public.email_outbox where data ->> 'n' = '4'), 'queued', 'a failed try goes back in the queue');
select ok((select send_after from public.email_outbox where data ->> 'n' = '4') > now(), 'after a delay');
select pg_temp.act_as_service();
select is(public.emails_sent_today(), 1, 'the daily counter counts sent emails (UTC day)');
reset role;

-- three retries, then failed
update public.email_outbox set send_after = now() - interval '1 minute' where data ->> 'n' = '4';
select pg_temp.act_as_service();
select count(*) from public.claim_emails(5);
select public.finish_emails(jsonb_build_array(jsonb_build_object('id', (select id from public.email_outbox where data ->> 'n' = '4'), 'outcome', 'retry', 'error', 'timeout 2')));
reset role;
update public.email_outbox set send_after = now() - interval '1 minute' where data ->> 'n' = '4';
select pg_temp.act_as_service();
select count(*) from public.claim_emails(5);
select public.finish_emails(jsonb_build_array(jsonb_build_object('id', (select id from public.email_outbox where data ->> 'n' = '4'), 'outcome', 'retry', 'error', 'timeout 3')));
reset role;
update public.email_outbox set send_after = now() - interval '1 minute' where data ->> 'n' = '4';
select pg_temp.act_as_service();
select count(*) from public.claim_emails(5);
select public.finish_emails(jsonb_build_array(jsonb_build_object('id', (select id from public.email_outbox where data ->> 'n' = '4'), 'outcome', 'retry', 'error', 'timeout 4')));
reset role;
select is((select attempts from public.email_outbox where data ->> 'n' = '4'), 4::smallint, 'an email is tried once plus 3 retries');
select is((select status from public.email_outbox where data ->> 'n' = '4'), 'failed', 'then it is marked failed');
select is((select last_error from public.email_outbox where data ->> 'n' = '4'), 'timeout 4', 'with the last error');

-- a crashed run: rows stuck in "sending" are claimed again after 10 minutes
update public.email_outbox set status = 'sending', send_after = now() - interval '1 minute' where data ->> 'n' = '1';
select pg_temp.act_as_service();
select is((select count(*)::int from public.claim_emails(5)), 1, 'a stuck "sending" email is picked up again');

-- ===================================================== scheduled jobs
reset role;
delete from public.job_runs;
select private.cron_flush_email();
select is((select last_status from public.job_runs where job = 'flush-email'), 'skipped', 'the flush job records "skipped" when Vault has no Worker address yet');
select pg_temp.act_as_service();
select lives_ok($$select public.record_job_run('flush-email', 'ok', '{"sent": 3}')$$, 'the Worker CAN record its run');
reset role;
select is((select run_count from public.job_runs where job = 'flush-email'), 2::bigint, 'runs are counted');
select is((select count(*)::int from public.job_runs where job = 'flush-email'), 1, 'one row per job (no growth)');
select private.job_housekeeping();
select is((select last_status from public.job_runs where job = 'housekeeping'), 'ok', 'housekeeping records its run');
select is((select count(*)::int from cron.job where jobname in ('flush-email', 'reconfirmation', 'reminders', 'housekeeping')), 4, 'all four jobs are scheduled');
select is((select schedule from cron.job where jobname = 'flush-email'), '* * * * *', 'the email flush runs every minute');
select is((select schedule from cron.job where jobname = 'reconfirmation'), '*/15 * * * *', 'reconfirmation runs every 15 minutes');
select is((select schedule from cron.job where jobname = 'reminders'), '*/30 * * * *', 'reminders run every 30 minutes');

select * from finish();
rollback;

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

-- ================================================================ the analytics queue and the funnel triggers (B8.2)
\set nu '00000000-0000-4000-8000-0000000004a1'

-- a future instant-approval event and a second one with another host
insert into public.events (host_id, type, title, area_id, category_id, starts_at, ends_at, capacity, approval_mode, status, published_at, pricing_mode)
  values (:'u2', 'community', 'Future one', 1, 1, now() + interval '6 days', now() + interval '6 days 2 hours', 20, 'host_approval', 'published', now(), 'free'),
         (:'u2', 'community', 'Future two', 1, 1, now() + interval '7 days', now() + interval '7 days 2 hours', 20, 'instant', 'published', now(), 'free'),
         (:'u4', 'community', 'Future three', 1, 1, now() + interval '8 days', now() + interval '8 days 2 hours', 20, 'instant', 'published', now(), 'free');
select id as f1 from public.events where title = 'Future one' \gset
select id as f2 from public.events where title = 'Future two' \gset
select id as f3 from public.events where title = 'Future three' \gset

-- ---------------------------------------------------------------- closed to everyone but the service role
select pg_temp.act_as(3);
select throws_ok($$select * from public.analytics_outbox$$, '42501', null, 'a member CANNOT read the queue');
select throws_ok($$insert into public.analytics_outbox (user_id, event, dedupe_key) values ('00000000-0000-4000-8000-000000000003', 'signed_up', 'x')$$, '42501', null, 'or write to it');
select throws_ok($$select * from public.claim_analytics_events(5)$$, '42501', null, 'or claim from it');
reset role; select pg_temp.act_as(1);
select throws_ok($$select * from public.analytics_outbox$$, '42501', null, 'not even an admin can read it');
select pg_temp.act_as_anon();
select throws_ok($$select * from public.analytics_outbox$$, '42501', null, 'anon CANNOT read it');
reset role;

-- ---------------------------------------------------------------- nothing is queued without consent
insert into public.bookings (event_id, user_id, status) values (:'f2', :'u3', 'approved');
select is((select count(*)::int from public.analytics_outbox), 0, 'someone who has not agreed produces no events at all');
delete from public.bookings where user_id = :'u3';

-- ---------------------------------------------------------------- with consent: each funnel step once
select pg_temp.act_as(3);
select public.record_consent(null, 'v1', true, true, true);
reset role;
select pg_temp.act_as(4);
select public.record_consent(null, 'v1', true, false, false); -- user 4 says no to analytics
reset role;
select is((select count(*)::int from public.analytics_outbox), 0, 'an existing member agreeing later reports no sign-up (they are already onboarded)');

insert into public.bookings (event_id, user_id, status) values (:'f2', :'u3', 'approved'); -- instant event: approved at once
select is((select count(*)::int from public.analytics_outbox where event = 'join_requested' and user_id = :'u3'), 1, 'a booking queues join_requested');
select is((select count(*)::int from public.analytics_outbox where event = 'request_approved' and user_id = :'u3' and (properties ->> 'instant')::boolean), 1, 'an instant approval also queues request_approved');
select is((select properties ->> 'event_type' from public.analytics_outbox where event = 'join_requested'), 'community', 'with the event type');
select is((select properties ->> 'category_id' from public.analytics_outbox where event = 'join_requested'), '1', 'and the category');
insert into public.bookings (event_id, user_id, status) values (:'f1', :'u3', 'requested');
update public.bookings set status = 'approved' where event_id = :'f1' and user_id = :'u3';
select is((select count(*)::int from public.analytics_outbox where event = 'request_approved' and user_id = :'u3' and not (properties ->> 'instant')::boolean), 1, 'a host approving queues request_approved (not instant)');
update public.bookings set status = 'confirmed' where event_id = :'f1' and user_id = :'u3';
select is((select count(*)::int from public.analytics_outbox where event = 'reconfirmed'), 1, 'confirming queues reconfirmed');
update public.bookings set status = 'confirmed' where event_id = :'f1' and user_id = :'u3';
select is((select count(*)::int from public.analytics_outbox where event = 'reconfirmed'), 1, 'and only once');
insert into public.bookings (event_id, user_id, status, waitlisted_at) values (:'f3', :'u3', 'waitlisted', now());
select is((select count(*)::int from public.analytics_outbox where event = 'join_requested' and user_id = :'u3'), 3, 'a waitlisted join is still a join');
select is((select count(*)::int from public.analytics_outbox where event = 'request_approved'), 2, 'but not an approval');

-- ---------------------------------------------------------------- rebooked: has attended before
select is((select count(*)::int from public.analytics_outbox where event = 'rebooked'), 0, 'no earlier attendance: not a rebooking');
select pg_temp.mk_done_event('Earlier event', array[:'u3']::uuid[]) as ee \gset
delete from public.analytics_outbox;
insert into public.bookings (event_id, user_id, status) values (:'f2', :'u3', 'approved') on conflict do nothing;
delete from public.bookings where user_id = :'u3' and event_id in (:'f1', :'f2', :'f3');
delete from public.analytics_outbox;
insert into public.bookings (event_id, user_id, status) values (:'f2', :'u3', 'approved');
select is((select count(*)::int from public.analytics_outbox where event = 'rebooked'), 1, 'someone who attended before and books again queues rebooked');
select is((select (properties ->> 'same_host')::boolean from public.analytics_outbox where event = 'rebooked'), true, 'with the same host');
insert into public.bookings (event_id, user_id, status) values (:'f3', :'u3', 'approved');
select is((select (properties ->> 'same_host')::boolean from public.analytics_outbox where event = 'rebooked' order by id desc limit 1), false, 'and not the same host for another host');

-- ---------------------------------------------------------------- check-in and feedback
delete from public.analytics_outbox;
select id as bk from public.bookings where event_id = :'ee' and user_id = :'u3' \gset
-- (the earlier event already has a check-in from the helper; that happened before consent was recorded? no: consent was recorded earlier)
select is((select count(*)::int from public.analytics_outbox where event = 'checked_in'), 0, 'the queue was just cleared');
select pg_temp.mk_done_event('Check-in event', array[:'u3', :'u5']::uuid[]) as ce \gset
select is((select count(*)::int from public.analytics_outbox where event = 'checked_in' and user_id = :'u3'), 1, 'a check-in queues checked_in for the guest');
select is((select properties ->> 'method' from public.analytics_outbox where event = 'checked_in' and user_id = :'u3'), 'manual', 'with the method');
select is((select count(*)::int from public.analytics_outbox where event = 'checked_in' and user_id = :'u5'), 0, 'and nothing for someone who has not agreed');

insert into public.tag_awards (event_id, from_user, to_user, tag_ids) values (:'ce', :'u3', :'u5', array[1]::smallint[]);
select is((select count(*)::int from public.analytics_outbox where event = 'feedback_given' and user_id = :'u3'), 1, 'giving tags queues feedback_given');
select is((select properties ->> 'kind' from public.analytics_outbox where event = 'feedback_given'), 'tags', 'with the kind');
insert into public.host_ratings (event_id, from_user, host_id, as_described, felt_safe, well_organised) values (:'ce', :'u3', :'u2', 5, 5, 5);
select is((select count(*)::int from public.analytics_outbox where event = 'feedback_given' and user_id = :'u3'), 1, 'a host rating at the same event adds nothing: one per person per event');
insert into public.private_feedback (event_id, from_user, about_user, issue_code) values (:'ce', :'u3', :'u5', 'other');
select is((select count(*)::int from public.analytics_outbox where event = 'feedback_given' and user_id = :'u3'), 1, 'and a private note never produces an event');

-- ---------------------------------------------------------------- sign-up and onboarding
select pg_temp.sign_up(:'nu', 'new.user@example.test');
select pg_temp.act_as_uid(:'nu');
select public.record_consent(null, 'v1', false, true, false);
reset role;
select is((select count(*)::int from public.analytics_outbox where event = 'signed_up' and user_id = :'nu'), 1, 'the first yes queues signed_up for someone still signing up');
select is((select occurred_at from public.analytics_outbox where event = 'signed_up' and user_id = :'nu'), (select created_at from auth.users where id = :'nu'), 'dated when the account was created');
select pg_temp.act_as_uid(:'nu');
select public.record_consent(null, 'v1', false, true, false);
reset role;
select is((select count(*)::int from public.analytics_outbox where event = 'signed_up' and user_id = :'nu'), 1, 'choosing again does not repeat it');
update public.profiles set onboarding_completed_at = now() where id = :'nu';
select is((select count(*)::int from public.analytics_outbox where event = 'profile_completed' and user_id = :'nu'), 1, 'finishing onboarding queues profile_completed');
update public.profiles set onboarding_completed_at = now() + interval '1 second' where id = :'nu';
select is((select count(*)::int from public.analytics_outbox where event = 'profile_completed' and user_id = :'nu'), 1, 'and only once');

-- ---------------------------------------------------------------- what can be in a payload
select is((select count(*)::int from public.analytics_outbox o, jsonb_object_keys(o.properties) k where k <> all (private.analytics_allowed_keys())), 0, 'every property of every queued event is on the allowed list');
select ok(not exists (select 1 from public.analytics_outbox where properties::text ~* '@|first_name|email|phone|address|note'), 'no email, name, phone, address or note anywhere');
select private.queue_analytics(:'u3', 'checked_in', jsonb_build_object('event_id', :'ce', 'email', 'a@b.test', 'first_name', 'Meera', 'note', 'secret'), 'strip-test');
select is((select properties from public.analytics_outbox where dedupe_key = 'strip-test'), jsonb_build_object('event_id', :'ce'), 'anything not on the list is dropped when queueing');
select private.queue_analytics(:'u3', 'checked_in', '{}', 'strip-test');
select is((select count(*)::int from public.analytics_outbox where dedupe_key = 'strip-test'), 1, 'and the same key is never queued twice');
select lives_ok(format('select private.queue_analytics(%L, %L, null, %L)', :'u3', 'not_an_event', 'bad-event'), 'a bad event name never raises: analytics cannot break what a person is doing');
select is((select count(*)::int from public.analytics_outbox where dedupe_key = 'bad-event'), 0, 'and queues nothing');

-- ---------------------------------------------------------------- the Worker claims, with consent checked again
insert into public.analytics_outbox (user_id, event, dedupe_key) values (:'u4', 'checked_in', 'no-consent-row'); -- queued while consent was on, then withdrawn
select pg_temp.act_as_service();
select ok((select count(*) from public.claim_analytics_events(50)) >= 3, 'the Worker claims queued events');
reset role;
select is((select status from public.analytics_outbox where dedupe_key = 'no-consent-row'), 'skipped', 'an event for someone who no longer allows analytics is skipped, not sent');
select is((select count(*)::int from public.analytics_outbox where status = 'sending' and attempts = 1), (select count(*)::int from public.analytics_outbox where status = 'sending'), 'claimed rows are marked as being sent');
select pg_temp.act_as_service();
select is((select count(*)::int from public.claim_analytics_events(50)), 0, 'a second claim finds nothing while they are being sent');
reset role;

-- results from the Worker
select id as one from public.analytics_outbox where status = 'sending' order by id limit 1 \gset
select id as two from public.analytics_outbox where status = 'sending' order by id offset 1 limit 1 \gset
select pg_temp.act_as_service();
select public.finish_analytics_events(jsonb_build_array(jsonb_build_object('id', :one, 'outcome', 'sent'), jsonb_build_object('id', :two, 'outcome', 'retry', 'error', 'boom')));
reset role;
select is((select status from public.analytics_outbox where id = :one), 'sent', 'sent');
select is((select status from public.analytics_outbox where id = :two), 'queued', 'a failed attempt goes back with a delay');
select ok((select send_after > now() from public.analytics_outbox where id = :two), 'a minute or more later');
update public.analytics_outbox set attempts = 4, status = 'sending' where id = :two;
select pg_temp.act_as_service();
select public.finish_analytics_events(jsonb_build_array(jsonb_build_object('id', :two, 'outcome', 'retry', 'error', 'still down')));
reset role;
select is((select status from public.analytics_outbox where id = :two), 'failed', 'after four tries it is given up');

-- ---------------------------------------------------------------- withdrawing deletes what is still waiting
insert into public.analytics_outbox (user_id, event, dedupe_key, status) values (:'u3', 'checked_in', 'waiting-1', 'queued'), (:'u3', 'checked_in', 'sent-1', 'sent');
select pg_temp.act_as(3);
select public.record_consent(null, 'v1', true, false, true);
reset role;
select is((select count(*)::int from public.analytics_outbox where user_id = :'u3' and status in ('queued', 'sending')), 0, 'withdrawing analytics deletes everything still waiting for that person');
select is((select count(*)::int from public.analytics_outbox where dedupe_key = 'sent-1'), 1, 'what was already sent stays (it is gone from our side of PostHog only on request)');
insert into public.bookings (event_id, user_id, status) values (:'f1', :'u3', 'requested');
select is((select count(*)::int from public.analytics_outbox where user_id = :'u3' and status = 'queued'), 0, 'and nothing new is queued while consent is off');

-- ---------------------------------------------------------------- housekeeping, cron, account deletion
update public.analytics_outbox set created_at = now() - interval '31 days' where dedupe_key = 'sent-1';
select private.job_housekeeping();
select is((select count(*)::int from public.analytics_outbox where dedupe_key = 'sent-1'), 0, 'sent rows are purged after 30 days');
select is((select count(*)::int from cron.job where jobname = 'flush-analytics'), 1, 'the flush job is scheduled');
select ok(exists (select 1 from private.job_schedule() where job = 'flush-analytics'), 'and has a line on the job-health page');
delete from public.analytics_outbox;
select private.cron_flush_analytics();
select is((select last_status from public.job_runs where job = 'flush-analytics'), 'ok', 'an empty queue records an ok run without calling the Worker');
insert into public.analytics_outbox (user_id, event, dedupe_key) values (:'u5', 'checked_in', 'cron-1');
select private.cron_flush_analytics();
select ok((select last_status in ('skipped', 'ok') from public.job_runs where job = 'flush-analytics'), 'with something queued it calls the Worker (skipped when the Vault secrets are not set)');
insert into public.analytics_outbox (user_id, event, dedupe_key) values (:'u3', 'checked_in', 'del-1');
select pg_temp.act_as(3);
select public.delete_my_account();
reset role;
select is((select count(*)::int from public.analytics_outbox where user_id = :'u3'), 0, 'deleting an account deletes its queued analytics');

select * from finish();
rollback;

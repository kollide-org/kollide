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

-- ================================================================ private feedback and tips (B6.2 + B6.6)
\set r1 '00000000-0000-4000-8000-0000000001a1'
\set r2 '00000000-0000-4000-8000-0000000001a2'
\set r3 '00000000-0000-4000-8000-0000000001a3'
\set r4 '00000000-0000-4000-8000-0000000001a4'
select pg_temp.sign_up(:'r1', 'r1@example.test'), pg_temp.sign_up(:'r2', 'r2@example.test'),
       pg_temp.sign_up(:'r3', 'r3@example.test'), pg_temp.sign_up(:'r4', 'r4@example.test');

-- The subject is user 5 (Noor). Each issue needs its own events: one note per person per event.
select pg_temp.mk_done_event('Disrespect 1', array[:'r1', :'r2', :'r3', :'u5']::uuid[]) as d1 \gset
select pg_temp.mk_done_event('Unsafe 1', array[:'r1', :'u5']::uuid[]) as s1 \gset
select pg_temp.mk_done_event('Unsafe 2', array[:'r3', :'u5']::uuid[]) as s2 \gset
select pg_temp.mk_done_event('Uncomfortable 1', array[:'r1', :'r2', :'u5']::uuid[]) as m1 \gset
select pg_temp.mk_done_event('Uncomfortable 2', array[:'r3', :'u5']::uuid[]) as m2 \gset
select pg_temp.mk_done_event('Other event', array[:'r4', :'u4']::uuid[]) as oe \gset

-- ---------------------------------------------------------------- submitting
select pg_temp.act_as_uid(:'r1');
select throws_ok(format('select public.submit_private_feedback(%L, %L, %L, %L)', :'d1', :'u5', 'rude', 'x'), 'P0001', 'invalid_issue', 'the issue must be from the list');
select throws_ok(format('select public.submit_private_feedback(%L, %L, %L, %L)', :'d1', :'u5', 'other', repeat('x', 501)), 'P0001', 'note_too_long', 'notes are short');
select throws_ok(format('select public.submit_private_feedback(%L, %L, %L, null)', :'oe', :'u4', 'other'), 'P0001', 'not_allowed', 'you CANNOT write about someone from an event you were not at');
select throws_ok(format('select public.submit_private_feedback(%L, %L, %L, null)', :'d1', :'r1', 'other'), 'P0001', 'not_allowed', 'you CANNOT write about yourself');
select lives_ok(format('select public.submit_private_feedback(%L, %L, %L, %L)', :'d1', :'u5', 'disrespectful', 'SECRET-NOTE-123'), 'a checked-in person can say something felt off');
select throws_ok(format('select public.submit_private_feedback(%L, %L, %L, null)', :'d1', :'u5', 'unsafe'), 'P0001', 'already_submitted', 'one note per person per event');
select is((select count(*)::int from public.private_feedback), 1, 'the author can read their own note');

-- ---------------------------------------------------------------- the subject can NEVER read it
reset role; select pg_temp.act_as(5);
select is((select count(*)::int from public.private_feedback), 0, 'the subject CANNOT read private feedback (table)');
select is((select count(*)::int from public.private_feedback where about_user = :'u5'), 0, 'not even when asking for rows about themselves');
select ok(position('SECRET-NOTE-123' in (select public.export_my_data()::text)) = 0, 'it is not in the subject''s data export');
select is((select public.export_my_data() -> 'private_feedback_written'), '[]'::jsonb, 'the export lists only notes the person wrote');
select throws_ok($$update public.private_feedback set note = 'x'$$, '42501', null, 'nobody can edit private feedback from the browser');
select throws_ok($$delete from public.private_feedback$$, '42501', null, 'nobody can delete private feedback from the browser');
reset role; select pg_temp.act_as_anon();
select throws_ok($$select count(*) from public.private_feedback$$, '42501', null, 'anon CANNOT read private feedback');
reset role; select pg_temp.act_as(1);
select is((select count(*)::int from public.private_feedback), 1, 'admins can read it');
reset role;
select is((select count(*)::int from public.audit_log where table_name = 'private_feedback' and new_data::text like '%SECRET-NOTE-123%'), 0, 'the note never enters the audit log');
select ok(exists (select 1 from public.audit_log where table_name = 'private_feedback' and action = 'INSERT'), 'but the fact that it was written does');

-- ---------------------------------------------------------------- the threshold rule: 3 people across 2 events
-- disrespectful: three people, ONE event -> no tip
select pg_temp.act_as_uid(:'r2');
select public.submit_private_feedback(:'d1', :'u5', 'disrespectful', null);
reset role; select pg_temp.act_as_uid(:'r3');
select public.submit_private_feedback(:'d1', :'u5', 'disrespectful', null);
-- unsafe: two people, two events -> no tip
reset role; select pg_temp.act_as_uid(:'r1');
select public.submit_private_feedback(:'s1', :'u5', 'unsafe', null);
reset role; select pg_temp.act_as_uid(:'r3');
select public.submit_private_feedback(:'s2', :'u5', 'unsafe', null);
-- made_uncomfortable: three people, two events -> a tip
reset role; select pg_temp.act_as_uid(:'r1');
select public.submit_private_feedback(:'m1', :'u5', 'made_uncomfortable', null);
reset role; select pg_temp.act_as_uid(:'r2');
select public.submit_private_feedback(:'m1', :'u5', 'made_uncomfortable', null);
reset role; select pg_temp.act_as_uid(:'r3');
select public.submit_private_feedback(:'m2', :'u5', 'made_uncomfortable', null);
reset role;

select is((select count(*)::int from private.tip_candidates() where issue = 'disrespectful'), 0, '3 people in only 1 event is not enough');
select is((select count(*)::int from private.tip_candidates() where issue = 'unsafe'), 0, '2 people in 2 events is not enough');
select is((select count(*)::int from private.tip_candidates() where issue = 'made_uncomfortable' and subject_id = :'u5'), 1, '3 people across 2 events is enough');
select is((select total_weight from private.tip_candidates() where issue = 'made_uncomfortable'), 3.00, 'three ordinary recent reviewers weigh 3.00');

-- weighting: a verified reviewer counts more
update public.profiles set is_verified = true where id = :'r1';
select is((select total_weight from private.tip_candidates() where issue = 'made_uncomfortable'), 3.25, 'a verified reviewer counts more');
update public.profiles set created_at = now() - interval '100 days' where id = :'r2';
select is((select total_weight from private.tip_candidates() where issue = 'made_uncomfortable'), 3.50, 'so does a long-standing one');

-- the nightly job creates the tip, once
select private.job_reputation_nightly();
select is((select count(*)::int from public.profile_tips where user_id = :'u5'), 1, 'the nightly job creates one tip');
select is((select issue_code from public.profile_tips where user_id = :'u5'), 'made_uncomfortable', 'for the issue that crossed the line');
select ok((select position('SECRET' in message) = 0 and position('Kabir' in message) = 0 from public.profile_tips where user_id = :'u5'), 'the wording is generic: no notes, no names');
select private.job_reputation_nightly();
select is((select count(*)::int from public.profile_tips where user_id = :'u5'), 1, 'running again does not repeat it');
select is((select count(*)::int from public.notifications where user_id = :'u5' and kind = 'tip'), 1, 'the subject is told once, gently');
select is((select last_status from public.job_runs where job = 'reputation-nightly'), 'ok', 'the job records itself');

-- who can see the tip
select pg_temp.act_as(5);
select is((select count(*)::int from public.profile_tips), 1, 'the subject can read their own tip');
select throws_ok($$update public.profile_tips set status = 'removed'$$, '42501', null, 'the subject CANNOT edit or remove their own tip');
reset role; select pg_temp.act_as_uid(:'r1');
select is((select count(*)::int from public.profile_tips), 0, 'a reviewer CANNOT see the tip they helped create');
reset role; select pg_temp.act_as(4);
select is((select count(*)::int from public.profile_tips), 0, 'a stranger CANNOT see it');
select pg_temp.act_as_anon();
select throws_ok($$select count(*) from public.profile_tips$$, '42501', null, 'anon CANNOT read tips');
reset role;

-- a tip fades when the evidence goes away
delete from public.private_feedback where event_id = :'m2';
select private.job_reputation_nightly();
select is((select status from public.profile_tips where user_id = :'u5'), 'expired', 'a tip expires when the evidence no longer meets the bar');

-- ---------------------------------------------------------------- the last 12 months count most
select pg_temp.mk_done_event('Old 1', array[:'r1', :'r2', :'u4']::uuid[]) as o1 \gset
select pg_temp.mk_done_event('Old 2', array[:'r3', :'u4']::uuid[]) as o2 \gset
insert into public.private_feedback (event_id, from_user, about_user, issue_code, created_at) values
  (:'o1', :'r1', :'u4', 'not_as_described', now() - interval '200 days'),
  (:'o1', :'r2', :'u4', 'not_as_described', now() - interval '200 days'),
  (:'o2', :'r3', :'u4', 'not_as_described', now() - interval '200 days');
-- the same shape of evidence (3 people, 2 events) that made a tip above, but 200 days old: 3 x 1.00 x 0.5 = 1.50 < 2.50
select is((select count(*)::int from private.tip_candidates() where issue = 'not_as_described'), 0, 'feedback older than 6 months counts half, so on its own it does not make a tip');
insert into public.private_feedback (event_id, from_user, about_user, issue_code, created_at) values
  (:'o1', :'r4', :'u4', 'harassment', now() - interval '400 days');
select is((select count(*)::int from private.tip_candidates() where issue = 'harassment'), 0, 'feedback older than 12 months is ignored');

-- ---------------------------------------------------------------- retaliation discount
-- harassment: three people across two events would normally make a tip... (first undo the bonuses used above)
update public.profiles set is_verified = false where id = :'r1';
update public.profiles set created_at = now() where id = :'r2';
select pg_temp.mk_done_event('Harass 1', array[:'r1', :'r2', :'u5']::uuid[]) as h1 \gset
select pg_temp.mk_done_event('Harass 2', array[:'r4', :'u5']::uuid[]) as h2 \gset
insert into public.private_feedback (event_id, from_user, about_user, issue_code) values
  (:'h1', :'r1', :'u5', 'harassment'), (:'h1', :'r2', :'u5', 'harassment'), (:'h2', :'r4', :'u5', 'harassment');
select is((select total_weight from private.tip_candidates() where issue = 'harassment' and subject_id = :'u5'), 3.00, 'without retaliation it would be a tip (3.00)');
-- ...but one of the three was reported by the subject first
insert into public.safety_reports (reporter_id, subject_type, subject_id, subject_user_id, reason) values (:'u5', 'user', :'r4', :'r4', 'harassment');
select is((select count(*)::int from private.tip_candidates() where issue = 'harassment' and subject_id = :'u5'), 0, 'feedback from someone the subject reported is discounted, so there is no tip');
select private.job_reputation_nightly();
select is((select count(*)::int from public.profile_tips where user_id = :'u5' and issue_code = 'harassment'), 0, 'the nightly job creates no tip');
select is((select count(*)::int from public.review_flags where kind = 'retaliation' and subject_user_id = :'u5'), 1, 'and flags the possible retaliation for admins');
-- only a REPORT counts: a private note is invisible and holds nobody, so filing notes must not be a free way to discount complaints
select pg_temp.mk_done_event('Mutual', array[:'r1', :'r2']::uuid[]) as mu \gset
insert into public.private_feedback (event_id, from_user, about_user, issue_code) values (:'mu', :'r1', :'r2', 'other'), (:'mu', :'r2', :'r1', 'other');
select ok(not private.is_retaliation(:'r1', :'r2', :'mu'), 'complaining about each other in private notes is NOT treated as retaliation');
select ok(not private.is_retaliation(:'r2', :'r1', :'mu'), 'in either direction');

-- ---------------------------------------------------------------- the appeal removes a tip, and it stays removed
update public.private_feedback set created_at = now() where issue_code = 'made_uncomfortable' and event_id = :'m1';
insert into public.private_feedback (event_id, from_user, about_user, issue_code) values (:'m2', :'r3', :'u5', 'made_uncomfortable');
select private.job_reputation_nightly();
select is((select count(*)::int from public.profile_tips where user_id = :'u5' and issue_code = 'made_uncomfortable' and status = 'active'), 1, 'a new tip appears when the evidence is back');
select id as tip from public.profile_tips where user_id = :'u5' and status = 'active' \gset
update public.profile_tips set status = 'removed' where id = :'tip';
select private.job_reputation_nightly();
select is((select count(*)::int from public.profile_tips where user_id = :'u5' and status = 'active'), 0, 'a removed tip does not come back without new feedback');

select * from finish();
rollback;

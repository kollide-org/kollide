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

-- ================================================================ B9: erasing an account (DPDP): coverage, seats and the export
create function pg_temp.rows_left(tbl text, col text, uid uuid) returns bigint language plpgsql as $$
declare c bigint;
begin
  execute format('select count(*) from public.%I where %I = %L', tbl, col, uid) into c;
  return c;
end $$;

-- ---------------------------------------------------------------- every column that points at a person has a decision
-- A NEW table or column that references profiles / auth.users makes this fail until it is put in one of the three lists.
create temp table fk_cols as
select c.conrelid::regclass::text || '.' || a.attname as col
  from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
 where c.contype = 'f' and c.confrelid in ('public.profiles'::regclass, 'auth.users'::regclass) and c.connamespace = 'public'::regnamespace;

-- rows about the person are deleted
create temp table cleaned(col text);
insert into cleaned values ('analytics_outbox.user_id'), ('appeals.user_id'), ('checkins.user_id'), ('connections.from_user'), ('connections.to_user'),
  ('email_outbox.user_id'), ('host_applications.user_id'), ('host_ratings.from_user'), ('host_ratings.host_id'), ('notifications.user_id'),
  ('private_feedback.about_user'), ('profile_interests.user_id'), ('profile_languages.user_id'), ('profile_photos.user_id'), ('profile_private.id'),
  ('profile_tips.user_id'), ('tag_awards.from_user'), ('tag_awards.to_user'), ('upload_keys.user_id'), ('user_blocks.blocker_id'), ('user_blocks.blocked_id'),
  ('user_roles.user_id'), ('verifications.user_id');
-- what the person wrote about others, or did for the team, stays but loses their name
create temp table anonymised(col text);
insert into anonymised values ('private_feedback.from_user'), ('safety_reports.reporter_id'), ('checkins.checked_in_by');
-- kept on purpose, with the reason
create temp table kept(col text, why text);
insert into kept values
  ('banned_identities.user_id', 'hashes only: a ban must survive erasing the account'),
  ('bookings.user_id', 'attendance rows without a name (upcoming ones are cancelled)'),
  ('consents.user_id', 'proof that consent was given or refused'),
  ('moderation_actions.user_id', 'the team''s append-only record'),
  ('review_flags.subject_user_id', 'safety record'),
  ('safety_reports.subject_user_id', 'reports about the person stay for the safety team'),
  ('profiles.id', 'the anonymised tombstone ("Former member")'),
  ('events.host_id', 'past events keep their record (upcoming ones are cancelled)'),
  ('squad_members.user_id', 'past squads (upcoming memberships are ended)'),
  ('squads.creator_id', 'past squads (upcoming ones are cancelled)'),
  ('app_config.updated_by', 'admin actor'), ('appeals.resolved_by', 'admin actor'), ('bookings.decided_by', 'the host who decided'),
  ('events.reviewed_by', 'admin actor'), ('featured_slots.created_by', 'admin actor'), ('host_applications.reviewed_by', 'admin actor'),
  ('moderation_actions.admin_id', 'admin actor'), ('review_flags.resolved_by', 'admin actor'), ('safety_reports.resolved_by', 'admin actor'),
  ('safety_reports.reviewed_by', 'admin actor'), ('user_roles.granted_by', 'admin actor'), ('verifications.reviewer_id', 'admin actor');

select is((select coalesce(array_agg(col order by col), '{}') from fk_cols where col not in (select col from cleaned union select col from anonymised union select col from kept)),
  '{}'::text[], 'every column that references a person is covered below (or the new one needs a decision)');
select is((select coalesce(array_agg(col order by col), '{}') from (select col from cleaned union select col from anonymised union select col from kept) x where col not in (select col from fk_cols)),
  '{}'::text[], 'and the lists contain nothing that no longer exists');

-- ---------------------------------------------------------------- one person with data everywhere, and seats to give back
select pg_temp.mk_done_event('Erase 1', array[:'u3', :'u4']::uuid[]) as e1 \gset
select id as ck from public.checkins where event_id = :'e1' and user_id = :'u3' \gset
insert into public.tag_awards (event_id, from_user, to_user, tag_ids) values (:'e1', :'u3', :'u4', array[1]::smallint[]), (:'e1', :'u4', :'u3', array[1]::smallint[]);
insert into public.connections (event_id, from_user, to_user) values (:'e1', :'u3', :'u4'), (:'e1', :'u4', :'u3');
insert into public.host_ratings (event_id, from_user, host_id, as_described, felt_safe, well_organised) values (:'e1', :'u3', :'u2', 5, 5, 5);
insert into public.private_feedback (event_id, from_user, about_user, issue_code, note) values (:'e1', :'u3', :'u4', 'other', 'written by the leaver'), (:'e1', :'u4', :'u3', 'other', 'about the leaver');
insert into public.safety_reports (reporter_id, subject_type, subject_id, subject_user_id, reason) values (:'u3', 'user', :'u4', :'u4', 'other'), (:'u4', 'user', :'u3', :'u3', 'other');
insert into public.profile_tips (user_id, issue_code, message) values (:'u3', 'other', 'tip');
insert into public.appeals (user_id, kind, message) values (:'u3', 'account_status', 'please');
insert into public.host_applications (user_id, message) values (:'u3', 'host me');
insert into public.verifications (user_id) values (:'u3');
insert into public.user_blocks (blocker_id, blocked_id) values (:'u3', :'u5');
insert into public.email_outbox (user_id, template, data) values (:'u3', 'request_received', '{}');
-- upcoming seats: a full event, the leaver holds one; a waitlisted person is next
insert into public.events (host_id, type, title, area_id, starts_at, ends_at, capacity, approval_mode, status, published_at, pricing_mode)
  values (:'u2', 'community', 'Full event', 1, now() + interval '5 days', now() + interval '5 days 2 hours', 2, 'instant', 'published', now(), 'free');
select id as fe from public.events where title = 'Full event' \gset
insert into public.bookings (event_id, user_id, status) values (:'fe', :'u3', 'approved'), (:'fe', :'u5', 'approved');
insert into public.bookings (event_id, user_id, status, waitlisted_at) values (:'fe', :'u4', 'waitlisted', now());
insert into public.squads (event_id, creator_id, meeting_point) values (:'fe', :'u3', 'Gate 2');
select id as sq from public.squads where creator_id = :'u3' \gset
insert into public.squad_members (squad_id, user_id, event_id, status) values (:'sq', :'u3', :'fe', 'approved');

-- ---------------------------------------------------------------- the export has exactly these sections
select pg_temp.act_as(3);
select is((select string_agg(k, ', ' order by k) from jsonb_object_keys(public.export_my_data()) k),
  'appeals, blocks, bookings, checkins, consents, exported_at, host_applications, host_ratings_given, interests, languages, meet_again_taps, moderation_notices, notes_about_me, notifications, photos, private, private_feedback_written, profile, reports_filed, roles, tags_given, verifications',
  'the export has exactly these sections (a new one needs a decision here)');
select ok(not (public.export_my_data()::text like '%about the leaver%'), 'and never private feedback ABOUT the person');
select is((select jsonb_array_length(public.export_my_data() -> 'bookings')), 2, 'their bookings are in it');

-- ---------------------------------------------------------------- erase
select lives_ok($$select public.delete_my_account()$$, 'the person erases their account');
reset role;
select is((select count(*)::int from cleaned where pg_temp.rows_left(split_part(col, '.', 1), split_part(col, '.', 2), :'u3') > 0), 0, 'no row about the person is left in any "deleted" table');
select is((select count(*)::int from anonymised where pg_temp.rows_left(split_part(col, '.', 1), split_part(col, '.', 2), :'u3') > 0), 0, 'and nothing they wrote carries their name');
select is((select count(*)::int from public.private_feedback where note = 'written by the leaver'), 1, 'what they wrote about someone else is kept (the safety record), anonymously');
select is((select count(*)::int from public.safety_reports where subject_user_id = :'u3'), 1, 'a report about them stays for the safety team');
select is((select first_name from public.profiles where id = :'u3'), 'Former member', 'the profile is anonymised');
select is((select (banned_until is not null) from auth.users where id = :'u3'), true, 'sign-in is blocked');

-- ---------------------------------------------------------------- their upcoming seats are given back
select is((select status::text from public.bookings where event_id = :'fe' and user_id = :'u3'), 'cancelled', 'their upcoming seat is released');
select is((select cancel_reason from public.bookings where event_id = :'fe' and user_id = :'u3'), 'account_deleted', 'with the reason');
select is((select status::text from public.bookings where event_id = :'fe' and user_id = :'u4'), 'approved', 'the waitlist moves up');
select is((select status::text from public.bookings where event_id = :'fe' and user_id = :'u5'), 'approved', 'and other guests are not touched');
select is((select status from public.squads where id = :'sq'), 'cancelled', 'a squad they started ends');
select is((select count(*)::int from public.notifications where user_id = :'u2' and kind = 'booking_cancelled'), 1, 'the host is told a seat was given back');
select is((select status::text from public.bookings where event_id = :'e1' and user_id = :'u3'), 'attended', 'past attendance stays, without a name');

select * from finish();
rollback;

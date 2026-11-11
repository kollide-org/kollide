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
-- Records a key as if the Worker had issued it (run as the table owner, before switching roles).
create function pg_temp.issue(uid uuid, purpose text, age interval default '0') returns text language plpgsql as $$
declare k text := case purpose when 'profile_photo' then 'profiles/' when 'selfie' then 'selfies/' when 'event_cover' then 'events/' else 'hubs/' end
  || gen_random_uuid() || '.webp';
begin
  insert into public.upload_keys (key, user_id, purpose, size_limit, created_at) values (k, uid, purpose, 307200, now() - age);
  return k;
end $$;

-- A real event for the cover tests (events exist since B4). User 2 is its host; user 4 is another host.
insert into public.events (id, host_id, type, title, area_id, starts_at, ends_at, capacity)
values ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-000000000002', 'community', 'Test event', 1,
        now() + interval '3 days', now() + interval '3 days 2 hours', 10);
insert into public.user_roles (user_id, role) values ('00000000-0000-4000-8000-000000000004', 'host');

-- ===================================================== authorize_upload (service role only)
select pg_temp.act_as_anon();
select throws_ok($$select public.authorize_upload('00000000-0000-4000-8000-000000000003', 'profile_photo', null, 'image/webp', 1000)$$, '42501',
  null, 'a stranger CANNOT call authorize_upload');
reset role; select pg_temp.act_as(3);
select throws_ok($$select public.authorize_upload('00000000-0000-4000-8000-000000000003', 'profile_photo', null, 'image/webp', 1000)$$, '42501',
  null, 'a member CANNOT call authorize_upload (only the Worker can)');
select throws_ok($$select * from public.upload_keys$$, '42501', null, 'a member CANNOT read upload_keys');
select throws_ok($$select * from public.storage_deletions$$, '42501', null, 'a member CANNOT read storage_deletions');
select throws_ok($$insert into public.upload_keys (key, user_id, purpose, size_limit) values ('profiles/44444444-4444-4444-8444-444444444444.webp', '00000000-0000-4000-8000-000000000003', 'profile_photo', 1)$$,
  '42501', null, 'a member CANNOT forge an upload key');

reset role; select pg_temp.act_as_service();
select throws_ok($$select public.authorize_upload('00000000-0000-4000-8000-000000000003', 'profile_photo', null, 'image/png', 1000)$$, 'P0001', 'invalid_type', 'a PNG is refused');
select throws_ok($$select public.authorize_upload('00000000-0000-4000-8000-000000000003', 'profile_photo', null, null, 1000)$$, 'P0001', 'invalid_type', 'a missing type is refused');
select throws_ok($$select public.authorize_upload('00000000-0000-4000-8000-000000000003', 'avatar', null, 'image/webp', 1000)$$, 'P0001', 'invalid_purpose', 'an unknown purpose is refused');
select throws_ok($$select public.authorize_upload('00000000-0000-4000-8000-000000000003', 'profile_photo', null, 'image/webp', 307201)$$, 'P0001', 'too_large', 'a photo over 300 KB is refused');
select throws_ok($$select public.authorize_upload('00000000-0000-4000-8000-000000000003', 'profile_photo', null, 'image/webp', 0)$$, 'P0001', 'too_large', 'an empty file is refused');
select throws_ok($$select public.authorize_upload('00000000-0000-4000-8000-000000000003', 'selfie', null, 'image/webp', 512001)$$, 'P0001', 'too_large', 'a selfie over 500 KB is refused');
select throws_ok($$select public.authorize_upload('00000000-0000-4000-8000-0000000000ff', 'profile_photo', null, 'image/webp', 1000)$$, 'P0001', 'not_active', 'an unknown user is refused');

select ok(public.authorize_upload('00000000-0000-4000-8000-000000000003', 'profile_photo', null, 'image/webp', 1000) like 'profiles/%.webp', 'a profile photo key starts with profiles/');
reset role;
select is((select size_limit from public.upload_keys where user_id = '00000000-0000-4000-8000-000000000003' and purpose = 'profile_photo'), 307200, 'the issued key records its size cap');
select pg_temp.act_as_service();
select lives_ok($$select public.authorize_upload('00000000-0000-4000-8000-000000000003', 'profile_photo', null, 'image/webp', 1000) from generate_series(1, 8)$$, 'nine pending photo keys an hour are allowed');
select throws_ok($$select public.authorize_upload('00000000-0000-4000-8000-000000000003', 'profile_photo', null, 'image/webp', 1000)$$, 'P0001', 'too_many_uploads', 'the tenth is refused');

select throws_ok($$select public.authorize_upload('00000000-0000-4000-8000-000000000003', 'event_cover', '00000000-0000-4000-8000-0000000000e1', 'image/webp', 1000)$$, 'P0001', 'not_allowed', 'a member CANNOT get an event cover key');
select throws_ok($$select public.authorize_upload('00000000-0000-4000-8000-000000000002', 'event_cover', null, 'image/webp', 1000)$$, 'P0001', 'event_required', 'a host must name the event');
select ok(public.authorize_upload('00000000-0000-4000-8000-000000000002', 'event_cover', '00000000-0000-4000-8000-0000000000e1', 'image/webp', 1000) like 'events/%.webp', 'a host CAN get an event cover key');
select ok(public.authorize_upload('00000000-0000-4000-8000-000000000001', 'event_cover', '00000000-0000-4000-8000-0000000000e1', 'image/webp', 1000) like 'events/%.webp', 'an admin CAN get an event cover key');
select throws_ok($$select public.authorize_upload('00000000-0000-4000-8000-000000000004', 'event_cover', '00000000-0000-4000-8000-0000000000e1', 'image/webp', 1000)$$, 'P0001', 'not_allowed', 'a host CANNOT get a cover key for someone else''s event');
select throws_ok($$select public.authorize_upload('00000000-0000-4000-8000-000000000002', 'event_cover', '00000000-0000-4000-8000-0000000000ff', 'image/webp', 1000)$$, 'P0001', 'not_allowed', 'nor for an event that does not exist');
select throws_ok($$select public.authorize_upload('00000000-0000-4000-8000-000000000003', 'hub_art', null, 'image/webp', 1000)$$, 'P0001', 'not_allowed', 'a member CANNOT get a hub art key');
select throws_ok($$select public.authorize_upload('00000000-0000-4000-8000-000000000002', 'hub_art', null, 'image/webp', 1000)$$, 'P0001', 'not_allowed', 'a host CANNOT get a hub art key');
select ok(public.authorize_upload('00000000-0000-4000-8000-000000000001', 'hub_art', null, 'image/webp', 1000) like 'hubs/%.webp', 'an admin CAN get a hub art key');

select ok(public.authorize_upload('00000000-0000-4000-8000-000000000005', 'selfie', null, 'image/webp', 1000) like 'selfies/%.webp', 'a member CAN get a selfie key');
reset role;
update public.profile_private set status = 'on_hold' where id = '00000000-0000-4000-8000-000000000004';
select pg_temp.act_as_service();
select throws_ok($$select public.authorize_upload('00000000-0000-4000-8000-000000000004', 'profile_photo', null, 'image/webp', 1000)$$, 'P0001', 'not_active', 'an on-hold member CANNOT upload');
reset role;
update public.profile_private set status = 'active' where id = '00000000-0000-4000-8000-000000000004';

-- ===================================================== attaching profile photos
select pg_temp.issue('00000000-0000-4000-8000-000000000003', 'profile_photo') as k1 \gset
select pg_temp.issue('00000000-0000-4000-8000-000000000004', 'profile_photo') as k4 \gset
select pg_temp.issue('00000000-0000-4000-8000-000000000003', 'selfie') as ks \gset
select pg_temp.issue('00000000-0000-4000-8000-000000000003', 'profile_photo', interval '25 hours') as kold \gset
select pg_temp.issue('00000000-0000-4000-8000-000000000003', 'profile_photo') as k2 \gset
select pg_temp.issue('00000000-0000-4000-8000-000000000003', 'profile_photo') as k3 \gset

select pg_temp.act_as_anon();
select throws_ok(format('select public.set_profile_photo(1::smallint, %L)', :'k1'), '42501', null, 'a stranger CANNOT attach a photo');

reset role; select pg_temp.act_as(3);
select throws_ok(format('select public.set_profile_photo(1::smallint, %L)', :'k4'), 'P0001', 'invalid_key', 'a member CANNOT attach a key issued to someone else');
select throws_ok(format('select public.set_profile_photo(1::smallint, %L)', :'ks'), 'P0001', 'invalid_key', 'a selfie key CANNOT be used as a photo');
select throws_ok(format('select public.set_profile_photo(1::smallint, %L)', :'kold'), 'P0001', 'invalid_key', 'a key older than 24 hours is refused');
select throws_ok($$select public.set_profile_photo(1::smallint, 'profiles/99999999-9999-4999-8999-999999999999.webp')$$, 'P0001', 'invalid_key', 'a key that was never issued is refused');
select throws_ok($$select public.set_profile_photo(1::smallint, 'placeholder/11111111-1111-4111-8111-111111111111.webp')$$, 'P0001', 'invalid_key', 'a placeholder key is refused');
select throws_ok(format('select public.set_profile_photo(0::smallint, %L)', :'k1'), 'P0001', 'invalid_position', 'position 0 is refused');
select throws_ok(format('select public.set_profile_photo(4::smallint, %L)', :'k1'), 'P0001', 'invalid_position', 'position 4 is refused (three photos at most)');
select lives_ok(format('select public.set_profile_photo(1::smallint, %L)', :'k1'), 'a member CAN attach their own issued key');
select throws_ok(format('select public.set_profile_photo(2::smallint, %L)', :'k1'), 'P0001', 'invalid_key', 'a key CANNOT be used twice');
select is((select r2_key from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000003' and position = 1), :'k1', 'the new key is stored at position 1');
reset role;
select is((select count(*)::int from public.storage_deletions where bucket = 'media' and key like 'seed/%' and done_at is null), 1,
  'the replaced photo is queued for deletion');
select pg_temp.act_as(3);
select lives_ok(format('select public.set_profile_photo(2::smallint, %L)', :'k2'), 'a second photo can be added');
select lives_ok(format('select public.set_profile_photo(3::smallint, %L)', :'k3'), 'a third photo can be added');
select is((select count(*)::int from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000003'), 3, 'three photos at most');

-- remove
select throws_ok($$select public.remove_profile_photo(5::smallint)$$, 'P0001', 'photo_not_found', 'removing a missing photo is refused');
select lives_ok($$select public.remove_profile_photo(3::smallint)$$, 'a member CAN remove a photo');
select lives_ok($$select public.remove_profile_photo(2::smallint)$$, 'and another');
select throws_ok($$select public.remove_profile_photo(1::smallint)$$, 'P0001', 'min_photos', 'but the last photo must stay');
reset role;
select is((select count(*)::int from public.storage_deletions where bucket = 'media' and key = :'k3'), 1, 'a removed photo is queued for deletion');
select pg_temp.act_as(4);
select throws_ok($$delete from public.profile_photos$$, '42501', null, 'photos CANNOT be deleted directly');

-- ===================================================== selfies and review
reset role;
update public.profiles set is_verified = false where id in ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000005');
select pg_temp.act_as(3);
select throws_ok(format('select public.submit_selfie(%L)', :'k1'), 'P0001', 'invalid_key', 'a photo key CANNOT be used as a selfie');
select lives_ok(format('select public.submit_selfie(%L)', :'ks'), 'a member CAN submit a selfie');
select is((select count(*)::int from public.verifications where user_id = '00000000-0000-4000-8000-000000000003' and result = 'pending'), 1, 'it is pending');
reset role;
select pg_temp.issue('00000000-0000-4000-8000-000000000003', 'selfie') as ks2 \gset
select pg_temp.act_as(3);
select throws_ok(format('select public.submit_selfie(%L)', :'ks2'), 'P0001', 'verification_pending', 'a second selfie while one is pending is refused');
select throws_ok($$select public.review_verification((select id from public.verifications limit 1), true)$$, 'P0001', 'not_allowed', 'a member CANNOT review');
select throws_ok($$select * from public.admin_list_pending_verifications()$$, 'P0001', 'not_allowed', 'a member CANNOT list pending verifications');

reset role; select pg_temp.act_as_anon();
select throws_ok($$select * from public.admin_list_pending_verifications()$$, '42501', null, 'a stranger CANNOT list pending verifications');

reset role; select pg_temp.act_as(2);
select throws_ok($$select * from public.admin_list_pending_verifications()$$, 'P0001', 'not_allowed', 'a host CANNOT list pending verifications');

reset role; select pg_temp.act_as(1);
select is((select count(*)::int from public.admin_list_pending_verifications()), 1, 'an admin CAN list pending verifications');
select lives_ok($$select public.review_verification((select id from public.verifications where user_id = '00000000-0000-4000-8000-000000000003'), true)$$, 'an admin CAN approve');
select throws_ok($$select public.review_verification((select id from public.verifications where user_id = '00000000-0000-4000-8000-000000000003'), false)$$, 'P0001', 'already_reviewed', 'a second review is refused');
select throws_ok($$select public.review_verification('00000000-0000-4000-8000-0000000000dd', true)$$, 'P0001', 'not_found', 'an unknown verification is refused');
reset role;
select is((select result from public.verifications where user_id = '00000000-0000-4000-8000-000000000003'), 'approved'::public.review_status, 'the result is approved');
select is((select selfie_key from public.verifications where user_id = '00000000-0000-4000-8000-000000000003'), null, 'the selfie key is cleared');
select is((select is_verified from public.profiles where id = '00000000-0000-4000-8000-000000000003'), true, 'approval sets is_verified');
select is((select count(*)::int from public.storage_deletions where bucket = 'private' and key = :'ks'), 1, 'the selfie is queued for deletion');
select is((select count(*)::int from public.audit_log where table_name = 'verifications' and new_data::text like '%selfies/%'), 0, 'the selfie key never enters the audit log');

-- rejection does not verify
select pg_temp.issue('00000000-0000-4000-8000-000000000005', 'selfie') as ks5 \gset
select pg_temp.act_as(5);
select lives_ok(format('select public.submit_selfie(%L)', :'ks5'), 'another member submits a selfie');
reset role; select pg_temp.act_as(1);
select lives_ok($$select public.review_verification((select id from public.verifications where user_id = '00000000-0000-4000-8000-000000000005'), false)$$, 'an admin CAN reject');
reset role;
select is((select is_verified from public.profiles where id = '00000000-0000-4000-8000-000000000005'), false, 'rejection does not verify the person');
select is((select result from public.verifications where user_id = '00000000-0000-4000-8000-000000000005'), 'rejected'::public.review_status, 'the result is rejected');

-- nobody reviews their own selfie
select pg_temp.issue('00000000-0000-4000-8000-000000000001', 'selfie') as ka \gset
select pg_temp.act_as(1);
select lives_ok(format('select public.submit_selfie(%L)', :'ka'), 'an admin can submit their own selfie');
select throws_ok($$select public.review_verification((select id from public.verifications where user_id = '00000000-0000-4000-8000-000000000001'), true)$$, 'P0001', 'not_allowed', 'but CANNOT review it');

-- ===================================================== cleanup helpers (service role only)
reset role; select pg_temp.act_as(3);
select throws_ok($$select public.unreferenced_keys('media', array['x'])$$, '42501', null, 'a member CANNOT call unreferenced_keys');
select throws_ok($$select * from public.claim_deletions(10)$$, '42501', null, 'a member CANNOT claim deletions');
select throws_ok($$select public.purge_old_upload_keys()$$, '42501', null, 'a member CANNOT purge');

reset role; select pg_temp.act_as_service();
select is(public.unreferenced_keys('media', array[(select r2_key from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000004'), 'profiles/99999999-9999-4999-8999-999999999999.webp']),
  array['profiles/99999999-9999-4999-8999-999999999999.webp'], 'only unreferenced media keys are returned');
select is(public.unreferenced_keys('private', array['selfies/99999999-9999-4999-8999-999999999999.webp']), array['selfies/99999999-9999-4999-8999-999999999999.webp'],
  'an unreferenced selfie is returned');
select throws_ok($$select public.unreferenced_keys('other', array['x'])$$, 'P0001', 'invalid_bucket', 'an unknown bucket is refused');
select ok((select count(*) from public.claim_deletions(100)) >= 3, 'queued deletions can be claimed');
select lives_ok($$select public.mark_deletions_done((select array_agg(id) from public.claim_deletions(100)))$$, 'and marked done');
select is((select count(*)::int from public.claim_deletions(100)), 0, 'a done deletion is not claimed again');
reset role;
select pg_temp.issue('00000000-0000-4000-8000-000000000003', 'profile_photo', interval '8 days');
select pg_temp.act_as_service();
select ok(public.purge_old_upload_keys() >= 1, 'old upload keys are purged');

-- ===================================================== onboarding needs issued keys
reset role;
select pg_temp.sign_up('00000000-0000-4000-8000-0000000000b1', 'noor2@kollide.test');
select pg_temp.act_as_uid('00000000-0000-4000-8000-0000000000b1');
select throws_ok($$select pg_temp.onboard(photos := array['placeholder/11111111-1111-4111-8111-111111111111.webp',
  'placeholder/22222222-2222-4222-8222-222222222222.webp', 'placeholder/33333333-3333-4333-8333-333333333333.webp'])$$,
  'P0001', 'photos_required', 'onboarding refuses placeholder photo keys');
select throws_ok($$select pg_temp.onboard(photos := array['profiles/11111111-1111-4111-8111-111111111111.webp',
  'profiles/22222222-2222-4222-8222-222222222222.webp', 'profiles/33333333-3333-4333-8333-333333333333.webp'])$$,
  'P0001', 'photos_required', 'onboarding refuses keys that were never issued');

-- ===================================================== deleting an account queues its images
reset role;
select pg_temp.issue('00000000-0000-4000-8000-000000000004', 'selfie') as ks4 \gset
select pg_temp.act_as(4);
select lives_ok(format('select public.submit_selfie(%L)', :'ks4'), 'setup: another member has a pending selfie');
select lives_ok($$select public.delete_my_account()$$, 'that member deletes their account');
reset role;
select is((select count(*)::int from public.storage_deletions where bucket = 'private' and key = :'ks4'), 1, 'their selfie is queued for deletion');
select ok((select count(*) from public.storage_deletions where bucket = 'media' and key like 'seed/%' and key like '%0004%') >= 0, 'their photos are queued for deletion');
select is((select count(*)::int from public.upload_keys where user_id = '00000000-0000-4000-8000-000000000004'), 0, 'their upload keys are gone');

select * from finish();
rollback;

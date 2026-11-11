-- DEMO DATA: local and staging only. NEVER run against production.
-- Staging: `npx supabase db push --include-seed`. Idempotent.
-- Demo users have no password: sign in with the 6-digit email code (local emails appear in Mailpit).
-- Reference data (areas, interests, tags, categories) is in a migration, not here.

do $$
declare
  nil_instance constant uuid := '00000000-0000-0000-0000-000000000000';
  demo record;
  interest_slugs text[];
begin
  for demo in
    select * from (values
      ('00000000-0000-4000-8000-000000000001'::uuid, 'asha.admin@kollide.test',   'Asha',   'Rao',     '+910000000001', date '1992-03-14', 'woman'::public.gender,      'indiranagar',    'Admin for demos. Loves board games.',  array['board-games','coffee','books']),
      ('00000000-0000-4000-8000-000000000002'::uuid, 'dev.host@kollide.test',     'Dev',    'Nair',    '+910000000002', date '1989-07-02', 'man'::public.gender,        'koramangala',    'Hosts hikes and quiet dinners.',       array['hiking','cooking','photography']),
      ('00000000-0000-4000-8000-000000000003'::uuid, 'meera.member@kollide.test', 'Meera',  'Iyer',    '+910000000003', date '1996-11-21', 'woman'::public.gender,      'hsr-layout',     'New to Bengaluru, here for the food.', array['street-food','dance','yoga']),
      ('00000000-0000-4000-8000-000000000004'::uuid, 'kabir.member@kollide.test', 'Kabir',  'Shetty',  '+910000000004', date '1994-01-30', 'man'::public.gender,        'jayanagar',      'Runner, trivia regular.',              array['running','trivia','football']),
      ('00000000-0000-4000-8000-000000000005'::uuid, 'noor.member@kollide.test',  'Noor',   'Khan',    '+910000000005', date '1998-05-09', 'non_binary'::public.gender, 'malleshwaram',   'Pottery and stand-up nights.',         array['pottery','stand-up-comedy','film'])
    ) as v(id, email, first_name, last_name, phone, dob, gender, area_slug, bio, interests)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      nil_instance, demo.id, 'authenticated', 'authenticated', demo.email, now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
    ) on conflict (id) do nothing;

    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), demo.id, demo.id::text, 'email',
      jsonb_build_object('sub', demo.id::text, 'email', demo.email, 'email_verified', true),
      now(), now(), now()
    ) on conflict (provider_id, provider) do nothing;

    insert into public.profiles (id, first_name, area_id, bio_prompts, is_verified, onboarding_completed_at)
    values (
      demo.id, demo.first_name, (select id from public.areas where slug = demo.area_slug),
      jsonb_build_array(jsonb_build_object('prompt', 'A perfect Saturday', 'answer', demo.bio)),
      true, now()
    ) on conflict (id) do nothing;

    insert into public.profile_private (id, last_name, phone, date_of_birth, email, gender)
    values (demo.id, demo.last_name, demo.phone, demo.dob, demo.email, demo.gender)
    on conflict (id) do nothing;

    insert into public.profile_photos (user_id, r2_key, position)
    values (demo.id, 'seed/' || demo.id || '.webp', 1)
    on conflict do nothing;

    insert into public.profile_interests (user_id, interest_id)
      select demo.id, i.id from public.interests i where i.slug = any (demo.interests)
    on conflict do nothing;

    insert into public.profile_languages (user_id, language_id)
      select demo.id, l.id from public.languages l where l.slug in ('english', 'kannada')
    on conflict do nothing;
  end loop;

  insert into public.user_roles (user_id, role) values
    ('00000000-0000-4000-8000-000000000001', 'admin'),
    ('00000000-0000-4000-8000-000000000002', 'host')
  on conflict do nothing;
end
$$;

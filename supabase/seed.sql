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
    ) on conflict (id) do update set
      first_name = excluded.first_name, area_id = excluded.area_id, bio_prompts = excluded.bio_prompts,
      is_verified = excluded.is_verified, onboarding_completed_at = excluded.onboarding_completed_at;

    insert into public.profile_private (id, last_name, phone, date_of_birth, email, gender)
    values (demo.id, demo.last_name, demo.phone, demo.dob, demo.email, demo.gender)
    on conflict (id) do update set
      last_name = excluded.last_name, phone = excluded.phone, date_of_birth = excluded.date_of_birth,
      email = excluded.email, gender = excluded.gender;

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

-- =====================================================================================================
-- Demo events (B4). Dates are relative to the day you seed, so staging always has upcoming events.
-- Re-seed to refresh them. Partner links point to example.com. All events are free, pay at venue or
-- cost split: no money moves through Kollide.
-- =====================================================================================================
create function pg_temp.seed_event(
  p_host uuid, p_type public.event_type, p_title text, p_desc text, p_cat text, p_area text,
  p_start timestamptz, p_hours numeric, p_capacity integer, p_pricing public.pricing_mode, p_label text,
  p_women boolean, p_house boolean, p_rules text, p_address text, p_note text, p_partner text, p_ref text
) returns uuid language plpgsql as $$
declare
  v_id uuid;
begin
  insert into public.events (host_id, type, title, description, category_id, area_id, starts_at, ends_at, capacity,
      overbook_pct, approval_mode, women_only, house_party, house_rules, pricing_mode, price_label,
      status, published_at, reviewed_by, reviewed_at, partner_url, referral_code)
  values (p_host, p_type, p_title, p_desc, (select id from public.categories where slug = p_cat),
      (select id from public.areas where slug = p_area), p_start, p_start + make_interval(secs => (p_hours * 3600)::int),
      p_capacity, case when p_pricing = 'free' and p_type <> 'partner' then 30 else 0 end,
      case when p_house or p_women then 'host_approval'::public.approval_mode else 'instant'::public.approval_mode end,
      p_women, p_house, p_rules, p_pricing, p_label, 'published', now(),
      '00000000-0000-4000-8000-000000000001', now(), p_partner, p_ref)
  returning id into v_id;
  if p_address is not null then
    insert into public.event_private (event_id, address, directions_note) values (v_id, p_address, p_note);
  end if;
  return v_id;
end
$$;

do $$
declare
  asha constant uuid := '00000000-0000-4000-8000-000000000001';
  dev constant uuid := '00000000-0000-4000-8000-000000000002';
  nye_year integer := case when make_timestamptz(extract(year from now())::int, 12, 31, 20, 0, 0, 'Asia/Kolkata') > now()
                           then extract(year from now())::int else extract(year from now())::int + 1 end;
  nye timestamptz := make_timestamptz(nye_year, 12, 31, 20, 0, 0, 'Asia/Kolkata');
  day0 timestamptz := date_trunc('day', now());
  e_comedy uuid; e_house uuid; e_roof uuid; e_walk uuid; e_crawl uuid; e_games uuid; hub uuid;
begin
  if exists (select 1 from public.events where title = 'Sunday board games at a cafe') then
    return; -- already seeded
  end if;

  -- Partner events (tickets are bought on the partner's site)
  e_comedy := pg_temp.seed_event(asha, 'partner', 'NYE stand-up comedy countdown', 'Five comics, one midnight. Tickets are sold by the venue.', 'film-and-theatre', 'indiranagar',
    nye + interval '1 hour', 4, null, 'pay_at_venue', 'Tickets from ₹799 on the partner site', false, false, null, null, null, 'https://example.com/tickets/nye-comedy', 'KOLLIDE');
  perform pg_temp.seed_event(asha, 'partner', 'Indie acoustic evening', 'Three acoustic sets in a small garden venue. Tickets are sold by the venue.', 'music', 'koramangala',
    day0 + interval '6 days 19 hours', 3, null, 'pay_at_venue', 'Tickets from ₹350 on the partner site', false, false, null, null, null, 'https://example.com/tickets/acoustic', 'KOLLIDE');
  perform pg_temp.seed_event(asha, 'partner', 'Sunday brunch trivia league', 'Teams of four, ten rounds, free entry. Reserve a table with the venue.', 'games', 'hsr-layout',
    day0 + interval '9 days 11 hours', 3, null, 'free', null, false, false, null, null, null, 'https://example.com/tickets/trivia', 'KOLLIDE');
  perform pg_temp.seed_event(asha, 'partner', 'Pottery wheel workshop', 'A two-hour beginner session. Booked and paid on the studio''s site.', 'arts-and-crafts', 'jayanagar',
    day0 + interval '12 days 16 hours', 2, null, 'pay_at_venue', '₹1,200 per person, paid to the studio', false, false, null, null, null, 'https://example.com/tickets/pottery', 'KOLLIDE');

  -- Community events (hosted by Dev)
  e_games := pg_temp.seed_event(dev, 'community', 'Sunday board games at a cafe', 'Bring a favourite game or borrow ours. Beginners welcome, no experience needed.', 'games', 'indiranagar',
    day0 + interval '3 days 16 hours', 3, 12, 'free', null, false, false, 'Be kind, be on time, and put your phone away at the table.', '100 Feet Road, Indiranagar, Bengaluru', 'Ground-floor cafe next to the metro pillar.', null, null);
  e_walk := pg_temp.seed_event(dev, 'community', 'Last sunrise walk of the year', 'A slow walk and chai in Cubbon Park to say goodbye to the year.', 'outdoors', 'mg-road',
    date_trunc('day', nye) + interval '6 hours 30 minutes', 2, 15, 'free', null, false, false, 'Wear comfortable shoes. We walk at the pace of the slowest person.', 'Cubbon Park, near the Bandstand gate, Bengaluru', 'Meet at the Bandstand gate.', null, null);
  perform pg_temp.seed_event(dev, 'community', 'Women''s 5k easy run', 'A relaxed 5k with no pressure to keep up. Women only.', 'sports', 'mg-road',
    day0 + interval '5 days 6 hours', 2, 12, 'free', null, true, false, 'Warm up together, finish together.', 'Cubbon Park, Kasturba Road gate, Bengaluru', 'Meet at the Kasturba Road gate.', null, null);
  e_house := pg_temp.seed_event(dev, 'community', 'NYE biryani and board games at home', 'A small house party: biryani, board games and a quiet countdown. The host approves every guest.', 'social', 'jayanagar',
    nye - interval '1 hour', 5, 18, 'cost_split', '₹300 each, split on the night', false, true, 'No plus-ones. Shoes off at the door.', '14, 4th Block, Jayanagar, Bengaluru', 'Third floor, ring the bell marked Rao.', null, null);
  perform pg_temp.seed_event(dev, 'community', 'Kannada and English over filter coffee', 'A relaxed language exchange. Come to learn or to teach.', 'learning', 'malleshwaram',
    day0 + interval '8 days 17 hours', 2, 10, 'pay_at_venue', 'Your own coffee, about ₹150 at the venue', false, false, 'Mistakes are the point.', '8th Cross, Malleshwaram, Bengaluru', 'Look for the table with the dictionary.', null, null);

  -- Kollide-run events
  e_crawl := pg_temp.seed_event(asha, 'kollide', 'Street food crawl: five stops, eight people', 'A guided evening of five street food stops. We meet at the first stop.', 'food-and-drink', 'koramangala',
    date_trunc('day', nye) - interval '1 day' + interval '18 hours', 3, 8, 'cost_split', 'About ₹500 each, split on the night', false, false, 'Vegetarian options at every stop.', 'Koramangala 5th Block food street, Bengaluru', 'Meet at the first stall by the signal.', null, null);
  e_roof := pg_temp.seed_event(asha, 'kollide', 'NYE rooftop countdown', 'Ring in the new year on a rooftop with a small group of verified people.', 'social', 'indiranagar',
    nye, 5, 40, 'pay_at_venue', 'Snacks on us, drinks at venue prices from ₹300', false, false, 'Our code of conduct applies all night.', 'Rooftop, 12th Main, Indiranagar, Bengaluru', 'Lift to the 6th floor, then the stairs.', null, null);
  perform pg_temp.seed_event(asha, 'kollide', 'Lalbagh sunrise walk', 'An easy sunrise loop around the lake, then breakfast.', 'outdoors', 'basavanagudi',
    day0 + interval '14 days 6 hours', 2, 20, 'free', null, false, false, 'We start on time.', 'Lalbagh West Gate, Bengaluru', 'Meet at the West Gate.', null, null);

  -- The New Year's Eve hub and the featured slots
  insert into public.hubs (slug, title, subtitle, accent_color, starts_on, ends_on, sort_order, published)
  values ('new-years-eve-in-bengaluru', 'New Year''s Eve in Bengaluru', 'Ring it in with people you can trust', '#F2A93B',
          make_date(nye_year, 12, 1), make_date(nye_year, 12, 31), 1, true)
  returning id into hub;
  insert into public.hub_events (hub_id, event_id, sort_order) values
    (hub, e_roof, 0), (hub, e_comedy, 1), (hub, e_house, 2), (hub, e_crawl, 3), (hub, e_walk, 4);
  insert into public.featured_slots (event_id, position, created_by) values
    (e_roof, 1, asha), (e_crawl, 2, asha), (e_games, 3, asha);
end
$$;

-- Reference data tables (admin-managed) and their starting data. The data is in this migration,
-- not seed.sql, because production needs it too. Inserts are idempotent.

do $$
declare
  t text;
begin
  foreach t in array array['areas', 'interests', 'languages', 'positive_tags', 'host_rating_tags', 'categories']
  loop
    execute format($f$
      create table public.%1$I (
        id smallint generated always as identity primary key,
        slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
        label text not null check (char_length(label) between 1 and 60),
        sort_order smallint not null default 0,
        active boolean not null default true,
        created_at timestamptz not null default now()
      )$f$, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select on table public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on table public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.is_admin()))', t || '_admin_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t || '_admin_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select private.is_admin()))', t || '_admin_delete', t);
  end loop;
end
$$;

alter table public.profiles
  add constraint profiles_area_id_fkey foreign key (area_id) references public.areas (id) on delete set null;

-- ---------------------------------------------------------------- data
insert into public.areas (slug, label) values
  ('indiranagar', 'Indiranagar'), ('koramangala', 'Koramangala'), ('hsr-layout', 'HSR Layout'),
  ('jayanagar', 'Jayanagar'), ('jp-nagar', 'JP Nagar'), ('whitefield', 'Whitefield'),
  ('malleshwaram', 'Malleshwaram'), ('basavanagudi', 'Basavanagudi'), ('bellandur', 'Bellandur'),
  ('marathahalli', 'Marathahalli'), ('hebbal', 'Hebbal'), ('yelahanka', 'Yelahanka'),
  ('sadashivanagar', 'Sadashivanagar'), ('richmond-town', 'Richmond Town'), ('frazer-town', 'Frazer Town'),
  ('ulsoor', 'Ulsoor'), ('mg-road', 'MG Road'), ('cunningham-road', 'Cunningham Road'),
  ('rajajinagar', 'Rajajinagar'), ('btm-layout', 'BTM Layout'), ('electronic-city', 'Electronic City'),
  ('sarjapur-road', 'Sarjapur Road'), ('bannerghatta-road', 'Bannerghatta Road'), ('domlur', 'Domlur'),
  ('vasanth-nagar', 'Vasanth Nagar'), ('banashankari', 'Banashankari'), ('yeshwanthpur', 'Yeshwanthpur'),
  ('kalyan-nagar', 'Kalyan Nagar'), ('hbr-layout', 'HBR Layout'), ('rt-nagar', 'RT Nagar'),
  ('cv-raman-nagar', 'CV Raman Nagar'), ('brookefield', 'Brookefield')
on conflict (slug) do nothing;

insert into public.interests (slug, label) values
  ('board-games', 'Board games'), ('hiking', 'Hiking'), ('running', 'Running'), ('cycling', 'Cycling'),
  ('live-music', 'Live music'), ('stand-up-comedy', 'Stand-up comedy'), ('film', 'Film'),
  ('books', 'Books'), ('photography', 'Photography'), ('cooking', 'Cooking'), ('coffee', 'Coffee'),
  ('street-food', 'Street food'), ('craft-beer', 'Craft beer'), ('travel', 'Travel'),
  ('art-and-crafts', 'Art and crafts'), ('pottery', 'Pottery'), ('dance', 'Dance'), ('yoga', 'Yoga'),
  ('badminton', 'Badminton'), ('football', 'Football'), ('trivia', 'Trivia'), ('startups', 'Startups'),
  ('language-exchange', 'Language exchange'), ('volunteering', 'Volunteering'), ('gardening', 'Gardening'),
  ('theatre', 'Theatre')
on conflict (slug) do nothing;

insert into public.languages (slug, label) values
  ('kannada', 'Kannada'), ('english', 'English'), ('hindi', 'Hindi'), ('tamil', 'Tamil'),
  ('telugu', 'Telugu'), ('malayalam', 'Malayalam'), ('marathi', 'Marathi'), ('bengali', 'Bengali'),
  ('gujarati', 'Gujarati'), ('punjabi', 'Punjabi'), ('urdu', 'Urdu'), ('konkani', 'Konkani'),
  ('tulu', 'Tulu'), ('odia', 'Odia')
on conflict (slug) do nothing;

-- Proposed list; edit in a later migration if the product changes it.
insert into public.positive_tags (slug, label) values
  ('warm', 'Warm'), ('great-listener', 'Great listener'), ('good-humour', 'Good humour'),
  ('made-me-feel-welcome', 'Made me feel welcome'), ('easy-to-talk-to', 'Easy to talk to'),
  ('brought-good-energy', 'Brought good energy'), ('thoughtful', 'Thoughtful'), ('reliable', 'Reliable')
on conflict (slug) do nothing;

insert into public.host_rating_tags (slug, label) values
  ('as-described', 'As described'), ('felt-safe', 'Felt safe'), ('well-organised', 'Well organised')
on conflict (slug) do nothing;

insert into public.categories (slug, label) values
  ('food-and-drink', 'Food and drink'), ('outdoors', 'Outdoors'), ('music', 'Music'), ('games', 'Games'),
  ('arts-and-crafts', 'Arts and crafts'), ('books', 'Books'), ('sports', 'Sports'), ('wellness', 'Wellness'),
  ('learning', 'Learning'), ('film-and-theatre', 'Film and theatre'), ('social', 'Social'), ('tech', 'Tech')
on conflict (slug) do nothing;

create index profiles_area_id_idx on public.profiles (area_id);

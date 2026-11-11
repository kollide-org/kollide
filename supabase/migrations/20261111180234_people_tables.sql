-- People tables: photos, interests, languages, host applications, verifications, consents, blocks.
-- Clients get only the privileges granted here; RLS decides which rows.

-- ---------------------------------------------------------------- profile_photos (writes arrive in B3)
create table public.profile_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  r2_key text not null unique,
  position smallint not null check (position between 1 and 3),
  created_at timestamptz not null default now(),
  unique (user_id, position)
);
alter table public.profile_photos enable row level security;
revoke all on table public.profile_photos from anon, authenticated;
grant select on public.profile_photos to authenticated;
create policy profile_photos_read on public.profile_photos for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()) or (select private.is_user_active(user_id)));

-- ---------------------------------------------------------------- interests and languages of a person
create table public.profile_interests (
  user_id uuid not null references public.profiles (id) on delete cascade,
  interest_id smallint not null references public.interests (id) on delete cascade,
  primary key (user_id, interest_id)
);
create table public.profile_languages (
  user_id uuid not null references public.profiles (id) on delete cascade,
  language_id smallint not null references public.languages (id) on delete cascade,
  primary key (user_id, language_id)
);
do $$
declare
  t text;
begin
  foreach t in array array['profile_interests', 'profile_languages']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select, insert, delete on table public.%I to authenticated', t);
    execute format($p$create policy %I on public.%I for select to authenticated
      using (user_id = (select auth.uid()) or (select private.is_admin()) or (select private.is_user_active(user_id)))$p$,
      t || '_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))',
      t || '_insert_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))',
      t || '_delete_own', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------- host_applications
create table public.host_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  message text not null check (char_length(btrim(message)) between 1 and 1000),
  status public.review_status not null default 'pending',
  admin_note text check (char_length(admin_note) <= 1000),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index host_applications_one_pending on public.host_applications (user_id) where status = 'pending';

alter table public.host_applications enable row level security;
revoke all on table public.host_applications from anon, authenticated;
grant select on public.host_applications to authenticated;
grant insert (user_id, message) on public.host_applications to authenticated;
grant update (status, admin_note, reviewed_by, reviewed_at) on public.host_applications to authenticated;

create policy host_applications_read on public.host_applications for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy host_applications_apply on public.host_applications for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending' and admin_note is null and reviewed_by is null and reviewed_at is null
    and (select private.current_user_status()) = 'active'
  );
create policy host_applications_admin_review on public.host_applications for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- ---------------------------------------------------------------- verifications (rows are written in B3)
create table public.verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  selfie_key text not null,
  result public.review_status not null default 'pending',
  reviewer_id uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
comment on column public.verifications.selfie_key is
  'Private. Not granted to anon or authenticated: only the Worker (service role) reads it to make a signed link.';

alter table public.verifications enable row level security;
revoke all on table public.verifications from anon, authenticated;
-- The owner sees the result only. selfie_key and reviewer_id are not readable through the API.
grant select (id, user_id, result, reviewed_at, created_at) on public.verifications to authenticated;
grant update (result, reviewer_id, reviewed_at) on public.verifications to authenticated;
create policy verifications_read on public.verifications for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy verifications_admin_review on public.verifications for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- ---------------------------------------------------------------- consents (append-only)
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  anonymous_id uuid, -- cookie choice of a logged-out visitor, linked to the user at sign-in
  purpose public.consent_purpose not null,
  notice_version text not null check (char_length(notice_version) between 1 and 40),
  granted boolean not null,
  created_at timestamptz not null default now(),
  check (user_id is not null or anonymous_id is not null)
);
create index consents_user_idx on public.consents (user_id, purpose, created_at desc);
create index consents_anon_idx on public.consents (anonymous_id, purpose, created_at desc);

alter table public.consents enable row level security;
revoke all on table public.consents from anon, authenticated;
grant select on public.consents to authenticated;
grant insert (user_id, anonymous_id, purpose, notice_version, granted) on public.consents to anon, authenticated;
create policy consents_read on public.consents for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy consents_insert on public.consents for insert to anon, authenticated
  with check (user_id = (select auth.uid()) or (user_id is null and anonymous_id is not null));

-- ---------------------------------------------------------------- user_blocks
create table public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.user_blocks enable row level security;
revoke all on table public.user_blocks from anon, authenticated;
grant select, delete on public.user_blocks to authenticated;
grant insert (blocker_id, blocked_id) on public.user_blocks to authenticated;
create policy user_blocks_read on public.user_blocks for select to authenticated
  using (blocker_id = (select auth.uid()));
create policy user_blocks_insert on public.user_blocks for insert to authenticated
  with check (blocker_id = (select auth.uid()));
create policy user_blocks_delete on public.user_blocks for delete to authenticated
  using (blocker_id = (select auth.uid()));

-- ---------------------------------------------------------------- indexes for foreign keys
create index profile_interests_interest_idx on public.profile_interests (interest_id);
create index profile_languages_language_idx on public.profile_languages (language_id);
create index verifications_user_idx on public.verifications (user_id);
create index user_blocks_blocked_idx on public.user_blocks (blocked_id);
create index user_roles_granted_by_idx on public.user_roles (granted_by);

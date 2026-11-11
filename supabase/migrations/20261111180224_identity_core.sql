-- Identity core: profiles, profile_private, user_roles and the helper functions.
-- Helpers live in the `private` schema: it is not exposed through the API, so SECURITY DEFINER
-- functions there cannot be called by browsers, but RLS policies can still use them.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

-- ---------------------------------------------------------------- generic trigger helper
create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- ---------------------------------------------------------------- tables
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text check (char_length(btrim(first_name)) between 1 and 40),
  area_id smallint, -- foreign key to areas is added in the reference tables migration
  bio_prompts jsonb not null default '[]'::jsonb
    check (jsonb_typeof(bio_prompts) = 'array' and jsonb_array_length(bio_prompts) <= 3),
  is_verified boolean not null default false,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'Public card fields only. Gender, status and everything private live in profile_private.';

create table public.profile_private (
  id uuid primary key references public.profiles (id) on delete cascade,
  last_name text check (char_length(btrim(last_name)) between 1 and 60),
  phone text check (phone ~ '^\+[0-9]{10,15}$'),
  date_of_birth date check (date_of_birth > date '1900-01-01'),
  email extensions.citext,
  gender public.gender,
  status public.user_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profile_private is 'Owner and admins only. Never returned to other members.';

create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();
create trigger profile_private_touch before update on public.profile_private
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------- helper functions
create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles where user_id = (select auth.uid()) and role = 'admin'
  )
$$;

create function private.has_role(wanted public.app_role) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles where user_id = (select auth.uid()) and role = wanted
  )
$$;

create function private.current_user_status() returns public.user_status
language sql stable security definer set search_path = '' as $$
  select status from public.profile_private where id = (select auth.uid())
$$;

create function private.is_user_active(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select status = 'active' from public.profile_private where id = uid), false)
$$;

create function private.age_from_dob(dob date) returns integer
language sql stable security definer set search_path = '' as $$
  select case when dob is null then null else date_part('year', age(current_date, dob))::integer end
$$;

-- Age only. The date of birth itself never leaves profile_private.
create function private.age_of(uid uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select private.age_from_dob((select date_of_birth from public.profile_private where id = uid))
$$;

-- 18+ is enforced by the database.
create function private.enforce_adult() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.date_of_birth is not null and new.date_of_birth > (current_date - interval '18 years')::date then
    raise exception 'You must be 18 or older to join Kollide' using errcode = 'check_violation';
  end if;
  return new;
end
$$;
create trigger profile_private_adult before insert or update of date_of_birth on public.profile_private
  for each row execute function private.enforce_adult();

revoke all on function
  private.is_admin(), private.has_role(public.app_role), private.current_user_status(),
  private.is_user_active(uuid), private.age_from_dob(date), private.age_of(uuid)
  from public;
grant execute on function
  private.is_admin(), private.has_role(public.app_role), private.current_user_status(),
  private.is_user_active(uuid), private.age_from_dob(date), private.age_of(uuid)
  to authenticated;

-- ---------------------------------------------------------------- privileges and RLS
alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.user_roles enable row level security;

revoke all on table public.profiles, public.profile_private, public.user_roles from anon, authenticated;

-- profiles: members read active profiles (and their own); the owner edits three columns.
grant select on public.profiles to authenticated;
grant update (first_name, area_id, bio_prompts) on public.profiles to authenticated;

create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()) or (select private.is_user_active(id)));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- profile_private: owner and admins read. No client writes: functions in B2 write it.
grant select on public.profile_private to authenticated;
create policy profile_private_read on public.profile_private for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));

-- user_roles: owner and admins read; admins grant and revoke.
grant select, insert, delete on public.user_roles to authenticated;
create policy user_roles_read on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy user_roles_admin_insert on public.user_roles for insert to authenticated
  with check ((select private.is_admin()));
create policy user_roles_admin_delete on public.user_roles for delete to authenticated
  using ((select private.is_admin()));

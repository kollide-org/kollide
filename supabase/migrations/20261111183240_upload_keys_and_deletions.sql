-- Image uploads (B3). The Worker records every key it signs in upload_keys, so the database can check
-- that a key a browser tries to attach was issued to that person, for that purpose, and is unused.
-- storage_deletions is the queue of R2 objects the cleanup job must delete.
-- Both tables are closed to the browser: only the service role (the Worker) and definer functions touch them.

create table public.upload_keys (
  key text primary key check (key ~ '^(profiles|events|hubs|selfies)/[0-9a-f-]{36}\.webp$'),
  user_id uuid not null references public.profiles (id) on delete cascade,
  purpose text not null check (purpose in ('profile_photo', 'event_cover', 'hub_art', 'selfie')),
  event_id uuid, -- the event a cover is for; checked against hosting rights in B4
  size_limit integer not null check (size_limit > 0),
  created_at timestamptz not null default now(),
  consumed_at timestamptz
);
create index upload_keys_user_idx on public.upload_keys (user_id, purpose, created_at desc);
create index upload_keys_created_idx on public.upload_keys (created_at);

create table public.storage_deletions (
  id bigint generated always as identity primary key,
  bucket text not null check (bucket in ('media', 'private')),
  key text not null,
  requested_at timestamptz not null default now(),
  done_at timestamptz,
  unique (bucket, key)
);
create index storage_deletions_pending_idx on public.storage_deletions (id) where done_at is null;

alter table public.upload_keys enable row level security;
alter table public.storage_deletions enable row level security;
revoke all on table public.upload_keys, public.storage_deletions from anon, authenticated;
grant select, insert, update, delete on public.upload_keys, public.storage_deletions to service_role;

-- Explicit "closed to everyone" policies. Server code uses the service role, which bypasses RLS.
create policy upload_keys_closed on public.upload_keys for all to anon, authenticated using (false) with check (false);
create policy storage_deletions_closed on public.storage_deletions for all to anon, authenticated using (false) with check (false);

-- The selfie key is cleared once the selfie is deleted after review.
alter table public.verifications alter column selfie_key drop not null;

grant usage on schema private to service_role;

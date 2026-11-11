-- app_config: small admin-controlled switches. v1 ships with payments_enabled = false.
-- See docs/backend/PAYMENTS_LATER.md.

create table public.app_config (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  check (key <> 'payments_enabled' or jsonb_typeof(value) = 'boolean')
);

create function private.stamp_app_config() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end
$$;
create trigger app_config_stamp before insert or update on public.app_config
  for each row execute function private.stamp_app_config();

alter table public.app_config enable row level security;
revoke all on table public.app_config from anon, authenticated;
grant select on public.app_config to anon, authenticated;
grant insert, update, delete on public.app_config to authenticated;

create policy app_config_read on public.app_config for select to anon, authenticated using (true);
create policy app_config_admin_insert on public.app_config for insert to authenticated
  with check ((select private.is_admin()));
create policy app_config_admin_update on public.app_config for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy app_config_admin_delete on public.app_config for delete to authenticated
  using ((select private.is_admin()));

insert into public.app_config (key, value) values ('payments_enabled', 'false'::jsonb)
on conflict (key) do nothing;

create function private.payments_enabled() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select (value #>> '{}')::boolean from public.app_config where key = 'payments_enabled'), false)
$$;
revoke all on function private.payments_enabled() from public;
grant execute on function private.payments_enabled() to anon, authenticated;

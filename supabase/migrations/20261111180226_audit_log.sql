-- Audit log: written only by triggers, readable only by admins, never changed.

create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid, -- auth.uid() of whoever made the change; null means the system or a server job
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  table_name text not null,
  row_pk text,
  old_data jsonb,
  new_data jsonb
);
create index audit_log_at_idx on public.audit_log (at desc);
create index audit_log_table_idx on public.audit_log (table_name, at desc);

alter table public.audit_log enable row level security;
revoke all on table public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;
create policy audit_log_admin_read on public.audit_log for select to authenticated
  using ((select private.is_admin()));

-- Rows can never be edited or deleted, even by server code.
create function private.audit_log_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'audit_log is append-only';
end
$$;
create trigger audit_log_no_change before update or delete on public.audit_log
  for each row execute function private.audit_log_immutable();
create trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function private.audit_log_immutable();

-- Generic trigger. Trigger arguments name the columns to record, so private values
-- (phone, date of birth, selfie keys, notes) never enter the log. No arguments = all columns.
create function private.audit_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  full_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  old_j jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  new_j jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
begin
  if tg_nargs > 0 then
    old_j := (select jsonb_object_agg(k, v) from jsonb_each(old_j) as e (k, v) where k = any (tg_argv));
    new_j := (select jsonb_object_agg(k, v) from jsonb_each(new_j) as e (k, v) where k = any (tg_argv));
  end if;

  if tg_op = 'UPDATE' and old_j is not distinct from new_j then
    return null; -- none of the audited columns changed
  end if;

  insert into public.audit_log (actor_id, action, table_name, row_pk, old_data, new_data)
  values (
    (select auth.uid()), tg_op, tg_table_name,
    coalesce(full_row ->> 'id', full_row ->> 'key', full_row ->> 'user_id'),
    old_j, new_j
  );
  return null;
end
$$;
revoke all on function private.audit_change() from public;

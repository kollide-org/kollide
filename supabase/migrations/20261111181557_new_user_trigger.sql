-- Every new sign-up (Google or email code) gets an empty profile and private row.
-- on conflict do nothing: seed data and retries can insert them first.
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  insert into public.profile_private (id, email)
  values (new.id, new.email::extensions.citext) on conflict (id) do nothing;
  return new;
end
$$;
revoke all on function private.handle_new_user() from public;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

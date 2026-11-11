-- Attach the audit trigger. Arguments list the only columns recorded.

create trigger audit_user_roles after insert or update or delete on public.user_roles
  for each row execute function private.audit_change();

create trigger audit_app_config after insert or update or delete on public.app_config
  for each row execute function private.audit_change();

do $$
declare
  t text;
begin
  foreach t in array array['areas', 'interests', 'languages', 'positive_tags', 'host_rating_tags', 'categories']
  loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.audit_change()',
      'audit_' || t, t);
  end loop;
end
$$;

-- Status changes (on hold, suspended, banned). Nothing else from profile_private is recorded.
create trigger audit_profile_status after insert or update or delete on public.profile_private
  for each row execute function private.audit_change('status');

create trigger audit_profile_verified after update of is_verified on public.profiles
  for each row execute function private.audit_change('is_verified');

create trigger audit_host_applications after update on public.host_applications
  for each row execute function private.audit_change('user_id', 'status', 'reviewed_by');

create trigger audit_verifications after update on public.verifications
  for each row execute function private.audit_change('user_id', 'result', 'reviewer_id');

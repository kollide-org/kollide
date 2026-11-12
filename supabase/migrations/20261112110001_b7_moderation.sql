-- B7.1 Moderation core: one place that changes a person's status (warn, hold, suspend, ban, reactivate), the ban blocklist,
-- and the admin's user search and user detail. Every function is a private SECURITY DEFINER function that checks the caller is
-- an active admin, with a thin public wrapper. Nothing here is callable by members or anon.

-- ---------------------------------------------------------------- new email
alter table public.email_outbox drop constraint email_outbox_template_check;
alter table public.email_outbox add constraint email_outbox_template_check check (template in (
  'request_received', 'booking_approved', 'booking_waitlisted', 'booking_declined', 'still_coming', 'day_of_reminder', 'event_cancelled',
  'feedback_prompt', 'safety_report_ack', 'admin_alert', 'account_on_hold', 'moderation_notice'));

-- ---------------------------------------------------------------- tables
-- Every moderation decision with its reason ('note' = a message to the person with no judgement attached). Append-only. The reason is for admins; user_note is what the person is told.
create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  admin_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in ('note', 'warn', 'hold', 'suspend', 'ban', 'reactivate')),
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  user_note text check (char_length(user_note) <= 300),
  report_id uuid references public.safety_reports (id) on delete set null,
  created_at timestamptz not null default now()
);
create index moderation_actions_user_idx on public.moderation_actions (user_id, created_at desc);

create function private.append_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception '% is append-only', tg_table_name;
end
$$;
create trigger moderation_actions_no_change before update or delete on public.moderation_actions
  for each row execute function private.append_only();
create trigger audit_moderation_actions after insert on public.moderation_actions
  for each row execute function private.audit_change('user_id', 'admin_id', 'action', 'reason', 'report_id');

-- The ban blocklist stores only hashes of the email and phone (never the readable value), linked to the banned account. A new
-- profile with a matching hash is refused. Rows go away when the ban is lifted. They survive account deletion on purpose.
create table public.banned_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  kind text not null check (kind in ('email', 'phone')),
  hash text not null check (hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (kind, hash)
);
create index banned_identities_user_idx on public.banned_identities (user_id);
create trigger audit_banned_identities after insert or delete on public.banned_identities
  for each row execute function private.audit_change('user_id', 'kind'); -- never the hash

-- Report handling columns (B7.2 fills them). The reporter's grant list is unchanged, so none of these are readable by members.
alter table public.safety_reports
  add column admin_note text check (char_length(admin_note) <= 1000),
  add column reviewed_by uuid references public.profiles (id) on delete set null,
  add column reviewing_at timestamptz,
  add column action_taken text check (action_taken in ('dismiss', 'warn', 'suspend', 'ban')),
  add column user_note text check (char_length(user_note) <= 300);

-- RLS: closed to browsers. Admins read through the functions below.
alter table public.moderation_actions enable row level security;
alter table public.banned_identities enable row level security;
revoke all on table public.moderation_actions, public.banned_identities from anon, authenticated;
grant select, insert, update, delete on public.moderation_actions, public.banned_identities to service_role;
create policy moderation_actions_closed on public.moderation_actions for all to anon, authenticated using (false) with check (false);
create policy banned_identities_closed on public.banned_identities for all to anon, authenticated using (false) with check (false);

-- ---------------------------------------------------------------- blocklist
-- Fixed salt, so the same email always gives the same hash. The point is to avoid keeping readable contact details.
create function private.identity_hash(p_kind text, p_value text) returns text
language sql immutable security definer set search_path = '' as $$
  select encode(extensions.digest('kollide-blocklist-v1:' || p_kind || ':' ||
    case when p_kind = 'email' then lower(btrim(p_value)) else regexp_replace(p_value, '[^0-9+]', '', 'g') end, 'sha256'), 'hex')
$$;

create function private.refuse_banned_identity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is not null and exists (
       select 1 from public.banned_identities b
        where b.kind = 'email' and b.hash = private.identity_hash('email', new.email::text) and b.user_id <> new.id) then
    raise exception 'not_allowed';
  end if;
  if new.phone is not null and exists (
       select 1 from public.banned_identities b
        where b.kind = 'phone' and b.hash = private.identity_hash('phone', new.phone) and b.user_id <> new.id) then
    raise exception 'not_allowed';
  end if;
  return new;
end
$$;
create trigger profile_private_blocklist before insert or update of email, phone on public.profile_private
  for each row execute function private.refuse_banned_identity();

-- ---------------------------------------------------------------- the one writer of status
-- No permission checks here: the callers (admin functions) have already checked. Transitions:
--   hold: active -> on_hold; suspend: active/on_hold -> suspended; ban: anything but banned -> banned;
--   reactivate: anything but active -> active; warn and note: no status change.
create function private.apply_user_status(p_admin uuid, p_user uuid, p_action text, p_reason text, p_user_note text, p_report uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  cur public.user_status;
  v_reason text := btrim(p_reason);
  v_note text := nullif(btrim(p_user_note), '');
  b record;
  v_title text;
begin
  if p_action not in ('note', 'warn', 'hold', 'suspend', 'ban', 'reactivate') then raise exception 'invalid_action'; end if;
  if v_reason is null or char_length(v_reason) not between 3 and 500 then raise exception 'reason_required'; end if;
  if v_note is not null and char_length(v_note) > 300 then raise exception 'note_too_long'; end if;
  if p_admin = p_user then raise exception 'not_allowed'; end if; -- nobody moderates themselves
  if exists (select 1 from public.user_roles where user_id = p_user and role = 'admin') then raise exception 'not_allowed'; end if;
  select status into cur from public.profile_private where id = p_user for update;
  if not found then
    -- Someone who was banned and then erased their data has no account left to change, but the blocklist still holds their hashes.
    -- Reactivating lifts that, so a ban can always be reversed.
    if p_action = 'reactivate' and exists (select 1 from public.banned_identities where user_id = p_user) then
      delete from public.banned_identities where user_id = p_user;
      insert into public.moderation_actions (user_id, admin_id, action, reason, user_note, report_id) values (p_user, p_admin, 'reactivate', v_reason, null, p_report);
      return;
    end if;
    raise exception 'not_found';
  end if;

  if (p_action = 'hold' and cur <> 'active') or (p_action = 'suspend' and cur not in ('active', 'on_hold'))
     or (p_action = 'ban' and cur = 'banned') or (p_action = 'reactivate' and cur = 'active') then
    raise exception 'invalid_transition';
  end if;

  if p_action not in ('warn', 'note') then
    update public.profile_private
       set status = case p_action when 'hold' then 'on_hold' when 'suspend' then 'suspended' when 'ban' then 'banned' else 'active' end::public.user_status
     where id = p_user;
  end if;

  if p_action = 'ban' then
    -- Remember who this was (hashes only), lock the login, sign out everywhere.
    insert into public.banned_identities (user_id, kind, hash)
      select p_user, 'email', private.identity_hash('email', pp.email::text) from public.profile_private pp where pp.id = p_user and pp.email is not null
      union all
      select p_user, 'phone', private.identity_hash('phone', pp.phone) from public.profile_private pp where pp.id = p_user and pp.phone is not null
    on conflict (kind, hash) do nothing;
    update auth.users set banned_until = 'infinity', updated_at = now() where id = p_user;
    delete from auth.refresh_tokens where user_id = p_user::text;
    delete from auth.sessions where user_id = p_user;
    -- Their upcoming bookings are released (the waitlist moves up) and their upcoming events are cancelled (guests are emailed).
    for b in
      select bk.id, bk.event_id, bk.status, e.host_id from public.bookings bk join public.events e on e.id = bk.event_id
       where bk.user_id = p_user and bk.status in ('requested', 'approved', 'waitlisted', 'confirmed') and e.ends_at > now()
    loop
      perform 1 from public.events where id = b.event_id for update;
      update public.bookings set status = 'cancelled', cancelled_at = now(), cancel_reason = 'account_removed', waitlisted_at = null where id = b.id;
      perform private.detach_from_squads(p_user, b.event_id);
      if b.status in ('approved', 'confirmed') then
        perform private.notify(b.host_id, 'booking_cancelled', 'A guest cancelled', (select title from public.events where id = b.event_id),
          jsonb_build_object('event_id', b.event_id, 'booking_id', b.id));
        perform private.promote_waitlist(b.event_id);
      elsif b.status in ('requested') then
        perform private.promote_waitlist(b.event_id);
      end if;
    end loop;
    update public.events set status = 'cancelled', review_note = 'The host account was closed.'
     where host_id = p_user and status in ('draft', 'pending_review', 'published') and ends_at > now();
  elsif p_action = 'reactivate' then
    update auth.users set banned_until = null, updated_at = now() where id = p_user;
    delete from public.banned_identities where user_id = p_user;
  end if;

  insert into public.moderation_actions (user_id, admin_id, action, reason, user_note, report_id)
  values (p_user, p_admin, p_action, v_reason, v_note, p_report);

  -- The person is told, in the app and by email. The email carries fixed wording plus the admin's note (escaped by the Worker).
  v_title := case p_action when 'note' then 'A message from the Kollide team' when 'warn' then 'A note from the Kollide team' when 'hold' then 'Your account is on hold' when 'suspend' then 'Your account is suspended'
                           when 'ban' then 'Your account was closed' else 'Your account is active again' end;
  perform private.notify(p_user, 'moderation_' || p_action, v_title, coalesce(v_note, case p_action when 'reactivate' then 'Thank you for your patience.'
    when 'warn' then 'Please read our code of conduct.' when 'note' then 'Open the app to read it.' else 'You can send an appeal from your profile.' end), '{}'::jsonb);
  perform private.queue_email(p_user, 'moderation_notice', jsonb_build_object('action', p_action, 'note', v_note), 1);
end
$$;

create function private.require_admin() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  perform private.require_active(uid);
  if not private.is_admin() then raise exception 'not_allowed'; end if;
  return uid;
end
$$;

create function private.admin_set_user_status(p_user uuid, p_action text, p_reason text, p_user_note text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.apply_user_status(private.require_admin(), p_user, p_action, p_reason, p_user_note, null);
end
$$;

-- ---------------------------------------------------------------- users
create function private.admin_search_users(p_q text, p_status text, p_limit integer, p_offset integer)
returns table (user_id uuid, first_name text, last_name text, email text, phone_hint text, status public.user_status, is_verified boolean,
               roles text[], created_at timestamptz, onboarded boolean, open_reports integer)
language plpgsql stable security definer set search_path = '' as $$
declare
  q text := lower(btrim(coalesce(p_q, '')));
begin
  perform private.require_admin();
  return query
    select p.id, p.first_name, pp.last_name, pp.email::text, case when pp.phone is null then null else '••••' || right(pp.phone, 4) end,
           pp.status, p.is_verified,
           coalesce((select array_agg(ur.role::text order by ur.role) from public.user_roles ur where ur.user_id = p.id), '{}'::text[]),
           p.created_at, p.onboarding_completed_at is not null,
           (select count(*)::integer from public.safety_reports sr where sr.subject_user_id = p.id and sr.status in ('open', 'reviewing'))
      from public.profiles p join public.profile_private pp on pp.id = p.id
     where p.deleted_at is null
       and (p_status is null or pp.status::text = p_status)
       and (q = '' or position(q in lower(coalesce(p.first_name, ''))) > 0 or position(q in lower(coalesce(pp.last_name, ''))) > 0
            or position(q in lower(coalesce(pp.email::text, ''))) > 0 or p.id::text = q
            or (regexp_replace(q, '[^0-9]', '', 'g') <> '' and pp.phone like '%' || regexp_replace(q, '[^0-9]', '', 'g')))
     order by p.created_at desc
     limit least(greatest(coalesce(p_limit, 25), 1), 100) offset greatest(coalesce(p_offset, 0), 0);
end
$$;

-- Everything an admin needs on one screen. No selfie, no private feedback (see admin_private_feedback_about), and no names of
-- anyone who reported or reviewed this person.
create function private.admin_user_detail(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  r jsonb;
begin
  perform private.require_admin();
  select jsonb_build_object(
    'id', p.id, 'first_name', p.first_name, 'last_name', pp.last_name, 'email', pp.email::text,
    'phone_hint', case when pp.phone is null then null else '••••' || right(pp.phone, 4) end,
    'age', private.age_from_dob(pp.date_of_birth), 'status', pp.status, 'is_verified', p.is_verified, 'created_at', p.created_at,
    'onboarded', p.onboarding_completed_at is not null,
    'roles', coalesce((select jsonb_agg(ur.role order by ur.role) from public.user_roles ur where ur.user_id = p.id), '[]'::jsonb),
    'verification', (select jsonb_build_object('result', v.result, 'reviewed_at', v.reviewed_at, 'submitted_at', v.created_at)
                       from public.verifications v where v.user_id = p.id order by v.created_at desc limit 1),
    'reputation', (select jsonb_build_object('events_attended', rp.events_attended, 'shows_up_attended', rp.shows_up_attended,
                            'shows_up_total', rp.shows_up_total, 'events_hosted', rp.events_hosted, 'top_tags', rp.top_tags)
                     from private.user_reputation rp where rp.user_id = p.id),
    'flags', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'kind', f.kind, 'status', f.status, 'details', f.details, 'created_at', f.created_at)
                                         order by f.created_at desc) from public.review_flags f where f.subject_user_id = p.id), '[]'::jsonb),
    'reports_about', coalesce((select jsonb_agg(jsonb_build_object('id', sr.id, 'reason', sr.reason, 'status', sr.status, 'held', sr.held,
                                                                   'action_taken', sr.action_taken, 'created_at', sr.created_at) order by sr.created_at desc)
                                 from public.safety_reports sr where sr.subject_user_id = p.id), '[]'::jsonb),
    'moderation', coalesce((select jsonb_agg(jsonb_build_object('action', m.action, 'reason', m.reason, 'user_note', m.user_note,
                                                               'admin_first_name', a.first_name, 'created_at', m.created_at) order by m.created_at desc)
                              from public.moderation_actions m left join public.profiles a on a.id = m.admin_id where m.user_id = p.id), '[]'::jsonb),
    'tips', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'message', t.message, 'created_at', t.created_at) order by t.created_at desc)
                        from public.profile_tips t where t.user_id = p.id and t.status = 'active'), '[]'::jsonb)
  ) into r
  from public.profiles p join public.profile_private pp on pp.id = p.id
  where p.id = p_user and p.deleted_at is null;
  if r is null then raise exception 'not_found'; end if;
  return r;
end
$$;

-- ---------------------------------------------------------------- wrappers and grants
create function public.admin_set_user_status(p_user uuid, p_action text, p_reason text, p_user_note text default null) returns void
language sql set search_path = '' as $$ select private.admin_set_user_status(p_user, p_action, p_reason, p_user_note) $$;
create function public.admin_search_users(p_q text default null, p_status text default null, p_limit integer default 25, p_offset integer default 0)
returns table (user_id uuid, first_name text, last_name text, email text, phone_hint text, status public.user_status, is_verified boolean,
               roles text[], created_at timestamptz, onboarded boolean, open_reports integer)
language sql stable set search_path = '' as $$ select * from private.admin_search_users(p_q, p_status, p_limit, p_offset) $$;
create function public.admin_user_detail(p_user uuid) returns jsonb
language sql stable set search_path = '' as $$ select private.admin_user_detail(p_user) $$;

revoke all on function
  private.append_only(), private.identity_hash(text, text), private.refuse_banned_identity(),
  private.apply_user_status(uuid, uuid, text, text, text, uuid), private.require_admin(),
  private.admin_set_user_status(uuid, text, text, text), private.admin_search_users(text, text, integer, integer), private.admin_user_detail(uuid)
  from public;
grant execute on function
  private.admin_set_user_status(uuid, text, text, text), private.admin_search_users(text, text, integer, integer), private.admin_user_detail(uuid)
  to authenticated;
revoke all on function
  public.admin_set_user_status(uuid, text, text, text), public.admin_search_users(text, text, integer, integer), public.admin_user_detail(uuid)
  from public, anon;
grant execute on function
  public.admin_set_user_status(uuid, text, text, text), public.admin_search_users(text, text, integer, integer), public.admin_user_detail(uuid)
  to authenticated;

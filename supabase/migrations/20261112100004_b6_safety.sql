-- B6.4 Safety: reports (instant hold), appeals (48-hour target) and profile tips, plus "on hold is blocked everywhere".
-- Reports and appeals are written only through functions. A subject can never read who reported them.

-- ---------------------------------------------------------------- tables
-- Anonymous, gentle notes shown only to the person they are about. Created by the nightly job (B6.6), never by hand.
create table public.profile_tips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  issue_code text not null check (issue_code in ('made_uncomfortable', 'disrespectful', 'unsafe', 'not_as_described', 'harassment', 'other')),
  message text not null check (char_length(message) <= 300),
  status text not null default 'active' check (status in ('active', 'expired', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profile_tips_one_active on public.profile_tips (user_id, issue_code) where status = 'active';
create trigger profile_tips_touch before update on public.profile_tips for each row execute function private.touch_updated_at();

-- subject_user_id is the person the report is about, or the host / squad creator when the report is about an event / squad.
create table public.safety_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id), -- null once the reporter deletes their account
  subject_type text not null check (subject_type in ('user', 'event', 'squad')),
  subject_id uuid not null,
  subject_user_id uuid not null references public.profiles (id),
  event_id uuid references public.events (id) on delete set null,
  reason text not null check (reason in ('harassment', 'unsafe', 'fake_profile', 'inappropriate_content', 'spam', 'other')),
  details text check (char_length(details) <= 1000),
  status public.report_status not null default 'open',
  held boolean not null default false, -- did this report put the subject on hold?
  outcome text check (char_length(outcome) <= 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null
);
create index safety_reports_subject_idx on public.safety_reports (subject_user_id, created_at);
create index safety_reports_reporter_idx on public.safety_reports (reporter_id, created_at);
create index safety_reports_open_idx on public.safety_reports (created_at) where status in ('open', 'reviewing');

create table public.appeals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  kind text not null check (kind in ('tip', 'account_status')),
  tip_id uuid references public.profile_tips (id) on delete cascade,
  message text not null check (char_length(btrim(message)) between 1 and 1000),
  status text not null default 'open' check (status in ('open', 'upheld', 'overturned')),
  due_at timestamptz not null default now() + interval '48 hours', -- the response target
  admin_note text check (char_length(admin_note) <= 500),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  overdue_alerted_at timestamptz,
  created_at timestamptz not null default now(),
  check ((kind = 'tip') = (tip_id is not null))
);
create unique index appeals_one_open_tip on public.appeals (user_id, tip_id) where status = 'open' and kind = 'tip';
create unique index appeals_one_open_status on public.appeals (user_id) where status = 'open' and kind = 'account_status';
create index appeals_open_idx on public.appeals (due_at) where status = 'open';

create trigger audit_safety_reports after insert or update of status, held, outcome or delete on public.safety_reports
  for each row execute function private.audit_change('reporter_id', 'subject_type', 'subject_id', 'subject_user_id', 'reason', 'status', 'held');
create trigger audit_appeals after insert or update of status or delete on public.appeals
  for each row execute function private.audit_change('user_id', 'kind', 'status');
create trigger audit_profile_tips after insert or update of status or delete on public.profile_tips
  for each row execute function private.audit_change('user_id', 'issue_code', 'status');

-- ---------------------------------------------------------------- RLS and privileges
alter table public.profile_tips enable row level security;
alter table public.safety_reports enable row level security;
alter table public.appeals enable row level security;
revoke all on table public.profile_tips, public.safety_reports, public.appeals from anon, authenticated;
grant select, insert, update, delete on public.profile_tips, public.safety_reports, public.appeals to service_role;

-- Tips: only the person they are about (the nightly job writes them) and admins.
grant select on public.profile_tips to authenticated;
create policy profile_tips_read on public.profile_tips for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

-- Reports: the reporter sees what they sent and its status, never the subject's side. The subject sees nothing.
-- (Admin tooling reads the rest through functions in B7.)
grant select (id, subject_type, subject_id, reason, details, status, created_at) on public.safety_reports to authenticated;
create policy safety_reports_read on public.safety_reports for select to authenticated
  using (reporter_id = (select auth.uid()) or (select private.is_admin()));

grant select on public.appeals to authenticated;
create policy appeals_read on public.appeals for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

-- ---------------------------------------------------------------- helpers
-- Have these two people been at an event together (it has started; or hosted/attended each other's), or been in a squad together?
-- Only people with a real connection can put each other on hold with a single report.
create function private.shares_event(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  -- An event only counts once it has started: joining an instant-approval event days ahead must not be enough to hold its host.
  select exists (
           select 1 from public.bookings x join public.bookings y on y.event_id = x.event_id join public.events e on e.id = x.event_id
            where x.user_id = p_a and y.user_id = p_b and e.starts_at <= now()
              and x.status in ('approved', 'confirmed', 'attended', 'no_show') and y.status in ('approved', 'confirmed', 'attended', 'no_show'))
      or exists (
           select 1 from public.bookings x join public.events e on e.id = x.event_id
            where ((x.user_id = p_a and e.host_id = p_b) or (x.user_id = p_b and e.host_id = p_a)) and e.starts_at <= now()
              and x.status in ('approved', 'confirmed', 'attended', 'no_show'))
      or exists (
           select 1 from public.squad_members x join public.squad_members y on y.squad_id = x.squad_id
            where x.user_id = p_a and y.user_id = p_b and x.status = 'approved' and y.status = 'approved')
$$;

-- ---------------------------------------------------------------- reporting
-- Putting someone on hold is instant. Guard rails against abuse: 5 reports a day, no self-reports, admins are never held,
-- only active accounts move to on_hold (a suspension or ban is never softened), and the instant hold needs a real connection
-- (shared event or squad) between reporter and subject. Any other report is saved for admins without a hold.
create function private.report(p_type text, p_subject uuid, p_reason text, p_details text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  v_user uuid;
  v_event uuid;
  v_details text := nullif(btrim(p_details), '');
  v_hold boolean := false;
  v_id uuid;
  a record;
begin
  if uid is null then raise exception 'not_signed_in'; end if; -- people on hold can still report
  if p_type not in ('user', 'event', 'squad') then raise exception 'invalid_subject'; end if;
  if p_reason is null or p_reason not in ('harassment', 'unsafe', 'fake_profile', 'inappropriate_content', 'spam', 'other') then
    raise exception 'invalid_reason';
  end if;
  if v_details is not null and char_length(v_details) > 1000 then raise exception 'details_too_long'; end if;

  if p_type = 'user' then
    select id into v_user from public.profiles where id = p_subject and deleted_at is null;
  elsif p_type = 'event' then
    select host_id, id into v_user, v_event from public.events where id = p_subject;
  else
    select creator_id, event_id into v_user, v_event from public.squads where id = p_subject;
  end if;
  if v_user is null then raise exception 'not_found'; end if;
  if v_user = uid then raise exception 'not_allowed'; end if;
  perform private.check_rate_limit(uid, 'report', 5);

  if private.shares_event(uid, v_user)
     and private.is_user_active(v_user)
     and not exists (select 1 from public.user_roles where user_id = v_user and role = 'admin') then
    update public.profile_private set status = 'on_hold' where id = v_user and status = 'active';
    v_hold := found;
  end if;

  insert into public.safety_reports (reporter_id, subject_type, subject_id, subject_user_id, event_id, reason, details, held)
  values (uid, p_type, p_subject, v_user, v_event, p_reason, v_details, v_hold) returning id into v_id;

  perform private.queue_email(uid, 'safety_report_ack', jsonb_build_object('report_id', v_id), 2);
  perform private.notify(uid, 'report_received', 'Thanks for telling us', 'We have your report and the team will look at it.', jsonb_build_object('report_id', v_id));
  for a in select user_id from public.user_roles where role = 'admin' loop
    perform private.queue_email(a.user_id, 'admin_alert', jsonb_build_object('kind', 'safety_report', 'report_id', v_id, 'held', v_hold), 1);
  end loop;
  perform private.notify_admins('safety_report', case when v_hold then 'A report put someone on hold' else 'A new safety report' end,
    p_type || ': ' || p_reason, jsonb_build_object('report_id', v_id, 'held', v_hold));
  if v_hold then
    -- Neutral on purpose: no reporter, no reason.
    perform private.queue_email(v_user, 'account_on_hold', '{}'::jsonb, 1);
    perform private.notify(v_user, 'account_on_hold', 'Your account is on hold', 'We are looking into something. You can appeal from your profile.', '{}'::jsonb);
  end if;
  -- Never say whether anyone was held: the reporter must not learn what their report did.
  return jsonb_build_object('report_id', v_id);
end
$$;

-- ---------------------------------------------------------------- appeals
-- A tip or an account hold can be disputed. Allowed while on hold. Admins answer within 48 hours (due_at).
create function private.create_appeal(p_kind text, p_tip uuid, p_message text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  v_message text := btrim(p_message);
  v_id uuid;
  a record;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if p_kind not in ('tip', 'account_status') then raise exception 'invalid_kind'; end if;
  if v_message is null or char_length(v_message) not between 1 and 1000 then raise exception 'message_invalid'; end if;
  if p_kind = 'tip' then
    if p_tip is null or not exists (select 1 from public.profile_tips where id = p_tip and user_id = uid and status = 'active') then raise exception 'not_found'; end if;
  else
    p_tip := null;
    if private.is_user_active(uid) then raise exception 'not_allowed'; end if; -- nothing to appeal
  end if;
  perform private.check_rate_limit(uid, 'appeal', 3);
  begin
    insert into public.appeals (user_id, kind, tip_id, message) values (uid, p_kind, p_tip, v_message) returning id into v_id;
  exception when unique_violation then
    raise exception 'already_appealed';
  end;
  perform private.notify(uid, 'appeal_received', 'We got your appeal', 'We aim to reply within 48 hours.', jsonb_build_object('appeal_id', v_id));
  for a in select user_id from public.user_roles where role = 'admin' loop
    perform private.queue_email(a.user_id, 'admin_alert', jsonb_build_object('kind', 'appeal', 'appeal_id', v_id), 2);
  end loop;
  perform private.notify_admins('appeal_received', 'A new appeal', p_kind, jsonb_build_object('appeal_id', v_id));
  return v_id;
end
$$;

-- Admin decision. `overturned` removes a tip, or brings an account back to active (and closes the reports that held it).
create function private.resolve_appeal(p_appeal uuid, p_decision text, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  ap public.appeals;
begin
  perform private.require_active(uid);
  if not private.is_admin() then raise exception 'not_allowed'; end if;
  if p_decision not in ('upheld', 'overturned') then raise exception 'invalid_decision'; end if;
  select * into ap from public.appeals where id = p_appeal for update;
  if not found then raise exception 'not_found'; end if;
  if ap.status <> 'open' then raise exception 'already_resolved'; end if;
  update public.appeals set status = p_decision, admin_note = left(nullif(btrim(p_note), ''), 500), resolved_by = uid, resolved_at = now() where id = ap.id;
  if p_decision = 'overturned' then
    if ap.kind = 'tip' then
      update public.profile_tips set status = 'removed' where id = ap.tip_id;
    else
      update public.profile_private set status = 'active' where id = ap.user_id and status <> 'active';
      update public.safety_reports set status = 'dismissed', outcome = 'appeal_overturned', resolved_at = now(), resolved_by = uid
       where subject_user_id = ap.user_id and held and status in ('open', 'reviewing');
    end if;
  end if;
  perform private.notify(ap.user_id, 'appeal_resolved',
    case when p_decision = 'overturned' then 'Your appeal was accepted' else 'We reviewed your appeal' end,
    case when p_decision = 'overturned' then 'Thank you for your patience. Things are back to normal.' else 'We looked carefully and are keeping the decision. Thank you for telling us.' end,
    jsonb_build_object('appeal_id', ap.id, 'decision', p_decision));
end
$$;

-- ---------------------------------------------------------------- "on hold" is blocked everywhere
-- Squads: a held person cannot create a squad, ask to join one or approve requests. Jobs and the service role (no caller) pass.
-- Leaving, disbanding and cancelling stay open on purpose, so a held person can always step back from a plan.
create function private.enforce_active_actor() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is not null and not private.is_user_active(uid) then raise exception 'not_active'; end if;
  return new;
end
$$;
create trigger squads_active_actor before insert on public.squads for each row execute function private.enforce_active_actor();
create trigger squad_members_active_actor before insert or update on public.squad_members
  for each row when (new.status in ('requested', 'approved')) execute function private.enforce_active_actor();

-- The exact address: a held person loses it with their booking access.
create or replace function private.user_has_booking_access(p_user uuid, p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_user_active(p_user)
     and exists (select 1 from public.bookings where user_id = p_user and event_id = p_event and status in ('approved', 'confirmed'))
$$;

-- ---------------------------------------------------------------- wrappers and grants
create function public.report(p_subject_type text, p_subject_id uuid, p_reason text, p_details text default null) returns jsonb
language sql set search_path = '' as $$ select private.report(p_subject_type, p_subject_id, p_reason, p_details) $$;
create function public.create_appeal(p_kind text, p_tip_id uuid default null, p_message text default null) returns uuid
language sql set search_path = '' as $$ select private.create_appeal(p_kind, p_tip_id, p_message) $$;
create function public.resolve_appeal(p_appeal uuid, p_decision text, p_note text default null) returns void
language sql set search_path = '' as $$ select private.resolve_appeal(p_appeal, p_decision, p_note) $$;

revoke all on function
  private.shares_event(uuid, uuid), private.report(text, uuid, text, text), private.create_appeal(text, uuid, text),
  private.resolve_appeal(uuid, text, text), private.enforce_active_actor()
  from public;
grant execute on function private.report(text, uuid, text, text), private.create_appeal(text, uuid, text), private.resolve_appeal(uuid, text, text) to authenticated;
revoke all on function public.report(text, uuid, text, text), public.create_appeal(text, uuid, text), public.resolve_appeal(uuid, text, text) from public, anon;
grant execute on function public.report(text, uuid, text, text), public.create_appeal(text, uuid, text), public.resolve_appeal(uuid, text, text) to authenticated;

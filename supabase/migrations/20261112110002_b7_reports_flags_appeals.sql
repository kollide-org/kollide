-- B7.2 Admin queues: reports, review flags and appeals. Functions only: the browser reads none of these tables directly.
-- Nothing here shows who wrote private feedback.

-- ---------------------------------------------------------------- columns and audit triggers
alter table public.review_flags add column resolution_note text check (char_length(resolution_note) <= 500);

-- Admin decisions on flags and reports, and changes to hub contents, were not audited before.
create trigger audit_review_flags after update of status, resolution_note on public.review_flags
  for each row execute function private.audit_change('kind', 'subject_user_id', 'event_id', 'status', 'resolved_by');
create trigger audit_hub_events after insert or delete on public.hub_events
  for each row execute function private.audit_change('hub_id', 'event_id');

drop trigger audit_safety_reports on public.safety_reports;
create trigger audit_safety_reports after insert or update of status, held, outcome, action_taken, reviewed_by or delete on public.safety_reports
  for each row execute function private.audit_change('reporter_id', 'subject_type', 'subject_id', 'subject_user_id', 'reason', 'status', 'held',
                                                    'action_taken', 'reviewed_by'); -- never the details or the notes

-- ---------------------------------------------------------------- private feedback, without authors
-- The only way an admin reads private feedback: the person it is about, the issue, the note and the month. Never who wrote it,
-- never which event, so a small event cannot point to one person.
create function private.private_feedback_for_admin(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('issue_code', f.issue_code, 'note', f.note, 'month', to_char(f.created_at, 'YYYY-MM'))
                            order by f.created_at desc), '[]'::jsonb)
    from public.private_feedback f where f.about_user = p_user
$$;

-- ---------------------------------------------------------------- reports
create function private.admin_list_reports(p_status text, p_limit integer, p_offset integer)
returns table (id uuid, subject_type text, subject_id uuid, subject_user_id uuid, subject_first_name text, subject_status public.user_status,
               reporter_first_name text, reason text, status public.report_status, held boolean, action_taken text, created_at timestamptz,
               reviewer_first_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query
    select r.id, r.subject_type, r.subject_id, r.subject_user_id, sp.first_name, spp.status, rp.first_name, r.reason, r.status, r.held, r.action_taken,
           r.created_at, vp.first_name
      from public.safety_reports r
      join public.profiles sp on sp.id = r.subject_user_id
      join public.profile_private spp on spp.id = r.subject_user_id
      left join public.profiles rp on rp.id = r.reporter_id
      left join public.profiles vp on vp.id = r.reviewed_by
     where case when p_status is null then true
                when p_status = 'pending' then r.status in ('open', 'reviewing')
                else r.status::text = p_status end
     -- waiting reports: oldest first (and held ones first); decided reports: newest first
     order by case when p_status = 'pending' and r.held then 0 else 1 end,
              case when p_status = 'pending' then extract(epoch from r.created_at) else -extract(epoch from r.created_at) end
     limit least(greatest(coalesce(p_limit, 25), 1), 100) offset greatest(coalesce(p_offset, 0), 0);
end
$$;

create function private.admin_get_report(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  r public.safety_reports;
  v jsonb;
begin
  perform private.require_admin();
  select * into r from public.safety_reports where id = p_id;
  if not found then raise exception 'not_found'; end if;
  select jsonb_build_object(
    'id', r.id, 'subject_type', r.subject_type, 'subject_id', r.subject_id, 'reason', r.reason, 'details', r.details, 'status', r.status,
    'held', r.held, 'action_taken', r.action_taken, 'admin_note', r.admin_note, 'user_note', r.user_note,
    'created_at', r.created_at, 'reviewing_at', r.reviewing_at, 'resolved_at', r.resolved_at,
    'reviewer_first_name', (select first_name from public.profiles where id = r.reviewed_by),
    'reporter', (select jsonb_build_object('id', p.id, 'first_name', p.first_name, 'is_verified', p.is_verified) from public.profiles p where p.id = r.reporter_id),
    'subject_label', case r.subject_type
                       when 'event' then (select title from public.events where id = r.subject_id)
                       when 'squad' then (select coalesce(name, 'Squad') from public.squads where id = r.subject_id)
                       else null end,
    'event_id', r.event_id,
    'subject', jsonb_build_object('id', sp.id, 'first_name', sp.first_name, 'status', spp.status, 'is_verified', sp.is_verified,
                'created_at', sp.created_at, 'roles', coalesce((select jsonb_agg(ur.role) from public.user_roles ur where ur.user_id = sp.id), '[]'::jsonb),
                'shows_up_attended', coalesce(rep.shows_up_attended, 0), 'shows_up_total', coalesce(rep.shows_up_total, 0)),
    'other_reports', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'reason', o.reason, 'status', o.status, 'held', o.held, 'created_at', o.created_at)
                                                  order by o.created_at desc)
                                 from public.safety_reports o where o.subject_user_id = r.subject_user_id and o.id <> r.id), '[]'::jsonb),
    'flags', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'kind', f.kind, 'status', f.status, 'created_at', f.created_at) order by f.created_at desc)
                         from public.review_flags f where f.subject_user_id = r.subject_user_id), '[]'::jsonb),
    'private_feedback', private.private_feedback_for_admin(r.subject_user_id),
    'moderation', coalesce((select jsonb_agg(jsonb_build_object('action', m.action, 'reason', m.reason, 'created_at', m.created_at) order by m.created_at desc)
                              from public.moderation_actions m where m.user_id = r.subject_user_id), '[]'::jsonb)
  ) into v
  from public.profiles sp join public.profile_private spp on spp.id = sp.id left join private.user_reputation rep on rep.user_id = sp.id
  where sp.id = r.subject_user_id;
  return v;
end
$$;

create function private.admin_start_review(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_admin();
begin
  update public.safety_reports set status = 'reviewing', reviewed_by = uid, reviewing_at = now() where id = p_id and status in ('open', 'reviewing');
  if not found then
    if exists (select 1 from public.safety_reports where id = p_id) then raise exception 'already_resolved'; end if;
    raise exception 'not_found';
  end if;
end
$$;

-- Lifts a hold and records it, with or without telling the person.
create function private.release_hold(p_admin uuid, p_user uuid, p_reason text, p_report uuid, p_tell boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.profile_private set status = 'active' where id = p_user and status = 'on_hold';
  if not found then return; end if;
  insert into public.moderation_actions (user_id, admin_id, action, reason, report_id) values (p_user, p_admin, 'reactivate', p_reason, p_report);
  if p_tell then
    perform private.notify(p_user, 'moderation_reactivate', 'Your account is active again', 'Thank you for your patience.', '{}'::jsonb);
    perform private.queue_email(p_user, 'moderation_notice', jsonb_build_object('action', 'reactivate', 'note', null), 1);
  end if;
end
$$;

-- Outcomes: dismiss (nothing found), warn (a formal warning), suspend, ban. Dismissing or warning lifts a hold,
-- unless another report about the same person is still waiting. Suspend and ban go through the moderation core.
create function private.admin_resolve_report(p_id uuid, p_action text, p_internal_note text, p_user_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_admin();
  r public.safety_reports;
  v_note text := nullif(btrim(p_internal_note), '');
  v_other_hold boolean;
begin
  if p_action not in ('dismiss', 'warn', 'suspend', 'ban') then raise exception 'invalid_action'; end if;
  if v_note is not null and char_length(v_note) > 1000 then raise exception 'note_too_long'; end if;
  if p_action <> 'dismiss' and (v_note is null or char_length(v_note) < 3) then raise exception 'reason_required'; end if;
  select * into r from public.safety_reports where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if r.status in ('resolved', 'dismissed') then raise exception 'already_resolved'; end if;

  -- A hold is a safety measure while reports are looked at: it only lifts once no other report about the same person is still waiting.
  v_other_hold := exists (select 1 from public.safety_reports o where o.subject_user_id = r.subject_user_id and o.id <> r.id and o.status in ('open', 'reviewing'));

  if p_action in ('suspend', 'ban', 'warn') then
    perform private.apply_user_status(uid, r.subject_user_id, p_action, v_note, p_user_note, r.id);
  end if;
  if p_action in ('dismiss', 'warn') and not v_other_hold then
    perform private.release_hold(uid, r.subject_user_id, coalesce(v_note, 'Report ' || case p_action when 'dismiss' then 'dismissed' else 'resolved with a warning' end),
                                 r.id, p_action = 'dismiss');
  end if;

  update public.safety_reports
     set status = case when p_action = 'dismiss' then 'dismissed' else 'resolved' end::public.report_status,
         action_taken = p_action, admin_note = v_note, user_note = nullif(btrim(p_user_note), ''), outcome = p_action,
         reviewed_by = coalesce(reviewed_by, uid), resolved_at = now(), resolved_by = uid
   where id = r.id;

  -- The reporter is told only that it was looked at, never what was decided.
  if r.reporter_id is not null then
    perform private.notify(r.reporter_id, 'report_reviewed', 'We reviewed your report', 'Thank you for telling us. We cannot share what we decided, to protect everyone''s privacy.',
      jsonb_build_object('report_id', r.id));
  end if;
end
$$;

create function private.admin_lift_hold(p_user uuid, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.apply_user_status(private.require_admin(), p_user, 'reactivate', p_note, null, null);
end
$$;

-- ---------------------------------------------------------------- flags
create function private.admin_list_flags(p_status text, p_limit integer, p_offset integer)
returns table (id uuid, kind text, status text, subject_user_id uuid, subject_first_name text, event_id uuid, event_title text, details jsonb,
               created_at timestamptz, resolved_at timestamptz, resolution_note text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query
    -- details never carry a reviewer: older retaliation flags did, so the key is stripped here as well
    select f.id, f.kind, f.status, f.subject_user_id, sp.first_name, f.event_id, e.title, f.details - 'reviewer_id', f.created_at, f.resolved_at, f.resolution_note
      from public.review_flags f
      left join public.profiles sp on sp.id = f.subject_user_id
      left join public.events e on e.id = f.event_id
     where p_status is null or f.status = p_status
     order by case when f.status = 'open' then 0 else 1 end, f.created_at desc
     limit least(greatest(coalesce(p_limit, 25), 1), 100) offset greatest(coalesce(p_offset, 0), 0);
end
$$;

create function private.admin_resolve_flag(p_id uuid, p_status text, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_admin();
begin
  if p_status not in ('reviewed', 'dismissed') then raise exception 'invalid_decision'; end if;
  if char_length(coalesce(p_note, '')) > 500 then raise exception 'note_too_long'; end if;
  update public.review_flags set status = p_status, resolution_note = nullif(btrim(p_note), ''), resolved_at = now(), resolved_by = uid
   where id = p_id and status = 'open';
  if not found then
    if exists (select 1 from public.review_flags where id = p_id) then raise exception 'already_resolved'; end if;
    raise exception 'not_found';
  end if;
end
$$;

-- ---------------------------------------------------------------- appeals
create function private.admin_list_appeals(p_status text, p_limit integer, p_offset integer)
returns table (id uuid, user_id uuid, first_name text, user_status public.user_status, kind text, tip_message text, message text, status text,
               due_at timestamptz, overdue boolean, admin_note text, created_at timestamptz, resolved_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query
    select a.id, a.user_id, p.first_name, pp.status, a.kind, t.message, a.message, a.status, a.due_at, a.status = 'open' and a.due_at < now(),
           a.admin_note, a.created_at, a.resolved_at
      from public.appeals a
      join public.profiles p on p.id = a.user_id
      join public.profile_private pp on pp.id = a.user_id
      left join public.profile_tips t on t.id = a.tip_id
     where p_status is null or a.status = p_status
     order by case when a.status = 'open' then 0 else 1 end, case when a.status = 'open' then extract(epoch from a.due_at) else -extract(epoch from a.created_at) end
     limit least(greatest(coalesce(p_limit, 25), 1), 100) offset greatest(coalesce(p_offset, 0), 0);
end
$$;

-- ---------------------------------------------------------------- wrappers and grants
create function public.admin_list_reports(p_status text default 'pending', p_limit integer default 25, p_offset integer default 0)
returns table (id uuid, subject_type text, subject_id uuid, subject_user_id uuid, subject_first_name text, subject_status public.user_status,
               reporter_first_name text, reason text, status public.report_status, held boolean, action_taken text, created_at timestamptz,
               reviewer_first_name text)
language sql stable set search_path = '' as $$ select * from private.admin_list_reports(p_status, p_limit, p_offset) $$;
create function public.admin_get_report(p_id uuid) returns jsonb language sql stable set search_path = '' as $$ select private.admin_get_report(p_id) $$;
create function public.admin_start_review(p_id uuid) returns void language sql set search_path = '' as $$ select private.admin_start_review(p_id) $$;
create function public.admin_resolve_report(p_id uuid, p_action text, p_internal_note text default null, p_user_note text default null) returns void
language sql set search_path = '' as $$ select private.admin_resolve_report(p_id, p_action, p_internal_note, p_user_note) $$;
create function public.admin_lift_hold(p_user uuid, p_note text) returns void language sql set search_path = '' as $$ select private.admin_lift_hold(p_user, p_note) $$;
create function public.admin_list_flags(p_status text default 'open', p_limit integer default 25, p_offset integer default 0)
returns table (id uuid, kind text, status text, subject_user_id uuid, subject_first_name text, event_id uuid, event_title text, details jsonb,
               created_at timestamptz, resolved_at timestamptz, resolution_note text)
language sql stable set search_path = '' as $$ select * from private.admin_list_flags(p_status, p_limit, p_offset) $$;
create function public.admin_resolve_flag(p_id uuid, p_status text, p_note text default null) returns void
language sql set search_path = '' as $$ select private.admin_resolve_flag(p_id, p_status, p_note) $$;
create function public.admin_list_appeals(p_status text default 'open', p_limit integer default 25, p_offset integer default 0)
returns table (id uuid, user_id uuid, first_name text, user_status public.user_status, kind text, tip_message text, message text, status text,
               due_at timestamptz, overdue boolean, admin_note text, created_at timestamptz, resolved_at timestamptz)
language sql stable set search_path = '' as $$ select * from private.admin_list_appeals(p_status, p_limit, p_offset) $$;

revoke all on function
  private.private_feedback_for_admin(uuid), private.release_hold(uuid, uuid, text, uuid, boolean),
  private.admin_list_reports(text, integer, integer), private.admin_get_report(uuid), private.admin_start_review(uuid),
  private.admin_resolve_report(uuid, text, text, text), private.admin_lift_hold(uuid, text),
  private.admin_list_flags(text, integer, integer), private.admin_resolve_flag(uuid, text, text), private.admin_list_appeals(text, integer, integer)
  from public;
grant execute on function
  private.admin_list_reports(text, integer, integer), private.admin_get_report(uuid), private.admin_start_review(uuid),
  private.admin_resolve_report(uuid, text, text, text), private.admin_lift_hold(uuid, text),
  private.admin_list_flags(text, integer, integer), private.admin_resolve_flag(uuid, text, text), private.admin_list_appeals(text, integer, integer)
  to authenticated;
revoke all on function
  public.admin_list_reports(text, integer, integer), public.admin_get_report(uuid), public.admin_start_review(uuid),
  public.admin_resolve_report(uuid, text, text, text), public.admin_lift_hold(uuid, text),
  public.admin_list_flags(text, integer, integer), public.admin_resolve_flag(uuid, text, text), public.admin_list_appeals(text, integer, integer)
  from public, anon;
grant execute on function
  public.admin_list_reports(text, integer, integer), public.admin_get_report(uuid), public.admin_start_review(uuid),
  public.admin_resolve_report(uuid, text, text, text), public.admin_lift_hold(uuid, text),
  public.admin_list_flags(text, integer, integer), public.admin_resolve_flag(uuid, text, text), public.admin_list_appeals(text, integer, integer)
  to authenticated;

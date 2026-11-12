-- B7.3 Privacy fixes and the audit log viewer.
-- 1. Admins must never see who wrote private feedback: they read notes only through private.private_feedback_for_admin
--    (no author, no event), the audit trigger stops recording the author, and retaliation flags stop naming the reviewer.
-- 2. The audit log is read through admin_audit_log (masked, filtered, paged). Nobody reads the table directly any more.

-- ---------------------------------------------------------------- private feedback: only the author reads it
drop policy private_feedback_read on public.private_feedback;
create policy private_feedback_read on public.private_feedback for select to authenticated using (from_user = (select auth.uid()));

drop trigger audit_private_feedback on public.private_feedback;
create trigger audit_private_feedback after insert or delete on public.private_feedback
  for each row execute function private.audit_change('event_id', 'about_user', 'issue_code'); -- not the author, never the note

-- Retaliation flags no longer carry the reviewer (older rows are scrubbed too). Flags still say THAT feedback may be retaliation.
update public.review_flags set details = details - 'reviewer_id' where details ? 'reviewer_id';

create or replace function private.job_reputation_nightly() returns void
language plpgsql security definer set search_path = '' as $$
declare
  prm jsonb := private.reputation_params();
  c record;
  v_id uuid;
  tips_new integer := 0;
  tips_expired integer := 0;
  flags_new integer := 0;
begin
  begin
    -- Tips: create the ones that now qualify, expire the ones whose evidence has aged out or fallen below the bar.
    for c in select * from private.tip_candidates() t
              where not exists (select 1 from public.profile_tips x where x.user_id = t.subject_id and x.issue_code = t.issue and x.status = 'active')
                and exists (select 1 from public.profiles p where p.id = t.subject_id and p.deleted_at is null) loop
      insert into public.profile_tips (user_id, issue_code, message) values (c.subject_id, c.issue, private.tip_message(c.issue)) returning id into v_id;
      perform private.notify(c.subject_id, 'tip', 'A gentle note from the community', 'You can read it on your profile.', jsonb_build_object('tip_id', v_id));
      tips_new := tips_new + 1;
    end loop;
    update public.profile_tips t set status = 'expired'
     where t.status = 'active'
       and not exists (select 1 from private.tip_candidates() k where k.subject_id = t.user_id and k.issue = t.issue_code);
    get diagnostics tips_expired = row_count;

    -- Retaliation: feedback from someone the subject reported is flagged for admins. The flag never names the reviewer.
    insert into public.review_flags (kind, subject_user_id, event_id, ref_key, details)
      select 'retaliation', f.about_user, f.event_id, f.id::text, '{}'::jsonb
        from public.private_feedback f
       where f.from_user is not null and f.created_at >= now() - interval '90 days'
         and private.is_retaliation(f.from_user, f.about_user, f.event_id)
    on conflict (kind, ref_key) do nothing;
    get diagnostics flags_new = row_count;

    -- Collusion: someone whose revealed tags nearly all come from the same two or three people, across several events.
    with per_giver as (
      select t.to_user, t.from_user, count(*) as n
        from public.tag_awards t join public.events e on e.id = t.event_id
       where t.revealed_at is not null and e.ends_at >= now() - interval '12 months'
       group by t.to_user, t.from_user
    ), ranked as (
      select to_user, n, row_number() over (partition by to_user order by n desc) as rn from per_giver
    ), shares as (
      select to_user, sum(n) as total, sum(n) filter (where rn <= (prm ->> 'collusion_max_givers')::integer) as top_n from ranked group by to_user
    ), spread as (
      select t.to_user, count(distinct t.event_id) as events
        from public.tag_awards t join public.events e on e.id = t.event_id
       where t.revealed_at is not null and e.ends_at >= now() - interval '12 months' group by t.to_user
    )
    insert into public.review_flags (kind, subject_user_id, ref_key, details)
      select 'collusion', s.to_user, s.to_user::text, jsonb_build_object('tags', s.total, 'events', p.events, 'share_from_top_givers', round(s.top_n::numeric / s.total, 2))
        from shares s join spread p on p.to_user = s.to_user
       where s.total >= (prm ->> 'collusion_min_tags')::integer and p.events >= (prm ->> 'collusion_min_events')::integer
         and s.top_n::numeric / s.total >= (prm ->> 'collusion_share')::numeric
    on conflict (kind, ref_key) do nothing;

    -- Host scores: low averages are flagged once a month. Hosting rights are never removed automatically in v1.
    insert into public.review_flags (kind, subject_user_id, ref_key, details)
      select 'low_host_score', h.host_id, h.host_id::text || ':' || to_char(now(), 'YYYY-MM'),
             jsonb_build_object('overall', h.overall, 'ratings', h.ratings, 'felt_safe', h.felt_safe)
        from private.host_scores h
       where h.ratings >= (prm ->> 'host_score_min_ratings')::integer and h.overall < (prm ->> 'host_score_min')::numeric
    on conflict (kind, ref_key) do nothing;

    perform private.record_job_run('reputation-nightly', 'ok',
      jsonb_build_object('tips_created', tips_new, 'tips_expired', tips_expired, 'retaliation_flags', flags_new), null);
  exception when others then
    perform private.record_job_run('reputation-nightly', 'error', null, sqlerrm);
  end;
end
$$;

-- ---------------------------------------------------------------- the audit log, read through one masked function
drop policy audit_log_admin_read on public.audit_log;
revoke select on public.audit_log from authenticated;
create policy audit_log_closed on public.audit_log for all to anon, authenticated using (false) with check (false);

-- Newest first, keyset paging (p_before = the id of the last row you already have). Filters are all optional.
-- Rows about private feedback are special: the actor of such a row IS the author, so they never show an actor, the actor filter
-- skips them, and they carry no author, note or event (only the issue and the person it is about).
create function private.admin_audit_log(p_actor uuid, p_action text, p_table text, p_from timestamptz, p_to timestamptz, p_limit integer, p_before bigint)
returns table (id bigint, at timestamptz, actor_id uuid, actor_first_name text, action text, table_name text, row_pk text, old_data jsonb, new_data jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query
    select l.id, l.at,
           case when l.table_name = 'private_feedback' then null else l.actor_id end,
           case when l.table_name = 'private_feedback' then null else p.first_name end,
           l.action, l.table_name, l.row_pk,
           case when l.table_name = 'private_feedback' then l.old_data - 'from_user' - 'note' - 'event_id' else l.old_data end,
           case when l.table_name = 'private_feedback' then l.new_data - 'from_user' - 'note' - 'event_id' else l.new_data end
      from public.audit_log l left join public.profiles p on p.id = l.actor_id
     where (p_actor is null or (l.table_name <> 'private_feedback' and l.actor_id = p_actor))
       and (p_action is null or l.action = p_action)
       and (p_table is null or l.table_name = p_table)
       and (p_from is null or l.at >= p_from)
       and (p_to is null or l.at < p_to)
       and (p_before is null or l.id < p_before)
     order by l.id desc
     limit least(greatest(coalesce(p_limit, 50), 1), 200);
end
$$;

create function private.admin_audit_tables() returns text[]
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return coalesce((select array_agg(distinct l.table_name order by l.table_name) from public.audit_log l), '{}'::text[]);
end
$$;

create function public.admin_audit_log(p_actor uuid default null, p_action text default null, p_table text default null,
  p_from timestamptz default null, p_to timestamptz default null, p_limit integer default 50, p_before bigint default null)
returns table (id bigint, at timestamptz, actor_id uuid, actor_first_name text, action text, table_name text, row_pk text, old_data jsonb, new_data jsonb)
language sql stable set search_path = '' as $$ select * from private.admin_audit_log(p_actor, p_action, p_table, p_from, p_to, p_limit, p_before) $$;
create function public.admin_audit_tables() returns text[] language sql stable set search_path = '' as $$ select private.admin_audit_tables() $$;

revoke all on function private.admin_audit_log(uuid, text, text, timestamptz, timestamptz, integer, bigint), private.admin_audit_tables() from public;
grant execute on function private.admin_audit_log(uuid, text, text, timestamptz, timestamptz, integer, bigint), private.admin_audit_tables() to authenticated;
revoke all on function public.admin_audit_log(uuid, text, text, timestamptz, timestamptz, integer, bigint), public.admin_audit_tables() from public, anon;
grant execute on function public.admin_audit_log(uuid, text, text, timestamptz, timestamptz, integer, bigint), public.admin_audit_tables() to authenticated;

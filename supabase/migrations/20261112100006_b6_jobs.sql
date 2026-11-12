-- B6.6 Scheduled jobs for the after-event loop. Every job records itself in job_runs, even when it fails.
--   attendance        every 30 min  count attendance 2 hours after an event ends, open the feedback window
--   reputation        every 15 min  refresh user_reputation
--   feedback-windows  hourly        reveal tags of closed windows, alert admins to overdue appeals
--   reputation-nightly nightly      tips, retaliation and collusion flags, host score check

-- ---------------------------------------------------------------- wording of tips (fixed, gentle, anonymous)
-- Notes and names are never copied into a tip.
create function private.tip_message(p_issue text) returns text
language sql immutable set search_path = '' as $$
  select case p_issue
    when 'made_uncomfortable' then 'A few people mentioned they did not feel fully comfortable. A little extra attention to how others are feeling can go a long way.'
    when 'disrespectful' then 'A few people felt they were not heard or respected. Giving everyone room to talk can help.'
    when 'unsafe' then 'A few people said they did not feel safe. Please be mindful of other people''s boundaries and personal space.'
    when 'not_as_described' then 'A few people felt things were not quite as described. Clear expectations help everyone enjoy the day.'
    when 'harassment' then 'A few people said some interactions were not welcome. Please take care to respect boundaries.'
    else 'A few people shared some gentle feedback they hope will help. Thank you for being part of Kollide.'
  end
$$;

-- Did the subject report the reviewer? Then the reviewer's feedback may be retaliation and counts for much less.
-- Only a report counts: a private note is invisible and holds nobody, so it must not be a free way to discount complaints.
create function private.is_retaliation(p_reviewer uuid, p_subject uuid, p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.safety_reports sr where sr.reporter_id = p_subject and sr.subject_user_id = p_reviewer)
$$;

-- Who has enough private feedback for a tip right now?
--   floor: at least `tip_min_reviewers` different people across `tip_min_events` different events (last 12 months), AND
--   enough weighted evidence. Weights: reviewer (verified, long-standing and reliable count more) x recency (recent counts
--   most) x retaliation (discounted). A tip the admin removed after an appeal needs new feedback to come back.
create function private.tip_candidates()
returns table (subject_id uuid, issue text, n_reviewers integer, n_events integer, total_weight numeric)
language sql stable security definer set search_path = '' as $$
  with prm as (select private.reputation_params() as p),
  fb as (
    select f.about_user, f.issue_code, f.event_id, f.from_user,
           (1.0 + case when pr.is_verified then 0.25 else 0 end
                + case when pr.created_at <= now() - interval '90 days' then 0.25 else 0 end
                + case when coalesce(r.events_attended, 0) >= 3 and r.shows_up_total > 0
                            and r.shows_up_attended::numeric / r.shows_up_total >= 0.8 then 0.25 else 0 end)
           * case when f.created_at >= now() - interval '90 days' then 1.0 when f.created_at >= now() - interval '180 days' then 0.75 else 0.5 end
           * case when private.is_retaliation(f.from_user, f.about_user, f.event_id) then (select (p ->> 'retaliation_factor')::numeric from prm) else 1.0 end as w
      from public.private_feedback f
      join public.profiles pr on pr.id = f.from_user
      left join private.user_reputation r on r.user_id = f.from_user
     where f.from_user is not null
       and f.created_at >= now() - interval '12 months'
       and f.created_at > coalesce((select max(t.updated_at) from public.profile_tips t
                                     where t.user_id = f.about_user and t.issue_code = f.issue_code and t.status = 'removed'), '-infinity')
  )
  select fb.about_user, fb.issue_code, count(distinct fb.from_user)::integer, count(distinct fb.event_id)::integer, round(sum(fb.w), 2)
    from fb
   group by fb.about_user, fb.issue_code
  having count(distinct fb.from_user) >= (select (p ->> 'tip_min_reviewers')::integer from prm)
     and count(distinct fb.event_id) >= (select (p ->> 'tip_min_events')::integer from prm)
     and sum(fb.w) >= (select (p ->> 'tip_min_weight')::numeric from prm)
$$;

-- ---------------------------------------------------------------- jobs
create function private.job_finalise_attendance() returns void
language plpgsql security definer set search_path = '' as $$
declare
  ev uuid;
  r text;
  done integer := 0;
  flagged integer := 0;
begin
  begin
    for ev in
      select id from public.events
       where attendance_finalised_at is null and status in ('published', 'completed')
         and ends_at + interval '2 hours' <= now() and ends_at > now() - interval '30 days'
    loop
      r := private.finalise_event(ev);
      if r = 'finalised' then done := done + 1; elsif r = 'no_checkins' then flagged := flagged + 1; end if;
    end loop;
    if done > 0 then perform private.refresh_reputation(); end if;
    perform private.record_job_run('attendance', 'ok', jsonb_build_object('events_finalised', done, 'events_without_checkins', flagged), null);
  exception when others then
    perform private.record_job_run('attendance', 'error', null, sqlerrm);
  end;
end
$$;

create function private.job_refresh_reputation() returns void
language plpgsql security definer set search_path = '' as $$
begin
  begin
    perform private.refresh_reputation();
    perform private.record_job_run('reputation', 'ok', null, null);
  exception when others then
    perform private.record_job_run('reputation', 'error', null, sqlerrm);
  end;
end
$$;

create function private.job_feedback_windows() returns void
language plpgsql security definer set search_path = '' as $$
declare
  revealed integer;
  ap record;
  alerted integer := 0;
  a record;
begin
  begin
    revealed := private.reveal_closed_tags();
    -- Appeals have a 48-hour target. One alert per late appeal.
    for ap in select id from public.appeals where status = 'open' and due_at < now() and overdue_alerted_at is null for update loop
      update public.appeals set overdue_alerted_at = now() where id = ap.id;
      for a in select user_id from public.user_roles where role = 'admin' loop
        perform private.queue_email(a.user_id, 'admin_alert', jsonb_build_object('kind', 'appeal_overdue', 'appeal_id', ap.id), 1);
      end loop;
      perform private.notify_admins('appeal_overdue', 'An appeal is past its 48 hours', 'Please answer it as soon as you can.', jsonb_build_object('appeal_id', ap.id));
      alerted := alerted + 1;
    end loop;
    perform private.record_job_run('feedback-windows', 'ok', jsonb_build_object('tags_revealed', revealed, 'overdue_appeals', alerted), null);
  exception when others then
    perform private.record_job_run('feedback-windows', 'error', null, sqlerrm);
  end;
end
$$;

create function private.job_reputation_nightly() returns void
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

    -- Retaliation: feedback from someone the subject reported is flagged for admins.
    insert into public.review_flags (kind, subject_user_id, event_id, ref_key, details)
      select 'retaliation', f.about_user, f.event_id, f.id::text, jsonb_build_object('reviewer_id', f.from_user)
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

-- ---------------------------------------------------------------- on demand (admins): finish an event now
-- Mirrors "send the Still coming? email now". Skips only the 2-hour wait; the event must have ended. With p_mark_no_shows
-- an admin can also close an event nobody was checked in at (otherwise nobody is marked no_show).
create function private.admin_finalise_event_now(p_event uuid, p_mark_no_shows boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare
  r text;
begin
  perform private.require_active((select auth.uid()));
  if not private.is_admin() then raise exception 'not_allowed'; end if;
  r := private.finalise_event(p_event, true, p_mark_no_shows);
  perform private.reveal_closed_tags();
  perform private.refresh_reputation();
  return r;
end
$$;
create function public.admin_finalise_event_now(p_event uuid, p_mark_no_shows boolean default false) returns text
language sql set search_path = '' as $$ select private.admin_finalise_event_now(p_event, p_mark_no_shows) $$;

-- ---------------------------------------------------------------- grants and schedules
revoke all on function
  private.tip_message(text), private.is_retaliation(uuid, uuid, uuid), private.tip_candidates(), private.job_finalise_attendance(),
  private.job_refresh_reputation(), private.job_feedback_windows(), private.job_reputation_nightly(), private.admin_finalise_event_now(uuid, boolean)
  from public;
grant execute on function
  private.job_finalise_attendance(), private.job_refresh_reputation(), private.job_feedback_windows(), private.job_reputation_nightly(),
  private.tip_candidates()
  to service_role;
grant execute on function private.admin_finalise_event_now(uuid, boolean) to authenticated;
revoke all on function public.admin_finalise_event_now(uuid, boolean) from public, anon;
grant execute on function public.admin_finalise_event_now(uuid, boolean) to authenticated;

select cron.schedule('attendance', '*/30 * * * *', 'select private.job_finalise_attendance()');
select cron.schedule('reputation', '*/15 * * * *', 'select private.job_refresh_reputation()');
select cron.schedule('feedback-windows', '5 * * * *', 'select private.job_feedback_windows()');
select cron.schedule('reputation-nightly', '30 21 * * *', 'select private.job_reputation_nightly()'); -- 03:00 India time

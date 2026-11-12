-- B6.3 Reputation: events attended, "Shows up X of Y" (last 12 months), top 3 tags, and "New to Kollide".
-- Everything is calculated from source rows (bookings, tag_awards), never stored as an editable number. The materialised view
-- lives in the `private` schema (not exposed through the API, so Supabase's advisors stay quiet) and is read through
-- profile_cards and host_inbox. pg_cron refreshes it every 15 minutes (B6.6).

-- Tuning numbers for reputation, in one place. Deliberately NOT in app_config, which anyone can read.
create function private.reputation_params() returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'tip_min_reviewers', 3,        -- a tip needs this many different people...
    'tip_min_events', 2,           -- ...across this many different events
    'tip_min_weight', 2.5,         -- and this much weighted evidence
    'retaliation_factor', 0.25,    -- feedback from someone the subject reported counts for a quarter
    'host_score_min', 3.5,         -- hosts averaging below this are flagged for admins
    'host_score_min_ratings', 5,
    'collusion_min_tags', 5, 'collusion_min_events', 3, 'collusion_share', 0.8, 'collusion_max_givers', 3
  )
$$;
revoke all on function private.reputation_params() from public;
grant execute on function private.reputation_params() to service_role;

-- ---------------------------------------------------------------- the materialised view
create materialized view private.user_reputation as
with seats as (
  select b.user_id,
         count(*) filter (where b.status = 'attended') as events_attended,
         count(*) filter (where b.status = 'attended' and e.ends_at >= now() - interval '12 months') as shows_up_attended,
         count(*) filter (where e.ends_at >= now() - interval '12 months') as shows_up_total
    from public.bookings b join public.events e on e.id = b.event_id
   where b.status in ('attended', 'no_show')
   group by b.user_id
), hosted as (
  select host_id as user_id, count(*) as events_hosted
    from public.events where attendance_finalised_at is not null and status = 'completed'
   group by host_id
), tag_counts as (
  select t.to_user as user_id, pt.slug, pt.label, pt.sort_order, count(*) as n
    from public.tag_awards t
    join public.events e on e.id = t.event_id
    cross join lateral unnest(t.tag_ids) as x (tag_id)
    join public.positive_tags pt on pt.id = x.tag_id
   where t.revealed_at is not null and e.ends_at >= now() - interval '12 months'
   group by t.to_user, pt.slug, pt.label, pt.sort_order
), ranked as (
  select user_id, slug, label, n, row_number() over (partition by user_id order by n desc, sort_order, slug) as rn from tag_counts
), top as (
  select user_id, jsonb_agg(jsonb_build_object('slug', slug, 'label', label, 'count', n) order by rn) as top_tags
    from ranked where rn <= 3 group by user_id
)
select u.user_id,
       coalesce(s.events_attended, 0)::integer as events_attended,
       coalesce(s.shows_up_attended, 0)::integer as shows_up_attended,
       coalesce(s.shows_up_total, 0)::integer as shows_up_total,
       coalesce(h.events_hosted, 0)::integer as events_hosted,
       coalesce(t.top_tags, '[]'::jsonb) as top_tags
  from (select user_id from seats union select user_id from hosted union select user_id from top) u
  left join seats s on s.user_id = u.user_id
  left join hosted h on h.user_id = u.user_id
  left join top t on t.user_id = u.user_id;
create unique index user_reputation_user_idx on private.user_reputation (user_id);

revoke all on private.user_reputation from public, anon;
-- profile_cards is a security_invoker view, so signed-in callers need to read it. The private schema is not in the API.
grant select on private.user_reputation to authenticated, service_role;

create function private.refresh_reputation() returns void
language plpgsql security definer set search_path = '' as $$
begin
  refresh materialized view concurrently private.user_reputation;
end
$$;
revoke all on function private.refresh_reputation() from public;
grant execute on function private.refresh_reputation() to service_role;

-- ---------------------------------------------------------------- the profile card gets reputation (new columns go last)
create or replace view public.profile_cards with (security_invoker = true) as
select
  p.id,
  p.first_name,
  p.area_id,
  p.bio_prompts,
  p.is_verified,
  p.created_at,
  private.age_of(p.id) as age,
  (select coalesce(array_agg(pi.interest_id order by pi.interest_id), '{}'::smallint[])
     from public.profile_interests pi where pi.user_id = p.id) as interest_ids,
  (select coalesce(array_agg(pl.language_id order by pl.language_id), '{}'::smallint[])
     from public.profile_languages pl where pl.user_id = p.id) as language_ids,
  (select coalesce(array_agg(ph.r2_key order by ph.position), '{}'::text[])
     from public.profile_photos ph where ph.user_id = p.id) as photo_keys,
  coalesce(r.events_attended, 0)::integer as events_attended,
  coalesce(r.shows_up_attended, 0)::integer as shows_up_attended,
  coalesce(r.shows_up_total, 0)::integer as shows_up_total,
  coalesce(r.top_tags, '[]'::jsonb) as top_tags,
  -- "New to Kollide": no attendance history and nothing hosted yet.
  (coalesce(r.events_attended, 0) = 0 and coalesce(r.shows_up_total, 0) = 0 and coalesce(r.events_hosted, 0) = 0) as is_new
from public.profiles p
left join private.user_reputation r on r.user_id = p.id
where p.onboarding_completed_at is not null;

comment on view public.profile_cards is 'Public card for signed-in members. Never exposes date of birth, gender, status or contact details. Reputation is calculated, never stored.';

-- ---------------------------------------------------------------- the host inbox, now with real numbers
create or replace function private.host_inbox(p_event uuid)
returns table (
  booking_id uuid, user_id uuid, status public.booking_status, requested_at timestamptz, squad_id uuid, squad_name text,
  first_name text, age integer, area_id smallint, is_verified boolean, photo_keys text[], interest_ids smallint[],
  language_ids smallint[], bio_prompts jsonb, shows_up_attended integer, shows_up_total integer, top_tags jsonb, events_in_common integer
)
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  e public.events;
begin
  perform private.require_active(uid);
  select * into e from public.events where id = p_event;
  if not found then raise exception 'not_found'; end if;
  if e.host_id <> uid and not private.is_admin() then raise exception 'not_allowed'; end if;
  return query
    select b.id, b.user_id, b.status, b.requested_at, b.squad_id, s.name,
           p.first_name, private.age_of(b.user_id), p.area_id, p.is_verified,
           coalesce((select array_agg(ph.r2_key order by ph.position) from public.profile_photos ph where ph.user_id = b.user_id), '{}'::text[]),
           coalesce((select array_agg(pi.interest_id order by pi.interest_id) from public.profile_interests pi where pi.user_id = b.user_id), '{}'::smallint[]),
           coalesce((select array_agg(pl.language_id order by pl.language_id) from public.profile_languages pl where pl.user_id = b.user_id), '{}'::smallint[]),
           p.bio_prompts,
           coalesce(r.shows_up_attended, 0), coalesce(r.shows_up_total, 0), coalesce(r.top_tags, '[]'::jsonb),
           (select count(distinct e2.id)::integer
              from public.bookings bb join public.events e2 on e2.id = bb.event_id
             where bb.user_id = b.user_id and bb.status in ('approved', 'confirmed', 'attended') and e2.id <> p_event
               and (e2.host_id = e.host_id
                    or exists (select 1 from public.bookings hb where hb.event_id = e2.id and hb.user_id = e.host_id
                                and hb.status in ('approved', 'confirmed', 'attended'))))
      from public.bookings b
      join public.profiles p on p.id = b.user_id
      left join public.squads s on s.id = b.squad_id
      left join private.user_reputation r on r.user_id = b.user_id
     where b.event_id = p_event and b.status in ('requested', 'waitlisted', 'approved', 'confirmed')
     order by case b.status when 'requested' then 0 when 'waitlisted' then 1 when 'approved' then 2 else 3 end, b.requested_at;
end
$$;

-- ---------------------------------------------------------------- host scores (for admins, through the nightly check)
-- Averages of the 1-5 ratings over the last 12 months. Private: hosts and members never see these numbers directly.
create view private.host_scores as
select r.host_id,
       count(*)::integer as ratings,
       round(avg(r.as_described), 2) as as_described,
       round(avg(r.felt_safe), 2) as felt_safe,
       round(avg(r.well_organised), 2) as well_organised,
       round((avg(r.as_described) + avg(r.felt_safe) + avg(r.well_organised)) / 3.0, 2) as overall
  from public.host_ratings r
 where r.created_at >= now() - interval '12 months'
 group by r.host_id;
revoke all on private.host_scores from public, anon, authenticated;
grant select on private.host_scores to service_role;

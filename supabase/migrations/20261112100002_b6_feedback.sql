-- B6.2 The feedback window: positive tags (double-blind), private "something felt off" notes, and host ratings.
-- Only people who were at the same event can give feedback, only while the 72-hour window is open (events.feedback_closes_at,
-- set when attendance is counted), and only once per pair per event. The browser never writes these tables.

-- ---------------------------------------------------------------- tables
-- One row per (event, giver, receiver): up to 3 tags from the fixed positive_tags list. revealed_at is null until both
-- sides have submitted for each other or the window has closed (double-blind). Receivers never see who tagged them,
-- and only revealed tags count towards a profile.
create table public.tag_awards (
  event_id uuid not null references public.events (id) on delete cascade,
  from_user uuid not null references public.profiles (id),
  to_user uuid not null references public.profiles (id),
  tag_ids smallint[] not null check (cardinality(tag_ids) between 1 and 3),
  created_at timestamptz not null default now(),
  revealed_at timestamptz,
  primary key (event_id, from_user, to_user),
  check (from_user <> to_user)
);
create index tag_awards_to_idx on public.tag_awards (to_user, revealed_at);
create index tag_awards_open_idx on public.tag_awards (event_id) where revealed_at is null;

-- "Something felt off." NEVER readable by the person it is about: there is no policy and no function that returns it to them.
-- The author can read their own; admins can read all. from_user becomes null when the author deletes their account.
create table public.private_feedback (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  from_user uuid references public.profiles (id),
  about_user uuid not null references public.profiles (id),
  issue_code text not null check (issue_code in ('made_uncomfortable', 'disrespectful', 'unsafe', 'not_as_described', 'harassment', 'other')),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  unique (event_id, from_user, about_user),
  check (from_user is null or from_user <> about_user)
);
create index private_feedback_about_idx on public.private_feedback (about_user, created_at);

create table public.host_ratings (
  event_id uuid not null references public.events (id) on delete cascade,
  from_user uuid not null references public.profiles (id),
  host_id uuid not null references public.profiles (id),
  as_described smallint not null check (as_described between 1 and 5),
  felt_safe smallint not null check (felt_safe between 1 and 5),
  well_organised smallint not null check (well_organised between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (event_id, from_user)
);
create index host_ratings_host_idx on public.host_ratings (host_id, created_at);

create trigger audit_private_feedback after insert or delete on public.private_feedback
  for each row execute function private.audit_change('event_id', 'from_user', 'about_user', 'issue_code'); -- never the note

-- ---------------------------------------------------------------- RLS and privileges
alter table public.tag_awards enable row level security;
alter table public.private_feedback enable row level security;
alter table public.host_ratings enable row level security;
revoke all on table public.tag_awards, public.private_feedback, public.host_ratings from anon, authenticated;
grant select, insert, update, delete on public.tag_awards, public.private_feedback, public.host_ratings to service_role;

-- A person sees what they wrote, nothing about themselves. Admins see everything.
-- A giver must not be able to tell whether the other person tagged them back (that would break the double-blind), so
-- revealed_at is not readable and give_tags returns nothing.
grant select (event_id, from_user, to_user, tag_ids, created_at) on public.tag_awards to authenticated;
grant select on public.private_feedback, public.host_ratings to authenticated;
create policy tag_awards_read on public.tag_awards for select to authenticated
  using (from_user = (select auth.uid()) or (select private.is_admin()));
create policy private_feedback_read on public.private_feedback for select to authenticated
  using (from_user = (select auth.uid()) or (select private.is_admin()));
create policy host_ratings_read on public.host_ratings for select to authenticated
  using (from_user = (select auth.uid()) or (select private.is_admin()));

-- ---------------------------------------------------------------- helpers
create function private.feedback_open(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select e.attendance_finalised_at is not null and now() <= e.feedback_closes_at
                     from public.events e where e.id = p_event), false)
$$;

-- Was this person at the event? The host counts once the event has any check-in; attendees need their own check-in.
create function private.is_participant(p_event uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.checkins c where c.event_id = p_event and c.user_id = p_user)
      or exists (select 1 from public.events e where e.id = p_event and e.host_id = p_user
                   and exists (select 1 from public.checkins c where c.event_id = p_event))
$$;

create function private.is_blocked_pair(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_blocks where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a))
$$;

-- The shared checks for tags, private feedback and "meet again": both people were at this event, the window is open,
-- the caller is active and the two have not blocked each other. Anything else is `not_allowed`, so nobody learns why.
create function private.require_feedback_pair(p_event uuid, p_from uuid, p_to uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_active(p_from);
  if p_to is null or p_from = p_to then raise exception 'not_allowed'; end if;
  if not exists (select 1 from public.events where id = p_event) then raise exception 'not_found'; end if;
  if not private.feedback_open(p_event) then raise exception 'feedback_closed'; end if;
  if not private.is_participant(p_event, p_from) or not private.is_participant(p_event, p_to) then raise exception 'not_allowed'; end if;
  if private.is_blocked_pair(p_from, p_to) then raise exception 'not_allowed'; end if;
end
$$;

-- ---------------------------------------------------------------- positive tags
create function private.give_tags(p_event uuid, p_to uuid, p_tag_ids smallint[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  mutual boolean;
begin
  perform private.require_feedback_pair(p_event, uid, p_to);
  if p_tag_ids is null or cardinality(p_tag_ids) = 0 then raise exception 'invalid_tags'; end if;
  if cardinality(p_tag_ids) > 3 then raise exception 'too_many_tags'; end if;
  if cardinality(p_tag_ids) <> (select count(distinct t) from unnest(p_tag_ids) as t)
     or (select count(*) from public.positive_tags where id = any (p_tag_ids) and active) <> cardinality(p_tag_ids) then
    raise exception 'invalid_tags';
  end if;
  perform private.check_rate_limit(uid, 'give_tags', 60);
  begin
    insert into public.tag_awards (event_id, from_user, to_user, tag_ids) values (p_event, uid, p_to, p_tag_ids);
  exception when unique_violation then
    raise exception 'already_submitted';
  end;
  -- Double-blind: when the other person has already tagged you, both sides are revealed now.
  mutual := exists (select 1 from public.tag_awards where event_id = p_event and from_user = p_to and to_user = uid);
  if mutual then
    update public.tag_awards set revealed_at = now()
     where event_id = p_event and revealed_at is null
       and ((from_user = uid and to_user = p_to) or (from_user = p_to and to_user = uid));
  end if;
end
$$;

-- Called every hour: once a window has closed, everything still hidden is revealed.
create function private.reveal_closed_tags() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  update public.tag_awards t set revealed_at = now()
   where t.revealed_at is null
     and exists (select 1 from public.events e where e.id = t.event_id and e.feedback_closes_at is not null and e.feedback_closes_at <= now());
  get diagnostics n = row_count;
  return n;
end
$$;

-- ---------------------------------------------------------------- private feedback
create function private.submit_private_feedback(p_event uuid, p_about uuid, p_issue text, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  v_note text := nullif(btrim(p_note), '');
begin
  perform private.require_feedback_pair(p_event, uid, p_about);
  if p_issue is null or p_issue not in ('made_uncomfortable', 'disrespectful', 'unsafe', 'not_as_described', 'harassment', 'other') then
    raise exception 'invalid_issue';
  end if;
  if v_note is not null and char_length(v_note) > 500 then raise exception 'note_too_long'; end if;
  perform private.check_rate_limit(uid, 'private_feedback', 10);
  begin
    insert into public.private_feedback (event_id, from_user, about_user, issue_code, note) values (p_event, uid, p_about, p_issue, v_note);
  exception when unique_violation then
    raise exception 'already_submitted';
  end;
end
$$;

-- ---------------------------------------------------------------- host rating
create function private.rate_host(p_event uuid, p_as_described integer, p_felt_safe integer, p_well_organised integer) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  e public.events;
begin
  perform private.require_active(uid);
  select * into e from public.events where id = p_event;
  if not found then raise exception 'not_found'; end if;
  if not private.feedback_open(p_event) then raise exception 'feedback_closed'; end if;
  -- Only guests who were checked in rate the host; the host cannot rate themselves.
  if e.host_id = uid or not exists (select 1 from public.checkins where event_id = p_event and user_id = uid) then raise exception 'not_allowed'; end if;
  if private.is_blocked_pair(uid, e.host_id) then raise exception 'not_allowed'; end if;
  if p_as_described not between 1 and 5 or p_felt_safe not between 1 and 5 or p_well_organised not between 1 and 5 then
    raise exception 'invalid_rating';
  end if;
  begin
    insert into public.host_ratings (event_id, from_user, host_id, as_described, felt_safe, well_organised)
    values (p_event, uid, e.host_id, p_as_described, p_felt_safe, p_well_organised);
  exception when unique_violation then
    raise exception 'already_submitted';
  end;
end
$$;

-- ---------------------------------------------------------------- what the caller can still do
-- One row per event whose window is open and where the caller was present, with the other people they can give feedback to.
create function private.my_feedback_tasks()
returns table (event_id uuid, event_title text, closes_at timestamptz, host_id uuid, can_rate_host boolean, host_rated boolean, people jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  perform private.require_active(uid);
  return query
    select e.id, e.title, e.feedback_closes_at, e.host_id,
           e.host_id <> uid and exists (select 1 from public.checkins c where c.event_id = e.id and c.user_id = uid),
           exists (select 1 from public.host_ratings r where r.event_id = e.id and r.from_user = uid),
           coalesce((
             select jsonb_agg(jsonb_build_object(
                      'user_id', o.pid, 'first_name', p.first_name, 'is_host', o.pid = e.host_id,
                      'photo_key', (select ph.r2_key from public.profile_photos ph where ph.user_id = o.pid order by ph.position limit 1),
                      'tagged', exists (select 1 from public.tag_awards t where t.event_id = e.id and t.from_user = uid and t.to_user = o.pid),
                      'flagged', exists (select 1 from public.private_feedback f where f.event_id = e.id and f.from_user = uid and f.about_user = o.pid))
                    order by p.first_name)
               from (select c.user_id as pid from public.checkins c where c.event_id = e.id
                     union select e.host_id) o
               join public.profiles p on p.id = o.pid and p.deleted_at is null
              where o.pid <> uid and not private.is_blocked_pair(uid, o.pid)), '[]'::jsonb)
      from public.events e
     where private.feedback_open(e.id) and private.is_participant(e.id, uid)
     order by e.feedback_closes_at;
end
$$;

-- ---------------------------------------------------------------- wrappers and grants
create function public.give_tags(p_event uuid, p_to uuid, p_tag_ids smallint[]) returns void
language sql set search_path = '' as $$ select private.give_tags(p_event, p_to, p_tag_ids) $$;
create function public.submit_private_feedback(p_event uuid, p_about uuid, p_issue text, p_note text default null) returns void
language sql set search_path = '' as $$ select private.submit_private_feedback(p_event, p_about, p_issue, p_note) $$;
create function public.rate_host(p_event uuid, p_as_described integer, p_felt_safe integer, p_well_organised integer) returns void
language sql set search_path = '' as $$ select private.rate_host(p_event, p_as_described, p_felt_safe, p_well_organised) $$;
create function public.my_feedback_tasks()
returns table (event_id uuid, event_title text, closes_at timestamptz, host_id uuid, can_rate_host boolean, host_rated boolean, people jsonb)
language sql stable set search_path = '' as $$ select * from private.my_feedback_tasks() $$;

revoke all on function
  private.feedback_open(uuid), private.is_participant(uuid, uuid), private.is_blocked_pair(uuid, uuid), private.require_feedback_pair(uuid, uuid, uuid),
  private.give_tags(uuid, uuid, smallint[]), private.reveal_closed_tags(), private.submit_private_feedback(uuid, uuid, text, text),
  private.rate_host(uuid, integer, integer, integer), private.my_feedback_tasks()
  from public;
grant execute on function
  private.give_tags(uuid, uuid, smallint[]), private.submit_private_feedback(uuid, uuid, text, text),
  private.rate_host(uuid, integer, integer, integer), private.my_feedback_tasks()
  to authenticated;
grant execute on function private.reveal_closed_tags() to service_role;
revoke all on function
  public.give_tags(uuid, uuid, smallint[]), public.submit_private_feedback(uuid, uuid, text, text),
  public.rate_host(uuid, integer, integer, integer), public.my_feedback_tasks()
  from public, anon;
grant execute on function
  public.give_tags(uuid, uuid, smallint[]), public.submit_private_feedback(uuid, uuid, text, text),
  public.rate_host(uuid, integer, integer, integer), public.my_feedback_tasks()
  to authenticated;

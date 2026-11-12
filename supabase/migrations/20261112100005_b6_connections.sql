-- B6.5 "Meet again": a yes-tap on someone you met at an event. A tap is one-way and private; nobody can read who tapped them.
-- Only when both people tapped each other is there a connection (shown through my_connections()). This is not a chat or a
-- dating feature: a connection only shows a first name and a photo. If three people at one event all tapped each other,
-- admins are told, so they can suggest a repeat event.

create table public.connections (
  event_id uuid not null references public.events (id) on delete cascade,
  from_user uuid not null references public.profiles (id),
  to_user uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (event_id, from_user, to_user),
  check (from_user <> to_user)
);
create index connections_to_idx on public.connections (to_user, event_id);

alter table public.connections enable row level security;
revoke all on table public.connections from anon, authenticated;
grant select, insert, update, delete on public.connections to service_role;
-- You can read the taps you made, never the taps made about you.
grant select on public.connections to authenticated;
create policy connections_read on public.connections for select to authenticated using (from_user = (select auth.uid()));

create function private.tap_meet_again(p_event uuid, p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  mutual boolean;
  v_title text;
  v_flag uuid;
begin
  perform private.require_feedback_pair(p_event, uid, p_user);
  perform private.check_rate_limit(uid, 'meet_again', 60);
  insert into public.connections (event_id, from_user, to_user) values (p_event, uid, p_user) on conflict do nothing;
  mutual := exists (select 1 from public.connections where event_id = p_event and from_user = p_user and to_user = uid);
  if not mutual then return jsonb_build_object('mutual', false); end if;

  select title into v_title from public.events where id = p_event;
  -- Both people hear about it only now that it is mutual.
  perform private.notify(uid, 'connection', 'You both want to meet again', v_title, jsonb_build_object('event_id', p_event, 'user_id', p_user));
  perform private.notify(p_user, 'connection', 'You both want to meet again', v_title, jsonb_build_object('event_id', p_event, 'user_id', uid));

  -- Three people who all tapped each other (a triangle: someone is mutual with both of this pair) -> tell the admins, once per event.
  if exists (
    select 1
      from public.connections x1 join public.connections x2 on x2.event_id = x1.event_id and x2.from_user = x1.to_user and x2.to_user = x1.from_user
      join public.connections y1 on y1.event_id = x1.event_id and y1.from_user = uid and y1.to_user = x1.to_user
      join public.connections y2 on y2.event_id = x1.event_id and y2.from_user = x1.to_user and y2.to_user = uid
     where x1.event_id = p_event and x1.from_user = p_user and x1.to_user not in (uid, p_user)
  ) then
    insert into public.review_flags (kind, event_id, ref_key, details)
    values ('repeat_event_group', p_event, p_event::text, jsonb_build_object('event_title', v_title))
    on conflict (kind, ref_key) do nothing returning id into v_flag;
    if v_flag is not null then
      perform private.notify_admins('repeat_event_group', 'A group wants to meet again', v_title || ': three or more people opted in. Consider a repeat event.',
        jsonb_build_object('event_id', p_event));
    end if;
  end if;
  return jsonb_build_object('mutual', true);
end
$$;

-- Mutual pairs only, one row per person (their most recent shared event).
create function private.my_connections()
returns table (user_id uuid, first_name text, photo_key text, event_id uuid, event_title text, connected_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  perform private.require_active(uid);
  return query
    select distinct on (m.other) m.other, p.first_name,
           (select ph.r2_key from public.profile_photos ph where ph.user_id = m.other order by ph.position limit 1),
           m.event_id, e.title, m.at
      from (select c.to_user as other, c.event_id, greatest(c.created_at, r.created_at) as at
              from public.connections c
              join public.connections r on r.event_id = c.event_id and r.from_user = c.to_user and r.to_user = c.from_user
             where c.from_user = uid) m
      join public.profiles p on p.id = m.other and p.deleted_at is null
      join public.events e on e.id = m.event_id
     where private.is_user_active(m.other) and not private.is_blocked_pair(uid, m.other)
     order by m.other, m.at desc;
end
$$;

create function public.tap_meet_again(p_event uuid, p_user uuid) returns jsonb
language sql set search_path = '' as $$ select private.tap_meet_again(p_event, p_user) $$;
create function public.my_connections()
returns table (user_id uuid, first_name text, photo_key text, event_id uuid, event_title text, connected_at timestamptz)
language sql stable set search_path = '' as $$ select * from private.my_connections() $$;

revoke all on function private.tap_meet_again(uuid, uuid), private.my_connections() from public;
grant execute on function private.tap_meet_again(uuid, uuid), private.my_connections() to authenticated;
revoke all on function public.tap_meet_again(uuid, uuid), public.my_connections() from public, anon;
grant execute on function public.tap_meet_again(uuid, uuid), public.my_connections() to authenticated;

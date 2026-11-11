-- Squads: a small group (4 to 6) going to one event together. The creator approves who joins.
-- Every member still needs an event booking, which is made through the one join function (join_event),
-- so event rules (women-only, age, blocks, seats, rate limit) apply to squad members too and the host still decides.

create function private.create_squad(p_event uuid, p_meeting_point text, p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  v_id uuid;
  point text := btrim(p_meeting_point);
  label text := nullif(btrim(p_name), '');
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if point is null or char_length(point) not between 3 and 200 then raise exception 'meeting_point_invalid'; end if;
  if label is not null and char_length(label) > 40 then raise exception 'name_invalid'; end if;
  if exists (select 1 from public.squad_members where event_id = p_event and user_id = uid and status in ('requested', 'approved')) then
    raise exception 'already_in_squad';
  end if;
  -- The creator needs a booking: make one through the normal path if they do not have one yet.
  if not exists (select 1 from public.bookings where event_id = p_event and user_id = uid and status <> 'cancelled') then
    perform private.join_event(uid, p_event, null);
  end if;
  insert into public.squads (event_id, creator_id, name, meeting_point) values (p_event, uid, label, point) returning id into v_id;
  insert into public.squad_members (squad_id, user_id, event_id, status, decided_at) values (v_id, uid, p_event, 'approved', now());
  update public.bookings set squad_id = v_id where event_id = p_event and user_id = uid and status <> 'cancelled';
  return v_id;
end
$$;

create function private.request_to_join_squad(p_squad uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  s public.squads;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into s from public.squads where id = p_squad for update;
  if not found or s.status <> 'forming' then raise exception 'not_found'; end if;
  if s.creator_id = uid then raise exception 'already_in_squad'; end if;
  if exists (select 1 from public.squad_members where event_id = s.event_id and user_id = uid and status in ('requested', 'approved')) then
    raise exception 'already_in_squad';
  end if;
  if (select count(*) from public.squad_members where squad_id = p_squad and status = 'approved') >= 6 then raise exception 'squad_full'; end if;
  if exists (select 1 from public.bookings where event_id = s.event_id and user_id = uid and status <> 'cancelled') then
    update public.bookings set squad_id = p_squad where event_id = s.event_id and user_id = uid and status <> 'cancelled';
  else
    perform private.join_event(uid, s.event_id, p_squad);
  end if;
  insert into public.squad_members (squad_id, user_id, event_id, status) values (p_squad, uid, s.event_id, 'requested')
  on conflict (squad_id, user_id) do update set status = 'requested', decided_at = null;
  perform private.notify(s.creator_id, 'squad_request', coalesce((select first_name from public.profiles where id = uid), 'Someone') || ' wants to join your squad',
    coalesce(s.name, 'Your squad'), jsonb_build_object('event_id', s.event_id, 'squad_id', p_squad));
end
$$;

create function private.decide_squad_request(p_squad uuid, p_user uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  s public.squads;
  m public.squad_members;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into s from public.squads where id = p_squad for update;
  if not found then raise exception 'not_found'; end if;
  if s.creator_id <> uid then raise exception 'not_allowed'; end if; -- the creator approves, not the host
  select * into m from public.squad_members where squad_id = p_squad and user_id = p_user for update;
  if not found or m.status <> 'requested' then raise exception 'not_found'; end if;
  if p_approve then
    if (select count(*) from public.squad_members where squad_id = p_squad and status = 'approved') >= 6 then raise exception 'squad_full'; end if;
    update public.squad_members set status = 'approved', decided_at = now() where squad_id = p_squad and user_id = p_user;
    perform private.notify(p_user, 'squad_approved', 'You are in the squad', coalesce(s.name, 'Squad'), jsonb_build_object('event_id', s.event_id, 'squad_id', p_squad));
  else
    update public.squad_members set status = 'declined', decided_at = now() where squad_id = p_squad and user_id = p_user;
    update public.bookings set squad_id = null where event_id = s.event_id and user_id = p_user and squad_id = p_squad;
    perform private.notify(p_user, 'squad_declined', 'An update on your squad request', 'That squad is not a fit this time. You can still go to the event on your own.',
      jsonb_build_object('event_id', s.event_id, 'squad_id', p_squad));
  end if;
end
$$;

create function private.leave_squad(p_squad uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  s public.squads;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into s from public.squads where id = p_squad for update;
  if not found then raise exception 'not_found'; end if;
  if s.creator_id = uid then raise exception 'creator_cannot_leave'; end if;
  update public.squad_members set status = 'left', decided_at = now() where squad_id = p_squad and user_id = uid and status in ('requested', 'approved');
  if not found then raise exception 'not_found'; end if;
  update public.bookings set squad_id = null where event_id = s.event_id and user_id = uid and squad_id = p_squad;
  perform private.notify(s.creator_id, 'squad_left', coalesce((select first_name from public.profiles where id = uid), 'A member') || ' left your squad',
    coalesce(s.name, 'Your squad'), jsonb_build_object('event_id', s.event_id, 'squad_id', p_squad));
end
$$;

create function private.disband_squad(p_squad uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  s public.squads;
  m public.squad_members;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into s from public.squads where id = p_squad for update;
  if not found then raise exception 'not_found'; end if;
  if s.creator_id <> uid then raise exception 'not_allowed'; end if;
  if s.status <> 'forming' then raise exception 'not_found'; end if;
  update public.squads set status = 'cancelled' where id = p_squad;
  for m in select * from public.squad_members where squad_id = p_squad and status in ('requested', 'approved') and user_id <> uid loop
    perform private.notify(m.user_id, 'squad_disbanded', 'A squad was disbanded', coalesce(s.name, 'Squad'), jsonb_build_object('event_id', s.event_id));
  end loop;
  update public.squad_members set status = 'left', decided_at = now() where squad_id = p_squad and status in ('requested', 'approved');
  update public.bookings set squad_id = null where squad_id = p_squad;
end
$$;

-- Forming squads for an event. The meeting point is not included: members get it from get_squad.
create function private.event_squads(p_event uuid)
returns table (id uuid, name text, creator_id uuid, creator_first_name text, member_count integer, spots_left integer, complete boolean, my_status text)
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  return query
    select s.id, s.name, s.creator_id, p.first_name,
           (select count(*)::integer from public.squad_members m where m.squad_id = s.id and m.status = 'approved'),
           greatest(6 - (select count(*)::integer from public.squad_members m where m.squad_id = s.id and m.status = 'approved'), 0),
           (select count(*) from public.squad_members m where m.squad_id = s.id and m.status = 'approved') >= 4,
           (select m.status from public.squad_members m where m.squad_id = s.id and m.user_id = uid)
      from public.squads s join public.profiles p on p.id = s.creator_id
     where s.event_id = p_event and s.status = 'forming'
     order by s.created_at;
end
$$;

-- Details for the creator and approved members: meeting point and members. Requests are visible to the creator only.
create function private.get_squad(p_squad uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  s public.squads;
  is_creator boolean;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into s from public.squads where id = p_squad;
  if not found then raise exception 'not_found'; end if;
  is_creator := s.creator_id = uid;
  if not is_creator and not exists (select 1 from public.squad_members where squad_id = p_squad and user_id = uid and status = 'approved') then
    raise exception 'not_allowed';
  end if;
  return jsonb_build_object(
    'id', s.id, 'event_id', s.event_id, 'name', s.name, 'meeting_point', s.meeting_point, 'status', s.status, 'is_creator', is_creator,
    'members', coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'first_name', p.first_name, 'status', m.status) order by m.created_at)
                           from public.squad_members m join public.profiles p on p.id = m.user_id
                          where m.squad_id = p_squad and (m.status = 'approved' or (is_creator and m.status = 'requested'))), '[]'::jsonb));
end
$$;

-- The squads the caller belongs to (or asked to join).
create function private.my_squads()
returns table (id uuid, event_id uuid, event_title text, name text, status text, my_status text, is_creator boolean, member_count integer, request_count integer)
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  return query
    select s.id, s.event_id, e.title, s.name, s.status, m.status, s.creator_id = uid,
           (select count(*)::integer from public.squad_members x where x.squad_id = s.id and x.status = 'approved'),
           case when s.creator_id = uid then (select count(*)::integer from public.squad_members x where x.squad_id = s.id and x.status = 'requested') else 0 end
      from public.squad_members m
      join public.squads s on s.id = m.squad_id
      join public.events e on e.id = s.event_id
     where m.user_id = uid and m.status in ('requested', 'approved') and s.status = 'forming'
     order by e.starts_at;
end
$$;

-- ---------------------------------------------------------------- wrappers and grants
create function public.create_squad(p_event uuid, p_meeting_point text, p_name text default null) returns uuid
language sql set search_path = '' as $$ select private.create_squad(p_event, p_meeting_point, p_name) $$;
create function public.request_to_join_squad(p_squad uuid) returns void
language sql set search_path = '' as $$ select private.request_to_join_squad(p_squad) $$;
create function public.decide_squad_request(p_squad uuid, p_user uuid, p_approve boolean) returns void
language sql set search_path = '' as $$ select private.decide_squad_request(p_squad, p_user, p_approve) $$;
create function public.leave_squad(p_squad uuid) returns void
language sql set search_path = '' as $$ select private.leave_squad(p_squad) $$;
create function public.disband_squad(p_squad uuid) returns void
language sql set search_path = '' as $$ select private.disband_squad(p_squad) $$;
create function public.event_squads(p_event uuid)
returns table (id uuid, name text, creator_id uuid, creator_first_name text, member_count integer, spots_left integer, complete boolean, my_status text)
language sql stable set search_path = '' as $$ select * from private.event_squads(p_event) $$;
create function public.get_squad(p_squad uuid) returns jsonb
language sql stable set search_path = '' as $$ select private.get_squad(p_squad) $$;
create function public.my_squads()
returns table (id uuid, event_id uuid, event_title text, name text, status text, my_status text, is_creator boolean, member_count integer, request_count integer)
language sql stable set search_path = '' as $$ select * from private.my_squads() $$;

revoke all on function
  private.create_squad(uuid, text, text), private.request_to_join_squad(uuid), private.decide_squad_request(uuid, uuid, boolean),
  private.leave_squad(uuid), private.disband_squad(uuid), private.event_squads(uuid), private.get_squad(uuid), private.my_squads()
  from public;
grant execute on function
  private.create_squad(uuid, text, text), private.request_to_join_squad(uuid), private.decide_squad_request(uuid, uuid, boolean),
  private.leave_squad(uuid), private.disband_squad(uuid), private.event_squads(uuid), private.get_squad(uuid), private.my_squads()
  to authenticated;
revoke all on function
  public.create_squad(uuid, text, text), public.request_to_join_squad(uuid), public.decide_squad_request(uuid, uuid, boolean),
  public.leave_squad(uuid), public.disband_squad(uuid), public.event_squads(uuid), public.get_squad(uuid), public.my_squads()
  from public, anon;
grant execute on function
  public.create_squad(uuid, text, text), public.request_to_join_squad(uuid), public.decide_squad_request(uuid, uuid, boolean),
  public.leave_squad(uuid), public.disband_squad(uuid), public.event_squads(uuid), public.get_squad(uuid), public.my_squads()
  to authenticated;

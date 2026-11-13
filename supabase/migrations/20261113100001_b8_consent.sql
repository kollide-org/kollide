-- B8.1 Consent: one validated way to record a cookie choice, and a helper that says whether someone currently allows analytics.
-- The browser keeps the choice in a first-party cookie; this records it (append-only) so we can show proof and honour it
-- on the server. A choice made while logged out is stored with an anonymous id; recording it again after sign-in stores
-- the user id together with that anonymous id, which is the link between the two.

-- Nobody writes consents directly any more: record_consent checks the notice version and rate-limits (it closes the
-- anonymous insert as a spam route). complete_onboarding (security definer) keeps writing its own rows.
drop policy consents_insert on public.consents;
revoke insert on public.consents from anon, authenticated;
create index consents_user_latest_idx on public.consents (user_id, purpose, created_at desc, id) where user_id is not null;

-- What to do when a signed-in person's Analytics choice changes. B8.2 fills this in (queued events are dropped on
-- withdrawal, the sign-up event is queued on the first yes). Until then it does nothing.
create function private.on_analytics_consent(p_user uuid, p_granted boolean) returns void
language sql security definer set search_path = '' as $$ select 1 $$;

create function private.record_consent(p_anonymous_id uuid, p_notice_version text, p_preferences boolean, p_analytics boolean, p_marketing boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  v_current text;
  v_at timestamptz := clock_timestamp(); -- not now(): two choices in one transaction must stay in order
begin
  if uid is null and p_anonymous_id is null then raise exception 'anonymous_id_required'; end if;
  if p_preferences is null or p_analytics is null or p_marketing is null then raise exception 'invalid_input'; end if;
  select value #>> '{}' into v_current from public.app_config where key = 'notice_version';
  if p_notice_version is distinct from v_current then raise exception 'notice_version_mismatch'; end if;
  perform private.check_rate_limit(coalesce(uid, p_anonymous_id), 'record_consent', 30);

  insert into public.consents (user_id, anonymous_id, purpose, notice_version, granted, created_at) values
    (uid, p_anonymous_id, 'preferences', p_notice_version, p_preferences, v_at),
    (uid, p_anonymous_id, 'analytics', p_notice_version, p_analytics, v_at),
    (uid, p_anonymous_id, 'marketing', p_notice_version, p_marketing, v_at);
  if uid is not null then perform private.on_analytics_consent(uid, p_analytics); end if;
end
$$;

-- True when the person's latest Analytics choice for the CURRENT notice version is yes. A new notice version means "not yet".
create function private.has_analytics_consent(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select c.granted from public.consents c
     where c.user_id = p_user and c.purpose = 'analytics'
       and c.notice_version = (select value #>> '{}' from public.app_config where key = 'notice_version')
     order by c.created_at desc, c.id desc limit 1), false)
$$;

create function public.record_consent(p_anonymous_id uuid, p_notice_version text, p_preferences boolean, p_analytics boolean, p_marketing boolean) returns void
language sql set search_path = '' as $$ select private.record_consent(p_anonymous_id, p_notice_version, p_preferences, p_analytics, p_marketing) $$;

-- The signed-in person's latest choice per purpose (any notice version), so a new device can adopt it instead of asking again.
create function public.my_consent() returns table (purpose public.consent_purpose, granted boolean, notice_version text, created_at timestamptz)
language sql stable set search_path = '' as $$
  select distinct on (c.purpose) c.purpose, c.granted, c.notice_version, c.created_at
    from public.consents c where c.user_id = (select auth.uid()) and c.purpose in ('preferences', 'analytics', 'marketing')
   order by c.purpose, c.created_at desc, c.id desc
$$;

-- For the Worker (service role): may this person's click be sent to PostHog?
create function public.analytics_consent_ok(p_user uuid) returns boolean
language sql stable set search_path = '' as $$ select private.has_analytics_consent(p_user) $$;

revoke all on function
  private.on_analytics_consent(uuid, boolean), private.record_consent(uuid, text, boolean, boolean, boolean), private.has_analytics_consent(uuid)
  from public;
-- anon and signed-in people record their own choice (checked inside); the helper is for server code
grant execute on function private.record_consent(uuid, text, boolean, boolean, boolean) to anon, authenticated;
grant execute on function private.has_analytics_consent(uuid) to service_role;
revoke all on function public.record_consent(uuid, text, boolean, boolean, boolean) from public;
grant execute on function public.record_consent(uuid, text, boolean, boolean, boolean) to anon, authenticated;
revoke all on function public.my_consent() from public, anon;
grant execute on function public.my_consent() to authenticated;
revoke all on function public.analytics_consent_ok(uuid) from public, anon, authenticated;
grant execute on function public.analytics_consent_ok(uuid) to service_role;

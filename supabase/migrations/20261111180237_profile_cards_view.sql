-- The public profile card. security_invoker means the caller's own RLS applies to every table
-- it reads, so members only get active profiles. The date of birth is never selected: age comes
-- from private.age_of(), which returns an integer only.

create view public.profile_cards with (security_invoker = true) as
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
     from public.profile_photos ph where ph.user_id = p.id) as photo_keys
from public.profiles p
where p.onboarding_completed_at is not null;

comment on view public.profile_cards is 'Public card for signed-in members. Never exposes date of birth, gender, status or contact details.';

revoke all on table public.profile_cards from anon, authenticated;
grant select on public.profile_cards to authenticated;

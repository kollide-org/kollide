-- B7.5 Account data for the B7 tables.
-- moderation_actions: the person can export what they were told (action, note, date). The internal reason and the admin are not
--   exported: they are the team's record, not the person's data. The rows are kept when the account is deleted (append-only).
-- banned_identities: hashes only, kept on purpose when the account is deleted, so a ban cannot be dodged. Not exported (the
--   person cannot be identified from a hash, and exporting it would help anyone trying to evade).

create function private.my_moderation_history() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('action', m.action, 'note', m.user_note, 'at', m.created_at) order by m.created_at), '[]'::jsonb)
    from public.moderation_actions m where m.user_id = (select auth.uid())
$$;
revoke all on function private.my_moderation_history() from public, anon;
grant execute on function private.my_moderation_history() to authenticated;

create or replace function public.export_my_data() returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = (select auth.uid())),
    'private', (select to_jsonb(pp) from public.profile_private pp where pp.id = (select auth.uid())),
    'photos', (select coalesce(jsonb_agg(to_jsonb(ph) order by ph.position), '[]'::jsonb)
                 from public.profile_photos ph where ph.user_id = (select auth.uid())),
    'interests', (select coalesce(jsonb_agg(i.slug order by i.slug), '[]'::jsonb)
                    from public.profile_interests pi join public.interests i on i.id = pi.interest_id
                   where pi.user_id = (select auth.uid())),
    'languages', (select coalesce(jsonb_agg(l.slug order by l.slug), '[]'::jsonb)
                    from public.profile_languages pl join public.languages l on l.id = pl.language_id
                   where pl.user_id = (select auth.uid())),
    'roles', (select coalesce(jsonb_agg(ur.role), '[]'::jsonb)
                from public.user_roles ur where ur.user_id = (select auth.uid())),
    'host_applications', (select coalesce(jsonb_agg(to_jsonb(ha)), '[]'::jsonb)
                            from public.host_applications ha where ha.user_id = (select auth.uid())),
    'verifications', (select coalesce(jsonb_agg(jsonb_build_object(
                        'id', v.id, 'result', v.result, 'reviewed_at', v.reviewed_at, 'created_at', v.created_at)), '[]'::jsonb)
                        from public.verifications v where v.user_id = (select auth.uid())),
    'consents', (select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at), '[]'::jsonb)
                   from public.consents c where c.user_id = (select auth.uid())),
    'blocks', (select coalesce(jsonb_agg(to_jsonb(b)), '[]'::jsonb)
                 from public.user_blocks b where b.blocker_id = (select auth.uid())),
    -- B5 and B6
    'bookings', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'event_id', b.event_id, 'status', b.status, 'requested_at', b.requested_at,
                   'decided_at', b.decided_at, 'cancelled_at', b.cancelled_at, 'cancel_reason', b.cancel_reason) order by b.requested_at), '[]'::jsonb)
                   from public.bookings b where b.user_id = (select auth.uid())),
    'checkins', (select coalesce(jsonb_agg(jsonb_build_object('event_id', c.event_id, 'method', c.method, 'at', c.created_at) order by c.created_at), '[]'::jsonb)
                   from public.checkins c where c.user_id = (select auth.uid())),
    'tags_given', (select coalesce(jsonb_agg(jsonb_build_object('event_id', t.event_id, 'to_user', t.to_user, 'tag_ids', t.tag_ids, 'at', t.created_at) order by t.created_at), '[]'::jsonb)
                     from public.tag_awards t where t.from_user = (select auth.uid())),
    'host_ratings_given', (select coalesce(jsonb_agg(jsonb_build_object('event_id', r.event_id, 'as_described', r.as_described, 'felt_safe', r.felt_safe,
                             'well_organised', r.well_organised, 'at', r.created_at) order by r.created_at), '[]'::jsonb)
                             from public.host_ratings r where r.from_user = (select auth.uid())),
    'private_feedback_written', (select coalesce(jsonb_agg(jsonb_build_object('event_id', f.event_id, 'about_user', f.about_user, 'issue_code', f.issue_code,
                                   'note', f.note, 'at', f.created_at) order by f.created_at), '[]'::jsonb)
                                   from public.private_feedback f where f.from_user = (select auth.uid())),
    'meet_again_taps', (select coalesce(jsonb_agg(jsonb_build_object('event_id', c.event_id, 'to_user', c.to_user, 'at', c.created_at) order by c.created_at), '[]'::jsonb)
                          from public.connections c where c.from_user = (select auth.uid())),
    'reports_filed', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'subject_type', s.subject_type, 'subject_id', s.subject_id, 'reason', s.reason,
                        'details', s.details, 'status', s.status, 'at', s.created_at) order by s.created_at), '[]'::jsonb)
                        from public.safety_reports s where s.reporter_id = (select auth.uid())),
    'notes_about_me', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'message', t.message, 'status', t.status, 'at', t.created_at) order by t.created_at), '[]'::jsonb)
                         from public.profile_tips t where t.user_id = (select auth.uid())),
    'appeals', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'kind', a.kind, 'message', a.message, 'status', a.status, 'at', a.created_at) order by a.created_at), '[]'::jsonb)
                  from public.appeals a where a.user_id = (select auth.uid())),
    'notifications', (select coalesce(jsonb_agg(jsonb_build_object('kind', n.kind, 'title', n.title, 'body', n.body, 'at', n.created_at) order by n.created_at), '[]'::jsonb)
                        from public.notifications n where n.user_id = (select auth.uid())),
    -- B7: what the Kollide team decided about this account and told the person (never the internal reason or the admin's name)
    'moderation_notices', private.my_moderation_history()
  )
  where (select auth.uid()) is not null
$$;

create or replace function private.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if exists (select 1 from public.profiles where id = uid and deleted_at is not null) then
    return; -- already deleted
  end if;

  -- Upcoming events of a deleted host are cancelled (their address stays in event_private for the record of the event).
  update public.events set status = 'cancelled', review_note = 'The host deleted their account.'
   where host_id = uid and status in ('draft', 'pending_review', 'published');

  -- Queue the person's images for deletion from R2, then forget the keys.
  insert into public.storage_deletions (bucket, key)
    select 'media', r2_key from public.profile_photos where user_id = uid
  on conflict do nothing;
  insert into public.storage_deletions (bucket, key)
    select 'private', selfie_key from public.verifications where user_id = uid and selfie_key is not null
  on conflict do nothing;
  delete from public.upload_keys where user_id = uid;

  -- Deliberately kept: public.moderation_actions (an append-only record of decisions about this account) and public.banned_identities
  -- (hashes only, so a ban cannot be dodged by erasing the account). Neither holds anything readable about the person.
  -- After-event data (B6): what they gave or received is deleted...
  delete from public.tag_awards where from_user = uid or to_user = uid;
  delete from public.connections where from_user = uid or to_user = uid;
  delete from public.host_ratings where from_user = uid or host_id = uid;
  delete from public.checkins where user_id = uid;
  update public.checkins set checked_in_by = null where checked_in_by = uid;
  delete from public.appeals where user_id = uid;
  delete from public.profile_tips where user_id = uid;
  delete from public.private_feedback where about_user = uid;
  delete from public.notifications where user_id = uid;
  delete from public.email_outbox where user_id = uid;
  -- ...and the safety record stays without their name.
  update public.private_feedback set from_user = null where from_user = uid;
  update public.safety_reports set reporter_id = null where reporter_id = uid;

  delete from public.user_roles where user_id = uid;
  delete from public.user_blocks where blocker_id = uid or blocked_id = uid;
  delete from public.host_applications where user_id = uid;
  delete from public.verifications where user_id = uid;
  delete from public.profile_photos where user_id = uid;
  delete from public.profile_interests where user_id = uid;
  delete from public.profile_languages where user_id = uid;
  delete from public.profile_private where id = uid;

  update public.profiles
     set first_name = 'Former member', area_id = null, bio_prompts = '[]'::jsonb,
         is_verified = false, deleted_at = now()
   where id = uid;

  -- Sign the person out everywhere and make the login unusable.
  delete from auth.identities where user_id = uid;
  delete from auth.refresh_tokens where user_id = uid::text;
  delete from auth.sessions where user_id = uid;
  update auth.users
     set email = 'deleted-' || uid || '@deleted.invalid', phone = null, encrypted_password = null,
         raw_user_meta_data = '{}'::jsonb, raw_app_meta_data = '{}'::jsonb,
         banned_until = 'infinity', updated_at = now()
   where id = uid;
end
$$;

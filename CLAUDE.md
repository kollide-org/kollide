# Kollide

Frontend and backend for Kollide v1, a social events platform for Bengaluru: people find an event, then host it or join it with a small group of verified people. It is not a dating app.

- Frontend: Vite, React, TypeScript, Tailwind, shadcn/ui, React Router, TanStack Query. See `README.md` for scripts, theme and motion rules.
- Services: components call hooks, hooks call interfaces in `src/services`, and a single flag (`VITE_SERVICES=mock|real`) picks the implementation.
- Backend: Supabase (Postgres, Auth, RLS) in `supabase/`, one Cloudflare Worker in `workers/api/`. Env vars are listed in `docs/backend/ENV.md`.

## Backend

Read these before any backend work:

@docs/backend/BACKEND_RULES.md

The full plan is in `docs/backend/BACKEND_PLAN.md`.

### Pattern for database functions called from the browser
Put the logic in a `SECURITY DEFINER` function in the `private` schema (with `search_path = ''`, checking `auth.uid()`), and expose a thin `SECURITY INVOKER` wrapper in `public` that calls it. Revoke execute from `public` and `anon` on the wrapper. Supabase's advisors warn about definer functions in `public`, and CI fails on warnings. Errors are raised as short codes (for example `under_18`) that the frontend maps to text. When a new table stores personal data, add it to `public.export_my_data()` and to `private.delete_my_account()`.

### Images
Browsers never choose an R2 key: the Worker asks `authorize_upload` for one and the key is recorded in `upload_keys`. Attach functions (`set_profile_photo`, `submit_selfie`, ...) only accept keys issued to the caller. When you add a column that stores an image key (event cover, hub art), update `private.unreferenced_keys` too, or the nightly cleanup deletes it.

### Events (B4)
- Events, hubs and featured slots are written only through functions; the browser reads. `partner_url`, `referral_code` and `review_note` are not granted to the browser (partner links go through the Worker's `/go/:id`).
- No money moves through Kollide: `price_label` is display text, `price_paise` must stay 0 while `payments_enabled` is false (a trigger enforces it).
- **B5 must redefine three stubs with `create or replace`:** `private.event_taken_seats(event)` (count bookings in requested, approved, confirmed, attended), `private.event_attendee_photos(event)` (verified attendees' photo keys) and `private.user_has_booking_access(user, event)` (approved or confirmed). `event_cards`, `search_events` and `get_event_address` then work unchanged. Test the address rule for attendees in B5.
- B5 should also schedule `public.complete_ended_events()` (service role) with `pg_cron`.

### Bookings, email and jobs (B5)
- **One join path:** every booking goes through `private.join_event(user, event, squad)` (it locks the event row). `request_to_join` and the squad functions call it. The paid branch is marked `PAID EVENTS (P1)`: it raises `payments_disabled` while the switch is off. Never write a booking as `confirmed` or `paid` anywhere else (a trigger enforces it).
- **Seats:** `private.event_taken_seats` counts requested, approved, confirmed and attended (P1 adds pending_payment and paid). Free events may be approved up to capacity x (1 + overbook_pct/100).
- **Email:** never send from SQL. Call `private.queue_email(user, template, data, priority)` (1 = critical, 2 = normal) and `private.notify(...)` on every state change. A new email needs a template in `workers/api/src/emails/templates.ts`, in the `email_outbox.template` check, and a test. Emails never contain the exact address.
- **Jobs:** each cron job function records itself with `private.record_job_run`. Add new jobs in a migration with `cron.schedule` and a Vault-based Worker call if they need the Worker.
- **B6 will:** make `host_inbox`'s "Shows up X of Y" and top tags real, mark `attended`/`no_show`, and add `checkin_token` to bookings.
- Test the seat lock with `npm run db:race` (two sessions, one seat).


### After the event (B6)
- **Check-in:** `bookings.checkin_token` is a random uuid (like `reconfirm_token`), never granted to the browser; the owner reads it with `my_checkin_token`. `check_in` / `check_in_manual` (host or admin, 2 h before to 4 h after the start) only write `checkins`, the source of truth. `private.finalise_event` (job `attendance`, every 30 min, or `admin_finalise_event_now`) turns check-ins into `attended` / `no_show` 2 h after the end and opens the 72 h feedback window (`events.feedback_closes_at`). **If an event has seats but zero check-ins nobody becomes `no_show`**: an admin flag (`review_flags`) is raised instead.
- **Feedback:** `tag_awards` (one row per giver/receiver/event, up to 3 tags, double-blind via `revealed_at`), `private_feedback` (never readable by its subject, never in exports or the audit log's note), `host_ratings`. Every feedback function goes through `private.require_feedback_pair`.
- **Reputation:** calculated only. `private.user_reputation` (matview, refreshed every 15 min, `refresh_reputation()`) feeds `profile_cards` and `host_inbox`. Tuning numbers live in `private.reputation_params()`, not in `app_config` (which is publicly readable). Tips come from `private.tip_candidates()` in the nightly job.
- **Safety:** `report()` holds the subject (`on_hold`) instantly only when reporter and subject share an event or squad; the reporter is never told whether anyone was held. Every write function calls `private.require_active(uid)` (squads use a trigger). Cancelling, reporting, appealing, export and delete stay open to people on hold on purpose. New personal-data tables must be added to `export_my_data()` and `delete_my_account()` (done for all B6 tables).
- **B7 will:** build the admin queue for `review_flags` and `safety_reports`, release holds, and resolve reports (only `resolve_appeal` and `admin_finalise_event_now` exist today).

# Kollide v1 — Backend Plan

Nov 11, 2026 · @ASMG

## Decisions locked

The Kollide v1 backend runs on **Supabase** for the database, sign-in and security rules, and on **Cloudflare Workers** for code that needs secrets. Photos go to **Cloudflare R2**, behaviour data goes to **PostHog**, and email is split between **Resend** and **Brevo**. Everything is ₹0 except the domain. Claude Code with Sonnet 5.5 writes the code, one milestone at a time.

| Area | Decision |
| --- | --- |
| Database, auth, permissions | Supabase free plan: Postgres, Supabase Auth, Row Level Security |
| Server code (secrets, jobs) | One Cloudflare Worker (Hono), deployed with Wrangler |
| Frontend hosting | Cloudflare Pages (unchanged) |
| Photos | Cloudflare R2: a public bucket for covers and profile photos, a private bucket for selfies |
| Sign-in codes | Resend, plugged into Supabase Auth as its email server |
| Other email (approvals, reconfirmation, reminders) | Brevo API, sent from a queue table |
| Payments | **Not in v1.** Events are free, pay at venue, cost-split, or partner tickets bought on the partner's site. No money moves through Kollide. Clean "payment seams" are kept so Razorpay can be added later without rework. |
| Analytics and tracking | PostHog EU Cloud free plan: core funnel, page views and clicks, session recordings, interest signals |
| Cookies | Login sessions, a consent banner, ad pixels (IDs added later), saved preferences |
| Environments | Local → Staging → Production. The 2 free Supabase projects are used for staging and production. |
| Code location | Same GitHub repo as the frontend, in `supabase/` and `workers/` folders |
| Future Android app | Native Kotlin. All business rules live in the database and the Worker, so Android reuses them. |
| Timeline | No fixed date. Build it properly, as fast as possible. |

### Follow-up decisions

| Item | Decision | Status |
| --- | --- | --- |
| Login session storage | Supabase default: 1-hour access token + refresh token in local storage, strict Content-Security-Policy. Revisit for Android. | Decided Nov 11 |
| Profile photo privacy | Public R2 URLs with random UUID file names. GPS and other hidden data stripped in the browser before upload. Selfies stay private. | Decided Nov 11 |
| PostHog region | EU Cloud (closer to India than US, stricter privacy defaults) | Decided Nov 11 |
| Payments | Deferred. v1 is free-only; the payment seams below stay in place. When payments return: a new Razorpay account under a co-founder's PAN, category Media & Entertainment → Ticketing, built as milestone P1. | Decided Nov 11 |
| Domain name | Claude Code uses a `KOLLIDE_DOMAIN` placeholder until it's set | Open |
| Ad pixel IDs (Meta, Google Ads) | The loader is built in B8; IDs stay empty until decided | Open |

## Architecture: what runs where

```
                      ┌──────────────────────────┐
   Cloudflare R2  ◄───┤ Website (React, CF Pages)├───► PostHog (EU)
   photos/selfies     └────────┬────────┬────────┘   (after consent)
   /backups                    │        │                  ▲
              data + sign-in   │        │ uploads          │ server events
                               ▼        ▼                  │
 ┌──────────── Supabase (Mumbai) ───┐  ┌── Cloudflare Worker (api.<domain>) ──┐
 │ Auth: Google + 6-digit email code│  │ Payments: OFF in v1 — provider       │
 │ Postgres + RLS + functions       │◄─┤   interface only, plugs in at P1     │
 │   (every booking/review rule;    │  │ Uploads: 5-min R2 presigned links    │
 │    app_config.payments_enabled)  │  │ Email: flushes email_outbox → Brevo  │
 │ pg_cron jobs ────── pg_net ──────┼─►│ Job endpoints (shared-secret header) │
 └───────┬──────────────▲───────────┘  └──────┬─────────────┬╌╌╌╌▲╌╌╌╌╌╌╌╌╌╌╌┘
         │ SMTP         │ nightly pg_dump      │ email        ┊API ┊ webhook
         ▼              │                      ▼              ▼    ┊
      Resend      GitHub Actions             Brevo        Razorpay (LATER, P1)
   (sign-in codes)  (backup → R2)        (300/day)        not connected in v1
```

The website reads and writes data directly through Supabase, and the database's own rules decide what each person may see or change. The Worker handles only the jobs that need secrets: upload links, sending email, and server-side analytics. Scheduled jobs start inside Supabase and call the Worker when they need email or storage cleanup. Payments are switched off in v1; the dashed seams show where Razorpay plugs in later.

## Services map: what we use, where, and the free limits

v1 uses eight services; Razorpay joins later. Only R2 asks for a card, and only to switch it on; it charges nothing while we stay inside the free limits. Limits were checked in November 2026 and change often, so check each pricing page before launch.

| Service | What Kollide uses it for | Free limit that matters | Who sets it up |
| --- | --- | --- | --- |
| [Supabase](https://supabase.com/pricing) | Postgres database, Google + email-code sign-in, Row Level Security, database functions, scheduled jobs (`pg_cron`), outgoing HTTP calls (`pg_net`) | 500 MB database, 50,000 monthly active users, 5 GB egress, 2 projects. **Pauses after 7 days with no activity.** No downloadable daily backups. | You create the accounts. Claude Code writes the SQL. |
| [Cloudflare Workers](https://developers.cloudflare.com/workers/platform/limits/) | `api.<domain>`: R2 upload links, email sending, scheduled-job endpoints, server-side analytics events, partner-link redirects | 100,000 requests a day, 10 ms of CPU per request (time spent waiting on the network doesn't count) | Claude Code (Wrangler) |
| Cloudflare Pages | The existing frontend | Unlimited static requests | Already done |
| [Cloudflare R2](https://developers.cloudflare.com/r2/pricing/) | Event covers, profile photos, verification selfies, nightly database backups | 10 GB stored, 1M writes and 10M reads a month, no download fees. **Card needed to turn it on.** | You switch it on. Claude Code writes the upload code. |
| [Resend](https://resend.com/pricing) | 6-digit sign-in codes only, through Supabase Auth's custom email server (SMTP) | 100 emails a day, 3,000 a month | You verify `auth.<domain>` |
| [Brevo](https://www.brevo.com/pricing/) | Request received, approvals, 24-hour reconfirmation, reminders, feedback prompts | 300 emails a day | You verify `mail.<domain>` |
| [PostHog Cloud (EU)](https://posthog.com/pricing) | Funnels, page views and clicks, session recordings, interest signals, later feature flags | 1M events and 5,000 recordings a month, no card needed | You create the project. Claude Code adds the code. |
| GitHub Actions | Database migrations, Worker deploys, nightly backup to R2 (which also stops Supabase from pausing) | 2,000 minutes a month on private repos | Claude Code |
| Google Cloud | The OAuth client for "Sign in with Google" | Free | You |
| Razorpay (later) | Not in v1. Added in milestone P1 when paid Kollide events return. | Per-transaction fee only | Later |

## Repo structure

The frontend stays where it is. The backend goes into new folders in the same repo, so one pull request can change both sides and database types are generated once.

```
kollide/                      (existing repo)
├─ src/ …                     existing frontend, untouched except src/services/*
│  ├─ services/               mock ↔ real switch already exists; real versions call Supabase or the Worker
│  └─ types/database.ts       GENERATED by `supabase gen types` — never edit by hand
├─ supabase/
│  ├─ config.toml             local Supabase settings (auth providers, email templates)
│  ├─ migrations/             one timestamped .sql file per change, never edited after merge
│  ├─ (functions, triggers, views and cron jobs are migrations too)
│  ├─ seed.sql                Bengaluru areas, interests, tags, demo events (local + staging only)
│  └─ tests/                  pgTAP tests: every permission rule and booking rule
├─ workers/api/
│  ├─ src/index.ts            Hono app
│  ├─ src/routes/             uploads.ts, jobs.ts, analytics.ts, go.ts (payments.ts later)
│  ├─ src/lib/                supabase-admin.ts, payments/ (interface only in v1), brevo.ts, r2.ts, auth.ts (JWT check)
│  ├─ src/emails/             HTML email templates
│  ├─ test/                   Vitest tests
│  └─ wrangler.toml           envs: staging, production
├─ docs/backend/              this plan + short decision notes (one per big choice)
├─ .github/workflows/         ci.yml, deploy-db.yml, deploy-worker.yml, nightly-backup.yml
└─ CLAUDE.md                  standing rules for every Claude Code session (section on working together)
```

Secrets never go in the repo. Local secrets go in `workers/api/.dev.vars` and `.env.local`, both git-ignored. Deployed secrets go in GitHub Actions secrets and are pushed with `wrangler secret put`.

## Database schema

The database holds about 35 tables in 8 groups. Private data (phone, date of birth, exact address) sits in its own tables so permission rules stay simple. Reliability, tag counts and ratings are always **calculated** from source rows, never stored as numbers someone could edit. Claude Code should treat this as the starting point and propose refinements before writing migration 1.

### Reference data (admin-managed)

`areas` (Bengaluru areas) · `interests` · `languages` · `positive_tags` (fixed list) · `host_rating_tags` · `categories`

### People

| Table | Holds | Who can read it |
| --- | --- | --- |
| `profiles` | id (= the Supabase auth user), first name, gender, area, bio prompts, interests, languages, `is_verified`, `status` (active / on\_hold / suspended / banned), created\_at | Signed-in members, through the `profile_cards` view only |
| `profile_private` | phone, date of birth, last name, email copy | The owner and admins only |
| `profile_photos` | R2 object key, position 1–3 | Signed-in members |
| `user_roles` | `admin` / `host`. Hosting is invite-only. | The owner and admins |
| `host_applications` | Request to become a host, with status and the admin's note | The applicant and admins |
| `verifications` | Selfie R2 key (deleted after review), result, reviewer, reviewed\_at | The owner (result only) and admins |
| `consents` | Purpose, notice version, granted yes/no, timestamp. Also stores cookie choices for logged-out visitors under an anonymous id. | The owner and admins |
| `user_blocks` | Who has blocked whom | The owner |

### Events

| Table | Holds | Who can read it |
| --- | --- | --- |
| `events` | type (partner / community / kollide), title, category, area, start and end time, capacity, overbook %, price in paise, pricing mode (free / pay\_at\_venue / cost\_split / paid), approval mode, women\_only, age range, house rules, cover key, status (draft / pending\_review / published / cancelled / completed), host\_id, partner\_url + referral code | Anyone, once published |
| `event_private` | exact address, map pin, host notes | The host, admins, and attendees with an approved, confirmed or paid booking |
| `hubs`, `hub_events` | Seasonal hubs (title, art, accent colour, dates) and the events in them | Anyone |
| `featured_slots` | Admin-picked events for the home page | Anyone |

### Joining

| Table | Holds |
| --- | --- |
| `bookings` | user, event, status (below), waitlist position, `hold_expires_at`, `reconfirm_by`, a check-in QR token, timestamps for each change |
| `squads`, `squad_members` | A group of 4–6 for one event, its meeting point, and members with their own request → approved status |
| `checkins` | booking, checked in by (the host), method (QR or manual), time. This is the source of truth for attendance. |

**Booking states** (enforced by the database, not the app):

- Paid (states reserved, unused in v1): `pending_payment` → `paid` → `attended` / `no_show`. A hold that runs out goes to `expired`.
- Free and community: `requested` → `approved` / `waitlisted` / `declined` → `confirmed` → `attended` / `no_show`.
- Both: `cancelled`. Paid only: `refunded`.

### Money (designed now, created in milestone P1)

`payments` (Razorpay order id, payment id, amount, status) · `webhook_events` (raw body, Razorpay event id with a unique constraint so nothing is processed twice) · `refunds` · `credit_ledger` (store credit as +/− entries; the balance is a sum, never a stored number)

### Reputation and safety

| Table | Holds |
| --- | --- |
| `tag_awards` | Who gave which positive tag to whom at which event (max 3 per person per event), and when it becomes visible (double-blind) |
| `private_feedback` | "Something felt off" notes. Never readable by the subject. |
| `profile_tips` | Anonymous tips generated once the 3-people, 2-events threshold is reached |
| `host_ratings` | "As described", "Felt safe", "Well organised" per attendee per event |
| `safety_reports` | reporter, subject (user, event or squad), reason, details, status, outcome |
| `appeals` | Disputes of tips or suspensions, with a 48-hour target |
| `connections` | "Meet again" yes-taps. A mutual pair = a connection. |
| `review_flags` | Collusion and retaliation flags from the nightly job |

### Platform

`email_outbox` (queued emails, status, attempts) · `notifications` (in-app bell) · `audit_log` (every admin action and sensitive change, written by triggers) · `job_runs` (last run time and result of each scheduled job) · `rate_limits` (counters for request spam)

### Calculated views (read-only)

- `profile_cards`: the public profile card. Age is calculated from the date of birth; the birth date itself is never exposed.
- `user_reputation`: events attended, "Shows up X of Y" (last 12 months), top 3 tags. A materialised view refreshed every 15 minutes.
- `event_cards`: spots left and attendee avatars for listings.
- `host_scores`: host rating averages, used to remove hosting rights.

**Kept for phase 2, not built now:** `chat_threads`, `chat_messages`, `push_tokens` (Android). The names are reserved so adding them later needs no rework.

**Not in the database:** behaviour and analytics events (those go to PostHog), and images (those go to R2; only the file key is stored).

## Security and permissions

The browser talks to Supabase directly, so **the database itself enforces every rule**. Even someone with the public key and a modified app can only see and do what the rules allow. The same rules will protect the Android app later.

1. **Row Level Security on every table, with no exceptions.** A table without a policy can't be read at all. A CI check fails the build if any table has RLS switched off.
2. **Writes go through database functions, not raw table inserts.** For example, `request_to_join(event_id)`, `decide_request(booking_id, decision)`, `check_in(qr_token)`. Each function checks who is calling (`auth.uid()`), their role and the event's state, then makes the change. The browser gets no direct insert or update rights on bookings, payments, check-ins, reviews or reports.
3. **Private fields live in private tables.** The exact address is only returned when the caller has an approved, confirmed or paid booking for that event, or is its host or an admin. Phone numbers and dates of birth are never returned to other users.
4. **Roles live in `user_roles`, not in the sign-in token.** Admin checks read the table, so revoking a role takes effect immediately.
5. **Users on hold are blocked by the database.** A `safety_reports` insert puts the subject `on_hold` straight away. Every join, host and review function refuses users who aren't active.
6. **The service key exists only inside the Worker.** It never reaches the frontend, the repo, or a Claude Code prompt.
7. **Rate limits:**
   - Supabase Auth's built-in limits on code requests.
   - A `rate_limits` table checked inside join, report and feedback functions (for example, 20 join requests a day).
   - Cloudflare's free rate-limiting rule on `api.<domain>`.
8. **Audit log.** Triggers record every admin action, role change, status change and refund, with who did it and when.
9. **Testing.** Every rule gets a pgTAP test written as "user A must NOT be able to…". Tests run in CI on every pull request. Supabase's built-in Security Advisor must show zero warnings before each release.
10. **Privacy (DPDP).**
    - Consent is recorded per purpose.
    - Users can export and delete their own data through functions.
    - Selfies are deleted after review.
    - 18+ is enforced in the database from the date of birth.
    - A written breach-response note lives in `docs/backend/`.

## Auth and sessions

Sign-in is handled by Supabase Auth, so we write no password or token code ourselves. "Sign in with Google" is the main button and a 6-digit email code is the fallback.

1. **Google.** You create an OAuth client in Google Cloud and paste its ID and secret into Supabase. Allowed return addresses: the production domain, the staging Pages URL and `localhost`.
2. **Email code.** Supabase sends a 6-digit code (not a magic link) through **Resend's SMTP** from `auth.<domain>`. We customise the email template with the Kollide look. The 100-a-day Resend cap means about 100 email-code sign-ins a day. That's fine while Google is the main route.
3. **First sign-in.** A database trigger creates an empty `profiles` row. The app sends new users to onboarding until `onboarding_completed_at` is set. That field is set by a function that checks the user is 18 or older, has 3 photos and has accepted the code of conduct.
4. **Session.** We use Supabase's default for v1: a 1-hour access token plus a refresh token in the browser's local storage, refreshed automatically. Decided on Nov 11. The Worker checks the same token on every call by verifying its signature against Supabase's published keys.
5. **Sign out everywhere, and deleting an account.** Handled by Supabase Auth plus our `delete_my_account()` function. That function removes personal data and keeps only anonymised booking and payment rows needed for accounts and tax.
6. **Android later.** Supabase's Kotlin SDK supports the same Google and email-code sign-in, and the same rules apply.

## Core business logic

All rules about seats, money and reputation live in Postgres functions and the Worker, never in React. That way the website and the future Android app can't disagree.

### Joining a community or free event

1. `request_to_join` locks the event row (`SELECT … FOR UPDATE`) so two people can't take the last seat at the same moment. It checks women-only, age range, blocks and hold status, then creates a `requested` booking.
2. The host sees requests through `host_inbox(event_id)`, which returns profile cards with "Shows up X of Y", top tags and events in common.
3. `decide_request` sets the booking to `approved`, `waitlisted` or `declined`. Free events allow approving up to the event's overbook limit (default 30% over capacity). Every decision queues an email. A decline uses the gentle wording.
4. **24 hours before the event,** a job sends a "Still coming?" email with a one-tap link that calls `reconfirm_booking`. Anyone who hasn't confirmed by the cutoff loses their seat, and the next person on the waitlist is promoted automatically.
5. **Squads** use the same request-and-approve pattern, but the squad creator approves instead of the host.

### Payments: switched off in v1, ready to plug in

No money moves through Kollide in v1. These seams are built now, so milestone P1 (Razorpay) later means adding code, not reworking it:

1. **One switch.** An `app_config` table holds `payments_enabled = false`. Database functions refuse paid bookings while it's off, and the frontend reads it to hide the Book button and the "Paid" filter.
2. **Prices already exist.** `events.price_paise` (a check keeps it at 0 while payments are off) and `pricing_mode` already includes `paid`. Free, pay-at-venue and cost-split work today.
3. **Booking states are reserved.** `pending_payment`, `paid`, `expired` and `refunded` exist in the enum but are never used in v1, so P1 needs no enum migration.
4. **One join function for every path.** All bookings go through the same seat-locking function. P1 adds a 15-minute hold branch instead of a second, parallel flow.
5. **A provider interface in the Worker.** `workers/api/src/payments/provider.ts` defines `createOrder`, `verifyWebhook` and `refund`. v1 has no implementation and no routes. P1 adds `RazorpayProvider` and the `/payments` and `/webhooks` routes.
6. **The money tables are designed, not created.** `payments`, `webhook_events`, `refunds` and `credit_ledger` are specified in `docs/backend/PAYMENTS_LATER.md`, together with the rules: the webhook is the only proof of payment, the price comes from the database, refunds follow the 72-hour policy.
7. **Analytics names are reserved.** `checkout_started` and `payment_captured` are listed in the event dictionary for P1.

### After the event

- **Check-in.** Each booking has a signed QR token. The host's scanner or a manual tap calls `check_in`. Two hours after the event ends, a job marks `attended` (checked in) or `no_show`.
- **Feedback window.** It is open for 72 hours, only between people checked in at the same event. Each person can review each other person once. Tags are revealed only when both sides have submitted or the window closes (double-blind).
- **Private feedback rule.** A tip appears only when **3 or more different people across 2 or more events** have flagged the same issue. A nightly job applies the weighting:
  - Verified, long-standing and reliable reviewers count more.
  - Feedback from someone who was reported by the subject is discounted.
  - The last 12 months count most.
- **Collusion check.** Every night, small groups who only ever tag each other are flagged for admin review.
- **Safety report.** Puts the subject on hold instantly, alerts admins by email, and creates an audit entry.
- **Meet again.** Mutual yes-taps create a `connection`. If 3 or more people all mutually opt in, admins get a "suggest a repeat event" notification.
- **Hosts.** Hosts whose average score stays below the threshold are flagged for admins to remove hosting rights. Rights are not removed automatically in v1.

### Partner events

The "Get tickets" link goes out through `api.<domain>/go/<event>`. The Worker logs the click as a PostHog event and redirects with our referral code, so we can show partners how many people we sent them.

## Scheduled jobs

Scheduled jobs run inside Supabase with `pg_cron`. Pure database work runs as SQL. Jobs that need email or R2 call a Worker endpoint through `pg_net`, with a shared secret header. Each run writes to `job_runs`, so admins can see if a job stopped.

| Every | Job | Runs in |
| --- | --- | --- |
| 1 min | Send queued emails from `email_outbox`, up to Brevo's daily cap, with retries | Worker `/jobs/flush-email` |
| 15 min | Send "Still coming?" emails 24 hours before; release unconfirmed seats at the cutoff; promote the waitlist | SQL + email queue |
| 15 min | Refresh `user_reputation` | SQL |
| 30 min | Day-of reminders; open the feedback window 2 hours after an event ends; mark attended or no-show | SQL + email queue |
| 1 hour | Close 72-hour feedback windows; reveal double-blind tags | SQL |
| Nightly | Private-feedback threshold → tips; collusion and retaliation flags; host score check; delete reviewed selfies from R2; delete stale rate-limit rows | SQL + Worker `/jobs/r2-cleanup` |
| Nightly | Database backup to R2 (keep 14 days). This also counts as activity, so Supabase never pauses. | GitHub Actions |
| (P1 later) 5 min | Release expired payment holds, then promote the waitlist | SQL |

## Email: Resend + Brevo split

**Resend** sends only sign-in codes. **Brevo** sends everything else. Using two separate sending subdomains means a spam problem with one can't hurt the other.

| Sender | Subdomain | Sends | Daily cap |
| --- | --- | --- | --- |
| Resend, through Supabase Auth's SMTP | `auth.<domain>` | 6-digit sign-in codes | 100 |
| Brevo API, called by the Worker | `mail.<domain>` | Request received, approved, waitlisted, gentle decline, "Still coming?", day-of reminder, feedback prompt, safety-report acknowledgement, admin alerts | 300 |

- **Outbox pattern.** Database functions never send email directly. They insert a row into `email_outbox` with the template name, recipient and data. The 1-minute job sends the queue, retries failures 3 times, and stops for the day at 280 emails to keep a safety margin. Anything left goes out after midnight UTC, with critical emails first (approval, reconfirmation).
- **DNS.** In Cloudflare: SPF and DKIM records for each subdomain, as each provider gives them, plus one DMARC record (start with `p=none`, then move to `quarantine` after 2 clean weeks).
- **Templates.** Plain HTML in `workers/api/src/emails/`, with the indigo-and-marigold look and an unsubscribe line for non-essential emails.
- **Watch out:** about 3 Brevo emails per booking means roughly 90 bookings a day before we hit the cap. A `job_runs` warning fires at 80% so you know when to upgrade or add a provider.

## Images on R2

The browser uploads images straight to R2 using a short-lived upload link from the Worker. Images never pass through Supabase, and the database stores only the file key.

| Bucket | Holds | Served from | Access |
| --- | --- | --- | --- |
| `kollide-media` | Event covers, profile photos, hub art | `img.<domain>` (Cloudflare cache, free) | Public, with random UUID file names (decided) |
| `kollide-private` | Verification selfies | Never served publicly. Admins see them through a 5-minute signed link from the Worker. | Private; deleted after review |
| `kollide-backups` | Nightly database dumps | Not served | Private; 14-day lifecycle rule |

1. The browser compresses each image to WebP at about 150 KB or less. Re-drawing it on a canvas strips location (GPS) and other hidden data.
2. The browser calls Worker `POST /uploads/sign` with the purpose (`profile_photo`, `event_cover`, `selfie`). The Worker checks the sign-in token, the purpose and the size limit, then returns a 5-minute upload link and a key like `profiles/<uuid>.webp`.
3. The browser uploads to R2, then calls a database function to attach the key (`set_profile_photo`, `set_event_cover`).
4. Each night a job deletes files no longer referenced in the database, so storage stays under 10 GB. At about 150 KB each, 10 GB holds roughly 65,000 images.

Turning on R2 needs a card on your Cloudflare account. Set a billing notification so you hear about it before any charge.

## Analytics, cookies and consent

PostHog records behaviour only after the visitor agrees. The consent banner is the switch for every non-essential cookie, and each choice is saved with a timestamp.

### Cookie categories

| Category | What it covers | Default | Consent needed |
| --- | --- | --- | --- |
| Essential | Login session, security, the consent choice itself | On | No (explained in the notice) |
| Preferences | Theme, last-used filters and area (local storage) | Off until accepted | Yes |
| Analytics | PostHog: page views, clicks, funnel, interest signals, session recordings | Off until accepted | Yes |
| Marketing | Meta and Google Ads pixels. The loader is built now; IDs are empty until you decide. | Off until accepted | Yes |

- Choices are stored in a first-party cookie, and in `consents` (by anonymous id, then linked to the user id when they sign in). The notice is versioned, so changing it asks everyone again.
- A "Cookie settings" link in the footer reopens the banner at any time. Withdrawing consent stops PostHog and the pixels immediately.

### What PostHog tracks

1. **Core funnel** (named events, sent from the Worker or the database so they can't be faked or blocked):
   - `signed_up` → `profile_completed` → `join_requested` → `request_approved` → `reconfirmed` → `checked_in` → `feedback_given` → `rebooked`
   - Reserved for P1: `checkout_started`, `payment_captured`
2. **Page views and clicks.** PostHog's automatic capture in the browser.
3. **Session recordings.** Every input is masked. Profile cards, phone, date of birth, addresses and the host inbox carry `ph-no-capture` and are never recorded. A sample of sessions is recorded so we stay under 5,000 recordings a month.
4. **Interest signals:**
   - `event_viewed`, with category, area, price band and hub;
   - `filter_applied`;
   - `search_performed`;
   - `partner_link_clicked`;
   - `squad_viewed`.

   These feed recommendations later.

### Identity and limits

- Users are identified by their Supabase user id only. Emails, names or phone numbers are never sent to PostHog.
- Every event carries an `env` property (staging or production), so test data never mixes into real numbers.
- With no card on PostHog, capture just stops if we pass 1M events in a month; nothing is charged. Automatic capture is tuned to skip noisy elements.

## Environments, deploys, backups

There are three environments. Code reaches production only through a pull request that has passed on staging.

|  | Local | Staging | Production |
| --- | --- | --- | --- |
| Database | Supabase CLI in Docker (or the staging fallback set up in B0) | Supabase project `kollide-staging` (Mumbai region) | Supabase project `kollide-prod` (Mumbai region) |
| Worker | `wrangler dev` | `api-staging.<domain>` | `api.<domain>` |
| Frontend | Vite dev server | Cloudflare Pages preview branch | `<domain>` |
| R2 | Local simulation (Miniflare) | `*-staging` buckets | Production buckets |
| Email | Captured locally, nothing sent | Real, but only to team addresses (allow-list) | Real |
| Data | `seed.sql` demo data | `seed.sql` demo data | Real users only |

**Deploy flow:**

1. A pull request runs the checks: lint, type check, pgTAP tests, Worker tests, a check that every table has RLS, and the Supabase advisors.
2. Merging to `main` applies migrations to staging (`supabase db push`) and deploys the staging Worker.
3. A manual "Promote to production" GitHub Action, with you approving, applies the same migrations to production and deploys the production Worker.

**Backups:** the free plan has no downloadable backups, so a nightly GitHub Action runs `pg_dump` on production, encrypts the file and uploads it to `kollide-backups`. `docs/backend/RESTORE.md` holds the exact restore steps. Test a restore into staging once a month.

## Build milestones for Claude Code (Sonnet 5.5)

There are 10 v1 milestones, built in order, with B0 already done. Payments come later as milestone P1. Each milestone ends with passing tests, a staging deploy, and the matching frontend mock service switched to the real backend, so you can check every step in the actual app.

0. **B0 — Setup.** ✅ Done: `supabase/` and `workers/` folders, `CLAUDE.md`, CI, deploy workflows.
1. **B1 — Schema and permissions foundation.** Reference tables, profiles, private tables, roles, enums (including the reserved payment states), `app_config` with `payments_enabled = false`, RLS on everything, the audit trigger, seed data, generated types and the first pgTAP tests.
2. **B2 — Sign-in and onboarding.** Google and email-code sign-in (Resend SMTP), the profile trigger, `complete_onboarding` with the 18+ check, consent records, and the Content-Security-Policy. Switch on the real auth and profile services in the frontend.
3. **B3 — Images.** R2 buckets, the Worker upload-link endpoint, photo and cover attaching, the private selfie flow and the admin review link.
4. **B4 — Events and hubs.** Host applications, create event (draft → pending\_review → published), admin approval, browse with filters (with indexes), `event_cards`, hubs and featuring, the private address rule, partner-link redirects. Paid pricing is refused while payments are off.
5. **B5 — Requests, waitlist, squads, email.** One seat-locking join function, the host inbox, decisions, overbooking, the email outbox + Brevo, `pg_cron` jobs, reconfirmation, waitlist promotion, and the Worker payment provider interface (no implementation).
6. **B6 — After the event.** QR check-in, attended/no-show, the feedback window, double-blind tags, private feedback and tips, host ratings, safety reports with auto-hold, appeals, reputation views and meet-again connections.
7. **B7 — Admin backend.** Admin functions for host and event approvals, hubs, the reports queue, hold/suspend/ban, partner links, the audit log viewer and job health.
8. **B8 — Analytics and consent.** The consent banner wired to `consents`, PostHog EU setup with masking and sampling, server-side funnel events, interest events, and the consent-gated pixel loader (IDs left empty).
9. **B9 — Hardening and launch.** Rate limits, the nightly backup and restore test, data export and delete-account, the Supabase advisors at zero warnings, a load sanity test, the email DNS check, and the production promote checklist.
10. **P1 — Payments (later, when you decide).** Razorpay provider, money tables, holds, webhook, refunds and credit, then `payments_enabled = true`. The full prompt is ready in the prompts file.

**Definition of done for the backend:** on production, a new user can do the full journey with no mock data:

- sign up and complete a profile;
- find an event and request to join;
- get approved and receive emails;
- check in and leave feedback;
- see their reliability update.

An admin can moderate all of it, and every step shows up in the PostHog funnel.

## Working with Claude Code across two people

You and your friend each run Claude Code (Sonnet 5.5) on your own branch. The repo's `CLAUDE.md` gives both sessions the same rules, so the code stays consistent whoever writes the prompt.

**What `CLAUDE.md` should say (Claude Code drafts it in milestone B0, and you approve it):**

- Read `docs/backend/BACKEND_PLAN.md` before any backend work. Ask before changing the stack, adding a paid service, storing a new kind of personal data, or building anything marked "not in v1".
- Every schema change is a new migration file. Never edit a migration that has been merged.
- Every new table gets RLS and a pgTAP test proving a stranger can't read or change it.
- Business rules go in database functions or the Worker, never only in React.
- Regenerate `src/types/database.ts` after every migration.
- Never put the service key, Razorpay secret or any other secret in code, logs or prompts.
- Finish each task by running the tests and reporting what changed, what was tested and what's left.
- Use Context7 for current Supabase, Razorpay, Cloudflare and PostHog docs.

**Branching:**

- One branch per milestone or feature, for example `be/b5-requests` or `be/b6-payments`.
- Only **one open pull request may change `supabase/migrations/` at a time**. Two migrations made in parallel can clash. Agree in chat who owns migrations this week.
- Your friend works on parts that don't overlap with yours. Good candidates: emails and templates, PostHog and consent, admin functions.

**Useful tools for Claude Code:**

- **Supabase MCP server.** Connect it in read-only mode and only to the local or staging project, never production. Claude Code can then inspect the schema and run the security advisors.
- **Context7** (already connected).
- **Playwright** (already connected) for end-to-end tests of whole flows on staging.

**How to prompt each milestone:** "Read CLAUDE.md and BACKEND\_PLAN.md. We're doing milestone B*n*. Propose the migration list, functions, endpoints and tests first, and wait for my go." Approve the plan, let it build, then check the staging preview yourself before merging.

## Risks and free-tier limits

The biggest risks are Supabase pausing, email caps on a busy day, and payments being bolted on badly later. Each has a fix already in the plan.

| Risk | What happens | What we do |
| --- | --- | --- |
| Supabase pauses after 7 idle days | The site stops loading data | The nightly backup job touches the database every day |
| No free Supabase backups | Data loss if something breaks | Nightly encrypted `pg_dump` to R2, plus a monthly restore test |
| 500 MB database cap | The database becomes read-only | Analytics and images are kept out of it. Watch the usage dashboard and upgrade to Pro ($25/month) near 400 MB. |
| Worker limits: 100k requests a day, 10 ms CPU | Upload or job calls fail | Only server-side work goes through the Worker; images load from R2 directly |
| Brevo 300/day, Resend 100/day | Emails are delayed until the next day | Queue with priorities, an 80% warning, Google as the main sign-in |
| R2 has a card on file | Unexpected charges if limits are passed | Billing notification, nightly cleanup of orphaned files, 14-day backup expiry |
| PostHog 1M events / 5k recordings | Tracking stops for the month | Tuned automatic capture, sampled recordings, no card attached |
| Payments added later in a hurry | Rework, or bugs around money | Seams built in v1 (switch, reserved states, single join function, provider interface, PAYMENTS\_LATER.md); P1 is its own milestone with its own tests |
| Two people changing the schema at once | Clashing migrations | One open migration pull request at a time |
| Free plans change their terms | Limits shift without notice | Check each pricing page before launch and quarterly after |

## Your setup checklist (before milestone B0)

Claude Code can't create accounts or enter cards for you. These steps take about 1–2 hours, and you only do them once. Keep every key in a password manager, not in chat.

**On your laptop**

- [ ] Install Docker Desktop, Node.js (LTS), the Supabase CLI and Wrangler.

**Supabase**

- [ ] Create 2 projects, `kollide-staging` and `kollide-prod`, in the Mumbai (ap-south-1) region.
- [ ] Save each project's URL, anon key, service key and database password.

**Cloudflare**

- [ ] Make sure the domain's DNS is on Cloudflare.
- [ ] Turn on R2 (add a card) and set a billing notification.
- [ ] Create an API token for Wrangler and GitHub Actions.

**Google Cloud**

- [ ] Create an OAuth client (Web) and add the Supabase callback URLs for both projects.

**Email**

- [ ] Resend: add the `auth.<domain>` domain, add its DNS records, and create an SMTP key.
- [ ] Brevo: add the `mail.<domain>` sender domain, add its DNS records, and create an API key.

**Razorpay (not needed for v1)**

- [ ] Later, for P1: a new account under a co-founder's PAN, category Media & Entertainment → Ticketing, with test keys and a webhook secret.

**PostHog**

- [ ] Choose a region, create the project and copy its project key.

**GitHub**

- [ ] Add the secrets above as repo secrets.
- [ ] Give your friend write access.
- [ ] Protect `main` so it requires pull requests.

**Decisions**

- [ ] Set the domain name in the "Follow-up decisions" table.

Then tell Claude Code: *"Read docs/backend/BACKEND\_PLAN.md and CLAUDE.md. Start milestone B0: propose the folder changes and the CI workflow, and wait for my go."*

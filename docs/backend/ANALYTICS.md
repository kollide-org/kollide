# Kollide analytics, cookies and consent (B8)

PostHog **EU Cloud**. Nothing non-essential loads or is sent before the visitor agrees. This file is the event dictionary and the
rules behind it. Change an event or property here and in the code together.

## Rules
1. **Consent first.** Four categories: Essential (always on), Preferences, Analytics, Marketing. "Reject all" is as prominent as "Accept all".
2. **Identify by Supabase user id only.** Never email, name or phone, in a property or as `distinct_id`.
3. **Every event carries `env`** (`local`, `staging`, `production`). Server events get it from `ENVIRONMENT`, browser events from `VITE_APP_ENV`.
4. **Properties are non-personal:** ids, categories, counts, booleans, enums. Nothing a person typed. Server-side, the database drops any property not on the allowed list (`private.analytics_allowed_keys()`).
5. **Withdrawing is immediate.** Browser: `opt_out_capturing()` + `reset()` and PostHog's stored keys are removed. Server: queued events for that person are deleted and the send job re-checks consent. Marketing: cookies are removed and the page reloads.
6. **Private feedback never produces an event** (not even "feedback_given").

## Where the choice lives
| Place | What |
|---|---|
| Cookie `kollide_consent` (first-party, 6 months) | `{ v: notice version, a: anonymous id, preferences, analytics, marketing, t }`. A choice for another notice version counts as none, so the banner returns. |
| `public.consents` (append-only) | One row per purpose per decision, written by `record_consent(...)`. Logged out: `anonymous_id`. Signed in: `user_id` and the `anonymous_id` (the link). A new device adopts the signed-in person's latest choice (`my_consent()`). |
| `private.has_analytics_consent(user)` | Latest `analytics` row for the user **for the current notice version** (`app_config.notice_version`). Bumping the version means "not yet" for everyone. |

## Event dictionary

### Browser (posthog-js, only with Analytics consent and `VITE_POSTHOG_KEY`)
| Event | Properties | Sent from |
|---|---|---|
| `$pageview` | PostHog's own (path, referrer) | automatic, on route changes |
| `$autocapture` | clicks and form submits on `a`, `button`, `form`, `select`, `label`; `ph-no-capture` elements excluded | automatic |
| `event_viewed` | `event_id`, `category`, `area`, `price_band` (`free`, `pay_at_venue`, `cost_split`, `paid`), `hub` (slug, from the `?hub=` link) | `src/pages/app/event.tsx` |
| `filter_applied` | `filters` (names of the active filters), `active_count` | `src/pages/app/home.tsx` |
| `search_performed` | `active_count`, `result_count` (a filtered event search finished; there is no free-text search) | `src/pages/app/home.tsx` |
| `squad_viewed` | `event_id` (or null on the squads page), `squad_count` (never names or meeting points) | `src/components/shared/squads-panel.tsx`, `src/pages/app/squads.tsx` |

Identify: `posthog.identify(<supabase user id>)` when signed in; `reset()` on sign-out and on withdrawal.

### Server (database queue → Worker → PostHog `/batch/`)
Triggers write `public.analytics_outbox` only for people who currently allow Analytics. The `flush-analytics` job (pg_cron, every minute, only calls the Worker when something is queued) sends them; consent is checked again when claimed.

| Event | Trigger | Properties |
|---|---|---|
| `signed_up` | first Analytics "yes" of someone who has not finished onboarding (queued from `record_consent`), dated at account creation | none |
| `profile_completed` | `profiles.onboarding_completed_at` set | none |
| `join_requested` | `bookings` insert (every join goes through `join_event`) | `event_id`, `event_type`, `category_id`, `area_id`, `booking_status` |
| `request_approved` | booking becomes `approved` (instant, host decision or waitlist promotion) | same + `instant` |
| `reconfirmed` | booking becomes `confirmed` | `event_id`, `event_type`, `category_id`, `area_id` |
| `checked_in` | `checkins` insert | same + `method` (`qr`/`manual`) |
| `feedback_given` | first tags or host rating by a person for an event | same + `kind` (`tags`/`host_rating`) |
| `rebooked` | a booking by someone who already has an `attended` booking at another event | same + `same_host` |
| `partner_link_clicked` | Worker `/go/:id?u=<user id>` (the page adds `u` only for a signed-in person with Analytics consent; the Worker asks the database to confirm). The anonymous click counter runs regardless. | `event_id` |

Every server event: `distinct_id` = user id, `env`, original timestamp, `$lib = kollide-worker`.

### RESERVED for P1 (payments): not emitted in v1
| Event | Notes |
|---|---|
| `checkout_started` | emitted from the Worker when a payment order is created |
| `payment_captured` | emitted from the Worker when the Razorpay webhook confirms a payment |

## The funnel to build in PostHog
Insights → Funnel, ordered, conversion window 30 days, break down by `env` (filter to the environment you are checking):
`signed_up → profile_completed → join_requested → request_approved → reconfirmed → checked_in → feedback_given → rebooked`

## Session recordings
- Sampled **20% of consenting sessions** (`VITE_POSTHOG_RECORDING_SAMPLE`, decided per session). This stays under the free plan's 5,000 recordings a month up to about **25,000 consenting sessions a month**. If traffic grows past that, lower it to 0.1.
- In PostHog project settings set **minimum recording duration to 5 seconds** and keep the project's own sampling at 100% (sampling is done in the app).
- `maskAllInputs: true`. `ph-no-capture` (blocked entirely) is on: profile cards (profile, host inbox, connections, feedback people, check-in list), the profile edit form, onboarding, the settings page, the event address, squads, and the whole admin area.

## Retention and deletion
- `analytics_outbox` rows: purged 30 days after sending; deleted with the account; not in the data export (transient delivery state).
- PostHog data: set the project's data retention in PostHog. Deleting a person's PostHog data when they delete their account is **not automated** (needs a PostHog personal API key and a Worker route): do it by hand on request until it is.

## Marketing pixels
`loadMarketingPixels()` reads `VITE_META_PIXEL_ID` and `VITE_GOOGLE_ADS_ID`. It does nothing if both are empty or Marketing is not granted. The Content-Security-Policy only mentions Meta and Google when the ids are set.

## Checking it on staging
1. Set `POSTHOG_API_KEY` (Wrangler, staging), `VITE_POSTHOG_KEY` and `VITE_APP_ENV=staging` (Pages), and the Vault secrets for the cron job.
2. Test user A: open the site, **Accept all**, sign up, finish onboarding, join an event, get approved, reconfirm, check in, give tags. In PostHog the funnel shows A through `feedback_given` within a few minutes.
3. Test user B: **Reject all** and do the same. PostHog must show **nothing** for B: no events, no person, no recording. Also check the browser network tab for B: no request to `posthog.com`.
4. Withdraw A's Analytics in "Cookie settings": requests stop at once.

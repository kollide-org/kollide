# Launch checklist (production)

Tick each box in order. Items marked **[you]** can only be done in a dashboard, DNS or GitHub settings. Items marked **[checked in B9]** were
verified on the local stack by the test suite; **re-check them on staging and production** with the command shown.
`<domain>` is your real domain, `<ref>` is the production Supabase project reference.
**Stop rule:** the production workflow `promote-production` is run by a person, last, after everything above it is ticked.

## 0. Before anything
- [ ] The branch you launch from is merged to `main` and `CI` is green (lint, types, pgTAP, race, RLS, security **and** performance advisors, bundle secret scan, e2e).
- [ ] Staging has been running this exact commit for at least a day (`deploy-staging` runs on every push to `main`).
- [ ] **Staging checks** (run each against the staging project, never production):
  - [ ] Advisors: Supabase dashboard → Advisors (Security and Performance) show no warnings, or run `npx supabase db advisors --type security --linked --fail-on warn` and `--type performance` after `supabase link --project-ref <staging ref>`. *Unused-index notices are only meaningful with real traffic: review them after a week.*
  - [ ] Load: `SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… npm run load:join -- --yes-this-is-staging` ends with `OK … exactly 10 approved, no overbooking`. It signs the 51 test users in one at a time and waits when Auth answers 429; if that keeps failing, raise the staging verification limit (30 per 5 minutes per IP, `RATE_LIMITS.md`) for the test and put it back. It exits non-zero if any `@load.test` user is left behind.
  - [ ] Full journey by hand (see the milestone reports B5 to B8): sign up, onboard, join, approve, reconfirm, check in, feedback, report, admin moderates, delete account.
  - [ ] Analytics: the staging PostHog funnel shows a consenting test user, and nothing for one who rejected (`docs/backend/ANALYTICS.md`).

## 1. Supabase production project **[you]**
Create it in the **Mumbai** region. Free plan is fine to start; note the 500 MB database limit (the monitor warns at 400 MB).
- [ ] **Settings → API:** copy the project URL, `anon`/publishable key and `service_role` key. The service key goes only into Wrangler and GitHub secrets, never into the frontend.
- [ ] **Settings → API → JWT Keys:** use the **asymmetric (ECC P-256 / RSA) signing keys**. The Worker verifies tokens with the public keys (JWKS) and **rejects HS256**: if the project signs with a shared secret, every Worker call returns 401.
- [ ] **Database → Extensions:** `pg_cron`, `pg_net`, `pgcrypto`, `citext`, `supabase_vault` enabled (migrations also create them where allowed).
- [ ] **Authentication → URL Configuration:** Site URL `https://<domain>`; Redirect URLs `https://<domain>/auth/callback` (add the staging and `localhost` URLs only on staging, never here).
- [ ] **Authentication → Providers → Email:** enabled, **Confirm email on**, OTP length 6, expiry 600 s, minimum interval 60 s. Do **not** build a password flow.
- [ ] **Authentication → Email Templates:** paste the Kollide code email for *Confirm signup* and *Magic link* (`supabase/templates/otp.html`).
- [ ] **Authentication → SMTP:** Resend (host `smtp.resend.com`, port 465, user `resend`, password = the Resend key scoped to `auth.<domain>`, sender `auth@auth.<domain>`). See `AUTH_SETUP.md`.
- [ ] **Authentication → Rate Limits:** values in `RATE_LIMITS.md`.
- [ ] **Authentication → Providers → Google:** enabled (section 2), nonce check left on.
- [ ] **Recommended, not done in B9:** Cloudflare Turnstile CAPTCHA (Authentication → Attack Protection). The hosted email provider still accepts password sign-ups through the Auth API even though the app never offers them; CAPTCHA is the way to close that. It needs a small frontend change.
- [ ] **Database → Network Restrictions:** optional; if used, allow GitHub Actions' ranges for the backup job or use the pooler.
- [ ] **Settings → Database:** note the password; build `BACKUP_DB_URL` (session pooler connection string) for section 9.
- [ ] **Database → Backups:** note what the plan includes (point-in-time recovery is paid).

## 2. Google OAuth (production) **[you]**
- [ ] Google Cloud → APIs & Services → OAuth consent screen: app name Kollide, support email, authorised domain `<domain>`, privacy URL `https://<domain>/privacy`, terms URL. **Publish the app** (status "In production"), otherwise only test users can sign in.
- [ ] Credentials → OAuth client (Web): **Authorised JavaScript origins** `https://<domain>`; **Authorised redirect URI** `https://<ref>.supabase.co/auth/v1/callback` (and nothing for staging or localhost on the production client; make a separate client for staging).
- [ ] Paste the client id and secret into Supabase → Authentication → Providers → Google.
- [ ] Test: sign in with Google on production **after** deploy, with a real account.

## 3. Resend and Brevo production senders **[you]**
- [ ] Resend: domain `auth.<domain>` added and **Verified**; API key scoped to that domain (used only as Supabase SMTP password).
- [ ] Brevo: domain `mail.<domain>` added and **Verified**; sender `mail@mail.<domain>`; API key created for production only.
- [ ] DNS records in place: `EMAIL_DNS.md`. `npm run check:dns -- auth.<domain> mail.<domain>` is all PASS.
- [ ] Test email headers show `spf=pass dkim=pass dmarc=pass` (steps in `EMAIL_DNS.md`).
- [ ] DMARC starts at `p=none`; put a reminder two weeks out to move to `p=quarantine`.

## 4. Cloudflare R2 and images **[you]** (`R2_SETUP.md`)
- [ ] Buckets exist: `kollide-media` (public via custom domain), `kollide-private`, `kollide-backups`.
- [ ] `img.<domain>` is connected to `kollide-media` as a **custom domain**.
- [ ] CORS on `kollide-media` and `kollide-private`: PUT from `https://<domain>` only.
- [ ] R2 API token (Object Read & Write) for media and private buckets; a **second** token for `kollide-backups` with Object Read & Write (the prune step lists and deletes).
- [ ] Lifecycle rule on `kollide-backups`: delete after 14 days.

## 5. Worker (production) **[you]** + one code edit
- [ ] **Replace every placeholder in the `[env.production]` section of `workers/api/wrangler.toml`**: `KOLLIDE_DOMAIN`, `SUPABASE_URL` (`https://<ref>.supabase.co`), `ALLOWED_ORIGINS` (`https://<domain>`), `SITE_URL`, `R2_ACCOUNT_ID`, `EMAIL_FROM` (`mail@mail.<domain>`). Commit to `main`. `promote-production` **refuses to run** while `REPLACE` or `example.invalid` remain in that section.
- [ ] `EMAIL_ALLOWLIST` stays empty in production (it is the staging safety net).
- [ ] Custom domain: Workers → `kollide-api` (production) → Settings → Domains → add `api.<domain>`.
- [ ] Secrets, each with `npx wrangler secret put <NAME> --env production` (run from `workers/api`):
  `SUPABASE_SERVICE_ROLE_KEY`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `JOB_SHARED_SECRET` (a new random 32+ character value; the **same** value goes into Vault below), `BREVO_API_KEY`, `POSTHOG_API_KEY` (production PostHog project).
- [ ] Cloudflare rate-limiting rules on `api.<domain>`: `RATE_LIMITS.md`.
- [ ] Optional: repository variables `PROD_API_URL=https://api.<domain>` and `STAGING_API_URL` switch on the post-deploy smoke test and the 30-minute health check (`monitor.yml`).

## 6. Vault and scheduled jobs **[you]** (after the first deploy, in the SQL editor of the **production** project)
```sql
select vault.create_secret('https://api.<domain>', 'worker_url');
select vault.create_secret('<the same JOB_SHARED_SECRET>', 'job_shared_secret');
```
- [ ] Within five minutes: `select job, last_status, last_ok_at from public.job_runs order by job;` shows `ok` for `flush-email`, `flush-analytics`, `reconfirmation`, `reminders`, `reputation`, `attendance`, `feedback-windows`, `monitor`, `r2-cleanup`. (`housekeeping` and `reputation-nightly` run once a night.) `skipped` means the Vault secrets are missing or wrong.
- [ ] Admin → Jobs shows no job marked **Late** and emails today against the cap.
- [ ] `select * from cron.job order by jobname;` lists 11 jobs.

## 7. Frontend on Cloudflare Pages **[you]**
Build command `npm run build`, output `dist`, Node 22. Production environment variables:
- [ ] `VITE_SERVICES=real` (the default is `mock`!)
- [ ] `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (the **anon/publishable** key only)
- [ ] `VITE_API_URL=https://api.<domain>`, `VITE_MEDIA_URL=https://img.<domain>`, `VITE_R2_ACCOUNT_ID`
- [ ] `VITE_APP_ENV=production`, `VITE_POSTHOG_KEY` (production PostHog project), `VITE_POSTHOG_RECORDING_SAMPLE=0.2`
- [ ] `VITE_META_PIXEL_ID` and `VITE_GOOGLE_ADS_ID` **empty** until you run adverts
- [ ] Custom domain `<domain>` (and `www` redirecting to it).
- [ ] The build log shows no `[headers] … is not set` warnings (those mean a looser Content-Security-Policy).
- [ ] **Bundle check on the production build:** `npm run build` with the production variables, then `npm run check:bundle` prints `OK`. Also `grep -r "service_role" dist` finds nothing.
- [ ] Open the site: the cookie banner appears, and the browser network tab shows **no** request to `posthog.com`, `facebook` or `google` before you choose.

## 8. PostHog production **[you]**
- [ ] A separate **EU** project for production (`eu.posthog.com`), key in Wrangler and Pages (above).
- [ ] Project settings: minimum recording duration 5 s; recording sampling left at 100% (the app samples 20%); data retention set.
- [ ] Funnel created from `ANALYTICS.md`.

## 9. GitHub **[you]**
- [ ] Environment `production`: **required reviewers** set (so a person approves every promote).
- [ ] Environment secrets (staging and production each): `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
- [ ] **Backups:** repository secrets `BACKUP_DB_URL` (production session-pooler URL), `BACKUP_PASSPHRASE` (also in your password manager), `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (the backups token), `R2_ACCOUNT_ID`; then set the repository **variable** `BACKUP_ENABLED=true`.
- [ ] Run the workflow once by hand (Actions → Nightly backup → Run workflow) and confirm the file appears in `kollide-backups`.
- [ ] **Restore drill** with that real file: `RESTORE.md` ("The drill"). Record the result in the table there.
- [ ] Somebody watches Actions failures by email (a failed backup opens an issue).

## 10. Data: reference data only **[checked in B9]**
Reference data (areas, interests, languages, categories, tags) and the two `app_config` rows come **from the migrations**, so
`supabase db push` is all the production database needs. The demo seed (`supabase/seed.sql`: five demo users, a demo admin, 11 events)
is **local and staging only and is never run in production**: `promote-production` pushes without `--include-seed`.
After the first deploy, in the production SQL editor:
```sql
select count(*) from auth.users;                                    -- 0 (nobody has signed up yet)
select count(*) from public.events;                                 -- 0
select count(*) from auth.users where email like '%@kollide.test';  -- 0: no demo accounts
select count(*) from public.areas;                                  -- 30+
select key, value from public.app_config;                           -- payments_enabled = false, notice_version = "v1"
```
- [ ] Results as shown.
- [ ] **Make the first admin** (after you sign in once): `AUTH_SETUP.md` ("Admin bootstrap"). There is no admin in a fresh database.

## 11. Payments are off **[checked in B9]**
- [ ] `select private.payments_enabled();` returns `false` and `select value from public.app_config where key='payments_enabled';` is `false`.
- [ ] No admin can change it through the API (policy refuses it); only a migration or the service role can, in milestone P1.
- [ ] `select count(*) from public.events where pricing_mode='paid' or price_paise>0;` is 0.
- [ ] The Worker has no `/payments` or `/webhooks` routes and there is no Razorpay secret anywhere.

## 12. Security re-checks on the production project
- [ ] Advisors (Security and Performance): no warnings.
- [ ] `npm run db:rls` passes in CI; the catalog test (`250_catalog_hardening`) pins that every function has `search_path = ''`, that no definer function is exposed in `public`, and that visitors can call only five functions.
- [ ] `private` is **not** in Settings → API → Exposed schemas (only `public`, `graphql_public`). **[you]**
- [ ] The service key exists only in Wrangler and GitHub secrets (search your notes and chat history too).
- [ ] Storage buckets in Supabase Storage: none used.

## 13. Monitoring is live
- [ ] The monitor job is running: `select job, last_status, last_ok_at, run_count from public.job_runs where job = 'monitor';` shows `ok` and a recent `last_ok_at` (it runs every 15 minutes).
- [ ] Alerts set up in code: any job without a success in 2x its interval, emails at 80% of the daily cap (224 of 280), database over 400 MB. One alert per problem per day.
- [ ] Repository variables `PROD_API_URL` (and `STAGING_API_URL`) are set, and `monitor.yml` (hourly health check) is passing. Cost: about 720 runner minutes a month, free on a public repository; on a private one it counts against the plan's included minutes (delete the schedule if that matters). With both variables empty the job is skipped and uses no minutes.
- [ ] Known gap: alerts travel by email through the Worker. If `flush-email` itself is broken, admins only get the in-app notification, and `monitor.yml` only proves the Worker answers. Look at the Admin → Jobs page after launch week.
- [ ] `POSTHOG_API_KEY` is set on the Worker, or you accept that no server-side funnel events are sent (queued events older than 7 days are dropped, and an unset key is not an alarm).

## 14. Privacy, DPDP and legal
- [ ] `docs/backend/BREACH_RESPONSE.md` has the three contacts filled in, and the privacy page shows a contact address.
- [ ] Export and delete tested on staging with a real account (Settings → Export my data, Delete my account). **[checked in B9: pgTAP 270 + e2e]**
- [ ] The `r2-cleanup` job has run (`job_runs`), so deleted people's photos leave R2.
- [ ] Terms and safety pages: still placeholders in the app (milestone 3 stubs). Replace before inviting the public.

## 15. Promote **[you]**
- [ ] Everything above ticked. Actions → **Promote to production** → type `production` → approve the run.
- [ ] Watch the run: preflight, migrations, Worker deploy, smoke test.
- [ ] Immediately after: sections 6, 10 and the Google sign-in test.

## 16. After launch
- [ ] Day 1: `job_runs` all `ok`, Admin → Jobs clean, first backup file exists.
- [ ] Day 7: review unused/slow queries in Supabase Reports; check the PostHog funnel; check Brevo daily volume against the 280 cap (three emails per booking ≈ 90 bookings a day).
- [ ] Day 14: move DMARC to `p=quarantine` if reports are clean.
- [ ] Quarterly: restore drill, rotate secrets, review admin accounts.

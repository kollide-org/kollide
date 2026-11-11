# Environment variables and secrets

Never paste a value into chat, the repo, logs or a test fixture. Keep them in a password manager.

Places a value can live:
- **Local**: git-ignored files (`.env.local`, `workers/api/.dev.vars`, `supabase/.env`). Examples are committed as `*.example`.
- **GitHub**: Actions secrets. *Environment* secrets (`staging`, `production`) for deploys, *repository* secrets for the backup.
- **Wrangler**: Worker secrets set with `npx wrangler secret put NAME --env staging|production`.
- **Supabase dashboard**: settings you paste into the project (Auth providers, SMTP).

> v1 has no payments, so there are no Razorpay variables. Payment secrets are added in P1: see `PAYMENTS_LATER.md`.

## Needed for B0 (CI and deploys)

| Name | Purpose | Where it lives |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | Lets the CLI link and run `db push` | GitHub, environments `staging` and `production` |
| `SUPABASE_PROJECT_ID` | Project ref (the id in the project URL) | GitHub, per environment (staging value, production value) |
| `SUPABASE_DB_PASSWORD` | Database password for `db push` | GitHub, per environment |
| `CLOUDFLARE_API_TOKEN` | Lets `wrangler deploy` publish the Worker (Workers edit permission) | GitHub, per environment |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account | GitHub, per environment |

## Worker (`workers/api`)

| Name | Kind | Purpose | Where it lives |
|---|---|---|---|
| `ENVIRONMENT` | variable | `local`, `staging` or `production`; also sent to PostHog later | `wrangler.toml` |
| `KOLLIDE_DOMAIN` | variable | The site domain. Never hard-coded in code. **You must set it.** | `wrangler.toml` (per environment) |
| `SUPABASE_URL` | variable | Project URL. **Replace the two `REPLACE_*_REF` placeholders.** | `wrangler.toml` (per environment), local default `http://127.0.0.1:54321` |
| `SUPABASE_SERVICE_ROLE_KEY` | secret | Admin database access from the Worker only. Bypasses RLS. | Wrangler (per env); `.dev.vars` locally |
| `JOB_SHARED_SECRET` | secret | Header secret (`X-Job-Secret`) for job endpoints such as `/jobs/r2-cleanup`. Called by hand in B3 and by `pg_cron` from B5. | Wrangler; Supabase Vault (B5); `.dev.vars` |
| `BREVO_API_KEY` | secret | Send non-login email through Brevo (`EMAIL_JOBS_SETUP.md`). B5. | Wrangler; `.dev.vars` |
| `SITE_URL`, `EMAIL_FROM`, `EMAIL_FROM_NAME`, `EMAIL_ALLOWLIST` | variable | Links in emails, the verified sender, and (staging) the team addresses allowed to receive email. B5. | `wrangler.toml` (per environment) |
| `worker_url`, `job_shared_secret` | Vault secrets | Where `pg_cron` calls the Worker, and the shared secret for `/jobs/*`. B5. | Supabase Vault (per project), set in SQL Editor |
| `R2_ACCOUNT_ID`, `R2_MEDIA_BUCKET`, `R2_PRIVATE_BUCKET`, `ALLOWED_ORIGINS` | variable | R2 account, bucket names and the site origins allowed to call the API. B3. | `wrangler.toml` (per environment) |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | secret | Presigned upload and view links (R2 API token, Object Read and Write). B3. | Wrangler; `.dev.vars` |
| `MEDIA`, `PRIVATE` | R2 bindings | Delete and list objects in the buckets. B3. | `wrangler.toml` (per environment) |
| `POSTHOG_API_KEY` | secret | Server-side funnel events (EU host). B8. | Wrangler; `.dev.vars` |

## Frontend (`.env.local`, and Cloudflare Pages environment variables for builds)

These are public by design (they end up in the browser). Never put a secret here. See `.env.example`.

| Name | Purpose | Where it lives |
|---|---|---|
| `VITE_SERVICES` | `mock` (default) or `real` | `.env.local`; Pages env vars |
| `VITE_SUPABASE_URL` | Project URL | `.env.local`; Pages env vars |
| `VITE_SUPABASE_ANON_KEY` | Public (anon or publishable) key | `.env.local`; Pages env vars |
| `VITE_API_URL` | Worker base URL (`https://api.<domain>`); used in the CSP | `.env.local`; Pages env vars |
| `VITE_MEDIA_URL` | Image host (`https://img.<domain>`); where photos load from, and used in the CSP | `.env.local`; Pages env vars |
| `VITE_R2_ACCOUNT_ID` | Cloudflare account ID; the CSP allows uploads to that R2 host only | `.env.local`; Pages env vars |
| `VITE_POSTHOG_KEY` | PostHog project key (B8) | `.env.local`; Pages env vars |

The build writes `dist/_headers` (the Content-Security-Policy) from these values, so Pages must have `VITE_SUPABASE_URL`, `VITE_API_URL` and `VITE_MEDIA_URL` set for the CSP to name the real hosts. The build prints a warning when one is missing.

## Local Supabase (`supabase/.env`)

| Name | Purpose |
|---|---|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in. Provider is off until B2. Local values come from the Google Cloud OAuth client. |

## Supabase dashboard (per project, B2)

Exact steps are in `AUTH_SETUP.md` (sign-in), `R2_SETUP.md` (images) and `EMAIL_JOBS_SETUP.md` (email and scheduled jobs): Google provider (client id and secret), URL configuration, email code settings and templates, Resend SMTP (host `smtp.resend.com`, port 465, user `resend`, API key, sender `auth@auth.<domain>`), rate limits.

## Backup workflow (disabled until you set the repo variable `BACKUP_ENABLED=true`)

Repository secrets, not environment secrets:

| Name | Purpose |
|---|---|
| `BACKUP_DB_URL` | Production Postgres connection string (session pooler, with password) |
| `BACKUP_PASSPHRASE` | Encrypts each dump. Lose it and the backups are unreadable. |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | R2 API token with write access to `kollide-backups` |

Also add an R2 lifecycle rule to expire objects after 14 days; the workflow prunes too, but the rule is the safety net.

## GitHub setup order

1. Settings > Environments: create `staging` and `production`. On `production`, add yourself as a required reviewer.
2. Add the five B0 secrets to `staging` (staging values).
3. Add the same five names to `production` (production values).
4. Settings > Branches: protect `main` (pull request required, require the `checks` status check).
5. Later, when enabling backups: add the repository secrets above, then set the repository variable `BACKUP_ENABLED` to `true`.
6. Worker secrets are not in GitHub: set them with `wrangler secret put` as each milestone needs them.

Until step 2 is done, the `Deploy staging` workflow will fail on push to `main`. That is expected.

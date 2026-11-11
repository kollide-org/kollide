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
| `JOB_SHARED_SECRET` | secret | Header secret for job endpoints called by `pg_cron`. B5. | Wrangler; Supabase Vault; `.dev.vars` |
| `BREVO_API_KEY` | secret | Send non-login email. B5. | Wrangler; `.dev.vars` |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | secret | Presigned upload links. B3. | Wrangler; `.dev.vars` |
| `POSTHOG_API_KEY` | secret | Server-side funnel events (EU host). B8. | Wrangler; `.dev.vars` |

## Frontend (`.env.local`, built into the site by Cloudflare Pages)

These are public by design. Never put a secret here.

| Name | Purpose | Where it lives |
|---|---|---|
| `VITE_SERVICES` | `mock` or `real` | `.env.local`; Pages env vars |
| `VITE_SUPABASE_URL` | Project URL | `.env.local`; Pages env vars |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public (anon) key | `.env.local`; Pages env vars |
| `VITE_API_URL` | Worker base URL | `.env.local`; Pages env vars |
| `VITE_POSTHOG_KEY` | PostHog project key (B8) | `.env.local`; Pages env vars |

## Local Supabase (`supabase/.env`)

| Name | Purpose |
|---|---|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in. Provider is off until B2. Local values come from the Google Cloud OAuth client. |

## Supabase dashboard (per project, B2)

- Google provider: client id and secret.
- Custom SMTP: Resend host, port, user, SMTP key, sender `auth.<domain>`.

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

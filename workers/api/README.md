# Kollide API Worker

Hono on Cloudflare Workers. Handles only work that needs secrets: upload links, email sending, jobs. Payments are off in v1 (see `docs/backend/PAYMENTS_LATER.md`). Everything else goes straight from the browser to Supabase under Row Level Security.

## Run

```bash
npm install        # from this folder
cp .dev.vars.example .dev.vars   # then fill it in
npm run dev        # http://localhost:8787/health
npm test
```

## Config

Plain variables live in `wrangler.toml` per environment (`staging`, `production`): `ENVIRONMENT`, `KOLLIDE_DOMAIN`, `SUPABASE_URL`. Replace the `TODO` values before the first deploy.

## Secrets (listed, not set)

Set each with `npx wrangler secret put <NAME> --env staging` (and `--env production`). Never put them in the repo.

| Secret | Needed from |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | first server route that writes data |
| `JOB_SHARED_SECRET` | B5 (job endpoints called by `pg_cron`) |
| `BREVO_API_KEY` | B5 |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ACCOUNT_ID` | B3 |
| `POSTHOG_API_KEY` | B8 |

Full details: `docs/backend/ENV.md`.

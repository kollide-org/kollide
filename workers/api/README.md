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
| `JOB_SHARED_SECRET` | B3 (`/jobs/r2-cleanup`; `pg_cron` calls it from B5) |
| `BREVO_API_KEY` | B5 (see `docs/backend/EMAIL_JOBS_SETUP.md`) |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | B3 (see `docs/backend/R2_SETUP.md`) |
| `POSTHOG_API_KEY` | B8 (optional; see `docs/backend/ANALYTICS.md`) |

Full details: `docs/backend/ENV.md`.

## Routes
| Route | Who | What |
|---|---|---|
| `GET /health` | anyone | liveness |
| `POST /uploads/sign` | signed-in | 5-minute presigned upload link for a profile photo, event cover, hub art or selfie; the database decides who may |
| `GET /admin/selfies/:id/view` | admins | 5-minute link to a pending selfie |
| `POST /jobs/r2-cleanup` | `X-Job-Secret` | deletes queued and orphaned R2 objects |
| `POST /jobs/flush-email` | `X-Job-Secret` | sends queued emails through Brevo (20 a run, 280 a day, critical first) |
| `GET /go/:eventId` | anyone | partner ticket redirect |
| `GET /dev/mail` | local only | the local dev mailbox |
| `PUT /dev/upload/...`, `GET /media/...`, `GET /dev/private/...` | local only | simulated R2 for development and tests (404 elsewhere) |

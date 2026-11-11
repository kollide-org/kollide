# Email and scheduled jobs: what to set up, per environment

Do this for **staging** first, then **production**. `<domain>` is your real domain (`KOLLIDE_DOMAIN`). Sign-in codes are separate: they use Resend (see `AUTH_SETUP.md`). Everything else (request received, approved, waitlisted, declined, "Still coming?", reminders, event cancelled) goes through **Brevo**, from the `email_outbox` table. Never paste a key into chat.

## How it works
1. Every booking change inserts a row into `email_outbox` and a row in `notifications` (the bell in the app).
2. Every minute, `pg_cron` calls the Worker (`POST /jobs/flush-email`) through `pg_net`. The Worker sends up to 20 emails per run through Brevo, critical ones first (approved, "Still coming?", event cancelled), and never more than **280 a day** (UTC). A failed email is tried again up to 3 more times, with growing delays.
3. Every 15 minutes the database sends "Still coming?" for approved bookings 24 hours or less from the start, releases seats that were not reconfirmed by 6 hours before the start, promotes the waitlist and completes ended events. Every 30 minutes it sends day-of reminders. Nightly it cleans old rows.
4. Each job writes its last run to `job_runs`: look at **Admin > Jobs** in the app.

Emails never contain the exact address. They link to the event page, where only people with a place see it.

## 1. Brevo (https://www.brevo.com)
1. Create a free account. Free plan: 300 emails a day.
2. **Senders, Domains & Dedicated IPs > Domains > Add a domain**: `mail.<domain>`.
3. Brevo shows DNS records (a Brevo code, DKIM, and a DMARC suggestion). Add each in **Cloudflare > DNS** for `<domain>` (names as Brevo shows them). Click **Authenticate** until the domain says verified.
4. DMARC: add one `TXT` record `_dmarc.mail.<domain>` with `v=DMARC1; p=none; rua=mailto:you@<domain>`. After two clean weeks change `p=none` to `p=quarantine`.
5. **SMTP & API > API keys > Generate a new API key**, name `kollide-staging` (and a second one for production). Copy it into your password manager.

## 2. Worker settings
In `workers/api/wrangler.toml`, for the environment, replace the `TODO` values:
- `SITE_URL`: the site address, no trailing slash (staging: your Pages URL; production: `https://<domain>`). Email links use it.
- `EMAIL_FROM`: `mail@mail.<domain>` (any address at the verified domain).
- `EMAIL_ALLOWLIST` (staging): your team addresses, comma separated, for example `you@example.com,friend@example.com`. **Staging sends only to these.** Everyone else is marked skipped, so testers with fake addresses never get mail. Leave it empty on production.

Then, from `workers/api`:
```bash
npx wrangler secret put BREVO_API_KEY --env staging
```
(`JOB_SHARED_SECRET` is already set from `R2_SETUP.md`.) Repeat with `--env production` for production.

## 3. Tell the database where the Worker is (Supabase Vault)
The every-minute job reads these two values from Vault, so nothing secret is in the repo. In the Supabase dashboard open **SQL Editor** (staging project first) and run, with your own values:

```sql
select vault.create_secret('https://<your worker address>', 'worker_url');
select vault.create_secret('<the same JOB_SHARED_SECRET you set on the Worker>', 'job_shared_secret');
```
To change one later: `select vault.update_secret((select id from vault.secrets where name = 'worker_url'), 'https://new-address');`

Until both exist, the job records "skipped" in **Admin > Jobs** and emails simply wait in the queue.

## 4. Check that it works (staging)
1. Wait one minute. **Admin > Jobs** shows `flush-email` with status `ok` (or `skipped` if Vault is not set yet).
2. With two test accounts: one asks to join an event (the host account must be an address on your allow-list, and so must the guest, or the guest's email is skipped). The host approves. The guest gets "You're in" and the event page shows the exact address.
3. A waitlisted guest gets "A spot opened up" when an approved guest cancels.
4. **"Still coming?" by hand:** sign in as an admin, open `/app/host/events/<event id>/inbox`, and click **Send "Still coming?" now (test)** next to an approved guest. The email arrives within a minute with a one-tap button; tapping it confirms the booking (also when not signed in).
5. To run the sender right now instead of waiting a minute:
```bash
curl -X POST https://<worker address>/jobs/flush-email -H "X-Job-Secret: <JOB_SHARED_SECRET>"
```
It returns how many emails it sent.
6. See what the cron has done: in SQL Editor, `select jobname, status, return_message, start_time from cron.job_run_details order by start_time desc limit 10;`

## Limits and what to watch
- Brevo free: 300 a day. The Worker stops at 280 and **Admin > Jobs** shows a warning once 224 have gone out in a day. Roughly 3 emails per booking means about 90 bookings a day before the cap; upgrade or add a provider before that.
- Cloudflare free Workers allow 50 outgoing requests per call, so the Worker sends 20 emails a run.
- If a job shows `error` in **Admin > Jobs**, the message is in the card. A stopped job shows an old "last run" time.

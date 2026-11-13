# Rate limits: what is set, and the dashboard steps for you

Three layers. The first is in the database and already deployed with the migrations; the other two are dashboard settings that
only you can make.

## 1. In the database (done)
Per person, per UTC day, counted in `rate_limits` by `private.check_rate_limit`. Only successful actions count (a refused call
rolls back with its counter). Cleared after 3 days by the nightly housekeeping job.

| Action | Limit / day | Where |
|---|---|---|
| Ask to join an event | 20 | `join_event` |
| Report someone | 5 | `report` |
| Appeal | 3 | `create_appeal` |
| Give tags / private feedback / meet again | 60 / 10 / 60 | `give_tags`, `submit_private_feedback`, `tap_meet_again` |
| Ask to join a squad / start a squad | 30 / 10 | `request_to_join_squad`, `create_squad` |
| Apply to host | 3 | `apply_to_host` |
| Create an event / send one for review | 20 / 10 | `create_event`, `submit_event_for_review` |
| Ask for an upload link | 60 | `authorize_upload` |
| Record a cookie choice | 30 per anonymous id, **plus 5,000 a day for all logged-out visitors together** | `record_consent` |

Not limited on purpose: export, delete account, onboarding, marking notifications read.

## 2. Supabase Auth (dashboard)
Dashboard → your **production** project → **Authentication → Rate Limits**. Set:

| Setting | Value | Why |
|---|---|---|
| Rate limit for sending emails | **30 per hour** | Sign-in codes go through Resend (100 a day on the free plan); this stops one person using the day's quota |
| Rate limit for sign-ups and sign-ins | **30 per 5 minutes per IP** (or lower) | slows code guessing |
| Rate limit for token verifications | **30 per 5 minutes per IP** | the 6-digit code has 1,000,000 values; keep guesses scarce |
| Rate limit for token refreshes | default (150) | |
| Rate limit for anonymous users | irrelevant (anonymous sign-in is off) | |

Also: **Authentication → Providers → Email**: keep "Confirm email" on, OTP length 6, expiry 600 s, "minimum interval between emails" 60 s.
The hosted email provider also accepts password sign-ups through the Auth API even though the app never shows a password box. If
you want to close that, turn on **CAPTCHA protection** (Authentication → Attack Protection → Cloudflare Turnstile): it needs a small
frontend change (a Turnstile widget on the sign-in page and its hosts in the Content-Security-Policy), so it is listed as a
recommendation in the launch checklist, not done.

## 3. Cloudflare rate-limiting rule on `api.<domain>` (dashboard)
Cloudflare dashboard → your domain → **Security → WAF → Rate limiting rules → Create rule**. The free plan allows a small number
of rules with one counting characteristic (IP); check the limits shown on that page.

**Rule 1: the public redirect**
- Name: `go-redirect`
- If incoming requests match: Hostname equals `api.<domain>` **and** URI Path starts with `/go/`
- Counting characteristic: IP · **30 requests per 1 minute**
- Action: Block for 10 minutes (or Managed Challenge).

**Rule 2: uploads and admin**
- Name: `uploads-admin`
- Hostname equals `api.<domain>` **and** (URI Path starts with `/uploads/` **or** starts with `/admin/`)
- IP · **60 requests per 1 minute** · Block for 10 minutes.

**Do not rate limit** `/jobs/*` (Supabase calls it from its own servers every minute and the shared secret already protects it)
or `/health` (the health check and uptime monitor use it).

Check it works: `for i in $(seq 1 40); do curl -s -o /dev/null -w "%{http_code} " https://api.<domain>/go/00000000-0000-4000-8000-000000000000; done` should
end in `429`s. Then check a normal request still works.

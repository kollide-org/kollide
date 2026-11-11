# Kollide backend: standing rules for every Claude Code session

These rules apply to every session that touches `supabase/`, `workers/`, `src/services/` or anything else on the backend. The full plan is in `docs/backend/BACKEND_PLAN.md`. Read it before starting a milestone.

## Stack (locked; ask before changing anything here)
- **Database, auth, permissions:** Supabase (Postgres, Supabase Auth, Row Level Security, `pg_cron`, `pg_net`). Region: Mumbai.
- **Server code:** one Cloudflare Worker in `workers/api/`, using Hono and TypeScript, deployed with Wrangler. Environments: `staging`, `production`.
- **Images:** Cloudflare R2. Buckets: `kollide-media` (public, random UUID keys), `kollide-private` (selfies), `kollide-backups`. Staging buckets have a `-staging` suffix.
- **Email:**
  - Sign-in codes go through Resend, set up as Supabase Auth's custom SMTP server.
  - Everything else goes through the Brevo API, sent from the `email_outbox` table.
- **Payments:** **NOT in v1.** No money moves through Kollide. Keep the payment seams described in `docs/backend/PAYMENTS_LATER.md`:
  - `app_config.payments_enabled = false`;
  - reserved booking states;
  - one seat-locking join function;
  - a Worker provider interface with no implementation.

  Do not add Razorpay code, routes, secrets, CSP entries or tables until milestone P1 is explicitly started.
- **Analytics:** PostHog **EU Cloud**, loaded only after the user gives consent.
- **Frontend:** the existing Vite + React + TypeScript app on Cloudflare Pages. Backend work only changes `src/services/*`, `src/types/database.ts`, and the auth and consent wiring.
- **Domain:** read it from the `KOLLIDE_DOMAIN` config. Never hard-code it.

## Hard rules
1. **Ask first** before you:
   - change the stack;
   - add any paid service or paid package;
   - store a new kind of personal data;
   - build anything marked "Not in v1" in the plan;
   - touch the production project.
2. **Every schema change is a new migration** in `supabase/migrations/`. Never edit a migration that has already been merged to `main`.
3. **Every table has Row Level Security switched on**, with explicit policies. With no policy, the table is closed to everyone. Each new table gets a pgTAP test proving that a stranger cannot read or change it.
4. **Rules live on the server, not only in React.** Seats, money, reviews, roles and status checks go in Postgres functions (`SECURITY DEFINER`, with `search_path` set, checking `auth.uid()`) or in the Worker.
5. **Never trust the browser for:**
   - prices;
   - payment success (only the Razorpay webhook confirms a payment);
   - roles;
   - attendance;
   - who may see the exact address.
6. **Keep private data in private tables.** Phone, date of birth, last name, exact address and selfies stay in private tables or the private bucket, and are never returned to other users.
7. **Calculate, don't store.** Reliability, tag counts, ratings, credit balances and spots left are computed with views or functions, never stored as editable numbers.
8. **Keep secrets out of the repo.**
   - Never put the service-role key, Brevo or Resend keys, R2 keys or any other secret in code, logs, test fixtures or chat output.
   - Local secrets go in `workers/api/.dev.vars` and `.env.local`, both git-ignored.
   - Deployed secrets go in GitHub Actions secrets and are set with `wrangler secret put`.
9. **Regenerate types after every migration:** run `supabase gen types typescript` and write the result to `src/types/database.ts`.
10. **Keep the mock switch working.** The frontend's mock/real flag must keep working. Replace mock services one by one, never all at once.
11. **Don't break the Worker's CPU budget.** It is 10 ms per request on the free plan: no heavy work, no big dependencies, and use the WebCrypto API for HMAC and JWT checks.
12. **Analytics:**
    - Identify PostHog users by their Supabase user id only. Never send email, name or phone.
    - Mask every input in session recordings, and mark profile cards, the host inbox, phone, date of birth and addresses with `ph-no-capture`.
13. **Use current docs.** Use Context7 for Supabase, Cloudflare (Workers, R2, Wrangler), Hono, Brevo, Resend and PostHog (and Razorpay in P1). Don't write APIs from memory.
14. **Payment seams must stay working.**
    - Every booking path goes through the single join function.
    - Never write a booking straight to `confirmed` or `paid` from anywhere else.
    - Keep `price_paise` and the `paid` pricing mode in the schema, refused by a check while `payments_enabled = false`.
15. **Supabase MCP (if connected):** use it read-only, and only against the local or staging project. Never production.

## How to work
- **Start each milestone with a plan, and wait for my "go".** The plan lists:
  - migrations;
  - functions and endpoints;
  - frontend services to switch from mock to real;
  - tests;
  - anything you need from me (keys, accounts, decisions).
- **Work on a branch named `be/<milestone>-<topic>`.** Keep commits small, with clear messages.
- **Only one open pull request may change `supabase/migrations/` at a time.** If another branch has a migration pending, stop and tell me.
- **Before saying a task is done, run all of these and report the results:**
  - lint;
  - type check;
  - `supabase test db` (pgTAP);
  - the Worker tests (Vitest);
  - the RLS check script.
- **End every milestone with a short report:**
  - what changed;
  - how it was tested;
  - what I need to check by hand on staging;
  - open questions;
  - what's next.
- **If the plan conflicts with reality, stop and tell me.** For example, a free-tier limit or an API that changed. Suggest the closest alternative instead of quietly working around it.

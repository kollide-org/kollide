# Breach response (personal data)

For anything that might have exposed people's personal data: a leaked key, a database or backup in the wrong hands, a bug that
showed someone else's data, an admin account taken over, a lost laptop with access. **Act first, write it up after.** Fill in the
two contact lines below before launch; they are blank on purpose (this file does not know your names or address).

| Role | Name | How to reach |
|---|---|---|
| Incident lead (decides, talks to the regulator) | _fill in_ | _phone + email_ |
| Technical lead (contains and fixes) | _fill in_ | _phone + email_ |
| Grievance / data protection contact (also shown to users) | _fill in_ | _email on the privacy page_ |

## What we hold, and where
| Data | Where | Sensitivity |
|---|---|---|
| Name, email, phone, date of birth, gender | Supabase Postgres (`profile_private`, `auth.users`) | high |
| Photos | Cloudflare R2 `kollide-media` (public, random file names) | medium |
| Selfies | R2 `kollide-private`, deleted after review | high |
| Exact event addresses (some are homes) | Postgres `event_private` | high |
| Private feedback, reports, moderation records | Postgres | high |
| Bookings, attendance, tags | Postgres | medium |
| Emails sent (address + template) | Brevo, Resend | medium |
| Analytics (user id, events, recordings if consented) | PostHog EU | low to medium |
| **Everything above in a backup** | R2 `kollide-backups`, encrypted (AES-256) | high, protected by the passphrase |
| Secrets: service key, R2 and Brevo keys, job secret, backup passphrase | Wrangler, GitHub, Supabase | critical |

## First hour: contain
1. **Stop the bleeding.** If a key leaked, rotate it now (list below). If an account is the cause, ban it (Admin → Users). If a bug exposes data, switch the feature off: deploy the fix, or revert the last deployment in Cloudflare (Workers → Deployments → Rollback; Pages → Deployments → Rollback).
2. **Rotate what might be exposed.**
   - Supabase service-role key and JWT signing keys: Dashboard → Settings → API. Then `wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production` and update the GitHub secrets.
   - Database password: Settings → Database → reset, then update `SUPABASE_DB_PASSWORD` and `BACKUP_DB_URL`.
   - R2 API token, Brevo key, Resend key, `JOB_SHARED_SECRET` (also in Vault `job_shared_secret`), `POSTHOG_API_KEY`, `BACKUP_PASSPHRASE` (old backups stay readable only with the old passphrase: keep it until they expire).
3. **Sign people out** if sessions may be stolen: Supabase → Authentication → Users, or rotate the JWT signing key (signs everyone out).
4. **Preserve evidence.** Do not delete logs. Export the Admin → Audit log, Supabase logs (Logs → API, Auth, Postgres) and Cloudflare logs for the period. Note times in IST and UTC.

## Same day: assess
Answer in writing: **what** data, **whose** (how many people), **when** it started and stopped, **how** it happened, **is it still happening**, and **could it be used to harm people** (addresses of homes, phone numbers, selfies and private feedback are the worst).
- Use the audit log (`admin_audit_log`), `consents`, `job_runs`, and the Supabase and Cloudflare logs to bound it.
- Private feedback authors are never visible to admins, so a leak of that table is still serious but cannot name authors; say so if it applies.

## Notify (India, DPDP Act 2023)
A personal data breach must be reported to the **Data Protection Board of India** and to **each affected person**, in the form and time the Board's rules set (check the current DPDP Rules; do not rely on a number written here). Do not wait for certainty: tell the Board what you know and update it.
- **Affected people:** email each one (we have addresses in `auth.users`/`profile_private`). Say plainly what happened, what data, what we have done, what they should do (for example "treat unknown calls with care"), and who to contact. Do not blame, do not minimise. Send in two batches if the 280-a-day Brevo cap would delay it (the queue sends the rest after midnight UTC, critical first).
- **Processors:** tell Supabase, Cloudflare, Brevo, Resend and PostHog support if their systems are involved.
- **Police / CERT-In:** serious incidents (account takeover, ransomware, data theft) must also be reported to CERT-In within its deadline (currently 6 hours for specified incident types; confirm the current rule).

## After: record and learn
1. Write an incident report within a week: timeline, cause, data, people, what we told whom and when, what we changed.
2. Fix the cause and add a test (pgTAP for database rules, Vitest for the Worker) so it cannot come back.
3. Review the monitoring and alerts: would we have noticed sooner? (`job_monitor`, advisors, the health check.)
4. Keep the report for at least 3 years.

## Drill
Once before launch, walk through "the service key was committed to a public repository": rotate it, redeploy, confirm the old key is refused. Note the time it took.

# Restoring a backup

Backups are an **encrypted `pg_dump`** of the whole production database, made every night by `.github/workflows/nightly-backup.yml`
and kept in the R2 bucket `kollide-backups` for 14 days. This page is how to get one back. **Practise it once before launch and
after any change to the backup job** (the drill is at the end).

## What is and is not in a backup
| In the dump | Not in the dump (set up again by hand) |
|---|---|
| Every table, function, view, RLS policy and grant in `public` and `private` | Supabase **Auth settings** (providers, templates, SMTP, rate limits, JWT signing keys) |
| Users and their sessions' data in `auth` (emails, identities) | **Vault secrets** (`worker_url`, `job_shared_secret`): re-create them with `vault.create_secret` |
| The `pg_cron` job definitions (`cron.job`) | **R2 files** (photos, covers; selfies are deleted anyway): they are in the R2 buckets, not the dump |
| Reference data, app_config, audit log, consents | **Worker secrets** and Pages variables |
| | Passwords: nobody has one (sign-in is Google or an email code) |

A backup contains personal data. It is encrypted with `BACKUP_PASSPHRASE` (AES-256, PBKDF2). Keep the passphrase in a password
manager, **separate from GitHub**: if GitHub is the only place it lives, losing access to GitHub loses every backup.

## Restore, step by step
1. **Create a new, empty Supabase project** (same region). Never restore over production while it is still serving people.
2. In its SQL editor enable the extensions the dump needs: `pg_cron`, `pg_net`, `pgcrypto`, `citext`, `supabase_vault`.
3. **Get the file.** Cloudflare dashboard → R2 → `kollide-backups` → download the newest `kollide-<date>.dump.enc` (or `aws s3 cp s3://kollide-backups/<file> . --endpoint-url https://<account>.r2.cloudflarestorage.com`).
4. **Decrypt.**
   ```bash
   openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass env:BACKUP_PASSPHRASE -in kollide-<date>.dump.enc -out kollide.dump
   pg_restore --list kollide.dump | head      # a readable list means the file is good
   ```
5. **Restore** with the new project's database URL (Settings → Database → connection string, direct or session pooler, password reset if needed). Use PostgreSQL 17 client tools.
   ```bash
   pg_restore --clean --if-exists --no-owner --no-privileges --dbname "postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" kollide.dump
   ```
   A handful of messages are normal (objects that Supabase owns, `cron` objects the first time). Read every other error.
6. **Re-create what is not in the dump:** Vault secrets, Auth settings (follow `AUTH_SETUP.md`), then check `cron.job` has the jobs.
7. **Check it:** `select count(*) from public.profiles;`, `select * from public.job_runs;`, then run the checks in `LAUNCH_CHECKLIST.md` against the new project.
8. **Cut over:** point the Worker (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `wrangler.toml`), Pages (`VITE_SUPABASE_URL`, anon key) and the Vault `worker_url` at the new project; add the new project to the Google OAuth redirect URIs.

**Point-in-time recovery:** the nightly dump loses up to a day. Paid Supabase plans add point-in-time recovery from the dashboard (Database → Backups): use that first if you are on one. The free plan has only this nightly dump.

## The drill (do it before launch, then every quarter)
1. Local proof the procedure works: `npm run db:restore-test` (dumps, encrypts, decrypts, empties a copy of the local database, restores into it, compares every table and function count, drops the copy). It must end with `OK`.
2. Real proof with production data: download last night's file from R2, then
   ```bash
   BACKUP_FILE=kollide-<date>.dump.enc BACKUP_PASSPHRASE=... bash scripts/restore-test.sh
   ```
   (restores into a scratch database on your local Supabase stack and prints each table's row count; compare with the counts in production).
3. Write the date and the result at the bottom of this file.

| Date | Who | Source | Result |
|---|---|---|---|
| 2026-11-13 | B9 (local stack) | local database, encrypted dump, restored into an emptied copy | tables and functions restored from the archive alone; matched |
| | | production dump | **to do before launch** |

## Keeping the free project from pausing
Supabase pauses free projects after a week without activity. The nightly job connects and runs `pg_dump`, which is database activity,
and `pg_cron` runs inside the database every minute. **We have not verified Supabase's exact definition of "activity"**, so treat this
as likely, not certain: after launch, check the dashboard shows no "will be paused" warning, and on a paid plan the point is moot.
GitHub also **disables scheduled workflows after 60 days with no repository activity**: if the repo goes quiet, run the workflow
by hand (Actions → Nightly backup → Run workflow) now and then. A failed backup opens a GitHub issue automatically.

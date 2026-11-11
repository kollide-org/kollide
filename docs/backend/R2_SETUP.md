# R2 setup (images): what to click, per environment

Do this once for **staging** (buckets with the `-staging` suffix) and once for **production**. `<domain>` is your real domain (`KOLLIDE_DOMAIN`). Never paste a key into chat; keep everything in your password manager.

R2 needs a card on your Cloudflare account to switch on, and charges nothing inside the free limits (10 GB stored). Set a billing notification first (Cloudflare dashboard > Manage account > Billing > Notifications).

## 1. Buckets
Cloudflare dashboard > **R2 object storage > Create bucket**. Create these, location **Automatic**:

| Environment | Buckets |
|---|---|
| Staging | `kollide-media-staging`, `kollide-private-staging` |
| Production | `kollide-media`, `kollide-private`, `kollide-backups` |

Keep **Public access disabled** for `kollide-private*` and `kollide-backups`. Never make them public.

## 2. Public address for the media bucket (needs the domain)
Open `kollide-media-staging` > **Settings > Custom Domains > Add**: `img-staging.<domain>`. For production, `kollide-media`: `img.<domain>`. The domain must be on Cloudflare DNS. Wait until it says **Active**.

Do **not** use the `r2.dev` address for production: it is rate-limited. If the domain is not ready and you want to test staging anyway, open the staging media bucket > **Settings > Public access > r2.dev subdomain > Allow Access** and use that address as `VITE_MEDIA_URL`. Turn it off again once the domain works.

Photos are public by design, with random file names (decided in the plan). Selfies are never public.

## 3. CORS (lets the browser upload)
For **each** of `kollide-media*` and `kollide-private*`: **Settings > CORS Policy > Add CORS policy**, paste:

```json
[
  {
    "AllowedOrigins": ["https://<your site origin for this environment>", "http://localhost:5173"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```
Staging origin: your Pages preview/staging URL. Production origin: `https://<domain>`. Leave `http://localhost:5173` out of the production policy.

## 4. API token for presigned links
**R2 object storage > Manage API tokens > Create API token**:
- Permissions: **Object Read & Write**
- Specify bucket(s): only that environment's `kollide-media*` and `kollide-private*`
- TTL: forever, or a date you will remember

Copy the **Access Key ID** and **Secret Access Key** (shown once). Your **Account ID** is on the R2 overview page (right side).

## 5. Worker secrets and variables
In a terminal, from `workers/api` (log in once with `npx wrangler login`). Run each command and paste the value when asked:

```bash
npx wrangler secret put R2_ACCESS_KEY_ID --env staging
```
```bash
npx wrangler secret put R2_SECRET_ACCESS_KEY --env staging
```
```bash
npx wrangler secret put JOB_SHARED_SECRET --env staging
```
`JOB_SHARED_SECRET` is a long random string you make up (for example `openssl rand -hex 32`). Repeat the three with `--env production` for production.

Then edit `workers/api/wrangler.toml` for that environment: replace the `TODO` values (`R2_ACCOUNT_ID`, `SUPABASE_URL`, `ALLOWED_ORIGINS`). `SUPABASE_SERVICE_ROLE_KEY` is also a Worker secret (`wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env staging`).

## 6. Site (Cloudflare Pages) variables
Pages project > **Settings > Variables and Secrets** (Production and Preview as needed):
- `VITE_MEDIA_URL` = `https://img-staging.<domain>` (production: `https://img.<domain>`)
- `VITE_R2_ACCOUNT_ID` = your Cloudflare account ID
- `VITE_API_URL` = your Worker address
- `VITE_SERVICES=real`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` as before

## 7. Backups bucket lifecycle (production only)
`kollide-backups` > **Settings > Object lifecycle rules > Add rule**: delete objects **14 days** after upload.

## 8. Run the cleanup job (until B5 schedules it)
```bash
curl -X POST https://<worker address>/jobs/r2-cleanup -H "X-Job-Secret: <JOB_SHARED_SECRET>"
```
It returns counts and cursors. B5 will call it every night from the database.

## 9. Staging check (by hand)
1. Sign in on the staging site and finish onboarding with 3 photos. They load from `img-staging.<domain>`.
2. Open one photo's address: it ends in `.webp` and is under 150 KB. Download it and check its properties show no GPS data.
3. Profile > replace a photo, remove a photo. Then upload a selfie under "Verify my profile".
4. As an admin: `/admin/verifications`, **View selfie**, **Approve**. The person shows as verified.
5. Run the cleanup job (step 8). In the R2 dashboard the `selfies/...` object and the replaced photo are gone.

## Notes
- The Worker deploy binds to these buckets, so staging deploys fail until the buckets exist.
- Presigned links last 5 minutes. R2 refuses a different content type or size than the one signed.
- Until `events` and hubs exist (B4), `unreferenced_keys` only knows profile photos and selfies. B4 must add the cover and hub art columns to it, or the nightly sweep would delete them.

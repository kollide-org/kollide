# Auth setup: what to click, per project

Do this once for `kollide-staging`, then again for `kollide-prod`. `<domain>` is your real domain (set in `KOLLIDE_DOMAIN`). `<ref>` is the project reference (the id in the Supabase project URL). Dashboard labels move around; if a name below is not where I say, search the Authentication sidebar for it.

Database changes (`supabase db push`) do **not** apply any of this. Auth settings live in the hosted project, so you set them here by hand. Do **not** run `supabase config push`: it would overwrite the settings below with the local ones (Google is switched off locally).

Never paste a secret into chat. Keep every key in your password manager.

## 1. Google sign-in

### 1a. Google Cloud Console
1. Open https://console.cloud.google.com and pick (or create) a project called `kollide`.
2. **APIs & Services > OAuth consent screen**: user type **External**, app name `Kollide`, your support email, authorised domain `<domain>`. Scopes: `openid`, `email`, `profile` only. When it is ready, click **Publish app** (a "Testing" app expires logins after 7 days).
3. **APIs & Services > Credentials > Create credentials > OAuth client ID**: type **Web application**, name `Kollide staging` (and a second client `Kollide production` later).
4. **Authorised JavaScript origins**: staging, `https://<staging-pages-url>`; production, `https://<domain>`. For local testing also `http://localhost:5173`.
5. **Authorised redirect URIs**: exactly `https://<ref>.supabase.co/auth/v1/callback` (the `<ref>` of that environment's Supabase project).
6. Create. Copy the **Client ID** and **Client secret** into your password manager.

### 1b. Supabase dashboard
1. **Authentication > Sign In / Providers > Google**: turn it **on**.
2. Paste the Client ID and Client secret. Leave "Skip nonce checks" **off**. Save.

## 2. URL configuration
**Authentication > URL Configuration**
- **Site URL**: staging, `https://<staging-pages-url>`; production, `https://<domain>`.
- **Redirect URLs** (add each, one per line):
  - `https://<staging-pages-url>/auth/callback` (staging project)
  - `https://<domain>/auth/callback` (production project)
  - `http://localhost:5173/auth/callback` (staging project only, for local development)

## 3. Email code (6 digits, not a link)
**Authentication > Sign In / Providers > Email**
- **Enable Email provider**: on. **Confirm email**: on.
- **Email OTP length**: `6`. **Email OTP expiration**: `600` seconds.
- **Minimum interval between emails to the same user**: `60` seconds.
- Do not use passwords: Kollide never shows a password field.

## 4. The code email (Kollide style)
**Authentication > Emails > Templates** (older dashboards: **Email Templates**). Do it for **both** templates, because new and returning users get different ones:
1. **Confirm sign up**: subject `Your Kollide sign-in code`; replace the body with the full contents of `supabase/templates/otp.html`.
2. **Magic Link**: subject `Your Kollide sign-in code`; same body.

The template uses `{{ .Token }}` (the 6-digit code) and no links or remote images.

## 5. Resend as the email server (SMTP)
First in Resend (https://resend.com):
1. **Domains > Add domain**: `auth.<domain>`. Add the DNS records Resend shows in Cloudflare (SPF, DKIM) and wait until the domain says **Verified**.
2. **API Keys > Create API key**: name `supabase-<environment>`, permission **Sending access**, domain `auth.<domain>`. Copy the key (starts `re_`).

Then in Supabase, **Authentication > Emails > SMTP Settings** (older dashboards: **Project Settings > Authentication > SMTP Settings**):
- **Enable custom SMTP**: on
- **Sender email**: `auth@auth.<domain>`
- **Sender name**: `Kollide`
- **Host**: `smtp.resend.com`
- **Port**: `465`
- **Username**: `resend`
- **Password**: the Resend API key
- **Minimum interval**: `60` seconds

Save. Resend's free plan allows 100 emails a day, about 100 sign-in codes.

## 6. Rate limits
**Authentication > Rate Limits** (shown only once custom SMTP is on):
- **Emails sent per hour**: `30`
- Leave the other limits at their defaults.

## 7. Check that it works (staging)
1. Open the staging site, go to **Sign in**, enter your email, click **Send code**. The email arrives from `auth@auth.<domain>` with a 6-digit code in the indigo and marigold design. If it does not, look at the Resend dashboard > Emails and Supabase > Logs > Auth.
2. Enter the code. You land on onboarding. Finish it. You land on the app.
3. Sign out. Click **Continue with Google** and sign in with a Google account. If Google says `redirect_uri_mismatch`, the redirect URI in step 1a.5 is wrong.
4. Profile page shows your details. Settings > **Delete my account** ends on the landing page.

## 8. Make yourself an admin (once per project)
Sign in once so your profile exists. Then **SQL Editor**, replacing the email with yours:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'you@example.com'
on conflict do nothing;
```

## What the code already handles
- A database trigger creates the profile rows for every new sign-up.
- Supabase's own limits (one code per minute per address, per-IP limits) plus the hourly cap above protect Resend's daily limit.
- Local development uses Mailpit (`http://127.0.0.1:54324`), nothing is sent. Local Google is off by default; to try it locally, put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `supabase/.env` and set `enabled = true` for `[auth.external.google]` in `supabase/config.toml` (do not commit that change).

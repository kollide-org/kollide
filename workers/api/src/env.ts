/** Bindings of the Worker. Secrets are set with `wrangler secret put` (see README.md). */
export type Env = {
  ENVIRONMENT: 'local' | 'staging' | 'production'
  KOLLIDE_DOMAIN: string
  SUPABASE_URL: string
  /** Comma-separated site origins allowed to call this API from a browser. */
  ALLOWED_ORIGINS: string
  /** The public address of the site, used in email links (no trailing slash). */
  SITE_URL: string
  /** Sender of non-login emails (the verified Brevo sender on mail.<domain>). */
  EMAIL_FROM: string
  EMAIL_FROM_NAME: string
  /** Staging only: the team addresses that may receive email. Anyone else is skipped. */
  EMAIL_ALLOWLIST: string
  R2_ACCOUNT_ID: string
  R2_MEDIA_BUCKET: string
  R2_PRIVATE_BUCKET: string
  /** Public bucket: profile photos, event covers, hub art. */
  MEDIA: R2Bucket
  /** Private bucket: verification selfies. */
  PRIVATE: R2Bucket
  // Secrets
  SUPABASE_SERVICE_ROLE_KEY: string
  R2_ACCESS_KEY_ID: string
  R2_SECRET_ACCESS_KEY: string
  JOB_SHARED_SECRET: string
  BREVO_API_KEY: string
  /** PostHog project API key (server-side funnel events). Unset means no server-side events are sent. */
  POSTHOG_API_KEY?: string
}

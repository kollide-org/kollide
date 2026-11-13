/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVICES?: 'mock' | 'real'
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_API_URL?: string
  readonly VITE_MEDIA_URL?: string
  readonly VITE_R2_ACCOUNT_ID?: string
  /** local | staging | production: sent as the `env` property on every analytics event. */
  readonly VITE_APP_ENV?: string
  /** PostHog project key (EU). Empty means no browser analytics at all. */
  readonly VITE_POSTHOG_KEY?: string
  /** Share of consenting sessions that are recorded, 0 to 1 (default 0.2). */
  readonly VITE_POSTHOG_RECORDING_SAMPLE?: string
  /** Empty means no Meta pixel. */
  readonly VITE_META_PIXEL_ID?: string
  /** Empty means no Google Ads tag. */
  readonly VITE_GOOGLE_ADS_ID?: string
}

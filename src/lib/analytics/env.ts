/** Where this build runs: sent as the `env` property on every analytics event. */
export const APP_ENV: string = import.meta.env.VITE_APP_ENV ?? (import.meta.env.DEV ? 'local' : 'production')

export const POSTHOG_KEY: string = import.meta.env.VITE_POSTHOG_KEY ?? ''
export const POSTHOG_API_HOST = 'https://eu.i.posthog.com'
export const POSTHOG_UI_HOST = 'https://eu.posthog.com'

/**
 * The share of sessions that are recorded (0 to 1). Proposed: 20%, which stays under the free plan's 5,000 recordings a month
 * up to about 25,000 consenting sessions a month. Lower it (VITE_POSTHOG_RECORDING_SAMPLE) if traffic grows past that.
 */
export const RECORDING_SAMPLE: number = (() => {
  const value = Number(import.meta.env.VITE_POSTHOG_RECORDING_SAMPLE ?? '0.2')
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0.2
})()

export const META_PIXEL_ID: string = import.meta.env.VITE_META_PIXEL_ID ?? ''
export const GOOGLE_ADS_ID: string = import.meta.env.VITE_GOOGLE_ADS_ID ?? ''

import type { PostHog } from 'posthog-js'

import { APP_ENV, POSTHOG_API_HOST, POSTHOG_KEY, POSTHOG_UI_HOST, RECORDING_SAMPLE } from './env'

/**
 * PostHog EU, loaded only after the person allows Analytics (the library is a separate chunk that nobody downloads before that).
 * Everything here is a no-op until then, and stops the moment they withdraw.
 */
let instance: PostHog | null = null
let starting: Promise<void> | null = null
let active = false
let userId: string | null = null

/** A stable fraction (0 to 1) for a session id, so the same session is always in or out of the recording sample. */
export function sessionFraction(id: string): number {
  let hash = 2166136261
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967296
}

/** The browser-side analytics are on only with a project key AND Analytics consent. */
export function analyticsConfigured(): boolean {
  return POSTHOG_KEY !== ''
}

export async function startAnalytics(): Promise<void> {
  if (!analyticsConfigured() || active) return
  active = true
  if (instance) {
    instance.opt_in_capturing()
    if (userId) instance.identify(userId)
    return
  }
  starting ??= import('posthog-js').then(({ default: posthog }) => {
    if (!active) return // withdrawn while the library was loading
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_API_HOST,
      ui_host: POSTHOG_UI_HOST,
      // pageviews follow the router (it uses the history API)
      capture_pageview: 'history_change',
      // clicks and form submits on interactive elements only: no rage clicks, no copied text, no hidden or password fields
      autocapture: {
        dom_event_allowlist: ['click', 'submit'],
        element_allowlist: ['a', 'button', 'form', 'select', 'label'],
        capture_copied_text: false,
      },
      rageclick: false,
      // only people we identify by their user id get a profile
      person_profiles: 'identified_only',
      // sampled below, per session
      disable_session_recording: true,
      session_recording: {
        maskAllInputs: true,
        blockClass: 'ph-no-capture', // profile cards, the host inbox, phone, date of birth and addresses
        maskTextClass: 'ph-mask',
      },
      loaded: (ph) => {
        ph.register({ env: APP_ENV })
        ph.onSessionId((sessionId) => {
          if (!active) return
          if (sessionFraction(sessionId) < RECORDING_SAMPLE) ph.startSessionRecording()
          else ph.stopSessionRecording()
        })
      },
    })
    instance = posthog
    if (userId) posthog.identify(userId)
  })
  await starting
}

/** Withdrawal: stop at once, forget who this was, and remove what PostHog stored in the browser. */
export function stopAnalytics(): void {
  active = false
  if (instance) {
    instance.opt_out_capturing()
    instance.stopSessionRecording()
    instance.reset()
  }
  purgeAnalyticsStorage()
  // PostHog may still write its state a moment after being told to stop: clear again once it has settled.
  window.setTimeout(() => {
    if (!active) purgeAnalyticsStorage()
  }, 1000)
}

/** Removes everything PostHog keeps in the browser (also used on every page load while Analytics is off). */
export function purgeAnalyticsStorage(): void {
  try {
    for (const key of Object.keys(window.localStorage)) if (key.startsWith('ph_') || key.includes('posthog')) window.localStorage.removeItem(key)
    for (const part of document.cookie.split('; ')) {
      const name = part.split('=')[0] ?? ''
      if (name.startsWith('ph_') || name.includes('posthog')) document.cookie = `${name}=; Max-Age=0; Path=/`
    }
  } catch {
    // storage is unavailable: nothing to clean
  }
}

/** Identify with the Supabase user id and nothing else: never an email, a name or a phone number. */
export function identifyUser(id: string | null): void {
  userId = id
  if (!instance || !active) return
  if (id) instance.identify(id)
  else instance.reset()
}

export function capture(event: string, properties?: Record<string, unknown>): void {
  if (!instance || !active) return
  instance.capture(event, properties)
}

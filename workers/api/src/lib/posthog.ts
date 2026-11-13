/** PostHog EU Cloud capture API. Server-side events are only ever sent for people who allow Analytics (the database checks). */
export const POSTHOG_HOST = 'https://eu.i.posthog.com'

export interface CaptureEvent {
  event: string
  /** The Supabase user id. Never an email, a name or a phone number. */
  distinct_id: string
  properties: Record<string, unknown>
  timestamp?: string
}

export type CaptureResult = { ok: true } | { ok: false; retry: boolean; error: string }

/** One batch request. 5xx, 429 and network errors can be retried; any other 4xx will not get better. */
export async function capture(apiKey: string, events: CaptureEvent[]): Promise<CaptureResult> {
  try {
    const res = await fetch(`${POSTHOG_HOST}/batch/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, batch: events }),
    })
    if (res.ok) return { ok: true }
    return { ok: false, retry: res.status >= 500 || res.status === 429, error: `PostHog answered ${res.status}` }
  } catch {
    return { ok: false, retry: true, error: 'could not reach PostHog' }
  }
}

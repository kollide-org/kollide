/**
 * The cookie banner's choice, kept in one first-party cookie (never shared with anyone). It records the notice version it was
 * made for, so a new version of the notice asks again, and an anonymous id that lets the database link a choice made while
 * logged out to the person once they sign in. Essential cookies need no choice and are not stored here.
 */
export interface ConsentChoice {
  preferences: boolean
  analytics: boolean
  marketing: boolean
}

export interface StoredConsent extends ConsentChoice {
  /** The notice version the choice was made for. */
  v: string
  /** Anonymous id: a random uuid, not derived from anything about the person. */
  a: string
  /** When the choice was made (ms). */
  t: number
}

export const CONSENT_COOKIE = 'kollide_consent'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 180 // about 6 months, then we ask again

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function readConsentCookie(): StoredConsent | null {
  try {
    const match = document.cookie.split('; ').find((part) => part.startsWith(`${CONSENT_COOKIE}=`))
    if (!match) return null
    const parsed = JSON.parse(decodeURIComponent(match.slice(CONSENT_COOKIE.length + 1))) as Partial<StoredConsent>
    if (
      typeof parsed.v !== 'string' || typeof parsed.a !== 'string' || !UUID.test(parsed.a) || typeof parsed.t !== 'number' ||
      typeof parsed.preferences !== 'boolean' || typeof parsed.analytics !== 'boolean' || typeof parsed.marketing !== 'boolean'
    ) {
      return null
    }
    return { v: parsed.v, a: parsed.a, t: parsed.t, preferences: parsed.preferences, analytics: parsed.analytics, marketing: parsed.marketing }
  } catch {
    return null
  }
}

export function writeConsentCookie(value: StoredConsent): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(value))}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`
}

export function newAnonymousId(): string {
  return crypto.randomUUID()
}

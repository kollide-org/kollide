import type { ConsentChoice } from '@/lib/consent/cookie'

export interface StoredChoice extends ConsentChoice {
  noticeVersion: string
}

export interface ConsentService {
  /** Records the cookie choice (logged out: with the anonymous id; signed in: with the user id as well, which links them). */
  record(anonymousId: string, noticeVersion: string, choice: ConsentChoice): Promise<void>
  /** The signed-in person's latest stored choice, or null if they never made one for any version. */
  mine(): Promise<StoredChoice | null>
}

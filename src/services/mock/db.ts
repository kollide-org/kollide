import type {
  Appeal,
  Booking,
  CheckIn,
  Connection,
  Credit,
  Event,
  Host,
  HostRating,
  Hub,
  ID,
  ISODateTime,
  Notification,
  Payment,
  PrivateFeedback,
  Profile,
  Refund,
  SafetyReport,
  Squad,
  SquadMember,
  TagReview,
  User,
} from '../types'

import { buildSeed } from './seed/build'

/** A profile as stored. Age is worked out from the date of birth on the way out. */
export type ProfileRecord = Omit<Profile, 'age'>

/** An event as stored, with the private fields the public `Event` type leaves out. */
export interface EventRecord extends Event {
  exactAddress: string
  directions: string | null
  cancelledByKollide: boolean
}

/** Everything the mock backend knows. Only source records: nothing calculated is stored. */
export interface Db {
  version: number
  seededAt: ISODateTime
  sessionUserId: ID | null
  /** Email sign-in codes waiting to be entered. */
  emailCodes: Record<string, string>
  users: User[]
  profiles: ProfileRecord[]
  hosts: Host[]
  events: EventRecord[]
  hubs: Hub[]
  bookings: Booking[]
  squads: Squad[]
  squadMembers: SquadMember[]
  checkIns: CheckIn[]
  tagReviews: TagReview[]
  privateFeedback: PrivateFeedback[]
  safetyReports: SafetyReport[]
  hostRatings: HostRating[]
  connections: Connection[]
  appeals: Appeal[]
  payments: Payment[]
  refunds: Refund[]
  credits: Credit[]
  notifications: Notification[]
}

/** Raise this whenever the shape or the seed changes, so stale browsers reseed. */
export const DB_VERSION = 2
const STORAGE_KEY = 'kollide:mock-db'

let memory: Db | null = null

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function load(): Db {
  const raw = storage()?.getItem(STORAGE_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Db
      if (parsed.version === DB_VERSION) return parsed
    } catch {
      // Unreadable data is replaced by a fresh seed below.
    }
  }
  const seeded = buildSeed(new Date())
  persist(seeded)
  return seeded
}

function persist(db: Db): void {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    // Storage is full or blocked. The data stays in memory for this visit.
  }
}

/** The live database. It is kept in memory and mirrored to localStorage. */
export function getDb(): Db {
  memory ??= load()
  return memory
}

/** Call after changing anything, so the change survives a refresh. */
export function saveDb(): void {
  if (memory) persist(memory)
}

/** Throws away every change and starts again from the seed. */
export function resetDb(): Db {
  const fresh = buildSeed(new Date())
  memory = fresh
  persist(fresh)
  return fresh
}

/** For tests: use a database that is never written to storage. */
export function useMemoryDb(db: Db): void {
  memory = db
}

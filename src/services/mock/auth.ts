import type { DevTools } from '../index'
import type { AuthService } from '../interfaces'
import type { Role, Session, User } from '../types'

import { getDb, resetDb, saveDb, type Db } from './db'
import { copy, invalid, latency, newId, now, nowIso, requireUser } from './runtime'
import { PERSONAS } from './seed/people'
import { profileOf } from './views'

/** In mock mode, this is the only code that signs you in. */
export const MOCK_EMAIL_CODE = '123456'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function sessionFor(db: Db, user: User): Session {
  const hasProfile = db.profiles.some((profile) => profile.userId === user.id)
  return copy({ user, profile: hasProfile ? profileOf(db, user.id, now()) : null })
}

function findOrCreateUser(db: Db, email: string): User {
  const normalised = email.trim().toLowerCase()
  const existing = db.users.find((user) => user.email === normalised)
  if (existing) return existing
  const user: User = {
    id: newId('u'),
    role: 'member',
    status: 'active',
    email: normalised,
    phone: null,
    lastName: null,
    dateOfBirth: null,
    onboardingComplete: false,
    consentAcceptedAt: null,
    createdAt: nowIso(),
  }
  db.users.push(user)
  return user
}

function signIn(db: Db, user: User): Session {
  db.sessionUserId = user.id
  saveDb()
  return sessionFor(db, user)
}

export const mockAuthService: AuthService = {
  async getSession() {
    await latency(0.4)
    const db = getDb()
    const user = db.users.find((candidate) => candidate.id === db.sessionUserId)
    return user ? sessionFor(db, user) : null
  },

  async signInWithGoogle() {
    await latency(1.6)
    const db = getDb()
    return signIn(db, findOrCreateUser(db, 'you@gmail.com'))
  },

  async requestEmailCode(email) {
    await latency()
    const normalised = email.trim().toLowerCase()
    if (!EMAIL_PATTERN.test(normalised)) throw invalid('Enter a full email address.')
    const db = getDb()
    db.emailCodes[normalised] = MOCK_EMAIL_CODE
    saveDb()
    return { email: normalised, expiresInSeconds: 600 }
  },

  async verifyEmailCode(email, code) {
    await latency(1.2)
    const normalised = email.trim().toLowerCase()
    const db = getDb()
    if (db.emailCodes[normalised] !== code.trim()) throw invalid('That code doesn’t match. Check it and try again.')
    delete db.emailCodes[normalised]
    return signIn(db, findOrCreateUser(db, normalised))
  },

  async signOut() {
    await latency(0.4)
    const db = getDb()
    db.sessionUserId = null
    saveDb()
  },

  async deleteAccount() {
    await latency()
    const db = getDb()
    const user = requireUser(db)
    const mine = (record: { userId: string }) => record.userId !== user.id
    db.users = db.users.filter((candidate) => candidate.id !== user.id)
    db.profiles = db.profiles.filter(mine)
    db.hosts = db.hosts.filter(mine)
    db.bookings = db.bookings.filter(mine)
    db.squadMembers = db.squadMembers.filter(mine)
    db.checkIns = db.checkIns.filter(mine)
    db.notifications = db.notifications.filter(mine)
    db.credits = db.credits.filter(mine)
    db.connections = db.connections.filter((connection) => !connection.userIds.includes(user.id))
    db.tagReviews = db.tagReviews.filter((review) => review.reviewerId !== user.id && review.subjectId !== user.id)
    db.sessionUserId = null
    saveDb()
  },
}

/**
 * Development helpers. They exist only in the mock layer and are reached
 * through `devTools` in `@/services`, never through a service interface.
 */
export const mockDevTools: DevTools = {
  emailCode: MOCK_EMAIL_CODE,

  /** Signs in as the seeded account for a role, or signs out for "visitor". */
  async signInAs(role: Role): Promise<Session | null> {
    const db = getDb()
    if (role === 'visitor') {
      db.sessionUserId = null
      saveDb()
      return null
    }
    const user = db.users.find((candidate) => candidate.id === PERSONAS[role])
    if (!user) throw new Error(`The seed has no account for the ${role} role.`)
    return signIn(db, user)
  },

  /** Throws away every change and reseeds, keeping whoever is signed in. */
  async resetData(): Promise<void> {
    const signedInAs = getDb().sessionUserId
    const fresh = resetDb()
    fresh.sessionUserId = fresh.users.some((user) => user.id === signedInAs) ? signedInAs : null
    saveDb()
  },
}


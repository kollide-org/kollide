import { MOCK_DELAY_MS } from '../config'
import { ServiceError } from '../errors'
import type { ID, Role, User } from '../types'
import { hasRole } from '../types'

import { getDb, type Db } from './db'

let delayMs = MOCK_DELAY_MS

/** Tests switch the delay off. */
export function setMockDelay(ms: number): void {
  delayMs = ms
}

/** A small, slightly uneven wait, so skeletons are visible and nothing feels robotic. */
export function latency(scale = 1): Promise<void> {
  if (delayMs <= 0) return Promise.resolve()
  const jitter = 0.75 + Math.random() * 0.5
  return new Promise((resolve) => setTimeout(resolve, delayMs * scale * jitter))
}

export function now(): Date {
  return new Date()
}

export function nowIso(): string {
  return now().toISOString()
}

let counter = 0
export function newId(prefix: string): ID {
  counter += 1
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function currentUser(db: Db = getDb()): User | null {
  return db.users.find((user) => user.id === db.sessionUserId) ?? null
}

export function requireUser(db: Db = getDb()): User {
  const user = currentUser(db)
  if (!user) throw new ServiceError('unauthenticated', 'Sign in to continue.')
  if (user.status === 'banned') throw new ServiceError('forbidden', 'This account has been closed.')
  return user
}

export function requireRole(minimum: Role, db: Db = getDb()): User {
  const user = requireUser(db)
  if (!hasRole(user.role, minimum)) throw new ServiceError('forbidden', 'You do not have access to this.')
  return user
}

/** A member in good standing: not on hold and not suspended. */
export function requireActiveMember(db: Db = getDb()): User {
  const user = requireRole('member', db)
  if (user.status === 'on_hold') {
    throw new ServiceError('account_on_hold', 'Your account is on hold while we look into a report.')
  }
  if (user.status === 'suspended') throw new ServiceError('forbidden', 'Your account is suspended.')
  if (!user.onboardingComplete) throw new ServiceError('forbidden', 'Finish your profile first.')
  return user
}

export function notFound(what: string): ServiceError {
  return new ServiceError('not_found', `We couldn’t find that ${what}.`)
}

export function invalid(message: string): ServiceError {
  return new ServiceError('validation', message)
}

/** Hands back a copy, so callers can never change the database by accident. */
export function copy<T>(value: T): T {
  return structuredClone(value)
}

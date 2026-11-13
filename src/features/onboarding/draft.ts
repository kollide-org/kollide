import { useCallback, useSyncExternalStore } from 'react'

import type { Area, Gender, ProfilePrompt } from '@/services'

/** Everything a new member enters before their profile is created. */
export interface OnboardingDraft {
  firstName: string
  /** Day, month and year as typed. Only the age is ever shown to others. */
  birthDay: string
  birthMonth: string
  birthYear: string
  gender: Gender | null
  area: Area | null
  /** Cropped photos, as data URLs. */
  photos: string[]
  interests: string[]
  languages: string[]
  prompts: ProfilePrompt[]
  phone: string
  /** A selfie for the optional verified badge. `null` if skipped. */
  selfie: string | null
  acceptedConduct: boolean
  acceptedPrivacy: boolean
}

export const EMPTY_DRAFT: OnboardingDraft = {
  firstName: '',
  birthDay: '',
  birthMonth: '',
  birthYear: '',
  gender: null,
  area: null,
  photos: [],
  interests: [],
  languages: ['English'],
  prompts: [],
  phone: '',
  selfie: null,
  acceptedConduct: false,
  acceptedPrivacy: false,
}

/**
 * The draft is kept in memory and mirrored to localStorage, one per account,
 * so a refresh half-way through does not lose anything.
 */
const drafts = new Map<string, OnboardingDraft>()
const listeners = new Set<() => void>()
const storageKey = (userId: string) => `kollide:onboarding:${userId}`

function read(userId: string): OnboardingDraft {
  const cached = drafts.get(userId)
  if (cached) return cached
  let draft = EMPTY_DRAFT
  try {
    const stored = window.localStorage.getItem(storageKey(userId))
    if (stored) draft = { ...EMPTY_DRAFT, ...(JSON.parse(stored) as Partial<OnboardingDraft>) }
  } catch {
    // Unreadable or blocked storage: start from an empty draft.
  }
  drafts.set(userId, draft)
  return draft
}

function write(userId: string, draft: OnboardingDraft): void {
  drafts.set(userId, draft)
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(draft))
  } catch {
    // Storage is full or blocked. The draft still lives in memory for this visit.
  }
  for (const listener of listeners) listener()
}

export function clearOnboardingDraft(userId: string): void {
  drafts.delete(userId)
  try {
    window.localStorage.removeItem(storageKey(userId))
  } catch {
    // Nothing to clear.
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useOnboardingDraft(userId: string) {
  const draft = useSyncExternalStore(
    subscribe,
    () => read(userId),
    () => EMPTY_DRAFT,
  )
  const update = useCallback((patch: Partial<OnboardingDraft>) => write(userId, { ...read(userId), ...patch }), [userId])
  return { draft, update }
}

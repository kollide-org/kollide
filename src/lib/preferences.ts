import { writeStored } from '@/lib/storage'

/**
 * Remembered choices that make the app nicer to use (theme, the last filters). They are written to the browser only when the
 * person allows Preferences. Without that they live in memory: they survive moving around the app, and are gone on reload.
 */
export const PREFERENCE_KEYS = ['kollide:theme', 'kollide:filters'] as const

let allowed = false
const memory = new Map<string, string>()

export function readPreference(key: string): string | null {
  if (memory.has(key)) return memory.get(key) ?? null
  return readRaw(key)
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writePreference(key: string, value: string | null): void {
  if (value === null) memory.delete(key)
  else memory.set(key, value)
  if (allowed) writeStored(key, value)
}

/** Called whenever the Preferences choice is known or changes. Allowing saves what is in memory; withdrawing erases what is stored. */
export function setPreferencesAllowed(next: boolean): void {
  allowed = next
  for (const key of PREFERENCE_KEYS) {
    if (next) {
      const value = memory.get(key)
      if (value !== undefined) writeStored(key, value)
    } else {
      const stored = readRaw(key)
      if (stored !== null) memory.set(key, stored) // keep what is in use for this visit
      writeStored(key, null)
    }
  }
}

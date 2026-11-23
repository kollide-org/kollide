/** localStorage access that never throws (private mode, blocked storage). */
export function readStored<T extends string>(key: string, allowed: readonly T[]): T | null {
  try {
    const value = window.localStorage.getItem(key)
    return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : null
  } catch {
    return null
  }
}

export function writeStored(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // Storage is unavailable. The choice simply lasts for this page view.
  }
}

/** Reads a JSON value, falling back when it is missing, unreadable or storage is blocked. */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage is full or blocked. Nothing depends on this being saved.
  }
}

/**
 * Remembers that a one-time moment has played for an id, such as the address
 * reveal for an event. `seen` is pure, so it can be read during render; call
 * `markSeen` from an effect.
 */
export function onceStore(key: string) {
  return {
    seen: (id: string) => readJson<string[]>(key, []).includes(id),
    markSeen: (id: string) => {
      const ids = readJson<string[]>(key, [])
      if (!ids.includes(id)) writeJson(key, [...ids.slice(-60), id])
    },
  }
}

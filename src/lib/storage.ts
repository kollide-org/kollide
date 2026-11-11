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

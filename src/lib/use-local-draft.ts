import { useCallback, useState } from 'react'

/**
 * Form state that is mirrored to localStorage, so a refresh or an accidental
 * tab close does not lose a half-written form.
 */
export function useLocalDraft<T extends object>(key: string, empty: T): [T, (patch: Partial<T>) => void, () => void] {
  const [draft, setDraft] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key)
      return stored ? { ...empty, ...(JSON.parse(stored) as Partial<T>) } : empty
    } catch {
      return empty
    }
  })

  const update = useCallback(
    (patch: Partial<T>) => {
      setDraft((current) => {
        const next = { ...current, ...patch }
        try {
          window.localStorage.setItem(key, JSON.stringify(next))
        } catch {
          // Storage is full or blocked. The draft still lives in memory.
        }
        return next
      })
    },
    [key],
  )

  const clear = useCallback(() => {
    setDraft(empty)
    try {
      window.localStorage.removeItem(key)
    } catch {
      // Nothing to clear.
    }
  }, [empty, key])

  return [draft, update, clear]
}

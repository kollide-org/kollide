import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'

import { readPreference, writePreference } from '@/lib/preferences'

import {
  THEME_PREFERENCES,
  THEME_STORAGE_KEY,
  ThemeContext,
  type ResolvedTheme,
  type ThemeContextValue,
  type ThemePreference,
} from './theme-context'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function subscribeToSystemTheme(onChange: () => void) {
  const media = window.matchMedia(DARK_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

/**
 * Holds the light, dark or system choice and puts the `dark` class on <html>.
 * The inline script in index.html applies the same class before first paint,
 * so there is no flash of the wrong theme.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(
    () => {
      const stored = readPreference(THEME_STORAGE_KEY)
      return (THEME_PREFERENCES as readonly string[]).includes(stored ?? '') ? (stored as ThemePreference) : 'system'
    },
  )
  const systemTheme = useSyncExternalStore(subscribeToSystemTheme, getSystemTheme, () => 'light' as const)
  const resolvedTheme = preference === 'system' ? systemTheme : preference

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolvedTheme === 'dark')
    const background = getComputedStyle(root).getPropertyValue('--background').trim()
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background)
  }, [resolvedTheme])

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next)
    writePreference(THEME_STORAGE_KEY, next === 'system' ? null : next) // saved to the browser only with Preferences consent
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      resolvedTheme,
      setPreference,
      toggle: () => setPreference(resolvedTheme === 'dark' ? 'light' : 'dark'),
    }),
    [preference, resolvedTheme, setPreference],
  )

  return <ThemeContext value={value}>{children}</ThemeContext>
}

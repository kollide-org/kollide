import { createContext, useContext } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'kollide:theme'
export const THEME_PREFERENCES: readonly ThemePreference[] = ['light', 'dark', 'system']

export interface ThemeContextValue {
  /** What the user chose. */
  preference: ThemePreference
  /** What is on screen right now. */
  resolvedTheme: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
  toggle: () => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside ThemeProvider')
  return value
}

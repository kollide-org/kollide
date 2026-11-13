import { createContext, useContext } from 'react'

import type { ConsentChoice } from '@/lib/consent/cookie'

export interface ConsentContextValue {
  /** True once the notice version is known, so the banner never flashes for someone who already chose. */
  ready: boolean
  /** The choice for the CURRENT notice version, or null if there is none yet (a new version asks again). */
  choice: ConsentChoice | null
  bannerVisible: boolean
  settingsOpen: boolean
  acceptAll: () => void
  rejectAll: () => void
  save: (choice: ConsentChoice) => void
  openSettings: () => void
  closeSettings: () => void
}

export const ConsentContext = createContext<ConsentContextValue | null>(null)

export function useConsent(): ConsentContextValue {
  const value = useContext(ConsentContext)
  if (!value) throw new Error('useConsent must be used inside ConsentProvider')
  return value
}

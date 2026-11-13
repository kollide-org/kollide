import { createContext, useContext } from 'react'

import type { Session } from '@/services'
import type { Role } from '@/services/types/role'

export const SESSION_QUERY_KEY = ['session'] as const

export interface SessionContextValue {
  /** `loading` until the auth service has answered once. */
  status: 'loading' | 'ready'
  session: Session | null
  /** "visitor" when nobody is signed in. */
  role: Role
  signOut: () => Promise<void>
}

export const SessionContext = createContext<SessionContextValue | null>(null)

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside SessionProvider')
  return value
}

import { createContext, useContext } from 'react'

import type { Role } from '@/services/types/role'

export interface SessionContextValue {
  role: Role
  /**
   * Development only. Lets every screen be tested as any role.
   * In milestone 2 the role comes from `authService` instead.
   */
  setRole: (role: Role) => void
}

export const SessionContext = createContext<SessionContextValue | null>(null)

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside SessionProvider')
  return value
}

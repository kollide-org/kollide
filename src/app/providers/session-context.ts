import { createContext, useContext } from 'react'

import type { AuthUser, MyProfile } from '@/services'
import type { Role } from '@/services/types/role'

export interface SessionContextValue {
  /** `loading` until we know who is signed in. `error` when the profile could not be loaded. */
  status: 'loading' | 'ready' | 'error'
  role: Role
  user: AuthUser | null
  profile: MyProfile | null
  /** Reload the profile after it changed. */
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
  /** Development only, mock services only. Lets every screen be tested as any role. */
  setRole: (role: Role) => void
}

export const SessionContext = createContext<SessionContextValue | null>(null)

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside SessionProvider')
  return value
}

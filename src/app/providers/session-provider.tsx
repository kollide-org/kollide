import { useCallback, useMemo, useState, type ReactNode } from 'react'

import { readStored, writeStored } from '@/lib/storage'
import { ROLES, type Role } from '@/services/types/role'

import { SessionContext, type SessionContextValue } from './session-context'

const DEV_ROLE_KEY = 'kollide:dev-role'

export function SessionProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(() =>
    import.meta.env.DEV ? (readStored(DEV_ROLE_KEY, ROLES) ?? 'visitor') : 'visitor',
  )

  const setRole = useCallback((next: Role) => {
    setRoleState(next)
    if (import.meta.env.DEV) writeStored(DEV_ROLE_KEY, next)
  }, [])

  const value = useMemo<SessionContextValue>(() => ({ role, setRole }), [role, setRole])

  return <SessionContext value={value}>{children}</SessionContext>
}

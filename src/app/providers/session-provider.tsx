import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { services, type AuthUser } from '@/services'
import { roleFromRoles, type Role } from '@/services/types/role'

import { SessionContext, type SessionContextValue } from './session-context'

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    let active = true
    // Token refreshes report the same user again: keep the same object so nothing reloads.
    const apply = (next: AuthUser | null) => {
      if (!active) return
      setUser((current) => (current?.id === next?.id && current?.email === next?.email ? current : next))
      setAuthReady(true)
    }
    void services.auth.getUser().then(apply, () => apply(null))
    const unsubscribe = services.auth.onChange(apply)
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const profileQuery = useQuery({
    queryKey: ['my-profile', user?.id ?? null],
    queryFn: () => services.profile.getMyProfile(),
    enabled: user !== null,
    staleTime: 60_000,
    retry: 1,
  })

  const profile = profileQuery.data ?? null
  const deleted = profile?.deletedAt != null

  // A deleted account is signed out everywhere.
  useEffect(() => {
    if (deleted) void services.auth.signOut()
  }, [deleted])

  const refreshProfile = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['my-profile'] })
  }, [queryClient])

  const signOut = useCallback(async () => {
    await services.auth.signOut()
    queryClient.removeQueries({ queryKey: ['my-profile'] })
  }, [queryClient])

  const setRole = useCallback(
    (next: Role) => {
      services.auth.devSetRole?.(next)
      void queryClient.invalidateQueries({ queryKey: ['my-profile'] })
    },
    [queryClient],
  )

  const value = useMemo<SessionContextValue>(() => {
    const signedIn = user !== null && !deleted
    const status: SessionContextValue['status'] = !authReady
      ? 'loading'
      : user && profileQuery.isPending
        ? 'loading'
        : user && profileQuery.isError
          ? 'error'
          : 'ready'
    return {
      status,
      role: signedIn ? roleFromRoles(profile?.roles ?? []) : 'visitor',
      user: signedIn ? user : null,
      profile: signedIn ? profile : null,
      refreshProfile,
      signOut,
      setRole,
    }
  }, [authReady, user, deleted, profile, profileQuery.isPending, profileQuery.isError, refreshProfile, signOut, setRole])

  return <SessionContext value={value}>{children}</SessionContext>
}

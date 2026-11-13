import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, type ReactNode } from 'react'

import { authService } from '@/services'

import { SESSION_QUERY_KEY, SessionContext, type SessionContextValue } from './session-context'

/** Holds who is signed in. Everything it knows comes from `authService`. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { data, isPending } = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: () => authService.getSession(),
    staleTime: Infinity,
  })

  const signOut = useCallback(async () => {
    await authService.signOut()
    queryClient.setQueryData(SESSION_QUERY_KEY, null)
    // Nothing fetched for the last person should be shown to the next.
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== SESSION_QUERY_KEY[0] })
  }, [queryClient])

  const value = useMemo<SessionContextValue>(
    () => ({
      status: isPending ? 'loading' : 'ready',
      session: data ?? null,
      role: data?.user.role ?? 'visitor',
      signOut,
    }),
    [data, isPending, signOut],
  )

  return <SessionContext value={value}>{children}</SessionContext>
}

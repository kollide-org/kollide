import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { SESSION_QUERY_KEY } from '@/app/providers/session-context'
import { authService, type Session } from '@/services'
import { ROLE_HOME } from '@/services/types/role'

/** Where someone goes straight after signing in. */
export function pathAfterSignIn(session: Session, from?: string | null): string {
  if (!session.user.onboardingComplete) return '/onboarding'
  return from && from.startsWith('/') ? from : ROLE_HOME[session.user.role]
}

/** Stores a new session and forgets anything fetched for whoever was here before. */
export function useAdoptSession() {
  const queryClient = useQueryClient()
  return useCallback(
    (session: Session | null) => {
      queryClient.setQueryData(SESSION_QUERY_KEY, session)
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== SESSION_QUERY_KEY[0] })
    },
    [queryClient],
  )
}

export function useGoogleSignIn() {
  const adopt = useAdoptSession()
  return useMutation({ mutationFn: () => authService.signInWithGoogle(), onSuccess: adopt })
}

export function useRequestEmailCode() {
  return useMutation({ mutationFn: (email: string) => authService.requestEmailCode(email) })
}

export function useVerifyEmailCode() {
  const adopt = useAdoptSession()
  return useMutation({
    mutationFn: ({ email, code }: { email: string; code: string }) => authService.verifyEmailCode(email, code),
    onSuccess: adopt,
  })
}

import { Navigate, Outlet } from 'react-router'

import { useSession } from '@/app/providers/session-context'

/** Sends signed-in people who have not finished onboarding to the onboarding screen. */
export function RequireOnboarded() {
  const { profile } = useSession()
  if (profile && !profile.onboardingCompletedAt) return <Navigate to="/onboarding" replace />
  return <Outlet />
}

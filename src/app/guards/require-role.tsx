import { Navigate, Outlet, useLocation } from 'react-router'

import { BootFallback } from '@/app/layouts/boot-fallback'
import { useSession } from '@/app/providers/session-context'
import { hasRole, ROLE_HOME, type Role } from '@/services/types/role'

/**
 * Shows the nested routes only to roles with enough access.
 * This is a courtesy in the interface. Real enforcement belongs to the backend.
 */
export function RequireRole({ minimum }: { minimum: Role }) {
  const { role, session, status } = useSession()
  const location = useLocation()

  // Wait for the session before deciding, so a signed-in member is never bounced to sign-in.
  if (status === 'loading') return <BootFallback />
  if (!session) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />
  // An account without a finished profile can only finish it.
  if (!session.user.onboardingComplete) return <Navigate to="/onboarding" replace />
  if (hasRole(role, minimum)) return <Outlet />

  return <Navigate to={ROLE_HOME[role]} replace />
}

import { Navigate, Outlet } from 'react-router'

import { BootFallback } from '@/app/layouts/boot-fallback'
import { useSession } from '@/app/providers/session-context'
import { hasRole, ROLE_HOME, type Role } from '@/services/types/role'

/**
 * Shows the nested routes only to roles with enough access.
 * This is a courtesy in the interface. Real enforcement belongs to the backend.
 */
export function RequireRole({ minimum }: { minimum: Role }) {
  const { role, status } = useSession()

  // Wait for the session before deciding, so a signed-in member is never bounced to sign-in.
  if (status === 'loading') return <BootFallback />
  if (hasRole(role, minimum)) return <Outlet />

  return <Navigate to={role === 'visitor' ? '/sign-in' : ROLE_HOME[role]} replace />
}

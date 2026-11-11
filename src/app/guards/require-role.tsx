import { Navigate, Outlet } from 'react-router'

import { useSession } from '@/app/providers/session-context'
import { BootFallback } from '@/app/layouts/boot-fallback'
import { ErrorState } from '@/components/shared/error-state'
import { hasRole, ROLE_HOME, type Role } from '@/services/types/role'

/**
 * Shows the nested routes only to roles with enough access.
 * This is a courtesy in the interface. Real enforcement belongs to the backend.
 */
export function RequireRole({ minimum }: { minimum: Role }) {
  const { role, status, refreshProfile } = useSession()

  if (status === 'loading') return <BootFallback />
  if (status === 'error') {
    return (
      <div className="container-page py-16">
        <ErrorState headingLevel="h1" onRetry={() => void refreshProfile()} />
      </div>
    )
  }

  if (hasRole(role, minimum)) return <Outlet />

  return <Navigate to={role === 'visitor' ? '/sign-in' : ROLE_HOME[role]} replace />
}

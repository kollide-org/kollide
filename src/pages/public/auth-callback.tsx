import { useEffect, useState } from 'react'
import { Navigate } from 'react-router'

import { useSession } from '@/app/providers/session-context'
import { AppLink } from '@/components/shared/app-link'

/** Google sends people back here. The Supabase client reads the code in the address and signs them in. */
export function Component() {
  const { status, role } = useSession()
  const [timedOut, setTimedOut] = useState(false)
  const params = new URLSearchParams(window.location.search)
  const failed = params.has('error') || params.has('error_description')

  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(true), 10_000)
    return () => window.clearTimeout(timer)
  }, [])

  if (status === 'ready' && role !== 'visitor') return <Navigate to="/app" replace />

  return (
    <div className="container-page py-20">
      <div role="status" className="mx-auto max-w-md text-center">
        {failed || timedOut ? (
          <>
            <h1 className="text-h2">We couldn’t sign you in</h1>
            <p className="mt-3 text-muted-foreground">Google didn’t finish signing you in. Please try again.</p>
            <p className="mt-6">
              <AppLink to="/sign-in" className="text-primary underline underline-offset-4">
                Back to sign in
              </AppLink>
            </p>
          </>
        ) : (
          <h1 className="text-h2">Signing you in…</h1>
        )}
      </div>
    </div>
  )
}

import { ArrowLeft } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router'

import { useSession } from '@/app/providers/session-context'
import { AppLink } from '@/components/shared/app-link'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { Wordmark } from '@/components/shared/wordmark'
import { pathAfterSignIn } from '@/features/auth/hooks'

const PROMISES = ['Verified profiles', 'Small squads of four to six', 'Women-only events and squads']

/**
 * The frame around the sign-in screens: the form on one side and, on wide
 * screens, a calm brand panel on the other.
 */
export function AuthLayout() {
  const { session } = useSession()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from

  // The form shows straight away, without waiting to hear whether someone is
  // signed in. If they are, they carry on to wherever they were heading.
  if (session) return <Navigate to={pathAfterSignIn(session, from)} replace />

  return (
    <div className="paper grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="flex min-h-dvh flex-col">
        <header className="flex h-16 items-center justify-between px-5 sm:px-8 md:h-20 lg:px-12">
          <Wordmark />
          <ThemeToggle />
        </header>

        <main id="main" className="flex flex-1 items-center px-5 py-10 sm:px-8 lg:px-12">
          <div className="mx-auto w-full max-w-md">
            <Outlet />
          </div>
        </main>

        <footer className="px-5 py-6 sm:px-8 lg:px-12">
          <AppLink
            to="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to kollide
          </AppLink>
        </footer>
      </div>

      <aside aria-hidden="true" className="relative isolate hidden overflow-hidden bg-brand-cherry text-brand-antique lg:block">
        <div className="absolute -top-[10%] -right-[22%] aspect-square w-[78%] animate-drift-a rounded-full bg-brand-dusty opacity-90" />
        <div className="absolute -bottom-[14%] -left-[26%] aspect-square w-[88%] animate-drift-b rounded-full bg-brand-ink/20" />
        <div className="absolute top-[20%] left-[12%] aspect-square w-[78%] rounded-full border border-brand-antique/25" />
        <div className="relative flex h-full flex-col justify-end p-14 xl:p-20">
          <p className="max-w-md font-display text-h1">Never walk in alone.</p>
          <ul className="mt-8 grid gap-3">
            {PROMISES.map((promise) => (
              <li key={promise} className="flex items-center gap-3 text-lead">
                <span className="size-1.5 rounded-full bg-brand-antique" />
                {promise}
              </li>
            ))}
          </ul>
          <p className="mt-10 w-fit rounded-full border border-brand-antique/40 px-4 py-2 text-sm font-semibold">
            Kollide is not a dating app.
          </p>
        </div>
      </aside>
    </div>
  )
}

import { useQueryClient } from '@tanstack/react-query'
import { useLocation } from 'react-router'
import { FlaskConical } from 'lucide-react'
import { toast } from 'sonner'

import { SESSION_QUERY_KEY, useSession } from '@/app/providers/session-context'
import { AppLink } from '@/components/shared/app-link'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { devTools } from '@/services'
import { ROLE_LABELS, ROLES, type Role } from '@/services/types/role'

const SHORTCUTS = [
  { to: '/', label: 'Landing page' },
  { to: '/app', label: 'App home' },
  { to: '/admin', label: 'Admin' },
  { to: '/styleguide', label: 'Style guide' },
  { to: '/dev/data', label: 'Mock data' },
]

declare global {
  interface Window {
    /** Development only: the mock layer's helpers, for the console and for screenshot scripts. */
    __kollide?: typeof devTools
  }
}
if (devTools) window.__kollide = devTools

/**
 * Development only. Signs in as the seeded account for each role, so every
 * screen can be tested. It is hidden when real services are in use.
 */
export default function RoleSwitcher() {
  const { role, session } = useSession()
  const queryClient = useQueryClient()
  const { pathname } = useLocation()
  // On a phone the sign-in and setup screens keep their main button at the bottom, so stay out of the way.
  const focusedFlow = pathname.startsWith('/onboarding') || pathname.startsWith('/sign-in')

  if (!devTools) return null
  const tools = devTools

  const forgetEverythingButSession = () =>
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== SESSION_QUERY_KEY[0] })

  const switchTo = async (next: Role) => {
    const nextSession = await tools.signInAs(next)
    queryClient.setQueryData(SESSION_QUERY_KEY, nextSession)
    forgetEverythingButSession()
  }

  const reset = async () => {
    await tools.resetData()
    await queryClient.invalidateQueries()
    toast.success('Demo data reset', { description: 'Everything is back to the seed.' })
  }

  return (
    <div className={cn('fixed right-3 bottom-20 z-50 md:right-4 md:bottom-4', focusedFlow && 'hidden md:block')}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-brand-ink px-4 text-sm font-semibold text-brand-antique shadow-overlay transition-transform duration-200 active:scale-95 dark:bg-brand-antique dark:text-brand-ink"
          >
            <FlaskConical className="size-4" aria-hidden="true" />
            <span className="sr-only">Development role:</span>
            {ROLE_LABELS[role]}
            {session?.profile ? <span className="font-normal opacity-70">· {session.profile.firstName}</span> : null}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" className="w-60">
          <DropdownMenuLabel>View as</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={role} onValueChange={(value) => void switchTo(value as Role)}>
            {ROLES.map((option) => (
              <DropdownMenuRadioItem key={option} value={option}>
                {ROLE_LABELS[option]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Go to</DropdownMenuLabel>
          {SHORTCUTS.map((shortcut) => (
            <DropdownMenuItem key={shortcut.to} asChild>
              <AppLink to={shortcut.to}>{shortcut.label}</AppLink>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void reset()}>Reset demo data</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

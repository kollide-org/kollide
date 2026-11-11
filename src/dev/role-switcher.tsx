import { FlaskConical } from 'lucide-react'

import { useSession } from '@/app/providers/session-context'
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
import { ROLE_LABELS, ROLES, type Role } from '@/services/types/role'

const SHORTCUTS = [
  { to: '/', label: 'Landing page' },
  { to: '/app', label: 'App home' },
  { to: '/admin', label: 'Admin' },
  { to: '/styleguide', label: 'Style guide' },
]

/** Development only. Switches the current role so every screen can be tested. */
export default function RoleSwitcher() {
  const { role, setRole } = useSession()

  return (
    <div className="fixed right-3 bottom-20 z-50 md:right-4 md:bottom-4">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-brand-ink px-4 text-sm font-semibold text-brand-antique shadow-overlay transition-transform duration-200 active:scale-95 dark:bg-brand-antique dark:text-brand-ink"
          >
            <FlaskConical className="size-4" aria-hidden="true" />
            <span className="sr-only">Development role:</span>
            {ROLE_LABELS[role]}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" className="w-56">
          <DropdownMenuLabel>View as</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={role} onValueChange={(value) => setRole(value as Role)}>
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
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

import { CircleUser, ClipboardList, LogOut, Settings, ShieldCheck } from 'lucide-react'
import * as m from 'motion/react-m'
import { Outlet } from 'react-router'

import { useSession } from '@/app/providers/session-context'
import { AppLink, AppNavLink } from '@/components/shared/app-link'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { Wordmark } from '@/components/shared/wordmark'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { spring } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { hasRole } from '@/services/types/role'

import { APP_NAV } from './app-nav'
import { useScrolled } from './use-scrolled'

export function AppLayout() {
  const { role, session, signOut } = useSession()
  const firstName = session?.profile?.firstName ?? 'Member'
  const photoUrl = session?.profile?.photos[0]?.url
  const scrolled = useScrolled()
  const isHost = hasRole(role, 'host')
  const isAdmin = hasRole(role, 'admin')

  return (
    <div className="flex min-h-dvh flex-col">
      <header
        className={cn(
          'sticky top-0 z-40 border-b bg-background/90 backdrop-blur-xl transition-[border-color] duration-300',
          scrolled ? 'border-border' : 'border-transparent',
        )}
      >
        <div className="container-page flex h-16 items-center justify-between gap-4 md:h-18">
          <Wordmark to="/app" />

          <nav aria-label="Main" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {APP_NAV.filter((item) => item.to !== '/app/profile').map((item) => (
                <li key={item.to}>
                  <AppNavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'relative inline-flex h-11 items-center rounded-lg px-4 font-medium transition-colors',
                        isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {item.label}
                        {isActive ? (
                          <m.span
                            layoutId="app-nav-underline"
                            className="absolute inset-x-4 -bottom-px h-0.5 rounded-full bg-primary"
                            transition={spring.soft}
                          />
                        ) : null}
                      </>
                    )}
                  </AppNavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-1.5">
            {isHost ? (
              <Button asChild variant="soft" size="sm">
                <AppLink to="/app/host">
                  <ClipboardList aria-hidden="true" />
                  Host
                </AppLink>
              </Button>
            ) : null}
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Account menu"
                  className="rounded-full transition-transform duration-200 active:scale-95"
                >
                  <Avatar className="size-10">
                    {photoUrl ? <AvatarImage src={photoUrl} alt="" /> : null}
                    <AvatarFallback className="bg-highlight font-semibold text-highlight-foreground">
                      {firstName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel>Signed in as {firstName}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <AppLink to="/app/profile">
                    <CircleUser aria-hidden="true" />
                    Your profile
                  </AppLink>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <AppLink to="/app/settings">
                    <Settings aria-hidden="true" />
                    Settings
                  </AppLink>
                </DropdownMenuItem>
                {isAdmin ? (
                  <DropdownMenuItem asChild>
                    <AppLink to="/admin">
                      <ShieldCheck aria-hidden="true" />
                      Admin
                    </AppLink>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void signOut()}>
                  <LogOut aria-hidden="true" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main id="main" className="container-page flex-1 pt-8 pb-32 md:pt-12 md:pb-24">
        <Outlet />
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {APP_NAV.map((item) => (
            <li key={item.to}>
              <AppNavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'relative flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive ? (
                      <m.span
                        layoutId="app-tab-pill"
                        className="absolute top-1.5 h-8 w-14 rounded-full bg-primary-soft"
                        transition={spring.soft}
                      />
                    ) : null}
                    <item.icon className="relative size-5.5" strokeWidth={isActive ? 2.2 : 1.8} aria-hidden="true" />
                    <span className="relative">{item.label}</span>
                  </>
                )}
              </AppNavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

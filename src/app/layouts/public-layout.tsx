import { Menu } from 'lucide-react'
import { useState } from 'react'
import { Outlet } from 'react-router'

import { useSession } from '@/app/providers/session-context'
import { AppLink, AppNavLink } from '@/components/shared/app-link'
import { SiteFooter } from '@/components/shared/site-footer'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { Wordmark } from '@/components/shared/wordmark'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { ROLE_HOME } from '@/services/types/role'

import { useScrolled } from './use-scrolled'

const NAV_LINKS = [
  { to: '/how-it-works', label: 'How it works' },
  { to: '/safety', label: 'Safety' },
]

export function PublicLayout() {
  const { role, status } = useSession()
  const scrolled = useScrolled()
  const [menuOpen, setMenuOpen] = useState(false)
  const signedIn = role !== 'visitor'

  return (
    <div className="flex min-h-dvh flex-col">
      <header
        className={cn(
          'sticky top-0 z-40 border-b transition-[background-color,border-color] duration-300',
          scrolled ? 'border-border bg-background/90 backdrop-blur-xl' : 'border-transparent bg-transparent',
        )}
      >
        <div className="container-page flex h-16 items-center justify-between gap-4 md:h-20">
          <Wordmark />

          <nav aria-label="Main" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {NAV_LINKS.map((link) => (
                <li key={link.to}>
                  <AppNavLink
                    to={link.to}
                    className={({ isActive }) =>
                      cn(
                        'inline-flex h-11 items-center rounded-lg px-4 font-medium transition-colors hover:bg-accent',
                        isActive ? 'text-primary' : 'text-foreground',
                      )
                    }
                  >
                    {link.label}
                  </AppNavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            {status === 'loading' ? null : signedIn ? (
              <Button asChild variant="outline" className="hidden md:inline-flex">
                <AppLink to={ROLE_HOME[role]}>Open Kollide</AppLink>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" className="hidden md:inline-flex">
                  <AppLink to="/sign-in">Sign in</AppLink>
                </Button>
                <Button asChild variant="outline" className="hidden md:inline-flex">
                  <AppLink to="/sign-in">Join Kollide</AppLink>
                </Button>
              </>
            )}

            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                  <Menu className="size-5" aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[min(22rem,88vw)]">
                <SheetHeader>
                  <SheetTitle>
                    <Wordmark to={null} />
                  </SheetTitle>
                  <SheetDescription className="sr-only">Site navigation</SheetDescription>
                </SheetHeader>
                <nav aria-label="Mobile" className="flex flex-1 flex-col px-4 pb-6">
                  <ul className="grid gap-1">
                    {NAV_LINKS.map((link) => (
                      <li key={link.to}>
                        <AppLink
                          to={link.to}
                          onClick={() => setMenuOpen(false)}
                          className="flex min-h-14 items-center rounded-xl px-3 font-display text-h3 hover:bg-accent"
                        >
                          {link.label}
                        </AppLink>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto grid gap-3">
                    {signedIn ? (
                      <Button asChild size="lg">
                        <AppLink to={ROLE_HOME[role]} onClick={() => setMenuOpen(false)}>
                          Open Kollide
                        </AppLink>
                      </Button>
                    ) : (
                      <>
                        <Button asChild size="lg">
                          <AppLink to="/sign-in" onClick={() => setMenuOpen(false)}>
                            Join Kollide
                          </AppLink>
                        </Button>
                        <Button asChild variant="ghost" size="lg">
                          <AppLink to="/sign-in" onClick={() => setMenuOpen(false)}>
                            Sign in
                          </AppLink>
                        </Button>
                      </>
                    )}
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <SiteFooter />
    </div>
  )
}

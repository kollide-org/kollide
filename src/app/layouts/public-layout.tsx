import { Menu } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { Outlet } from 'react-router'

import { useSession } from '@/app/providers/session-context'
import { SmoothScroll } from '@/components/motion/smooth-scroll'
import { AppLink, AppNavLink } from '@/components/shared/app-link'
import { SiteFooter } from '@/components/shared/site-footer'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { Wordmark } from '@/components/shared/wordmark'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ROLE_HOME } from '@/services/types/role'

import { useScrolled } from './use-scrolled'

// The menu sheet is only needed on small screens, and only once it is opened.
const loadMenu = () => import('./public-menu')
const PublicMenu = lazy(loadMenu)
const preloadMenu = () => void loadMenu()

const NAV_LINKS = [
  { to: '/how-it-works', label: 'How it works' },
  { to: '/safety', label: 'Safety' },
]

export function PublicLayout() {
  const { role, status } = useSession()
  const scrolled = useScrolled()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuLoaded, setMenuLoaded] = useState(false)
  const signedIn = role !== 'visitor'

  return (
    <div className="paper flex min-h-dvh flex-col">
      <SmoothScroll />
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

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Open menu"
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              onPointerEnter={preloadMenu}
              onFocus={preloadMenu}
              onClick={() => setMenuOpen(true)}
            >
              <Menu className="size-5" aria-hidden="true" />
            </Button>
            {menuOpen || menuLoaded ? (
              <Suspense fallback={null}>
                <PublicMenu
                  open={menuOpen}
                  onOpenChange={(open) => {
                    setMenuLoaded(true)
                    setMenuOpen(open)
                  }}
                  links={NAV_LINKS}
                  signedIn={signedIn}
                  homePath={ROLE_HOME[role]}
                />
              </Suspense>
            ) : null}
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

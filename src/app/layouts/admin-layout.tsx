import { Activity, ArrowLeft, BadgeCheck, CalendarClock, Flag, FlagTriangleRight, Gavel, History, Layers, Link2, Settings, UserCheck, UsersRound } from 'lucide-react'
import { Outlet } from 'react-router'

import { AppLink, AppNavLink } from '@/components/shared/app-link'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { Wordmark } from '@/components/shared/wordmark'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import type { NavItem } from './app-nav'

const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'Host approvals', icon: UserCheck, end: true },
  { to: '/admin/verifications', label: 'Verifications', icon: BadgeCheck },
  { to: '/admin/jobs', label: 'Jobs', icon: Activity },
  { to: '/admin/events', label: 'Events', icon: CalendarClock },
  { to: '/admin/hubs', label: 'Hubs', icon: Layers },
  { to: '/admin/reports', label: 'Reports', icon: Flag },
  { to: '/admin/appeals', label: 'Appeals', icon: Gavel },
  { to: '/admin/flags', label: 'Flags', icon: FlagTriangleRight },
  { to: '/admin/users', label: 'Users', icon: UsersRound },
  { to: '/admin/partners', label: 'Partner links', icon: Link2 },
  { to: '/admin/audit', label: 'Audit log', icon: History },
  { to: '/admin/config', label: 'App settings', icon: Settings },
]

function navLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'flex h-11 shrink-0 items-center gap-3 rounded-lg px-3.5 font-medium whitespace-nowrap transition-colors',
    isActive ? 'bg-primary-soft text-primary-soft-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
  )
}

export function AdminLayout() {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="sticky top-0 z-40 border-b border-border bg-card lg:h-dvh lg:border-r lg:border-b-0">
        <div className="flex h-16 items-center justify-between gap-3 px-5 lg:h-20 lg:px-6">
          <div className="flex items-center gap-3">
            <Wordmark to="/admin" />
            <Badge variant="highlight-soft" size="sm">
              Admin
            </Badge>
          </div>
          <ThemeToggle />
        </div>

        <nav aria-label="Admin" className="lg:px-3 lg:py-2">
          <ul className="flex gap-1 overflow-x-auto px-4 pb-3 [scrollbar-width:none] lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
            {ADMIN_NAV.map((item) => (
              <li key={item.to}>
                <AppNavLink to={item.to} end={item.end} className={navLinkClass}>
                  <item.icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
                  {item.label}
                </AppNavLink>
              </li>
            ))}
            <li className="lg:hidden">
              <AppLink to="/app" className={navLinkClass({ isActive: false })}>
                <ArrowLeft className="size-5" strokeWidth={1.8} aria-hidden="true" />
                Back to the app
              </AppLink>
            </li>
          </ul>
        </nav>

        <div className="hidden px-3 lg:absolute lg:inset-x-0 lg:bottom-4 lg:block">
          <AppLink to="/app" className={navLinkClass({ isActive: false })}>
            <ArrowLeft className="size-5" strokeWidth={1.8} aria-hidden="true" />
            Back to the app
          </AppLink>
        </div>
      </aside>

      <main id="main" className="ph-no-capture min-w-0 px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
        <div className="mx-auto max-w-5xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

import { CalendarCheck, CircleUser, Handshake, House, UsersRound, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Match the path exactly, so "/app" is not active on every app page. */
  end?: boolean
}

/** The five places a member can go. Shown as tabs on mobile and a top bar on desktop. */
export const APP_NAV: NavItem[] = [
  { to: '/app', label: 'Home', icon: House, end: true },
  { to: '/app/plans', label: 'My plans', icon: CalendarCheck },
  { to: '/app/squads', label: 'Squads', icon: UsersRound },
  { to: '/app/connections', label: 'Connections', icon: Handshake },
  { to: '/app/profile', label: 'Profile', icon: CircleUser },
]

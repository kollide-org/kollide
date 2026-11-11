import { Bell } from 'lucide-react'

import { AppLink } from '@/components/shared/app-link'
import { useUnreadCount } from '@/hooks/use-bookings'

/** The bell in the app header with the number of unread notifications. */
export function NotificationBell() {
  const unread = useUnreadCount().data ?? 0
  return (
    <AppLink
      to="/app/notifications"
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      className="relative grid size-10 place-items-center rounded-full outline-none hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
    >
      <Bell aria-hidden className="size-5" />
      {unread > 0 ? (
        <span className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.65rem] font-semibold text-primary-foreground">
          {unread > 9 ? '9+' : unread}
        </span>
      ) : null}
    </AppLink>
  )
}

import { useQueryClient } from '@tanstack/react-query'

import { AppLink } from '@/components/shared/app-link'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { useNotifications } from '@/hooks/use-bookings'
import { formatWhen } from '@/lib/format'
import { services } from '@/services'

export function Component() {
  const queryClient = useQueryClient()
  const list = useNotifications()
  const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey: ['notifications'] }), queryClient.invalidateQueries({ queryKey: ['notifications-unread'] })])

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Updates"
        title="Notifications"
        action={
          <Button variant="outline" onClick={async () => { await services.notifications.markRead(); await refresh() }}>
            Mark all as read
          </Button>
        }
      />
      {list.data?.length === 0 ? <p className="text-muted-foreground">Nothing yet.</p> : null}
      <ul className="grid gap-3">
        {list.data?.map((n) => (
          <li key={n.id} className={`rounded-2xl border p-4 ${n.read ? 'border-border' : 'border-primary bg-primary-soft/40'}`}>
            <p className="font-medium">{n.title}{!n.read ? <span className="sr-only"> (unread)</span> : null}</p>
            {n.body ? <p className="text-muted-foreground">{n.body}</p> : null}
            <p className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
              {formatWhen(n.createdAt)}
              {n.eventId && n.kind === 'feedback_open' ? <AppLink to={`/app/events/${n.eventId}/feedback`} className="text-primary underline underline-offset-4">Share feedback</AppLink> : null}
              {n.eventId && n.kind !== 'feedback_open' ? <AppLink to={`/app/events/${n.eventId}`} className="text-primary underline underline-offset-4">Open event</AppLink> : null}
              {n.kind === 'account_on_hold' || n.kind === 'appeal_resolved' || n.kind === 'tip' ? <AppLink to="/app/appeals" className="text-primary underline underline-offset-4">Appeals</AppLink> : null}
              {n.kind === 'connection' ? <AppLink to="/app/connections" className="text-primary underline underline-offset-4">See connections</AppLink> : null}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}

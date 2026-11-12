import { Plus } from 'lucide-react'

import { AppLink } from '@/components/shared/app-link'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useMyEvents } from '@/hooks/use-events'
import { formatWhen } from '@/lib/format'

const STATUS_LABEL = { draft: 'Draft', pending_review: 'Waiting for review', published: 'Published', completed: 'Completed', cancelled: 'Cancelled' } as const

export function Component() {
  const events = useMyEvents()
  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow="Hosting"
        title="Your events"
        action={
          <Button asChild>
            <AppLink to="/app/host/events/new"><Plus /> New event</AppLink>
          </Button>
        }
      />
      {events.data?.length === 0 ? <p className="text-muted-foreground">You have no events yet. Create your first one.</p> : null}
      <div className="grid gap-4">
        {events.data?.map((event) => (
          <Card key={event.id}>
            <CardContent className="grid gap-2 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-h3">{event.title}</h2>
                  <p className="text-sm text-muted-foreground">{formatWhen(event.startsAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="soft">{STATUS_LABEL[event.status]}</Badge>
                  {event.status === 'published' ? (
                    <Button asChild size="sm">
                      <AppLink to={`/app/host/events/${event.id}/inbox`}>Requests</AppLink>
                    </Button>
                  ) : null}
                  {event.status === 'published' || event.status === 'completed' ? (
                    <Button asChild variant="soft" size="sm">
                      <AppLink to={`/app/host/events/${event.id}/checkin`}>Check-in</AppLink>
                    </Button>
                  ) : null}
                  <Button asChild variant="outline" size="sm">
                    <AppLink to={`/app/host/events/${event.id}`}>{event.status === 'draft' ? 'Edit' : 'Open'}</AppLink>
                  </Button>
                </div>
              </div>
              {event.reviewNote ? <p className="rounded-xl bg-secondary p-3 text-sm">Note from our team: {event.reviewNote}</p> : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

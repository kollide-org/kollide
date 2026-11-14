import { CalendarPlus, Plus } from 'lucide-react'

import { AppLink } from '@/components/shared/app-link'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EVENT_STATUS_LABELS } from '@/features/events/labels'
import { useHostedEvents } from '@/features/events/queries'
import { formatEventDate } from '@/lib/format'
import type { EventListItem } from '@/services'

function EventRow({ event }: { event: EventListItem }) {
  const status = EVENT_STATUS_LABELS[event.status]
  return (
    <li className="group relative flex flex-wrap items-center gap-x-5 gap-y-3 p-4 transition-colors hover:bg-background/60 sm:px-5">
      <img src={event.coverUrl} alt="" loading="lazy" className="size-16 shrink-0 rounded-xl object-cover" />
      <div className="min-w-0 flex-1 basis-48">
        <h2 className="truncate font-display text-h4">
          <AppLink
            to={`/app/events/${event.slug}`}
            className="outline-none after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-ring"
          >
            {event.title}
          </AppLink>
        </h2>
        <p className="text-sm text-muted-foreground">
          {formatEventDate(event.startsAt)} · {event.area}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {event.status === 'published' ? (
          <Badge variant="outline" size="sm">
            {event.goingCount} of {event.capacity} going
          </Badge>
        ) : null}
        <Badge variant={status.variant} size="sm">
          {status.label}
        </Badge>
      </div>
    </li>
  )
}

/** The host's events, in every state. The request inbox and check-in join this page in the next milestone. */
export function Component() {
  const { data: events, isPending, isError, refetch } = useHostedEvents()

  return (
    <>
      <title>Hosting · Kollide</title>
      <PageHeader
        eyebrow="Hosting"
        title="Your events"
        description="Everything you’re hosting, from the first draft to the last guest out of the door."
        action={
          <Button asChild>
            <AppLink to="/app/host/new">
              <Plus aria-hidden="true" />
              Create an event
            </AppLink>
          </Button>
        }
      />

      <div className="mt-10">
        {isPending ? (
          <div role="status" aria-label="Loading your events" className="grid gap-3">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : events.length === 0 ? (
          <EmptyState
            icon={CalendarPlus}
            title="You haven’t hosted anything yet"
            description="Start small. A table of six at a café you like is a fine first event."
          />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card">
            {events.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

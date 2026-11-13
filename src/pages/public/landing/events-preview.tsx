import { ArrowRight, CalendarDays } from 'lucide-react'
import type { CSSProperties } from 'react'

import { Stagger, StaggerItem } from '@/components/motion/stagger'
import { AppLink } from '@/components/shared/app-link'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Button } from '@/components/ui/button'
import { EventCard, EventCardSkeleton } from '@/features/events/components/event-card'
import { useActiveHub, useEvents } from '@/features/events/queries'
import { useMediaQuery } from '@/lib/use-media-query'

const PREVIEW_COUNT = 6

function HubRibbon() {
  const { data: hub } = useActiveHub()
  if (!hub || hub.events.length === 0) return null

  // The hub supplies its own accent colour, whatever the season.
  const accent = { '--hub-accent': hub.accentColor, '--hub-accent-foreground': hub.accentForeground } as CSSProperties
  return (
    <p style={accent} className="mt-6 inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-full border border-border bg-card py-1.5 pr-5 pl-1.5">
      <span className="inline-flex h-7 items-center rounded-full bg-hub-accent px-3 text-sm font-semibold text-hub-accent-foreground">
        In season
      </span>
      <span className="font-medium">{hub.title}</span>
      <span className="text-muted-foreground">
        {hub.events.length} {hub.events.length === 1 ? 'event' : 'events'}
      </span>
    </p>
  )
}

function Cards() {
  const { data: events, isPending, isError, refetch } = useEvents()
  const isPhone = useMediaQuery('(max-width: 639px)')

  if (isPending) {
    return (
      <div role="status" aria-label="Loading events" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <EventCardSkeleton key={index} />
        ))}
      </div>
    )
  }
  if (isError) return <ErrorState onRetry={() => void refetch()} />
  if (events.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="The next events are being planned"
        description="New evenings are added every week. Join now and you’ll be the first to see them."
      />
    )
  }

  // On phones the cards sit in one row that scrolls sideways. From tablets up they are a grid.
  return (
    <div
      role="region"
      aria-label="Upcoming events"
      tabIndex={isPhone ? 0 : undefined}
      className="-mx-5 snap-x snap-mandatory scroll-px-5 overflow-x-auto px-5 pb-4 [scrollbar-width:none] focus-visible:outline-offset-4 sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0"
    >
      <Stagger inView className="flex w-max gap-4 sm:grid sm:w-auto sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        {events.slice(0, PREVIEW_COUNT).map((event) => (
          <StaggerItem key={event.id} className="w-[78vw] max-w-80 snap-start sm:w-auto sm:max-w-none">
            <EventCard event={event} />
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  )
}

/** A preview of what is coming up, read from the event service. */
export function EventsPreview() {
  return (
    <section className="border-y border-border bg-card/50">
      <div className="container-page py-24 md:py-32">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div>
            <p className="eyebrow text-primary">Coming up</p>
            <h2 className="mt-4 text-h2 md:text-h1">Happening soon in Bengaluru</h2>
            <HubRibbon />
          </div>
          <Button asChild variant="outline">
            <AppLink to="/sign-in">
              See every event
              <ArrowRight aria-hidden="true" />
            </AppLink>
          </Button>
        </div>
        <div className="mt-12">
          <Cards />
        </div>
      </div>
    </section>
  )
}

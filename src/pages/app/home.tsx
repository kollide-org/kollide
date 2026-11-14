import { CalendarSearch, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'

import { useSession } from '@/app/providers/session-context'
import { Stagger, StaggerItem } from '@/components/motion/stagger'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EventCard, EventCardSkeleton } from '@/features/events/components/event-card'
import { EventFilterBar } from '@/features/events/components/event-filters'
import { HubSection } from '@/features/events/components/hub-section'
import { countFilters, filtersFromParams, filtersToParams } from '@/features/events/filters'
import { useActiveHub, useEvents } from '@/features/events/queries'
import { SquadCard } from '@/features/squads/components/squad-card'
import { useSquadsForming } from '@/features/squads/queries'
import { cn } from '@/lib/utils'
import type { EventFilters } from '@/services'

function greeting(hour: number): string {
  if (hour < 5) return 'Still up'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/** The seasonal hub. It quietly disappears if no hub is active. */
function Hub() {
  const { data: hub, isPending, isError } = useActiveHub()
  if (isPending) return <Skeleton className="h-128 w-full rounded-[2rem]" />
  // The hub is a bonus. If it fails or is empty, the feed below still does the job.
  if (isError || !hub || hub.events.length === 0) return null
  return <HubSection hub={hub} seeAllHref={`/app?${filtersToParams({ hubId: hub.id })}#events`} />
}

function Squads() {
  const { data: squads, isPending, isError, refetch } = useSquadsForming()

  return (
    <section aria-labelledby="squads-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="inline-flex h-7 items-center rounded-full bg-highlight px-3 text-sm font-semibold text-highlight-foreground">
            Squads forming
          </p>
          <h2 id="squads-heading" className="mt-4 text-h2">
            Don’t go alone. Go as four.
          </h2>
        </div>
      </div>

      <div className="mt-7">
        {isPending ? (
          <div role="status" aria-label="Loading squads" className="grid gap-5 md:grid-cols-3">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-52 rounded-2xl" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : squads.length === 0 ? (
          <EmptyState
            icon={UsersRound}
            title="No squads forming right now"
            description="Open any event and start one. Others going to the same thing can ask to join you."
          />
        ) : (
          <div
            role="region"
            aria-label="Squads forming"
            tabIndex={0}
            className="-mx-5 snap-x snap-mandatory scroll-px-5 overflow-x-auto px-5 pb-4 [scrollbar-width:none] focus-visible:outline-offset-4 md:mx-0 md:overflow-visible md:px-0 md:pb-0"
          >
            <Stagger inView className="flex w-max gap-4 md:grid md:w-auto md:grid-cols-3 md:gap-5">
              {squads.map((squad) => (
                <StaggerItem key={squad.id} className="w-[80vw] max-w-80 snap-start md:w-auto md:max-w-none">
                  <SquadCard squad={squad} />
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        )}
      </div>
    </section>
  )
}

function Feed() {
  const [params, setParams] = useSearchParams()
  const filters = filtersFromParams(params)
  const { data: events, isPending, isError, isPlaceholderData, refetch } = useEvents(filters)
  const active = countFilters(filters)

  const change = (next: EventFilters) => setParams(filtersToParams(next), { replace: true, preventScrollReset: true })

  return (
    <section id="events" aria-labelledby="events-heading" className="scroll-mt-24">
      <h2 id="events-heading" className="text-h2">
        {active > 0 ? 'Matching events' : 'Everything coming up'}
      </h2>

      <div className="sticky top-16 z-30 -mx-5 mt-4 border-b border-border/70 bg-background/92 px-5 py-2.5 backdrop-blur-xl sm:-mx-8 sm:px-8 md:top-18 lg:-mx-12 lg:px-12">
        <EventFilterBar filters={filters} onChange={change} resultCount={events && !isPlaceholderData ? events.length : null} />
      </div>

      <p className="mt-5 text-sm text-muted-foreground" aria-live="polite">
        {events ? `${events.length} ${events.length === 1 ? 'event' : 'events'}` : 'Loading events…'}
      </p>

      <div className="mt-5">
        {isPending ? (
          <div role="status" aria-label="Loading events" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <EventCardSkeleton key={index} />
            ))}
          </div>
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : events.length === 0 ? (
          <EmptyState
            icon={CalendarSearch}
            title={active > 0 ? 'Nothing matches those filters' : 'Nothing on just yet'}
            description={
              active > 0
                ? 'Try a wider date or another area. New events are added every week.'
                : 'New events are added every week. Check back soon.'
            }
            action={
              active > 0 ? (
                <Button variant="soft" onClick={() => change({})}>
                  Clear the filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          // While a new filter is loading, the last results stay on screen, slightly faded.
          <ul className={cn('grid gap-5 transition-opacity duration-200 sm:grid-cols-2 lg:grid-cols-3', isPlaceholderData && 'opacity-55')}>
            {events.map((event, index) => (
              <li key={event.id} className="rise-in" style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}>
                <EventCard event={event} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

/** Home: the seasonal hub, squads forming, then the event feed with its filters. */
export function Component() {
  const { session } = useSession()
  const [hello] = useState(() => greeting(new Date().getHours()))

  return (
    <>
      <title>What’s on · Kollide</title>
      <header>
        <p className="eyebrow text-primary">Bengaluru</p>
        <h1 className="mt-3 text-h1">
          {hello}, {session?.profile?.firstName}.
        </h1>
        <p className="mt-3 max-w-2xl text-lead text-muted-foreground">Here’s what’s on, and who’s going.</p>
      </header>

      <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-16 md:gap-20">
        <Hub />
        <Squads />
        <Feed />
      </div>
    </>
  )
}

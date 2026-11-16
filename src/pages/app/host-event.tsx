import { ArrowLeft, ArrowUpRight, Inbox, ListOrdered, UsersRound } from 'lucide-react'
import * as m from 'motion/react-m'
import { Tabs as TabsPrimitive } from 'radix-ui'
import type { CSSProperties } from 'react'
import { useParams, useSearchParams } from 'react-router'

import { PersonAvatar } from '@/components/people/person-avatar'
import { VerifiedBadge } from '@/components/people/verified-badge'
import { AppLink } from '@/components/shared/app-link'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { BOOKING_STATUS } from '@/features/bookings/labels'
import { CapacityMeter } from '@/features/bookings/components/capacity-meter'
import { RequestDeck } from '@/features/bookings/components/request-deck'
import { useAttendees, useHostCapacity, useJoinRequests } from '@/features/bookings/queries'
import { useEvent } from '@/features/events/queries'
import { formatEventDate } from '@/lib/format'
import { spring } from '@/lib/motion'
import { cn } from '@/lib/utils'
import type { JoinRequest } from '@/services'

const step = (index: number) => ({ '--i': index }) as CSSProperties

const TABS = ['requests', 'waitlist', 'going'] as const
type Tab = (typeof TABS)[number]

function DeckSkeleton() {
  return (
    <div role="status" aria-label="Loading requests" className="grid gap-8 lg:grid-cols-[20rem_minmax(0,36rem)]">
      <div className="hidden gap-2 lg:grid">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-18 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4">
        <Skeleton className="h-11 w-48 rounded-xl" />
        <Skeleton className="aspect-[4/5] w-full rounded-3xl" />
      </div>
    </div>
  )
}

function Going({ eventId }: { eventId: string }) {
  const { data: attendees, isPending, isError, refetch } = useAttendees(eventId)
  if (isPending) {
    return (
      <div role="status" aria-label="Loading guests" className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-18 rounded-2xl" />
        ))}
      </div>
    )
  }
  if (isError) return <ErrorState onRetry={() => void refetch()} />
  if (attendees.length === 0) {
    return (
      <EmptyState
        icon={UsersRound}
        title="Nobody is going yet"
        description="People you accept appear here, with a note when they’ve said they’re still coming."
      />
    )
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {attendees.map(({ booking, person }) => {
        const status = BOOKING_STATUS[booking.status]
        return (
          <li key={booking.id}>
            <AppLink
              to={`/app/people/${person.userId}`}
              className="flex items-center gap-3.5 rounded-2xl border border-border/70 bg-card p-3.5 shadow-card transition-[transform,box-shadow] duration-300 ease-out-soft hover:-translate-y-0.5 hover:shadow-lift"
            >
              <PersonAvatar person={person} className="size-12" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 font-semibold">
                  <span className="truncate">{person.firstName}</span>
                  {person.verified ? <VerifiedBadge /> : null}
                </span>
                <span className="text-sm text-muted-foreground">{booking.reconfirmedAt ? 'Still coming' : 'Accepted'}</span>
              </span>
              <Badge variant={status.variant} size="sm">
                {status.label}
              </Badge>
            </AppLink>
          </li>
        )
      })}
    </ul>
  )
}

/** One event, from the host's side: how full it is, who is asking, who is waiting and who is going. */
export function Component() {
  const { slug = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const tab: Tab = TABS.includes(params.get('tab') as Tab) ? (params.get('tab') as Tab) : 'requests'

  const event = useEvent(slug)
  const eventId = event.data?.id ?? ''
  const canManage = Boolean(event.data?.viewer.isHost)
  const requests = useJoinRequests(eventId, canManage)
  const capacity = useHostCapacity(eventId, canManage)

  const all: JoinRequest[] = requests.data ?? []
  const asking = all.filter((request) => request.booking.status === 'requested')
  const waiting = all
    .filter((request) => request.booking.status === 'waitlisted')
    .sort((a, b) => (a.booking.waitlistPosition ?? 99) - (b.booking.waitlistPosition ?? 99))

  if (event.isError) return <ErrorState onRetry={() => void event.refetch()} />
  if (event.data && !canManage) {
    return (
      <EmptyState
        icon={Inbox}
        headingLevel="h1"
        title="This isn’t one of your events"
        description="Only the host sees the requests for an event."
        action={<AppLink to="/app/host" className="font-semibold text-primary underline-offset-4 hover:underline">Back to your events</AppLink>}
      />
    )
  }

  const counts: Record<Tab, number | undefined> = {
    requests: requests.data ? asking.length : undefined,
    waitlist: requests.data ? waiting.length : undefined,
    going: capacity.data?.approved,
  }
  const labels: Record<Tab, string> = { requests: 'Requests', waitlist: 'Waitlist', going: 'Going' }

  return (
    <>
      <title>{`${event.data ? `Requests for ${event.data.title}` : 'Requests'} · Kollide`}</title>
      <AppLink
        to="/app/host"
        className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Your events
      </AppLink>

      <div className="mt-6 grid gap-8">
        {event.data ? (
          <header className="flex items-center gap-5">
            <img src={event.data.coverUrl} alt="" className="rise-in hidden size-24 shrink-0 rounded-2xl object-cover sm:block" />
            <div className="min-w-0">
              <p className="eyebrow rise-in text-primary" style={step(1)}>
                {formatEventDate(event.data.startsAt)} · {event.data.area}
              </p>
              <h1 className="rise-in mt-2 text-h2" style={step(2)}>
                {event.data.title}
              </h1>
              <AppLink
                to={`/app/events/${event.data.slug}`}
                className="rise-in mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline"
                style={step(3)}
              >
                See the event page
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </AppLink>
            </div>
          </header>
        ) : (
          <div role="status" aria-label="Loading the event" className="flex items-center gap-5">
            <Skeleton className="hidden size-24 rounded-2xl sm:block" />
            <div className="grid flex-1 gap-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-9 w-3/4" />
            </div>
          </div>
        )}
        {capacity.data ? <CapacityMeter capacity={capacity.data} /> : <Skeleton className="h-60 rounded-3xl lg:h-40" />}
      </div>

      <TabsPrimitive.Root
        value={tab}
        onValueChange={(value) =>
          setParams((current) => {
            const next = new URLSearchParams(current)
            if (value === 'requests') next.delete('tab')
            else next.set('tab', value)
            return next
          }, { replace: true, preventScrollReset: true })
        }
        className="mt-12"
      >
        <TabsPrimitive.List aria-label="Guests" className="flex gap-1 border-b border-border">
          {TABS.map((value) => (
            <TabsPrimitive.Trigger
              key={value}
              value={value}
              className={cn(
                'relative inline-flex h-12 items-center gap-2 px-3 font-medium sm:px-4 transition-colors outline-none focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-ring',
                value === tab ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {labels[value]}
              {counts[value] !== undefined ? (
                <span
                  className={cn(
                    'min-w-6 rounded-full px-1.5 text-center text-xs leading-6 font-semibold',
                    value === tab ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {counts[value]}
                </span>
              ) : null}
              {value === tab ? (
                <m.span
                  layoutId="host-tab"
                  transition={spring.soft}
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary"
                  aria-hidden="true"
                />
              ) : null}
            </TabsPrimitive.Trigger>
          ))}
        </TabsPrimitive.List>

        <TabsPrimitive.Content value="requests" className="pt-8 outline-none">
          {!event.data || requests.isPending ? (
            <DeckSkeleton />
          ) : requests.isError ? (
            <ErrorState onRetry={() => void requests.refetch()} />
          ) : asking.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="You’re all caught up"
              description="New requests arrive here as profile cards, with any note the person wrote."
            />
          ) : (
            <RequestDeck key="requests" mode="requests" eventId={eventId} requests={asking} capacity={capacity.data} />
          )}
        </TabsPrimitive.Content>

        <TabsPrimitive.Content value="waitlist" className="pt-8 outline-none">
          {!event.data || requests.isPending ? (
            <DeckSkeleton />
          ) : requests.isError ? (
            <ErrorState onRetry={() => void requests.refetch()} />
          ) : waiting.length === 0 ? (
            <EmptyState
              icon={ListOrdered}
              title="Nobody is on the waitlist"
              description="When you waitlist someone, they wait here in order. If a place opens, the first person gets it."
            />
          ) : (
            <RequestDeck key="waitlist" mode="waitlist" eventId={eventId} requests={waiting} capacity={capacity.data} />
          )}
        </TabsPrimitive.Content>

        <TabsPrimitive.Content value="going" className="pt-8 outline-none">
          {eventId ? <Going eventId={eventId} /> : null}
        </TabsPrimitive.Content>
      </TabsPrimitive.Root>
    </>
  )
}

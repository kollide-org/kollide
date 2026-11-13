import { CalendarDays, MapPin, UserRound, UsersRound } from 'lucide-react'
import { useId, type CSSProperties, type ReactNode } from 'react'

import { useSession } from '@/app/providers/session-context'
import { Stagger, StaggerItem } from '@/components/motion/stagger'
import { AvatarStack } from '@/components/people/avatar-stack'
import { PersonAvatar } from '@/components/people/person-avatar'
import { ReliabilityChip } from '@/components/people/reliability-chip'
import { VerifiedBadge } from '@/components/people/verified-badge'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { BOOKING_STATUS } from '@/features/bookings/labels'
import { useMyBookings } from '@/features/bookings/queries'
import { useActiveHub, useEvents } from '@/features/events/queries'
import { useProfileCards } from '@/features/profile/queries'
import { useSquadsForming } from '@/features/squads/queries'
import { formatEventDate, priceLabel, spotsLabel } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { EventListItem, EventType, ProfileCard, SquadWithMembers } from '@/services'
import { ROLE_LABELS } from '@/services/types/role'

const TYPE_LABEL: Record<EventType, string> = {
  partner: 'Partner event',
  community: 'Community',
  kollide: 'By Kollide',
}

function Section({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="border-t border-border py-12 md:py-16">
      <h2 id={id} className="text-h2">
        {title}
      </h2>
      <p className="mt-2 max-w-2xl text-muted-foreground">{note}</p>
      <div className="mt-8">{children}</div>
    </section>
  )
}

function EventTile({ event, compact = false }: { event: EventListItem; compact?: boolean }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-card transition-[transform,box-shadow] duration-300 ease-out-soft hover:-translate-y-1 hover:shadow-lift">
      <div className="relative aspect-[3/2] overflow-hidden bg-muted">
        <img
          src={event.coverUrl}
          alt={event.coverAlt}
          loading="lazy"
          decoding="async"
          className="size-full object-cover transition-transform duration-[1200ms] ease-out-soft group-hover:scale-105"
        />
        <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2">
          <Badge variant="secondary" size="sm" className="bg-card/90 backdrop-blur-sm">
            {TYPE_LABEL[event.type]}
          </Badge>
          {event.womenOnly ? (
            <Badge size="sm" className="bg-card/90 text-foreground backdrop-blur-sm">
              Women only
            </Badge>
          ) : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-4" aria-hidden="true" />
            {formatEventDate(event.startsAt)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-4" aria-hidden="true" />
            {event.area}
          </span>
        </p>
        <h3 className={cn('mt-2', compact ? 'text-lead font-display' : 'text-h4')}>{event.title}</h3>
        {compact ? null : <p className="mt-1.5 text-muted-foreground">{event.summary}</p>}
        <p className="mt-3 flex items-center gap-1.5 text-sm">
          {event.host ? (
            <>
              <span className="text-muted-foreground">Hosted by</span>
              <span className="font-semibold">{event.host.firstName}</span>
              {event.host.verified ? <VerifiedBadge /> : null}
            </>
          ) : (
            <>
              <span className="text-muted-foreground">At</span>
              <span className="font-semibold">{event.partner?.name}</span>
            </>
          )}
        </p>
        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" size="sm">
              {priceLabel(event.pricing)}
            </Badge>
            {event.type === 'partner' ? null : (
              <Badge variant={event.spotsLeft > 0 ? 'highlight-soft' : 'secondary'} size="sm">
                {spotsLabel(event.spotsLeft)}
              </Badge>
            )}
            {event.squadsForming > 0 ? (
              <Badge variant="highlight-soft" size="sm">
                Squad forming
              </Badge>
            ) : null}
          </div>
          <AvatarStack people={event.attendeePreview} total={event.goingCount} max={3} />
        </div>
      </div>
    </article>
  )
}

function TileSkeletons({ count }: { count: number }) {
  return (
    <div role="status" aria-label="Loading" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="overflow-hidden rounded-xl border border-border/70 bg-card">
          <Skeleton className="aspect-[3/2] w-full rounded-none" />
          <div className="grid gap-3 p-5">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-6 w-5/6" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

function HubPanel() {
  const { data: hub, isPending, isError, refetch } = useActiveHub()

  if (isPending) return <Skeleton className="h-112 w-full rounded-3xl" />
  if (isError) return <ErrorState onRetry={() => void refetch()} />
  if (!hub) {
    return <EmptyState icon={CalendarDays} title="No hub is active" description="An admin can feature a seasonal hub from the hub manager." />
  }

  // The hub brings its own accent. Nothing here knows it is New Year's Eve.
  const accent = { '--hub-accent': hub.accentColor, '--hub-accent-foreground': hub.accentForeground } as CSSProperties

  return (
    <div style={accent} className="relative isolate overflow-hidden rounded-3xl bg-brand-ink text-brand-antique shadow-lift">
      <img src={hub.artworkUrl} alt="" fetchPriority="high" decoding="async" className="absolute inset-0 -z-10 size-full object-cover opacity-70" />
      <div className="absolute inset-0 -z-10 bg-linear-to-t from-brand-ink via-brand-ink/60 to-transparent" />
      <div className="p-6 sm:p-10">
        <span className="inline-flex h-7 items-center rounded-full bg-hub-accent px-3 text-sm font-semibold text-hub-accent-foreground">
          Seasonal hub
        </span>
        <h3 className="mt-5 max-w-2xl text-h1">{hub.title}</h3>
        <p className="mt-3 max-w-xl text-lead text-brand-antique/85">{hub.subtitle}</p>
      </div>
      {/* Focusable, so the row can be scrolled with the arrow keys. */}
      <div
        role="region"
        aria-label={`Events in ${hub.title}`}
        tabIndex={0}
        className="snap-x scroll-px-6 overflow-x-auto px-6 pb-8 [scrollbar-width:none] focus-visible:outline-offset-[-4px] sm:scroll-px-10 sm:px-10 sm:pb-10"
      >
        <ul className="flex w-max gap-4">
          {hub.events.map((event) => (
            <li key={event.id} className="w-72 shrink-0 snap-start text-foreground">
              <EventTile event={event} compact />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function EventGrid() {
  const { data: events, isPending, isError, refetch } = useEvents()

  if (isPending) return <TileSkeletons count={6} />
  if (isError) return <ErrorState onRetry={() => void refetch()} />
  if (events.length === 0) {
    return <EmptyState icon={CalendarDays} title="Nothing on yet" description="New events appear here as hosts publish them." />
  }
  return (
    <Stagger inView className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((event) => (
        <StaggerItem key={event.id}>
          <EventTile event={event} />
        </StaggerItem>
      ))}
    </Stagger>
  )
}

function SquadRing({ filled, size }: { filled: number; size: number }) {
  const radius = 26
  const circumference = 2 * Math.PI * radius
  return (
    <div className="relative size-16 shrink-0">
      <svg viewBox="0 0 64 64" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="32" cy="32" r={radius} fill="none" strokeWidth="5" className="stroke-muted" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${(filled / size) * circumference} ${circumference}`}
          className="stroke-highlight"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold">
        {filled} of {size}
      </span>
    </div>
  )
}

function SquadCard({ squad }: { squad: SquadWithMembers }) {
  return (
    <article className="flex h-full flex-col gap-5 rounded-xl border border-border/70 bg-card p-5 shadow-card">
      <div className="flex items-center gap-4">
        <SquadRing filled={squad.members.length} size={squad.size} />
        <div className="min-w-0">
          <h3 className="text-h4">{squad.name}</h3>
          <p className="truncate text-sm text-muted-foreground">{squad.event.title}</p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Meet {squad.meetingPoint.minutesBefore} min before at {squad.meetingPoint.place}
      </p>
      <div className="mt-auto flex items-center justify-between gap-3">
        <AvatarStack people={squad.members} max={5} />
        <div className="flex gap-2">
          {squad.womenOnly ? (
            <Badge variant="outline" size="sm">
              Women only
            </Badge>
          ) : null}
          {squad.viewerStatus ? (
            <Badge variant={squad.viewerStatus === 'approved' ? 'success' : 'soft'} size="sm">
              {squad.viewerStatus === 'approved' ? 'You’re in' : 'Request sent'}
            </Badge>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function SquadList() {
  const { data: squads, isPending, isError, refetch } = useSquadsForming()

  if (isPending) {
    return (
      <div role="status" aria-label="Loading" className="grid gap-5 md:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-48 rounded-xl" />
        ))}
      </div>
    )
  }
  if (isError) return <ErrorState onRetry={() => void refetch()} />
  if (squads.length === 0) {
    return <EmptyState icon={UsersRound} title="No squads forming" description="Start one for any event, and others can ask to join you." />
  }
  return (
    <Stagger inView className="grid gap-5 md:grid-cols-3">
      {squads.map((squad) => (
        <StaggerItem key={squad.id}>
          <SquadCard squad={squad} />
        </StaggerItem>
      ))}
    </Stagger>
  )
}

function PersonCard({ card }: { card: ProfileCard }) {
  return (
    <article className="flex h-full flex-col rounded-xl border border-border/70 bg-card p-5 shadow-card">
      <div className="flex items-center gap-4">
        <PersonAvatar person={{ firstName: card.firstName, photoUrl: card.photos[0]?.url ?? null }} className="size-16" />
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-h4">
            {card.firstName}, {card.age}
            {card.verification.status === 'verified' ? <VerifiedBadge className="text-base" /> : null}
          </h3>
          <p className="text-sm text-muted-foreground">{card.area}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <ReliabilityChip reputation={card.reputation} size="sm" />
        {card.onHold ? (
          <Badge variant="destructive" size="sm">
            On hold
          </Badge>
        ) : null}
        {card.host ? (
          <Badge variant="outline" size="sm">
            Host · {card.host.eventsHosted} events
          </Badge>
        ) : null}
      </div>
      {card.prompts[0] ? (
        <blockquote className="mt-4 border-l-2 border-highlight pl-3">
          <p className="text-sm text-muted-foreground">{card.prompts[0].question}</p>
          <p className="mt-0.5">{card.prompts[0].answer}</p>
        </blockquote>
      ) : null}
      <ul className="mt-auto flex flex-wrap gap-1.5 pt-4" aria-label="Most common tags">
        {card.reputation.topTags.map(({ tag, count }) => (
          <li key={tag}>
            <Badge variant="secondary" size="sm">
              {tag} · {count}
            </Badge>
          </li>
        ))}
      </ul>
    </article>
  )
}

/** A mix that shows every state: regulars, hosts, a newcomer, someone unreliable, someone on hold. */
const PEOPLE_TO_SHOW = ['u02', 'u03', 'u17', 'u19', 'u27', 'u38', 'u11', 'u06']

function PeopleGrid() {
  const { role, status } = useSession()
  const signedIn = status === 'ready' && role !== 'visitor'
  const results = useProfileCards(PEOPLE_TO_SHOW, signedIn)

  if (status === 'ready' && !signedIn) {
    return (
      <EmptyState
        icon={UserRound}
        title="Profiles are for members"
        description="Use the role switcher in the corner to view as a member. Visitors only see event previews."
      />
    )
  }
  if (results.some((result) => result.isError)) {
    return <ErrorState onRetry={() => results.forEach((result) => void result.refetch())} />
  }
  if (results.some((result) => result.isPending)) {
    return (
      <div role="status" aria-label="Loading" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {PEOPLE_TO_SHOW.map((userId) => (
          <Skeleton key={userId} className="h-64 rounded-xl" />
        ))}
      </div>
    )
  }
  return (
    <Stagger inView className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {results.map((result) =>
        result.data ? (
          <StaggerItem key={result.data.userId}>
            <PersonCard card={result.data} />
          </StaggerItem>
        ) : null,
      )}
    </Stagger>
  )
}

function MyPlans() {
  const { role, status } = useSession()
  const signedIn = status === 'ready' && role !== 'visitor'
  const { data: plans, isPending, isError, refetch } = useMyBookings(signedIn)

  if (status === 'ready' && !signedIn) {
    return <EmptyState icon={CalendarDays} title="No plans as a visitor" description="View as a member to see bookings in every status." />
  }
  if (isPending) return <Skeleton className="h-64 rounded-xl" />
  if (isError) return <ErrorState onRetry={() => void refetch()} />
  if (plans.length === 0) {
    return <EmptyState icon={CalendarDays} title="No plans yet" description="Bookings appear here as soon as this account requests or books an event." />
  }
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border/70 bg-card shadow-card">
      {plans.map((plan) => {
        const state = BOOKING_STATUS[plan.status]
        return (
          <li key={plan.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 sm:px-5">
            <img src={plan.event.coverUrl} alt="" loading="lazy" className="size-14 rounded-lg object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{plan.event.title}</p>
              <p className="text-sm text-muted-foreground">
                {formatEventDate(plan.event.startsAt)}
                {plan.address ? ` · ${plan.address.exactAddress}` : ` · ${plan.event.area}`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {plan.needsReconfirmation ? (
                <Badge variant="highlight" size="sm">
                  Still coming?
                </Badge>
              ) : null}
              {plan.feedbackOpen ? (
                <Badge variant="highlight" size="sm">
                  Feedback open
                </Badge>
              ) : null}
              {plan.waitlistPosition ? (
                <Badge variant="outline" size="sm">
                  Position {plan.waitlistPosition}
                </Badge>
              ) : null}
              <Badge variant={state.variant} size="sm">
                {state.label}
              </Badge>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function Component() {
  const { role, session } = useSession()

  return (
    <div className="container-page pb-24">
      <title>Mock data · Kollide</title>

      <header className="py-12 md:py-20">
        <p className="eyebrow text-primary">Milestone 2</p>
        <h1 className="mt-3 text-h1">Mock data</h1>
        <p className="mt-4 max-w-2xl text-lead text-muted-foreground">
          Everything below is read through the same hooks and services the product will use. Reliability, tags and
          spots left are worked out from bookings, check-ins and reviews each time. Nothing calculated is stored.
        </p>
        <p className="mt-6 inline-flex items-center gap-3 rounded-full border border-border bg-card py-1.5 pr-5 pl-1.5">
          {session?.profile ? (
            <PersonAvatar person={{ firstName: session.profile.firstName, photoUrl: session.profile.photos[0]?.url ?? null }} className="size-9" />
          ) : (
            <span className="inline-flex size-9 items-center justify-center rounded-full bg-muted">
              <UserRound className="size-4.5" aria-hidden="true" />
            </span>
          )}
          <span>
            Viewing as <span className="font-semibold">{session?.profile?.firstName ?? 'a visitor'}</span>
            {session ? <span className="text-muted-foreground"> · {ROLE_LABELS[role]}</span> : null}
          </span>
        </p>
      </header>

      <Section title="Active hub" note="A hub is a title, artwork, an accent colour and a list of events. This one happens to be New Year’s Eve.">
        <HubPanel />
      </Section>

      <Section title="Events" note="Published and upcoming, soonest first. The exact address is not part of an event, so it cannot leak into a list.">
        <EventGrid />
      </Section>

      <Section title="Squads forming" note="Small groups of four to six going to the same event. The creator approves each person.">
        <SquadList />
      </Section>

      <Section title="People" note="Profile cards with reputation. A newcomer shows “New to Kollide”, never an empty or low score.">
        <PeopleGrid />
      </Section>

      <Section title="My plans" note="Every booking for the account you are viewing as. The address appears only once a booking is approved or paid.">
        <MyPlans />
      </Section>
    </div>
  )
}

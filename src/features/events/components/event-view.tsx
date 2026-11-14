import { ArrowLeft, CalendarDays, CalendarX, HandCoins, Home, Lock, MapPin, ShieldCheck, UsersRound } from 'lucide-react'
import type { ReactNode } from 'react'

import { useSession } from '@/app/providers/session-context'
import { AvatarStack } from '@/components/people/avatar-stack'
import { PersonAvatar } from '@/components/people/person-avatar'
import { VerifiedBadge } from '@/components/people/verified-badge'
import { AppLink } from '@/components/shared/app-link'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { SquadCard } from '@/features/squads/components/squad-card'
import { useSquadsForEvent } from '@/features/squads/queries'
import { ageRangeLabel, formatDay, formatTimeRange, priceLabel } from '@/lib/format'
import { useMediaQuery } from '@/lib/use-media-query'
import { isServiceError, type EventDetail } from '@/services'

import { CATEGORY_LABELS, TYPE_LABELS } from '../labels'
import { useEvent, useEventAddress, useSimilarEvents } from '../queries'

import { EventAction } from './event-action'
import { EventCard } from './event-card'
import { HostCard } from './host-card'

function Block({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-border pt-9">
      <h2 className="text-h3">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Fact({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3.5">
      <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-highlight-soft text-highlight-soft-foreground">{icon}</span>
      <p>
        <span className="block text-sm text-muted-foreground">{label}</span>
        <span className="block font-medium">{children}</span>
      </p>
    </li>
  )
}

/** The exact address. It is locked until the viewer's booking is approved or paid. */
function Address({ event }: { event: EventDetail }) {
  const unlocked = event.viewer.canSeeAddress
  const { data: address, isPending, isError, refetch } = useEventAddress(event.id, unlocked)

  // A partner venue is a public place. Its full address comes with the ticket.
  if (event.type === 'partner' && !unlocked) {
    return (
      <div className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5">
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-muted">
          <MapPin className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="font-semibold">
            {event.venueName}, {event.area}
          </p>
          <p className="mt-1 text-muted-foreground">The full address and entry details come with your ticket from the venue.</p>
        </div>
      </div>
    )
  }

  if (!unlocked) {
    return (
      <div className="flex items-start gap-4 rounded-2xl border border-dashed border-foreground/25 p-5">
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-muted">
          <Lock className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="font-semibold">
            {event.venueName ? `${event.venueName}, ${event.area}` : `A home in ${event.area}`}
          </p>
          <p className="mt-1 text-muted-foreground">
            The exact address is shared once your {event.type === 'kollide' ? 'booking is paid' : 'request is approved'}. Until
            then, everyone sees the area only.
          </p>
        </div>
      </div>
    )
  }
  if (isPending) return <Skeleton className="h-24 w-full rounded-2xl" />
  if (isError) return <ErrorState onRetry={() => void refetch()} />

  return (
    <div className="flex items-start gap-4 rounded-2xl border border-success/40 bg-success-soft/60 p-5">
      <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-success-soft text-success-strong">
        <MapPin className="size-5" aria-hidden="true" />
      </span>
      <div>
        <p className="font-semibold">{address.exactAddress}</p>
        {address.directions ? <p className="mt-1 text-muted-foreground">{address.directions}</p> : null}
        <p className="mt-2 text-sm text-muted-foreground">Only approved guests can see this. Please don’t pass it on.</p>
      </div>
    </div>
  )
}

function Squads({ event }: { event: EventDetail }) {
  const { data: squads, isPending } = useSquadsForEvent(event.id)
  if (isPending) return <Skeleton className="h-52 w-full rounded-2xl" />
  if (!squads || squads.length === 0) {
    return (
      <p className="text-muted-foreground">
        Nobody has started a squad for this one yet. A squad is four to six people who meet nearby first and walk in
        together.
      </p>
    )
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {squads.map((squad) => (
        <li key={squad.id}>
          <SquadCard squad={squad} />
        </li>
      ))}
    </ul>
  )
}

function Similar({ event, title }: { event: EventDetail; title: string }) {
  const { data: similar } = useSimilarEvents(event.id, true)
  if (!similar || similar.length === 0) return null
  return (
    <section className="mt-16 border-t border-border pt-12">
      <h2 className="text-h2">{title}</h2>
      <ul className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {similar.map((item) => (
          <li key={item.id}>
            <EventCard event={item} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function Loading() {
  return (
    <div role="status" aria-label="Loading event" className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-14">
      <div className="grid gap-6">
        <Skeleton className="aspect-[16/10] w-full rounded-3xl" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-14 w-5/6" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-2/3" />
      </div>
      <Skeleton className="h-96 w-full rounded-3xl" />
    </div>
  )
}

interface EventViewProps {
  slug: string
  /** Where "Back" goes, and what it says. */
  back: { to: string; label: string }
}

/**
 * One event, in full. Visitors and members share this view. What differs is
 * the action offered, and how much is shown about the people going.
 */
export function EventView({ slug, back }: EventViewProps) {
  const { role } = useSession()
  const { data: event, isPending, isError, error, refetch } = useEvent(slug)
  const signedIn = role !== 'visitor'
  // The action is rendered once: beside the content on wide screens, near the top on small ones.
  const wide = useMediaQuery('(min-width: 1024px)')

  if (isPending) return <Loading />
  if (isError) {
    return isServiceError(error, 'not_found') ? (
      <EmptyState
        icon={CalendarX}
        headingLevel="h1"
        title="We couldn’t find that event"
        description="It may have finished, or the link may be old. There is plenty more happening."
      />
    ) : (
      <ErrorState headingLevel="h1" onRetry={() => void refetch()} />
    )
  }

  const { viewer } = event
  const seesGuests = viewer.canSeeAddress || viewer.isHost
  const full = event.type !== 'partner' && event.spotsLeft === 0
  const declined = viewer.booking?.status === 'declined'
  const showSimilar = declined || (full && !viewer.canSeeAddress && !viewer.booking)
  const isHouseParty = event.category === 'house_party'

  return (
    <article>
      <title>{`${event.title} · Kollide`}</title>
      <AppLink
        to={back.to}
        className="inline-flex min-h-11 items-center gap-2 rounded-md text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4.5" aria-hidden="true" />
        {back.label}
      </AppLink>

      <div className="mt-3 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-14">
        <div className="min-w-0">
          <div className="relative aspect-[16/10] overflow-hidden rounded-3xl bg-muted">
            <img src={event.coverUrl} alt={event.coverAlt} fetchPriority="high" decoding="async" className="rise-in size-full object-cover" />
            <div className="absolute top-4 left-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-card/92 px-3.5 py-1.5 text-sm font-semibold backdrop-blur-sm">{TYPE_LABELS[event.type]}</span>
              {event.womenOnly ? (
                <span className="rounded-full bg-card/92 px-3.5 py-1.5 text-sm font-semibold backdrop-blur-sm">Women only</span>
              ) : null}
            </div>
          </div>

          <header className="mt-8">
            <p className="rise-in eyebrow text-primary">{CATEGORY_LABELS[event.category]}</p>
            <h1 className="rise-in mt-3 text-h1" style={{ animationDelay: '60ms' }}>
              {event.title}
            </h1>
            <p className="rise-in mt-4 text-lead text-muted-foreground" style={{ animationDelay: '120ms' }}>
              {event.summary}
            </p>
          </header>

          {/* On small screens the action sits here, near the top, where the thumb expects it. */}
          {wide ? null : (
            <div className="mt-8">
              <EventAction event={event} appPath={`/app/events/${event.slug}`} />
            </div>
          )}

          <ul className="mt-9 grid gap-5 sm:grid-cols-2">
            <Fact icon={<CalendarDays className="size-5" aria-hidden="true" />} label="When">
              {formatDay(event.startsAt)} · {formatTimeRange(event.startsAt, event.endsAt)}
            </Fact>
            <Fact icon={<MapPin className="size-5" aria-hidden="true" />} label="Where">
              {event.venueName ? `${event.venueName}, ${event.area}` : event.area}
            </Fact>
            <Fact icon={<HandCoins className="size-5" aria-hidden="true" />} label="Cost">
              {priceLabel(event.pricing)}
            </Fact>
            <Fact icon={<UsersRound className="size-5" aria-hidden="true" />} label="Who it’s for">
              Ages {ageRangeLabel(event.ageRange)}
              {event.womenOnly ? ' · women only' : ''}
            </Fact>
          </ul>

          <div className="mt-10 grid gap-9">
            <Block title="About this event">
              <p className="max-w-2xl text-muted-foreground">{event.description}</p>
            </Block>

            <Block title="The address">
              <Address event={event} />
            </Block>

            <Block title="House rules">
              <ul className="grid gap-3">
                {event.houseRules.map((rule) => (
                  <li key={rule} className="flex gap-3">
                    <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.7} aria-hidden="true" />
                    {rule}
                  </li>
                ))}
              </ul>
              {isHouseParty ? (
                <div className="mt-6 flex gap-4 rounded-2xl bg-highlight-soft p-5 text-highlight-soft-foreground">
                  <Home className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="font-semibold">How house parties work on Kollide</p>
                    <p className="mt-1">
                      At most 25 guests. The host approves every guest. The address is shared only after approval.
                    </p>
                  </div>
                </div>
              ) : null}
            </Block>

            <Block title="Who’s going">
              {event.goingCount === 0 ? (
                <p className="text-muted-foreground">Nobody yet. Be the first, and others will follow.</p>
              ) : seesGuests && signedIn ? (
                <>
                  <ul className="flex flex-wrap gap-2.5">
                    {event.attendeePreview.map((person) => (
                      <li key={person.userId}>
                        <AppLink
                          to={`/app/people/${person.userId}`}
                          className="flex items-center gap-2.5 rounded-full border border-border bg-card py-1.5 pr-4 pl-1.5 font-medium transition-colors hover:border-foreground/40"
                        >
                          <PersonAvatar person={person} className="size-9" />
                          {person.firstName}
                          {person.verified ? <VerifiedBadge /> : null}
                        </AppLink>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-sm text-muted-foreground">
                    {event.goingCount} going. You can see who, because you’re going too.
                  </p>
                </>
              ) : (
                <div className="flex flex-wrap items-center gap-4">
                  <AvatarStack people={event.attendeePreview} total={event.goingCount} max={5} />
                  <p className="text-muted-foreground">
                    {event.goingCount} going. You’ll see who once you’re in.
                  </p>
                </div>
              )}
            </Block>

            {event.type === 'partner' || event.squadsForming > 0 ? (
              <Block id="squads" title="Squads for this event">
                <Squads event={event} />
              </Block>
            ) : null}

            {event.host ? (
              <Block title="Your host">
                <div className="max-w-md">
                  <HostCard host={event.host} profileHref={signedIn ? `/app/people/${event.host.userId}` : undefined} />
                </div>
              </Block>
            ) : event.partner ? (
              <Block title="The venue">
                <p className="text-muted-foreground">
                  This event is run by <span className="font-semibold text-foreground">{event.partner.name}</span>, a Kollide
                  partner. Tickets are bought on their site, under their terms.
                </p>
              </Block>
            ) : null}

            {event.hubId ? (
              <p>
                <Badge variant="highlight-soft">Part of a seasonal collection</Badge>
              </p>
            ) : null}
          </div>
        </div>

        {wide ? (
          <aside className="sticky top-28">
            <EventAction event={event} appPath={`/app/events/${event.slug}`} />
          </aside>
        ) : null}
      </div>

      {showSimilar ? <Similar event={event} title="This one’s full. Here are similar events." /> : null}
    </article>
  )
}

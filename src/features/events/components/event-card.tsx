import { MapPin } from 'lucide-react'

import { useSession } from '@/app/providers/session-context'
import { AvatarStack } from '@/components/people/avatar-stack'
import { VerifiedBadge } from '@/components/people/verified-badge'
import { AppLink } from '@/components/shared/app-link'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDay, formatTime, priceLabel, spotsLabel } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { EventListItem } from '@/services'

interface EventCardProps {
  event: EventListItem
  /** Load the cover straight away. Use for cards at the top of a page. */
  priority?: boolean
  className?: string
}

/**
 * An event, as a card. The whole card is one link.
 * On hover it lifts slightly and the cover zooms slowly.
 * It shows the area, never the address.
 */
export function EventCard({ event, priority = false, className }: EventCardProps) {
  const { role } = useSession()
  const [weekday, ...date] = formatDay(event.startsAt).split(' ')
  // Visitors get the public preview. Members get the full event page.
  const href = role === 'visitor' ? `/events/${event.slug}` : `/app/events/${event.slug}`

  return (
    <article
      className={cn(
        'group relative flex h-full flex-col rounded-2xl border border-border/70 bg-card p-2 shadow-card transition-[transform,box-shadow] duration-500 ease-out-soft focus-within:shadow-lift hover:-translate-y-1.5 hover:shadow-lift',
        className,
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
        <img
          src={event.coverUrl}
          alt={event.coverAlt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className="size-full object-cover transition-transform duration-[1400ms] ease-out-soft group-hover:scale-[1.06]"
        />
        <div className="absolute top-3 left-3 flex flex-col items-center rounded-lg bg-card/92 px-2.5 py-1.5 text-center leading-none backdrop-blur-sm">
          <span className="text-xs font-semibold tracking-wide text-primary uppercase">{weekday}</span>
          <span className="mt-1 text-sm font-semibold">{date.join(' ')}</span>
        </div>
        <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
          <span className="rounded-full bg-card/92 px-3 py-1 text-sm font-semibold backdrop-blur-sm">{priceLabel(event.pricing)}</span>
          {event.womenOnly ? (
            <span className="rounded-full bg-card/92 px-3 py-1 text-xs font-semibold backdrop-blur-sm">Women only</span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-3 pt-4 pb-3">
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-4 shrink-0" aria-hidden="true" />
          {event.area}
          <span aria-hidden="true">·</span>
          {formatTime(event.startsAt)}
        </p>
        <h3 className="mt-2 text-h4">
          <AppLink to={href} className="outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring">
            {event.title}
          </AppLink>
        </h3>
        <p className="mt-1.5 flex items-center gap-1.5 text-sm">
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
        <div className="mt-auto flex min-h-8 items-center justify-between gap-3 pt-5">
          <AvatarStack people={event.attendeePreview} total={event.goingCount} max={3} />
          <p className="ml-auto text-sm font-medium text-muted-foreground">
            {event.type === 'partner'
              ? event.squadsForming > 0
                ? 'Squad forming'
                : 'Tickets at the venue'
              : spotsLabel(event.spotsLeft)}
          </p>
        </div>
      </div>
    </article>
  )
}

export function EventCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-2">
      <Skeleton className="aspect-[4/3] w-full rounded-xl" />
      <div className="grid gap-3 px-3 pt-4 pb-3">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-6 w-5/6" />
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="mt-3 h-8 w-24 rounded-full" />
      </div>
    </div>
  )
}

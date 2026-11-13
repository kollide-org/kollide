import { BadgeCheck, MapPin, Users } from 'lucide-react'

import { AppLink } from '@/components/shared/app-link'
import { Badge } from '@/components/ui/badge'
import { formatWhen, priceText } from '@/lib/format'
import { mediaUrl } from '@/lib/media'
import type { EventCard } from '@/services'

/** One event in a list. Shows the area, never the address. */
export function EventCardView({ event, hub }: { event: EventCard; hub?: string }) {
  const cover = event.coverKey ? mediaUrl(event.coverKey) : ''
  return (
    <AppLink
      to={`/app/events/${event.id}${hub ? `?hub=${encodeURIComponent(hub)}` : ''}`}
      className="group grid overflow-hidden rounded-2xl border border-border bg-card shadow-card transition hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <div className="aspect-[16/9] w-full bg-gradient-to-br from-primary-soft to-secondary">
        {cover ? <img src={cover} alt="" loading="lazy" className="size-full object-cover" /> : null}
      </div>
      <div className="grid gap-2 p-4">
        <p className="eyebrow text-primary">{formatWhen(event.startsAt)}</p>
        <h3 className="text-h3">{event.title}</h3>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin aria-hidden className="size-4" /> {event.areaName}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="soft">{priceText(event)}</Badge>
          {event.womenOnly ? <Badge>Women only</Badge> : null}
          {event.type === 'partner' ? <Badge>Tickets on partner site</Badge> : null}
          {event.type === 'kollide' ? <Badge>Kollide-run</Badge> : null}
          {event.spotsLeft !== null ? (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Users aria-hidden className="size-4" /> {event.spotsLeft} spots left
            </span>
          ) : null}
        </div>
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          Hosted by {event.hostFirstName ?? 'a member'}
          {event.hostIsVerified ? <BadgeCheck aria-label="Verified host" className="size-4 text-primary" /> : null}
        </p>
      </div>
    </AppLink>
  )
}

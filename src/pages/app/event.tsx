import { BadgeCheck, CalendarClock, CalendarX, MapPin, ShieldCheck, Ticket, Users } from 'lucide-react'
import { useParams } from 'react-router'

import { AppLink } from '@/components/shared/app-link'
import { EmptyState } from '@/components/shared/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useEvent, useEventAddress } from '@/hooks/use-events'
import { apiUrl } from '@/lib/api-url'
import { formatWhen, priceText } from '@/lib/format'
import { mediaUrl } from '@/lib/media'

export function Component() {
  const { id = '' } = useParams()
  const event = useEvent(id)
  const address = useEventAddress(id)

  if (event.isPending) return <Skeleton className="h-96 w-full" />
  if (!event.data) {
    return (
      <EmptyState
        icon={CalendarX}
        title="We couldn’t find that event"
        description="It may have ended, or it is not published."
        action={<AppLink to="/app" className="text-primary underline underline-offset-4">Back to what’s on</AppLink>}
      />
    )
  }
  const e = event.data
  const cover = e.coverKey ? mediaUrl(e.coverKey) : ''

  return (
    <article className="grid gap-8 lg:grid-cols-[2fr_1fr]">
      <div className="grid content-start gap-6">
        <div className="aspect-[16/9] overflow-hidden rounded-2xl bg-gradient-to-br from-primary-soft to-secondary">
          {cover ? <img src={cover} alt="" className="size-full object-cover" /> : null}
        </div>
        <header className="grid gap-3">
          <p className="eyebrow text-primary">{e.categoryName ?? 'Event'}</p>
          <h1 className="text-h1">{e.title}</h1>
          <div className="flex flex-wrap gap-2">
            <Badge variant="soft">{priceText(e)}</Badge>
            {e.womenOnly ? <Badge>Women only</Badge> : null}
            {e.houseParty ? <Badge>House party: the host approves every guest</Badge> : null}
            {e.type === 'kollide' ? <Badge>Run by Kollide</Badge> : null}
          </div>
        </header>
        {e.description ? <p className="whitespace-pre-line text-lead">{e.description}</p> : null}
        {e.houseRules ? (
          <section aria-label="House rules" className="grid gap-1">
            <h2 className="text-h3">House rules</h2>
            <p className="whitespace-pre-line text-muted-foreground">{e.houseRules}</p>
          </section>
        ) : null}
      </div>

      <aside className="grid content-start gap-5 rounded-2xl border border-border p-5">
        <p className="flex items-start gap-2"><CalendarClock aria-hidden className="mt-0.5 size-5 shrink-0" /> {formatWhen(e.startsAt)}</p>
        <p className="flex items-start gap-2"><MapPin aria-hidden className="mt-0.5 size-5 shrink-0" /> {e.areaName}</p>
        {e.spotsLeft !== null ? (
          <p className="flex items-start gap-2"><Users aria-hidden className="mt-0.5 size-5 shrink-0" /> {e.spotsLeft} of {e.capacity} spots left</p>
        ) : null}
        <p className="flex items-start gap-2">
          <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0" /> Ages {e.minAge}{e.maxAge ? ` to ${e.maxAge}` : '+'}
        </p>
        <p className="flex items-center gap-1">
          Hosted by <strong>{e.hostFirstName ?? 'a member'}</strong>
          {e.hostIsVerified ? <BadgeCheck aria-label="Verified host" className="size-4 text-primary" /> : null}
        </p>

        <section aria-label="Address" className="grid gap-1 border-t border-border pt-4">
          <h2 className="text-h3">Where</h2>
          {address.data?.address ? (
            <>
              <p data-testid="exact-address">{address.data.address}</p>
              {address.data.directionsNote ? <p className="text-sm text-muted-foreground">{address.data.directionsNote}</p> : null}
            </>
          ) : (
            <p className="text-muted-foreground">{e.areaName}. The exact address is shared once the host approves you.</p>
          )}
        </section>

        {e.hasPartnerLink ? (
          <div className="grid gap-2">
            <Button asChild size="lg">
              <a href={apiUrl(`/go/${e.id}`)} rel="noopener noreferrer" target="_blank">
                <Ticket /> Get tickets
              </a>
            </Button>
            <p className="text-sm text-muted-foreground">Tickets are sold by our partner. You leave Kollide to buy them.</p>
          </div>
        ) : (
          <p className="rounded-xl bg-secondary p-3 text-sm text-muted-foreground">
            Requests to join open very soon. Nothing is charged by Kollide.
          </p>
        )}
      </aside>
    </article>
  )
}

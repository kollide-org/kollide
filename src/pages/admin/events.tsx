import { CalendarCheck, Check, Lock, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'

import { PersonAvatar } from '@/components/people/person-avatar'
import { VerifiedBadge } from '@/components/people/verified-badge'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CATEGORY_LABELS } from '@/features/events/labels'
import { useDecideEvent, useEventAddress, useEventsForReview } from '@/features/events/queries'
import { ageRangeLabel, formatDay, formatTimeRange, priceLabel } from '@/lib/format'
import type { EventReviewItem } from '@/services'

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  )
}

function ReviewCard({ item }: { item: EventReviewItem }) {
  const { event, host } = item
  const decide = useDecideEvent()
  // Admins may always see the address. It is part of what they are approving.
  const { data: address } = useEventAddress(event.id, true)

  const act = (decision: 'approve' | 'decline') =>
    decide.mutate(
      { eventId: event.id, decision },
      {
        onSuccess: () =>
          toast.success(decision === 'approve' ? 'Event approved' : 'Event sent back', {
            description: decision === 'approve' ? `“${event.title}” is now live.` : `${host?.firstName ?? 'The host'} has been told it needs changes.`,
          }),
        onError: (error) => toast.error('That didn’t go through', { description: error.message }),
      },
    )

  return (
    <li className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card">
      <div className="grid md:grid-cols-[16rem_1fr]">
        <img src={event.coverUrl} alt="" loading="lazy" className="aspect-[16/9] size-full object-cover md:aspect-auto" />
        <div className="p-6">
          <p className="eyebrow text-primary">{CATEGORY_LABELS[event.category]}</p>
          <h2 className="mt-2 text-h3">{event.title}</h2>
          <p className="mt-1.5 text-muted-foreground">{event.summary}</p>

          {host ? (
            <p className="mt-4 flex items-center gap-2.5">
              <PersonAvatar person={host} className="size-8" />
              <span className="text-muted-foreground">Hosted by</span>
              <span className="font-semibold">{host.firstName}</span>
              {host.verified ? <VerifiedBadge /> : null}
            </p>
          ) : null}

          <dl className="mt-5 grid gap-x-8 gap-y-4 border-t border-border pt-5 sm:grid-cols-2">
            <Detail label="When">
              {formatDay(event.startsAt)} · {formatTimeRange(event.startsAt, event.endsAt)}
            </Detail>
            <Detail label="Where">{event.venueName ? `${event.venueName}, ${event.area}` : `A home in ${event.area}`}</Detail>
            <Detail label="Guests">
              {event.capacity} · ages {ageRangeLabel(event.ageRange)}
              {event.womenOnly ? ' · women only' : ''}
            </Detail>
            <Detail label="Cost">{priceLabel(event.pricing)}</Detail>
          </dl>

          <div className="mt-5 rounded-xl bg-background/70 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Lock className="size-4" aria-hidden="true" />
              Private address
            </p>
            {address ? (
              <p className="mt-1.5 text-muted-foreground">
                {address.exactAddress}
                {address.directions ? ` · ${address.directions}` : ''}
              </p>
            ) : (
              <Skeleton className="mt-2 h-5 w-2/3" />
            )}
          </div>

          <p className="mt-5 text-muted-foreground">{event.description}</p>

          <h3 className="mt-5 text-sm font-semibold">House rules</h3>
          <ul className="mt-2 grid gap-1.5 text-muted-foreground">
            {event.houseRules.map((rule) => (
              <li key={rule} className="flex gap-2.5">
                <span aria-hidden="true" className="mt-2.5 size-1 shrink-0 rounded-full bg-highlight" />
                {rule}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-5">
            <Button onClick={() => act('approve')} disabled={decide.isPending}>
              <Check aria-hidden="true" />
              Approve and publish
            </Button>
            <Button variant="outline" onClick={() => act('decline')} disabled={decide.isPending}>
              <X aria-hidden="true" />
              Send back for changes
            </Button>
          </div>
        </div>
      </div>
    </li>
  )
}

/** Admin: every new event is checked here before it goes live. */
export function Component() {
  const { data: items, isPending, isError, refetch } = useEventsForReview()

  return (
    <>
      <title>Event approvals · Kollide admin</title>
      <PageHeader eyebrow="Admin" title="Event approvals" description="New events wait here until someone on the team has read them." />

      <div className="mt-10">
        {isPending ? (
          <div role="status" aria-label="Loading events" className="grid gap-5">
            <Skeleton className="h-96 rounded-2xl" />
          </div>
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : items.length === 0 ? (
          <EmptyState icon={CalendarCheck} title="Nothing waiting" description="Every event has been looked at. New ones appear here as hosts send them in." />
        ) : (
          <ul className="grid gap-6">
            {items.map((item) => (
              <ReviewCard key={item.event.id} item={item} />
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

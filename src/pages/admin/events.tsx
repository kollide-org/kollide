import { CalendarCheck, Check, Lock, Sparkles, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { PersonAvatar } from '@/components/people/person-avatar'
import { VerifiedBadge } from '@/components/people/verified-badge'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { QueueItem, QueueList, QueueSkeleton } from '@/features/admin/components/queue'
import { ViewTabs } from '@/features/admin/components/view-tabs'
import { useSetFeatured } from '@/features/admin/queries'
import { CATEGORY_LABELS } from '@/features/events/labels'
import { useDecideEvent, useEventAddress, useEvents, useEventsForReview } from '@/features/events/queries'
import { ageRangeLabel, formatDay, formatTimeRange, priceLabel } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { EventListItem, EventReviewItem } from '@/services'

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
    <QueueItem className="overflow-hidden">
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
    </QueueItem>
  )
}

function ReviewQueue() {
  const { data: items, isPending, isError, refetch } = useEventsForReview()
  if (isPending) return <QueueSkeleton label="Loading events" rows={1} className="h-96" />
  if (isError) return <ErrorState onRetry={() => void refetch()} />
  if (items.length === 0) {
    return <EmptyState icon={CalendarCheck} title="Nothing waiting" description="Every event has been looked at. New ones appear here as hosts send them in." />
  }
  return (
    <QueueList className="gap-6">
      {items.map((item) => (
        <ReviewCard key={item.event.id} item={item} />
      ))}
    </QueueList>
  )
}

function FeatureRow({ event }: { event: EventListItem }) {
  const setFeatured = useSetFeatured()
  // The switch moves at once and goes back if the change does not save.
  const [featured, setLocal] = useState(event.featured)
  const id = `feature-${event.id}`

  const change = (next: boolean) => {
    setLocal(next)
    setFeatured.mutate(
      { eventId: event.id, featured: next },
      {
        onSuccess: () => toast.success(next ? 'Featured' : 'No longer featured', { description: event.title }),
        onError: (error) => {
          setLocal(!next)
          toast.error('That didn’t save', { description: error.message })
        },
      },
    )
  }

  return (
    <li className="flex items-center gap-4 py-4">
      <img src={event.coverUrl} alt="" loading="lazy" className="size-14 shrink-0 rounded-xl object-cover sm:h-14 sm:w-20" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{event.title}</span>
          {event.type === 'partner' ? <Badge variant="secondary" size="sm">Partner</Badge> : null}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {formatDay(event.startsAt)} · {event.area} · {event.goingCount} going
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Label htmlFor={id} className={cn('hidden text-sm sm:block', featured ? 'text-foreground' : 'text-muted-foreground')}>
          Featured
        </Label>
        <Switch id={id} checked={featured} onCheckedChange={change} aria-label={`Feature ${event.title}`} />
      </div>
    </li>
  )
}

function LiveEvents() {
  const { data: events, isPending, isError, refetch } = useEvents()
  if (isPending) return <QueueSkeleton label="Loading live events" rows={1} className="h-96" />
  if (isError) return <ErrorState onRetry={() => void refetch()} />
  if (events.length === 0) {
    return <EmptyState icon={Sparkles} title="No live events" description="Approved events appear here, ready to be featured." />
  }
  const featuredCount = events.filter((event) => event.featured).length
  return (
    <section aria-labelledby="live-heading" className="rounded-2xl border border-border/70 bg-card px-5 shadow-card sm:px-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border py-5">
        <h2 id="live-heading" className="font-sans text-base font-semibold">
          Upcoming and live
        </h2>
        <p className="text-sm text-muted-foreground">
          {featuredCount} featured · featured events come first on Home and in browsing
        </p>
      </div>
      <ul className="divide-y divide-border">
        {events.map((event) => (
          <FeatureRow key={event.id} event={event} />
        ))}
      </ul>
    </section>
  )
}

/** Admin: every new event is checked here before it goes live, and live events can be featured. */
export function Component() {
  const waiting = useEventsForReview()

  return (
    <>
      <title>Events · Kollide admin</title>
      <PageHeader eyebrow="Admin" title="Events" description="New events wait here until someone on the team has read them. Feature the best of what’s live." />

      <div className="mt-10">
        <ViewTabs
          label="Events"
          tabs={[
            { value: 'review', label: 'Waiting for review', count: waiting.data?.length },
            { value: 'live', label: 'Live and featuring' },
          ]}
        >
          {(view) => (view === 'review' ? <ReviewQueue /> : <LiveEvents />)}
        </ViewTabs>
      </div>
    </>
  )
}

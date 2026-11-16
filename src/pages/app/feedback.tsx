import { ArrowLeft, EyeOff, Handshake, MessageCircleHeart, ShieldAlert } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { useParams } from 'react-router'

import { AppLink } from '@/components/shared/app-link'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { HostRating } from '@/features/reviews/components/host-rating'
import { PersonFeedback } from '@/features/reviews/components/person-feedback'
import { useFeedbackForm } from '@/features/reviews/queries'
import { formatDay, formatTime } from '@/lib/format'
import { isServiceError } from '@/services'
import type { ReportSubject } from '@/features/safety/components/report-dialog'

const ReportDialog = lazy(() =>
  import('@/features/safety/components/report-dialog').then((module) => ({ default: module.ReportDialog })),
)

/** After an event: tags for the people you met, "meet again?", a word about the host, and a way to report. */
export function Component() {
  const { eventId = '' } = useParams()
  const form = useFeedbackForm(eventId)
  const [reporting, setReporting] = useState<ReportSubject | null>(null)
  const [openedAt] = useState(() => Date.now())

  const back = (
    <AppLink to="/app/plans?tab=past" className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground">
      <ArrowLeft className="size-4" aria-hidden="true" />
      My plans
    </AppLink>
  )

  if (form.isPending) {
    return (
      <>
        {back}
        <div role="status" aria-label="Loading feedback" className="mx-auto mt-8 grid max-w-3xl gap-5">
          <Skeleton className="h-28 w-full rounded-3xl" />
          <Skeleton className="h-64 w-full rounded-3xl" />
          <Skeleton className="h-64 w-full rounded-3xl" />
        </div>
      </>
    )
  }
  if (form.isError) {
    return (
      <>
        {back}
        {isServiceError(form.error, 'forbidden') ? (
          <EmptyState
            className="mt-8"
            icon={MessageCircleHeart}
            headingLevel="h1"
            title="Feedback is for people who were there"
            description="Only people who were checked in at an event can give feedback on it."
          />
        ) : (
          <ErrorState className="mt-8" headingLevel="h1" onRetry={() => void form.refetch()} />
        )}
      </>
    )
  }

  const data = form.data
  const closed = new Date(data.closesAt).getTime() <= openedAt
  const hoursLeft = Math.max(0, Math.round((new Date(data.closesAt).getTime() - openedAt) / 3_600_000))
  const allDone = data.people.every((person) => person.reviewed) && data.hostRated

  return (
    <>
      <title>{`Feedback for ${data.eventTitle} · Kollide`}</title>
      {back}
      <div className="mx-auto mt-8 grid max-w-3xl gap-10">
        <header className="flex items-center gap-5">
          <img src={data.eventCoverUrl} alt="" className="rise-in hidden size-24 shrink-0 rounded-2xl object-cover sm:block" />
          <div>
            <p className="eyebrow rise-in text-primary">How was it?</p>
            <h1 className="rise-in mt-2 text-h1">{data.eventTitle}</h1>
            <p className="rise-in mt-2 text-muted-foreground">
              {closed
                ? 'Feedback for this event has closed.'
                : `Open for ${hoursLeft} more hours, until ${formatDay(data.closesAt)} at ${formatTime(data.closesAt)}.`}
            </p>
          </div>
        </header>

        <div className="grid gap-3 rounded-3xl bg-highlight-soft p-5 text-highlight-soft-foreground sm:grid-cols-2 sm:p-6">
          <p className="flex items-start gap-3 text-sm">
            <EyeOff className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            What you give stays hidden until the other person has given theirs, or the window closes. Tags show as counts,
            never with your name.
          </p>
          <p className="flex items-start gap-3 text-sm">
            <Handshake className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            Say yes to meeting someone again, and if they say yes too, you’re connected. There are no messages: you’ll just
            see each other on Kollide.
          </p>
        </div>

        {closed ? null : allDone ? (
          <EmptyState
            icon={MessageCircleHeart}
            title="That’s everything. Thank you."
            description="Your answers help hosts plan better evenings, and help good company find each other again."
            action={
              <AppLink to="/app/connections" className="font-semibold text-primary underline-offset-4 hover:underline">
                See your connections
              </AppLink>
            }
          />
        ) : null}

        {data.people.length > 0 && !closed ? (
          <section aria-labelledby="people-heading" className="grid gap-4">
            <h2 id="people-heading" className="text-h3">
              The people you met
            </h2>
            {data.people.map((person) => (
              <PersonFeedback
                key={person.userId}
                eventId={data.eventId}
                person={person}
                onReport={(target) => setReporting({ type: 'user', id: target.userId, name: target.firstName, eventId: data.eventId })}
              />
            ))}
          </section>
        ) : null}

        {data.people.length === 0 && !closed ? (
          <p className="rounded-3xl border border-dashed border-foreground/20 p-6 text-muted-foreground">
            Nobody else was checked in at this one, so there’s nobody to tag.
            {data.host ? ' You can still tell us about the host.' : ''}
          </p>
        ) : null}

        {data.host && !closed ? (
          <section aria-labelledby="host-heading" className="grid gap-4">
            <h2 id="host-heading" className="text-h3">
              The host
            </h2>
            <HostRating eventId={data.eventId} host={data.host} rated={data.hostRated} />
          </section>
        ) : null}

        <section aria-labelledby="safety-heading" className="flex flex-col gap-4 rounded-3xl border border-border/70 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="safety-heading" className="font-sans text-base font-semibold">
              Did something serious happen?
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Harassment or anything that made you feel unsafe goes straight to our safety team.</p>
          </div>
          <Button
            variant="outline"
            className="shrink-0"
            onClick={() => setReporting({ type: 'event', id: data.eventId, name: data.eventTitle })}
          >
            <ShieldAlert aria-hidden="true" />
            Report a concern
          </Button>
        </section>
      </div>

      {reporting ? (
        <Suspense fallback={null}>
          <ReportDialog subject={reporting} open onOpenChange={(open) => !open && setReporting(null)} />
        </Suspense>
      ) : null}
    </>
  )
}

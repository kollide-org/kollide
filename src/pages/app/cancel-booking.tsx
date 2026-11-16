import { ArrowLeft, CalendarX } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { AppLink } from '@/components/shared/app-link'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useMyBookings } from '@/features/bookings/queries'
import { RefundRules } from '@/features/payments/components/refund-rules'
import { useCancelAndRefund, useRefundQuote } from '@/features/payments/queries'
import { formatEventDate, formatInr } from '@/lib/format'
import type { RefundQuote } from '@/services'

/** "₹1,800 back to the account you paid from", "₹1,200 as Kollide credit", or both. */
function refundSentence(quote: RefundQuote): string {
  const parts = []
  if (quote.moneyBackInr > 0) parts.push(`${formatInr(quote.moneyBackInr)} back to the account you paid from`)
  if (quote.creditBackInr > 0) parts.push(`${formatInr(quote.creditBackInr)} as Kollide credit`)
  return parts.join(', and ')
}

/** The refund-rules screen: what cancelling now would give back, and why. */
export function Component() {
  const { bookingId = '' } = useParams()
  const navigate = useNavigate()
  const plans = useMyBookings()
  const plan = plans.data?.find((candidate) => candidate.id === bookingId)
  const quote = useRefundQuote(bookingId, plan?.status === 'paid')
  const cancel = useCancelAndRefund()
  const [openedAt] = useState(() => Date.now())
  const hoursLeft = plan ? Math.round((new Date(plan.event.startsAt).getTime() - openedAt) / 3_600_000) : null

  const back = (
    <AppLink to="/app/plans" className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground">
      <ArrowLeft className="size-4" aria-hidden="true" />
      My plans
    </AppLink>
  )

  if (plans.isError) return <>{back}<ErrorState className="mt-8" headingLevel="h1" onRetry={() => void plans.refetch()} /></>
  if (plans.data && !plan) {
    return (
      <>
        {back}
        <EmptyState className="mt-8" icon={CalendarX} headingLevel="h1" title="We couldn’t find that booking" description="It may already be cancelled." />
      </>
    )
  }
  if (plan && plan.status !== 'paid' && !cancel.isSuccess) return <Navigate to="/app/plans" replace />

  const confirm = () => {
    if (!quote.data) return
    const sentence = refundSentence(quote.data)
    cancel.mutate(bookingId, {
      onSuccess: () => {
        toast.success('Your booking is cancelled', { description: `${sentence[0].toUpperCase()}${sentence.slice(1)}.` })
        void navigate('/app/plans', { viewTransition: true })
      },
      onError: (error) => toast.error('That didn’t go through', { description: error.message }),
    })
  }

  return (
    <>
      <title>Cancel a booking · Kollide</title>
      {back}
      <div className="mx-auto mt-8 grid max-w-3xl gap-10">
        <header>
          <p className="eyebrow rise-in text-primary">Cancel a booking</p>
          {plan ? (
            <>
              <h1 className="rise-in mt-3 text-h1">Cancel your place at {plan.event.title}?</h1>
              <p className="rise-in mt-3 text-lead text-muted-foreground">
                {formatEventDate(plan.event.startsAt)}
                {hoursLeft !== null && hoursLeft > 0 ? `, which is ${hoursLeft} hours from now.` : '.'}
              </p>
            </>
          ) : (
            <Skeleton className="mt-3 h-24 w-full" />
          )}
        </header>

        <section aria-labelledby="quote-heading" aria-live="polite" className="rounded-3xl border border-border/70 bg-card p-6 shadow-card sm:p-8">
          <h2 id="quote-heading" className="font-sans text-sm font-semibold text-muted-foreground">
            If you cancel now
          </h2>
          {quote.isPending ? (
            <div role="status" aria-label="Working out your refund" className="mt-3 grid gap-3">
              <Skeleton className="h-12 w-48" />
              <Skeleton className="h-5 w-full" />
            </div>
          ) : quote.isError ? (
            <ErrorState onRetry={() => void quote.refetch()} />
          ) : (
            <>
              <p className="mt-2 font-display text-display">{formatInr(quote.data.amountInr)}</p>
              <p className="mt-2 text-lead">{refundSentence(quote.data) || 'Nothing comes back for this booking.'}</p>
              <p className="mt-2 text-muted-foreground">{quote.data.explanation}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" variant="destructive" onClick={confirm} disabled={cancel.isPending || quote.data.outcome === 'none'}>
                  {cancel.isPending ? 'Cancelling…' : 'Cancel my booking'}
                </Button>
                <Button asChild size="lg" variant="ghost">
                  <AppLink to="/app/plans">Keep my place</AppLink>
                </Button>
              </div>
            </>
          )}
        </section>

        <section aria-labelledby="rules-heading">
          <h2 id="rules-heading" className="text-h3">
            How refunds work
          </h2>
          <RefundRules className="mt-5" current={quote.data?.outcome} />
          <p className="mt-4 text-sm text-muted-foreground">
            Your place goes to the next person on the waitlist, if there is one.
          </p>
        </section>
      </div>
    </>
  )
}

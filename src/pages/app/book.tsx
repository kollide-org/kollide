import { ArrowLeft, ArrowRight, Check, KeyRound, MapPin, Ticket, UsersRound } from 'lucide-react'
import * as m from 'motion/react-m'
import { useState, type CSSProperties } from 'react'
import { Navigate, useParams } from 'react-router'

import { AppLink } from '@/components/shared/app-link'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useEvent, useEventAddress } from '@/features/events/queries'
import { CheckoutSheet } from '@/features/payments/components/checkout-sheet'
import { RefundRules } from '@/features/payments/components/refund-rules'
import { useCheckout, usePay } from '@/features/payments/queries'
import { formatDay, formatInr, formatTimeRange } from '@/lib/format'
import { spring } from '@/lib/motion'
import { useMotionAllowed } from '@/lib/use-media-query'
import { isServiceError, type Checkout, type EventDetail, type PaymentInput, type PaymentResult } from '@/services'

const step = (index: number) => ({ '--i': index }) as CSSProperties

function Line({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <li className={strong ? 'flex items-baseline justify-between gap-4 border-t border-border pt-4' : 'flex items-baseline justify-between gap-4'}>
      <span className={strong ? 'font-semibold' : 'text-muted-foreground'}>{label}</span>
      <span className={strong ? 'font-display text-h3' : 'tabular-nums'}>{value}</span>
    </li>
  )
}

function Summary({ event, checkout, onContinue }: { event: EventDetail; checkout: Checkout; onContinue: () => void }) {
  return (
    <section aria-labelledby="summary-heading" className="grid gap-6 rounded-3xl border border-border/70 bg-card p-6 shadow-card sm:p-7">
      <h2 id="summary-heading" className="text-h4">
        Your booking
      </h2>
      <ul className="grid gap-3">
        <Line label="One place" value={formatInr(checkout.priceInr)} />
        {checkout.creditAppliedInr > 0 ? <Line label="Kollide credit" value={`− ${formatInr(checkout.creditAppliedInr)}`} /> : null}
        <Line label="To pay" value={formatInr(checkout.payableInr)} strong />
      </ul>
      {checkout.creditAppliedInr > 0 ? (
        <p className="-mt-2 text-sm text-muted-foreground">
          You have {formatInr(checkout.creditAvailableInr)} of credit. It is used first, automatically.
        </p>
      ) : null}
      <Button size="lg" className="w-full" onClick={onContinue}>
        {checkout.payableInr === 0 ? 'Book with credit' : 'Continue to payment'}
        <ArrowRight aria-hidden="true" />
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {event.spotsLeft} {event.spotsLeft === 1 ? 'place' : 'places'} left. Full refund up to 72 hours before.
      </p>
    </section>
  )
}

function Success({ event, result }: { event: EventDetail; result: PaymentResult }) {
  const address = useEventAddress(event.id, true)
  const motionAllowed = useMotionAllowed()
  const { payment } = result
  const paid =
    payment.method === 'credit'
      ? `${formatInr(payment.creditAppliedInr)} of Kollide credit`
      : payment.creditAppliedInr > 0
        ? `${formatInr(payment.amountInr)}, plus ${formatInr(payment.creditAppliedInr)} of credit`
        : formatInr(payment.amountInr)

  return (
    <section aria-labelledby="booked-heading" className="mx-auto max-w-2xl py-6 text-center sm:py-12">
      <m.span
        initial={motionAllowed ? { scale: 0.4, opacity: 0 } : { opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ...spring.soft, bounce: 0.35 }}
        className="relative mx-auto inline-flex size-24 items-center justify-center rounded-full bg-success-soft text-success-strong"
      >
        {motionAllowed ? (
          <m.span
            className="absolute inset-0 rounded-full border-2 border-success"
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.15 }}
            aria-hidden="true"
          />
        ) : null}
        <Check className="size-11" strokeWidth={2.5} aria-hidden="true" />
      </m.span>
      <p className="eyebrow rise-in mt-8 text-primary" style={step(2)}>
        Booked
      </p>
      <h1 id="booked-heading" className="rise-in mt-3 text-h1" style={step(3)}>
        You’re going to {event.title}.
      </h1>
      <p className="rise-in mx-auto mt-4 max-w-lg text-lead text-muted-foreground" style={step(4)}>
        {formatDay(event.startsAt)}, {formatTimeRange(event.startsAt, event.endsAt)}. You paid {paid}.
      </p>
      <p className="rise-in mt-2 text-sm text-muted-foreground" style={step(4)}>
        Reference <span className="font-semibold text-foreground tabular-nums">{payment.reference}</span>
      </p>

      <div className="rise-in mt-10 grid gap-3 text-left" style={step(5)}>
        <div className="flex gap-4 rounded-3xl border border-border/70 bg-card p-5 shadow-card">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-highlight-soft text-highlight-soft-foreground">
            <MapPin className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">The address is yours now</p>
            {address.data ? (
              <p className="mt-1 text-muted-foreground">{address.data.exactAddress}</p>
            ) : (
              <Skeleton className="mt-2 h-5 w-64" />
            )}
          </div>
        </div>
        <div className="flex gap-4 rounded-3xl border border-border/70 bg-card p-5 shadow-card">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-highlight-soft text-highlight-soft-foreground">
            <UsersRound className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold">Going on your own?</p>
            <p className="mt-1 text-muted-foreground">
              Join a squad and meet a few people nearby first.{' '}
              <AppLink to={`/app/events/${event.slug}#squads`} className="font-semibold text-primary underline-offset-4 hover:underline">
                See squads
              </AppLink>
            </p>
          </div>
        </div>
      </div>

      <div className="rise-in mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center" style={step(6)}>
        <Button asChild size="lg">
          <AppLink to="/app/plans">
            <Ticket aria-hidden="true" />
            See my plans
          </AppLink>
        </Button>
        <Button asChild variant="ghost">
          <AppLink to={`/app/events/${event.slug}`}>Back to the event</AppLink>
        </Button>
      </div>
    </section>
  )
}

function Loading() {
  return (
    <div role="status" aria-label="Loading your booking" className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="grid content-start gap-5">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-28 w-full rounded-3xl" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
      <Skeleton className="h-80 rounded-3xl" />
    </div>
  )
}

/** Booking one of Kollide's own events: the summary, then a simulated checkout. */
export function Component() {
  const { slug = '' } = useParams()
  const event = useEvent(slug)
  const [result, setResult] = useState<PaymentResult | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const pay = usePay()

  const data = event.data
  const bookable = data && data.type === 'kollide' && data.pricing.mode === 'paid' && data.viewer.booking?.status !== 'paid'
  const checkout = useCheckout(data?.id ?? '', Boolean(bookable) && !result)

  if (result && data) return <Success event={data} result={result} />
  if (event.isError) return <ErrorState headingLevel="h1" onRetry={() => void event.refetch()} />
  // Anything that isn't booked here, or is booked already, goes back to its own page.
  if (data && !bookable) return <Navigate to={`/app/events/${slug}`} replace />

  const back = (
    <AppLink to={`/app/events/${slug}`} className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground">
      <ArrowLeft className="size-4" aria-hidden="true" />
      Back to the event
    </AppLink>
  )

  if (!data || checkout.isPending) return <>{back}<Loading /></>
  if (checkout.isError) {
    if (isServiceError(checkout.error, 'conflict')) {
      return (
        <>
          {back}
          <EmptyState
            className="mt-8"
            icon={UsersRound}
            headingLevel="h1"
            title="This one can’t be booked right now"
            description={checkout.error.message}
            action={
              <AppLink to={`/app/events/${slug}`} className="font-semibold text-primary underline-offset-4 hover:underline">
                See similar events
              </AppLink>
            }
          />
        </>
      )
    }
    return <>{back}<ErrorState className="mt-8" headingLevel="h1" onRetry={() => void checkout.refetch()} /></>
  }

  const onPay = (input: PaymentInput) =>
    pay.mutate(
      { bookingId: checkout.data.booking.id, input },
      {
        onSuccess: (paid) => {
          setSheetOpen(false)
          setResult(paid)
        },
      },
    )
  const failure =
    pay.error && (isServiceError(pay.error, 'payment_failed') || isServiceError(pay.error, 'validation'))
      ? pay.error.message
      : pay.error
        ? 'Something went wrong on our side. You have not been charged.'
        : null

  return (
    <>
      <title>{`Book ${data.title} · Kollide`}</title>
      {back}
      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-14">
        <div className="grid min-w-0 content-start gap-10">
          <header>
            <p className="eyebrow rise-in text-primary">Book your place</p>
            <h1 className="rise-in mt-3 text-h1" style={step(1)}>
              {data.title}
            </h1>
          </header>

          <div className="rise-in flex items-center gap-5 rounded-3xl border border-border/70 bg-card p-3 shadow-card" style={step(2)}>
            <img src={data.coverUrl} alt="" className="size-24 shrink-0 rounded-2xl object-cover" />
            <div className="min-w-0">
              <p className="font-semibold">{formatDay(data.startsAt)}</p>
              <p className="text-muted-foreground">{formatTimeRange(data.startsAt, data.endsAt)}</p>
              <p className="text-muted-foreground">{data.area}</p>
            </div>
          </div>

          <section aria-labelledby="next-heading" className="rise-in" style={step(3)}>
            <h2 id="next-heading" className="text-h3">
              What happens next
            </h2>
            <ol className="mt-5 grid gap-4">
              {[
                [KeyRound, 'The exact address appears on your plan the moment you’ve paid.'],
                [UsersRound, 'You can join a squad, so you arrive with a few people.'],
                [Ticket, 'On the day, show your ticket at the door.'],
              ].map(([Icon, text], index) => {
                const IconComponent = Icon as typeof KeyRound
                return (
                  <li key={index} className="flex items-start gap-4">
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-highlight-soft text-highlight-soft-foreground">
                      <IconComponent className="size-5" aria-hidden="true" />
                    </span>
                    <p className="pt-2">{text as string}</p>
                  </li>
                )
              })}
            </ol>
          </section>

          <section aria-labelledby="refunds-heading">
            <h2 id="refunds-heading" className="text-h3">
              If your plans change
            </h2>
            <RefundRules className="mt-5" />
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Summary event={data} checkout={checkout.data} onContinue={() => setSheetOpen(true)} />
        </aside>
      </div>

      <CheckoutSheet
        checkout={checkout.data}
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open)
          if (!open) pay.reset()
        }}
        processing={pay.isPending}
        failure={failure}
        onPay={onPay}
        onRetry={() => pay.reset()}
      />
    </>
  )
}

import { ArrowUpRight, Bell, CalendarHeart, Check, Clock, CreditCard, Smartphone, Wallet } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { AppLink } from '@/components/shared/app-link'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { PlanCard, type PlanAction } from '@/features/bookings/components/plan-card'
import { useCancelPlan, useMyBookings, useReconfirm } from '@/features/bookings/queries'
import { useMarkAllRead, useNotifications } from '@/features/notifications/queries'
import { useMyCredits, useMyPayments } from '@/features/payments/queries'
import { formatAgo, formatDay, formatInr, formatTime } from '@/lib/format'
import { spring, staggerContainer, staggerItem } from '@/lib/motion'
import { cn } from '@/lib/utils'
import type { BookingWithEvent, NotificationKind } from '@/services'

/** Updates a member cares about. Host and admin notices live on their own pages. */
const MEMBER_UPDATES: NotificationKind[] = [
  'request_approved',
  'request_declined',
  'request_waitlisted',
  'waitlist_promoted',
  'squad_approved',
  'payment',
  'refund',
  'account',
]
const ENDED = new Set(['attended', 'no_show', 'cancelled', 'refunded'])

const CONFIRM: Record<PlanAction, { title: string; body: string; button: string; done: string }> = {
  withdraw: {
    title: 'Withdraw your request?',
    body: 'The host won’t see it any more. You can ask again later if there’s room.',
    button: 'Withdraw',
    done: 'Request withdrawn',
  },
  leave_waitlist: {
    title: 'Leave the waitlist?',
    body: 'Everyone behind you moves up one place.',
    button: 'Leave the waitlist',
    done: 'You left the waitlist',
  },
  cant_make_it: {
    title: 'Give up your place?',
    body: 'Thank you for saying so. Your place goes to the next person on the waitlist, and it counts as cancelling, not as missing the event.',
    button: 'Give up my place',
    done: 'Your place is free for someone else',
  },
  remove_unpaid: {
    title: 'Remove this booking?',
    body: 'You haven’t paid, so nothing is charged.',
    button: 'Remove',
    done: 'Booking removed',
  },
}

/** "Still coming?": shown in the 24 hours before a free event, until the member answers. */
function StillComing({ plan, onCantMakeIt }: { plan: BookingWithEvent; onCantMakeIt: () => void }) {
  const reconfirm = useReconfirm()
  return (
    <m.section
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0, transition: spring.gentle }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.2 } }}
      aria-labelledby={`still-${plan.id}`}
      className="relative overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground shadow-lift sm:p-8"
    >
      <span className="absolute -top-16 -right-10 size-56 rounded-full bg-highlight/50 mix-blend-soft-light" aria-hidden="true" />
      <span className="absolute -right-24 -bottom-24 size-64 rounded-full border border-primary-foreground/25" aria-hidden="true" />
      <div className="relative grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div>
          <p className="eyebrow opacity-85">Still coming?</p>
          <h2 id={`still-${plan.id}`} className="mt-3 text-h2">
            {plan.event.title}
          </h2>
          <p className="mt-2 max-w-xl opacity-90">
            {formatDay(plan.event.startsAt)} at {formatTime(plan.event.startsAt)}, {plan.event.area}.{' '}
            {plan.event.host?.firstName ?? 'The host'} is planning for you. A quick yes helps, and if you can’t make it, your
            place goes to someone on the waitlist.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:min-w-52">
          <Button
            size="lg"
            className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
            disabled={reconfirm.isPending}
            onClick={() =>
              reconfirm.mutate(plan.id, {
                onSuccess: () => toast.success('See you there', { description: 'The host knows you’re coming.' }),
                onError: (error) => toast.error('That didn’t go through', { description: error.message }),
              })
            }
          >
            <Check aria-hidden="true" />
            Yes, I’m coming
          </Button>
          <Button variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={onCantMakeIt}>
            I can’t make it
          </Button>
        </div>
      </div>
    </m.section>
  )
}

function Updates() {
  const notifications = useNotifications()
  const markAll = useMarkAllRead()
  const updates = (notifications.data ?? []).filter((item) => !item.read && MEMBER_UPDATES.includes(item.kind)).slice(0, 4)
  if (updates.length === 0) return null
  const icon = (kind: NotificationKind) =>
    kind === 'payment' || kind === 'refund' ? Wallet : kind === 'request_waitlisted' ? Clock : kind === 'waitlist_promoted' || kind === 'request_approved' ? Check : Bell

  return (
    <section aria-labelledby="updates-heading">
      <div className="flex items-center justify-between gap-4">
        <h2 id="updates-heading" className="text-h4">
          New for you
        </h2>
        <Button variant="link" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
          Mark all as read
        </Button>
      </div>
      <ul className="mt-4 grid gap-2">
        {updates.map((item) => {
          const Icon = icon(item.kind)
          return (
            <li key={item.id} className="flex items-start gap-3.5 rounded-2xl border border-border/70 bg-card p-4">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-highlight-soft text-highlight-soft-foreground">
                <Icon className="size-4.5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">{item.title}</span>
                <span className="block text-sm text-muted-foreground">
                  {item.body} · {formatAgo(item.createdAt)}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function CreditCardSummary() {
  const credits = useMyCredits()
  const unused = (credits.data ?? []).filter((credit) => !credit.usedAt)
  const total = unused.reduce((sum, credit) => sum + credit.amountInr, 0)
  if (total === 0) return null
  return (
    <section aria-labelledby="credit-heading" className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-card p-6 shadow-card sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-success-soft text-success-strong">
          <Wallet className="size-6" aria-hidden="true" />
        </span>
        <div>
          <h2 id="credit-heading" className="font-sans text-sm font-semibold text-muted-foreground">
            Kollide credit
          </h2>
          <p className="font-display text-h2">{formatInr(total)}</p>
        </div>
      </div>
      <div className="text-sm text-muted-foreground sm:max-w-xs sm:text-right">
        <p>Used automatically on your next paid booking. It never expires.</p>
        <p className="mt-1">{unused[0].reason}</p>
      </div>
    </section>
  )
}

function Payments({ plans }: { plans: BookingWithEvent[] }) {
  const payments = useMyPayments()
  if (!payments.data || payments.data.length === 0) return null
  const titleOf = (bookingId: string) => plans.find((plan) => plan.id === bookingId)?.event.title ?? 'A Kollide event'
  const label = { succeeded: 'Paid', refunded: 'Refunded', failed: 'Didn’t go through', processing: 'Processing' } as const
  const variant = { succeeded: 'success', refunded: 'outline', failed: 'secondary', processing: 'warning' } as const

  return (
    <section aria-labelledby="payments-heading">
      <h2 id="payments-heading" className="text-h3">
        Payments
      </h2>
      <ul className="mt-5 divide-y divide-border overflow-hidden rounded-3xl border border-border/70 bg-card shadow-card">
        {payments.data.map((payment) => {
          const Method = payment.method === 'card' ? CreditCard : payment.method === 'upi' ? Smartphone : Wallet
          return (
            <li key={payment.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 sm:px-5">
              <Method className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1 basis-48">
                <span className="block truncate font-medium">{titleOf(payment.bookingId)}</span>
                <span className="block text-sm text-muted-foreground">
                  {formatDay(payment.createdAt)} · {payment.reference}
                </span>
              </span>
              <span className="font-semibold tabular-nums">{formatInr(payment.amountInr)}</span>
              <Badge variant={variant[payment.status]} size="sm">
                {label[payment.status]}
              </Badge>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** "My plans": everything the member has asked for, booked or been to. */
export function Component() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'past' ? 'past' : 'upcoming'
  const plans = useMyBookings()
  const payments = useMyPayments()
  const cancel = useCancelPlan()
  const [pending, setPending] = useState<{ plan: BookingWithEvent; action: PlanAction } | null>(null)
  const [openedAt] = useState(() => Date.now())

  const all = plans.data ?? []
  const upcoming = all
    .filter((plan) => new Date(plan.event.endsAt).getTime() > openedAt && !ENDED.has(plan.status))
    .sort((a, b) => a.event.startsAt.localeCompare(b.event.startsAt))
  // A checkout that was started and removed before paying was never really a plan.
  const past = all.filter((plan) => !upcoming.includes(plan) && !(plan.status === 'cancelled' && plan.flow === 'paid' && !plan.paymentId))
  const stillComing = upcoming.filter((plan) => plan.needsReconfirmation)
  const shown = tab === 'past' ? past : upcoming

  const confirm = () => {
    if (!pending) return
    const { plan, action } = pending
    cancel.mutate(plan.id, {
      onSuccess: ({ promotion }) => {
        setPending(null)
        toast.success(CONFIRM[action].done, {
          description: promotion ? 'The next person on the waitlist has your place now.' : undefined,
        })
      },
      onError: (error) => toast.error('That didn’t go through', { description: error.message }),
    })
  }

  const setTab = (next: 'upcoming' | 'past') =>
    setParams(
      (current) => {
        const copy = new URLSearchParams(current)
        if (next === 'past') copy.set('tab', 'past')
        else copy.delete('tab')
        return copy
      },
      { replace: true, preventScrollReset: true },
    )

  return (
    <>
      <title>My plans · Kollide</title>
      <PageHeader eyebrow="My plans" title="What’s coming up." description="Everything you’ve asked to join, booked or been to, and where each one stands." />

      <div className="mt-12 grid gap-10">
        <AnimatePresence initial={false}>
          {stillComing.map((plan) => (
            <StillComing key={plan.id} plan={plan} onCantMakeIt={() => setPending({ plan, action: 'cant_make_it' })} />
          ))}
        </AnimatePresence>

        <Updates />
        <CreditCardSummary />

        <section aria-label="Your plans">
          <div role="tablist" aria-label="When" className="flex gap-1 border-b border-border">
            {(['upcoming', 'past'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                id={`plans-tab-${value}`}
                aria-selected={tab === value}
                aria-controls="plans-panel"
                tabIndex={tab === value ? 0 : -1}
                onClick={() => setTab(value)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                    const next = value === 'upcoming' ? 'past' : 'upcoming'
                    setTab(next)
                    document.getElementById(`plans-tab-${next}`)?.focus()
                  }
                }}
                className={cn(
                  'relative inline-flex h-12 items-center gap-2 px-4 font-medium transition-colors outline-none focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-ring',
                  tab === value ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {value === 'upcoming' ? 'Upcoming' : 'Past'}
                {plans.data ? (
                  <span
                    className={cn(
                      'min-w-6 rounded-full px-1.5 text-center text-xs leading-6 font-semibold',
                      tab === value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {value === 'upcoming' ? upcoming.length : past.length}
                  </span>
                ) : null}
                {tab === value ? (
                  <m.span layoutId="plans-tab" transition={spring.soft} className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" aria-hidden="true" />
                ) : null}
              </button>
            ))}
          </div>

          <div id="plans-panel" role="tabpanel" aria-labelledby={`plans-tab-${tab}`} className="pt-8">
            {plans.isPending ? (
              <div role="status" aria-label="Loading your plans" className="grid gap-3">
                {[0, 1, 2].map((index) => (
                  <Skeleton key={index} className="h-32 rounded-3xl" />
                ))}
              </div>
            ) : plans.isError ? (
              <ErrorState onRetry={() => void plans.refetch()} />
            ) : shown.length === 0 ? (
              <EmptyState
                icon={CalendarHeart}
                title={tab === 'past' ? 'Nothing here yet' : 'Nothing planned yet'}
                description={
                  tab === 'past'
                    ? 'Events you’ve been to will collect here.'
                    : 'Find something on this week, ask to join, and it will appear here.'
                }
                action={
                  tab === 'upcoming' ? (
                    <AppLink to="/app" className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline">
                      Find an event
                      <ArrowUpRight className="size-4" aria-hidden="true" />
                    </AppLink>
                  ) : undefined
                }
              />
            ) : (
              <m.ul key={tab} variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-[minmax(0,1fr)] gap-3">
                {shown.map((plan) => (
                  <m.li key={plan.id} variants={staggerItem} layout="position">
                    <PlanCard
                      plan={plan}
                      payment={payments.data?.find((payment) => payment.id === plan.paymentId)}
                      onAction={(target, action) => setPending({ plan: target, action })}
                    />
                  </m.li>
                ))}
              </m.ul>
            )}
          </div>
        </section>

        <Payments plans={all} />
      </div>

      <Dialog open={Boolean(pending)} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          {pending ? (
            <>
              <DialogHeader>
                <DialogTitle>{CONFIRM[pending.action].title}</DialogTitle>
                <DialogDescription>
                  {pending.plan.event.title}. {CONFIRM[pending.action].body}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setPending(null)}>
                  Keep it
                </Button>
                <Button variant="destructive" onClick={confirm} disabled={cancel.isPending}>
                  {CONFIRM[pending.action].button}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

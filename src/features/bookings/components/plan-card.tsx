import { ArrowUpRight, MapPin } from 'lucide-react'
import type { ReactNode } from 'react'

import { AppLink } from '@/components/shared/app-link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BOOKING_STATUS } from '@/features/bookings/labels'
import { formatDay, formatInr, formatTime } from '@/lib/format'
import type { BookingWithEvent, Payment } from '@/services'

export type PlanAction = 'withdraw' | 'leave_waitlist' | 'cant_make_it' | 'remove_unpaid'

interface PlanCardProps {
  plan: BookingWithEvent
  payment?: Payment
  onAction: (plan: BookingWithEvent, action: PlanAction) => void
}

/** What a booking means right now, in a sentence, and what the member can do about it. */
function describe(plan: BookingWithEvent, payment: Payment | undefined): { text: string; actions: ReactNode[] } {
  const host = plan.event.host?.firstName ?? 'The host'
  switch (plan.status) {
    case 'requested':
      return { text: `Waiting for ${host}’s answer. Most hosts reply within a day.`, actions: ['withdraw'] }
    case 'waitlisted':
      return {
        text: `Number ${plan.waitlistPosition ?? '–'} on the waitlist. If a place opens, it’s yours automatically.`,
        actions: ['leave_waitlist'],
      }
    case 'approved':
      return {
        text: plan.promotedAt ? 'A place opened up, and you moved up from the waitlist. You’re in.' : 'You’re in.',
        actions: ['cant_make_it'],
      }
    case 'confirmed':
      return { text: 'You’re in, and you’ve said you’re still coming.', actions: ['cant_make_it'] }
    case 'paid':
      return {
        text: payment
          ? `Booked. You paid ${payment.method === 'credit' ? `${formatInr(payment.creditAppliedInr)} in credit` : formatInr(payment.amountInr + payment.creditAppliedInr)}.`
          : 'Booked.',
        actions: ['cancel_paid'],
      }
    case 'pending_payment':
      return { text: 'You started booking but haven’t paid yet. Places aren’t held until you pay.', actions: ['finish', 'remove_unpaid'] }
    case 'declined':
      return { text: `${host} couldn’t fit everyone in this time.`, actions: ['similar'] }
    case 'attended':
      return { text: 'You went.', actions: [] }
    case 'no_show':
      return { text: 'You were booked but didn’t make it.', actions: [] }
    case 'cancelled':
      return { text: plan.paymentId ? 'Cancelled. The amount came back as Kollide credit.' : 'Cancelled.', actions: [] }
    case 'refunded':
      return { text: 'Cancelled and refunded.', actions: [] }
  }
}

/** One booking on "My plans". */
export function PlanCard({ plan, payment, onAction }: PlanCardProps) {
  const status = BOOKING_STATUS[plan.status]
  const { text, actions } = describe(plan, payment)
  const eventPath = `/app/events/${plan.event.slug}`

  const button = (action: ReactNode) => {
    switch (action) {
      case 'withdraw':
        return <Button key="withdraw" variant="ghost" size="sm" onClick={() => onAction(plan, 'withdraw')}>Withdraw my request</Button>
      case 'leave_waitlist':
        return <Button key="leave" variant="ghost" size="sm" onClick={() => onAction(plan, 'leave_waitlist')}>Leave the waitlist</Button>
      case 'cant_make_it':
        return <Button key="cant" variant="ghost" size="sm" onClick={() => onAction(plan, 'cant_make_it')}>I can’t make it</Button>
      case 'remove_unpaid':
        return <Button key="remove" variant="ghost" size="sm" onClick={() => onAction(plan, 'remove_unpaid')}>Remove</Button>
      case 'cancel_paid':
        return (
          <Button key="cancel" asChild variant="ghost" size="sm">
            <AppLink to={`/app/plans/${plan.id}/cancel`}>Cancel booking</AppLink>
          </Button>
        )
      case 'finish':
        return (
          <Button key="finish" asChild variant="soft" size="sm">
            <AppLink to={`${eventPath}/book`}>Finish booking</AppLink>
          </Button>
        )
      case 'similar':
        return (
          <Button key="similar" asChild variant="ghost" size="sm">
            <AppLink to={eventPath}>
              See similar events
              <ArrowUpRight aria-hidden="true" />
            </AppLink>
          </Button>
        )
      default:
        return null
    }
  }

  return (
    <article className="flex gap-4 rounded-3xl border border-border/70 bg-card p-3.5 shadow-card sm:gap-5 sm:p-4">
      <AppLink to={eventPath} tabIndex={-1} aria-hidden="true" className="shrink-0">
        <img src={plan.event.coverUrl} alt="" loading="lazy" className="size-20 rounded-2xl object-cover sm:size-28" />
      </AppLink>
      <div className="grid min-w-0 flex-1 content-start gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Badge variant={status.variant} size="sm">
            {plan.promotedAt && plan.status === 'approved' ? 'Moved up' : status.label}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {formatDay(plan.event.startsAt)} · {formatTime(plan.event.startsAt)}
          </span>
        </div>
        <h3 className="text-h4">
          <AppLink to={eventPath} className="underline-offset-4 hover:underline">
            {plan.event.title}
          </AppLink>
        </h3>
        <p className="text-sm text-muted-foreground">{text}</p>
        {plan.address ? (
          <p className="flex items-start gap-2 text-sm">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>{plan.address.exactAddress}</span>
          </p>
        ) : null}
        {actions.length > 0 ? <div className="-ml-3 flex flex-wrap items-center gap-1">{actions.map(button)}</div> : null}
      </div>
    </article>
  )
}

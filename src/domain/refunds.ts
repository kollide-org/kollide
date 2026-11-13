import type { BookingStatus, ISODateTime, RefundKind } from '@/services/types'

import { hoursBetween } from './time'

/** A full refund is available until this long before the event. After that, it is credit. */
export const FULL_REFUND_CUTOFF_HOURS = 72

export interface RefundDecision {
  outcome: RefundKind | 'none'
  amountInr: number
  explanation: string
}

interface RefundCase {
  amountPaidInr: number
  bookingStatus: BookingStatus
  eventStartsAt: ISODateTime
  eventCancelledByKollide: boolean
  now: Date
}

/**
 * The refund rules:
 * - a full refund up to 72 hours before the event;
 * - Kollide credit after that;
 * - nothing for a no-show;
 * - an automatic full refund if Kollide cancels the event.
 */
export function decideRefund(refundCase: RefundCase): RefundDecision {
  const { amountPaidInr, bookingStatus, eventStartsAt, eventCancelledByKollide, now } = refundCase

  if (eventCancelledByKollide && (bookingStatus === 'paid' || bookingStatus === 'cancelled')) {
    return {
      outcome: 'cancelled_by_kollide',
      amountInr: amountPaidInr,
      explanation: 'Kollide cancelled this event, so your payment is refunded in full automatically.',
    }
  }
  if (bookingStatus === 'no_show') {
    return { outcome: 'none', amountInr: 0, explanation: 'There is no refund when a booking is missed without cancelling.' }
  }
  if (bookingStatus !== 'paid') {
    return { outcome: 'none', amountInr: 0, explanation: 'There is nothing to refund for this booking.' }
  }

  const hoursUntil = hoursBetween(now, eventStartsAt)
  if (hoursUntil >= FULL_REFUND_CUTOFF_HOURS) {
    return {
      outcome: 'full',
      amountInr: amountPaidInr,
      explanation: 'You are more than 72 hours ahead of the event, so you get a full refund.',
    }
  }
  if (hoursUntil > 0) {
    return {
      outcome: 'credit',
      amountInr: amountPaidInr,
      explanation: 'The event is less than 72 hours away, so you get the full amount as Kollide credit.',
    }
  }
  return { outcome: 'none', amountInr: 0, explanation: 'This event has already started, so it can no longer be refunded.' }
}

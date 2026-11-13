import type { Booking, BookingStatus, ISODateTime } from '@/services/types'

import { hoursBetween } from './time'

/** Hosts may approve up to 30% more people than capacity, because some don't turn up. */
export const OVER_APPROVAL_RATIO = 0.3
/** House parties are capped, however large the home. */
export const HOUSE_PARTY_MAX_GUESTS = 25
/** "Still coming?" appears this long before the event. */
export const RECONFIRM_WINDOW_HOURS = 24

export function approvalLimit(capacity: number): number {
  return Math.floor(capacity * (1 + OVER_APPROVAL_RATIO))
}

/** Statuses that hold a place at an upcoming event. */
const HOLDING: readonly BookingStatus[] = ['approved', 'confirmed', 'paid', 'attended']

export function holdsPlace(status: BookingStatus): boolean {
  return HOLDING.includes(status)
}

export function canApproveAnother(capacity: number, holdingCount: number): boolean {
  return holdingCount < approvalLimit(capacity)
}

/** Never negative, even when the host has approved over capacity. */
export function spotsLeft(capacity: number, holdingCount: number): number {
  return Math.max(0, capacity - holdingCount)
}

/** The exact address appears only once a booking is approved or paid. */
export function canSeeAddress(status: BookingStatus): boolean {
  return holdsPlace(status)
}

/** True in the 24 hours before the event, for an approved guest who has not yet answered. */
export function needsReconfirmation(
  booking: Pick<Booking, 'status' | 'reconfirmedAt'>,
  eventStartsAt: ISODateTime,
  now: Date,
): boolean {
  if (booking.status !== 'approved' || booking.reconfirmedAt) return false
  const hoursUntil = hoursBetween(now, eventStartsAt)
  return hoursUntil > 0 && hoursUntil <= RECONFIRM_WINDOW_HOURS
}

/** The next person to promote when a place opens: the lowest waitlist position, then the earliest request. */
export function nextOnWaitlist<T extends Pick<Booking, 'status' | 'waitlistPosition' | 'createdAt'>>(
  bookings: readonly T[],
): T | null {
  const waiting = bookings.filter((booking) => booking.status === 'waitlisted')
  if (waiting.length === 0) return null
  return [...waiting].sort(
    (a, b) =>
      (a.waitlistPosition ?? Number.MAX_SAFE_INTEGER) - (b.waitlistPosition ?? Number.MAX_SAFE_INTEGER) ||
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )[0]
}

/** The moves each status allows. Anything else is rejected. */
const TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  requested: ['approved', 'waitlisted', 'declined', 'cancelled'],
  waitlisted: ['approved', 'declined', 'cancelled'],
  approved: ['confirmed', 'attended', 'no_show', 'cancelled', 'waitlisted', 'declined'],
  confirmed: ['attended', 'no_show', 'cancelled'],
  declined: [],
  pending_payment: ['paid', 'cancelled'],
  paid: ['attended', 'no_show', 'cancelled', 'refunded'],
  attended: [],
  no_show: [],
  cancelled: [],
  refunded: [],
}

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

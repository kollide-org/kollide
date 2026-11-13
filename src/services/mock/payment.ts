import { holdsPlace } from '@/domain/bookings'
import { decideRefund } from '@/domain/refunds'

import { ServiceError } from '../errors'
import type { PaymentService } from '../interfaces'
import type { Booking, Checkout, Credit, ID, Payment, PaymentInput, Refund } from '../types'

import { promoteFromWaitlist } from './booking'
import { getDb, saveDb, type Db, type EventRecord } from './db'
import { notify } from './notify'
import { copy, invalid, latency, newId, notFound, now, nowIso, requireActiveMember, requireUser } from './runtime'

/**
 * A simulated checkout. No payment SDK is called anywhere.
 * To see the failure screen, pay with a UPI ID ending in "@fail" or a card
 * number ending in 0002.
 */
const UPI_PATTERN = /^[a-z0-9._-]{2,}@[a-z]{2,}$/i

function eventOf(db: Db, eventId: ID): EventRecord {
  const event = db.events.find((candidate) => candidate.id === eventId)
  if (!event) throw notFound('event')
  return event
}

function ownBooking(db: Db, bookingId: ID, userId: ID): Booking {
  const booking = db.bookings.find((candidate) => candidate.id === bookingId)
  if (!booking) throw notFound('booking')
  if (booking.userId !== userId) throw new ServiceError('forbidden', 'This is not your booking.')
  return booking
}

function unusedCredits(db: Db, userId: ID): Credit[] {
  return db.credits.filter((credit) => credit.userId === userId && !credit.usedAt).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

function checkoutFor(db: Db, booking: Booking, event: EventRecord): Checkout {
  const priceInr = event.pricing.amountInr ?? 0
  const creditAvailableInr = unusedCredits(db, booking.userId).reduce((sum, credit) => sum + credit.amountInr, 0)
  const creditAppliedInr = Math.min(creditAvailableInr, priceInr)
  return { booking, eventTitle: event.title, priceInr, creditAvailableInr, creditAppliedInr, payableInr: priceInr - creditAppliedInr }
}

/** Uses up credit, oldest first. Whatever is left of a credit is kept as a new one. */
function spendCredit(db: Db, userId: ID, amountInr: number): void {
  let remaining = amountInr
  for (const credit of unusedCredits(db, userId)) {
    if (remaining <= 0) break
    credit.usedAt = nowIso()
    if (credit.amountInr > remaining) {
      db.credits.push({ ...credit, id: newId('cr'), amountInr: credit.amountInr - remaining, usedAt: null, reason: 'Remaining Kollide credit' })
    }
    remaining -= Math.min(remaining, credit.amountInr)
  }
}

function validatePayment(input: PaymentInput): void {
  if (input.method === 'upi') {
    if (!UPI_PATTERN.test(input.upiId.trim())) throw invalid('Enter a UPI ID, such as name@bank.')
    return
  }
  const digits = input.cardNumber.replace(/\s/g, '')
  if (!/^\d{16}$/.test(digits)) throw invalid('Enter the 16-digit card number.')
  const [month, year] = input.expiry.split('/').map((part) => Number(part.trim()))
  const expires = new Date(2000 + year, month, 1)
  if (!month || month > 12 || Number.isNaN(expires.getTime()) || expires <= now()) throw invalid('Check the expiry date.')
  if (!/^\d{3}$/.test(input.cvv)) throw invalid('Enter the 3-digit security code.')
  if (!input.nameOnCard.trim()) throw invalid('Enter the name on the card.')
}

function shouldFail(input: PaymentInput): boolean {
  return input.method === 'upi' ? input.upiId.trim().toLowerCase().endsWith('@fail') : input.cardNumber.replace(/\s/g, '').endsWith('0002')
}

export const mockPaymentService: PaymentService = {
  async startCheckout(eventId) {
    await latency()
    const db = getDb()
    const user = requireActiveMember(db)
    const event = eventOf(db, eventId)
    if (event.pricing.mode !== 'paid') throw invalid('This event is not booked through checkout.')
    if (event.status !== 'published' || new Date(event.startsAt) <= now()) {
      throw new ServiceError('conflict', 'This event is no longer taking bookings.')
    }
    const mine = db.bookings.filter((booking) => booking.eventId === eventId && booking.userId === user.id)
    if (mine.some((booking) => holdsPlace(booking.status))) throw new ServiceError('conflict', 'You have already booked this event.')

    let booking = mine.find((candidate) => candidate.status === 'pending_payment')
    if (!booking) {
      const held = db.bookings.filter((candidate) => candidate.eventId === eventId && holdsPlace(candidate.status)).length
      if (held >= event.capacity) throw new ServiceError('conflict', 'This one’s full. Here are similar events.')
      booking = {
        id: newId('bk'),
        eventId,
        userId: user.id,
        flow: 'paid',
        status: 'pending_payment',
        note: null,
        waitlistPosition: null,
        reconfirmedAt: null,
        paymentId: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }
      db.bookings.push(booking)
      saveDb()
    }
    return copy(checkoutFor(db, booking, event))
  },

  async pay(bookingId, input) {
    // Long enough for the "processing" state to be seen.
    await latency(4)
    const db = getDb()
    const user = requireActiveMember(db)
    const booking = ownBooking(db, bookingId, user.id)
    if (booking.status !== 'pending_payment') throw new ServiceError('conflict', 'This booking is not waiting for payment.')
    validatePayment(input)
    const event = eventOf(db, booking.eventId)
    const checkout = checkoutFor(db, booking, event)

    const payment: Payment = {
      id: newId('pay'),
      bookingId: booking.id,
      userId: user.id,
      amountInr: checkout.payableInr,
      creditAppliedInr: checkout.creditAppliedInr,
      method: input.method,
      status: 'succeeded',
      reference: `KOL${Math.floor(100000 + Math.random() * 900000)}`,
      failureReason: null,
      createdAt: nowIso(),
    }
    db.payments.push(payment)

    if (shouldFail(input)) {
      payment.status = 'failed'
      payment.failureReason = 'Your bank declined the payment.'
      saveDb()
      throw new ServiceError('payment_failed', 'Your bank declined the payment. You have not been charged.')
    }

    spendCredit(db, user.id, checkout.creditAppliedInr)
    booking.status = 'paid'
    booking.paymentId = payment.id
    booking.updatedAt = payment.createdAt
    notify(db, user.id, 'payment', 'You’re booked', `${event.title}. The address is now on your plan.`, '/app/plans')
    saveDb()
    return copy({ payment, booking })
  },

  async getRefundQuote(bookingId) {
    await latency(0.6)
    const db = getDb()
    const user = requireUser(db)
    const booking = ownBooking(db, bookingId, user.id)
    const event = eventOf(db, booking.eventId)
    const payment = db.payments.find((candidate) => candidate.id === booking.paymentId)
    const decision = decideRefund({
      amountPaidInr: (payment?.amountInr ?? 0) + (payment?.creditAppliedInr ?? 0),
      bookingStatus: booking.status,
      eventStartsAt: event.startsAt,
      eventCancelledByKollide: event.cancelledByKollide,
      now: now(),
    })
    return { bookingId, ...decision }
  },

  async cancelAndRefund(bookingId) {
    await latency(1.5)
    const db = getDb()
    const user = requireUser(db)
    const booking = ownBooking(db, bookingId, user.id)
    const event = eventOf(db, booking.eventId)
    const payment = db.payments.find((candidate) => candidate.id === booking.paymentId)
    if (booking.status !== 'paid' || !payment) throw new ServiceError('conflict', 'There is nothing to refund for this booking.')

    const amountPaidInr = payment.amountInr + payment.creditAppliedInr
    const decision = decideRefund({
      amountPaidInr,
      bookingStatus: booking.status,
      eventStartsAt: event.startsAt,
      eventCancelledByKollide: event.cancelledByKollide,
      now: now(),
    })
    if (decision.outcome === 'none') throw new ServiceError('conflict', decision.explanation)

    const refund: Refund = {
      id: newId('rf'),
      paymentId: payment.id,
      bookingId: booking.id,
      userId: user.id,
      kind: decision.outcome,
      amountInr: decision.amountInr,
      createdAt: nowIso(),
    }
    db.refunds.push(refund)
    payment.status = 'refunded'
    booking.updatedAt = refund.createdAt

    let credit: Credit | null = null
    if (decision.outcome === 'credit') {
      booking.status = 'cancelled'
      credit = {
        id: newId('cr'),
        userId: user.id,
        amountInr: decision.amountInr,
        reason: `Credit for cancelling “${event.title}” inside 72 hours`,
        refundId: refund.id,
        createdAt: refund.createdAt,
        usedAt: null,
      }
      db.credits.push(credit)
      notify(db, user.id, 'refund', `₹${credit.amountInr} added as Kollide credit`, 'It will be used automatically on your next paid booking.', '/app/plans')
    } else {
      booking.status = 'refunded'
      notify(db, user.id, 'refund', `₹${refund.amountInr} refunded`, `For ${event.title}. It can take a few days to reach your account.`, '/app/plans')
    }
    promoteFromWaitlist(db, event)
    saveDb()
    return copy({ refund, credit })
  },

  async listMyPayments() {
    await latency()
    const db = getDb()
    const user = requireUser(db)
    return copy(db.payments.filter((payment) => payment.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
  },

  async listMyCredits() {
    await latency()
    const db = getDb()
    const user = requireUser(db)
    return copy(db.credits.filter((credit) => credit.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
  },
}

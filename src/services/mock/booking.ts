import {
  approvalLimit,
  canApproveAnother,
  canSeeAddress,
  canTransition,
  holdsPlace,
  needsReconfirmation,
  nextOnWaitlist,
} from '@/domain/bookings'
import { isReviewWindowOpen } from '@/domain/reviews'

import { ServiceError } from '../errors'
import type { BookingService } from '../interfaces'
import type { Booking, BookingStatus, CheckIn, CheckInMethod, ID, WaitlistPromotion } from '../types'

import { getDb, saveDb, type Db, type EventRecord } from './db'
import { notify } from './notify'
import { copy, invalid, latency, newId, notFound, now, nowIso, requireActiveMember, requireUser } from './runtime'
import { eventListItem, personPreview, profileCard } from './views'

function eventOf(db: Db, eventId: ID): EventRecord {
  const event = db.events.find((candidate) => candidate.id === eventId)
  if (!event) throw notFound('event')
  return event
}

function bookingOf(db: Db, bookingId: ID): Booking {
  const booking = db.bookings.find((candidate) => candidate.id === bookingId)
  if (!booking) throw notFound('booking')
  return booking
}

/** The host of the event, or an admin. */
function requireManager(db: Db, event: EventRecord) {
  const user = requireUser(db)
  if (user.role !== 'admin' && event.hostId !== user.id) {
    throw new ServiceError('forbidden', 'Only the host can do this.')
  }
  return user
}

function move(booking: Booking, to: BookingStatus): void {
  if (!canTransition(booking.status, to)) {
    throw new ServiceError('conflict', 'This booking has already moved on. Refresh to see where it stands.')
  }
  booking.status = to
  booking.updatedAt = nowIso()
}

function holdingCount(db: Db, eventId: ID): number {
  return db.bookings.filter((booking) => booking.eventId === eventId && holdsPlace(booking.status)).length
}

function renumberWaitlist(db: Db, eventId: ID): void {
  db.bookings
    .filter((booking) => booking.eventId === eventId && booking.status === 'waitlisted')
    .sort((a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0) || a.createdAt.localeCompare(b.createdAt))
    .forEach((booking, index) => {
      booking.waitlistPosition = index + 1
    })
}

/** When a place opens up, the next person on the waitlist takes it. */
export function promoteFromWaitlist(db: Db, event: EventRecord): WaitlistPromotion | null {
  if (holdingCount(db, event.id) >= event.capacity) return null
  const next = nextOnWaitlist(db.bookings.filter((booking) => booking.eventId === event.id))
  if (!next) return null
  next.status = 'approved'
  next.waitlistPosition = null
  next.updatedAt = nowIso()
  renumberWaitlist(db, event.id)
  notify(db, next.userId, 'waitlist_promoted', 'A place opened up', `You’re in for ${event.title}.`, '/app/plans')
  return { promoted: next, person: personPreview(db, next.userId) }
}

function recordCheckIn(db: Db, event: EventRecord, userId: ID, method: CheckInMethod, by: ID): CheckIn {
  const existing = db.checkIns.find((checkIn) => checkIn.eventId === event.id && checkIn.userId === userId)
  if (existing) return existing
  const booking = db.bookings.find(
    (candidate) => candidate.eventId === event.id && candidate.userId === userId && holdsPlace(candidate.status),
  )
  if (!booking) throw invalid('This person does not have an approved booking for this event.')
  const checkIn: CheckIn = { id: newId('ci'), eventId: event.id, userId, method, checkedInAt: nowIso(), checkedInBy: by }
  db.checkIns.push(checkIn)
  booking.status = 'attended'
  booking.updatedAt = checkIn.checkedInAt
  return checkIn
}

function feedbackOwed(db: Db, booking: Booking, event: EventRecord, at: Date): boolean {
  if (booking.status !== 'attended' || !isReviewWindowOpen(event.endsAt, at)) return false
  const others = db.checkIns.filter((checkIn) => checkIn.eventId === event.id && checkIn.userId !== booking.userId)
  const reviewed = db.tagReviews.filter((review) => review.eventId === event.id && review.reviewerId === booking.userId)
  const hostRated =
    !event.hostId ||
    event.hostId === booking.userId ||
    db.hostRatings.some((rating) => rating.eventId === event.id && rating.raterId === booking.userId)
  return reviewed.length < others.length || !hostRated
}

export const mockBookingService: BookingService = {
  async listMyBookings() {
    await latency()
    const db = getDb()
    const user = requireUser(db)
    const at = now()
    return copy(
      db.bookings
        .filter((booking) => booking.userId === user.id)
        .map((booking) => {
          const event = eventOf(db, booking.eventId)
          return {
            ...booking,
            event: eventListItem(db, event),
            needsReconfirmation: needsReconfirmation(booking, event.startsAt, at),
            address: canSeeAddress(booking.status)
              ? { eventId: event.id, exactAddress: event.exactAddress, directions: event.directions }
              : null,
            feedbackOpen: feedbackOwed(db, booking, event, at),
          }
        })
        .sort((a, b) => b.event.startsAt.localeCompare(a.event.startsAt)),
    )
  },

  async requestToJoin(eventId, note) {
    await latency()
    const db = getDb()
    const user = requireActiveMember(db)
    const event = eventOf(db, eventId)
    if (event.type !== 'community') throw invalid('This event is booked differently. Open it to see how.')
    if (event.status !== 'published' || new Date(event.startsAt) <= now()) {
      throw new ServiceError('conflict', 'This event is no longer taking requests.')
    }
    if (event.hostId === user.id) throw invalid('You are hosting this one.')
    const profile = db.profiles.find((candidate) => candidate.userId === user.id)
    if (event.womenOnly && profile?.gender !== 'woman') throw new ServiceError('forbidden', 'This event is for women only.')
    const active = db.bookings.find(
      (booking) => booking.eventId === eventId && booking.userId === user.id && !['cancelled', 'declined'].includes(booking.status),
    )
    if (active) throw new ServiceError('conflict', 'You have already asked to join this event.')

    const booking: Booking = {
      id: newId('bk'),
      eventId,
      userId: user.id,
      flow: 'free',
      status: 'requested',
      note: note?.trim() || null,
      waitlistPosition: null,
      reconfirmedAt: null,
      paymentId: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    db.bookings.push(booking)
    if (event.hostId) notify(db, event.hostId, 'request_received', `${profile?.firstName ?? 'Someone'} asked to join`, event.title, '/app/host')
    saveDb()
    return copy(booking)
  },

  async cancelBooking(bookingId) {
    await latency()
    const db = getDb()
    const user = requireUser(db)
    const booking = bookingOf(db, bookingId)
    if (booking.userId !== user.id) throw new ServiceError('forbidden', 'This is not your booking.')
    if (booking.flow === 'paid' && booking.status === 'paid') {
      throw invalid('Paid bookings are cancelled from the refund screen, so the refund rules apply.')
    }
    const heldPlace = holdsPlace(booking.status)
    move(booking, 'cancelled')
    booking.waitlistPosition = null
    const event = eventOf(db, booking.eventId)
    renumberWaitlist(db, event.id)
    const promotion = heldPlace ? promoteFromWaitlist(db, event) : null
    saveDb()
    return copy({ booking, promotion })
  },

  async reconfirm(bookingId) {
    await latency(0.6)
    const db = getDb()
    const user = requireUser(db)
    const booking = bookingOf(db, bookingId)
    if (booking.userId !== user.id) throw new ServiceError('forbidden', 'This is not your booking.')
    move(booking, 'confirmed')
    booking.reconfirmedAt = booking.updatedAt
    saveDb()
    return copy(booking)
  },

  async getTicket(bookingId) {
    await latency(0.6)
    const db = getDb()
    const user = requireUser(db)
    const booking = bookingOf(db, bookingId)
    if (booking.userId !== user.id) throw new ServiceError('forbidden', 'This is not your booking.')
    if (!holdsPlace(booking.status)) throw new ServiceError('forbidden', 'Your ticket appears once your booking is approved or paid.')
    return {
      bookingId: booking.id,
      eventId: booking.eventId,
      code: `KOLLIDE:${booking.eventId}:${booking.id}`,
      holderFirstName: personPreview(db, user.id).firstName,
    }
  },

  async listRequests(eventId) {
    await latency()
    const db = getDb()
    const event = eventOf(db, eventId)
    const manager = requireManager(db, event)
    const at = now()
    return copy(
      db.bookings
        .filter((booking) => booking.eventId === eventId && (booking.status === 'requested' || booking.status === 'waitlisted'))
        .sort((a, b) => a.status.localeCompare(b.status) || a.createdAt.localeCompare(b.createdAt))
        .map((booking) => ({ booking, requester: profileCard(db, booking.userId, manager.id, at) })),
    )
  },

  async decideRequest(bookingId, decision) {
    await latency(0.7)
    const db = getDb()
    const booking = bookingOf(db, bookingId)
    const event = eventOf(db, booking.eventId)
    requireManager(db, event)

    if (decision === 'approve') {
      if (!canApproveAnother(event.capacity, holdingCount(db, event.id))) {
        throw new ServiceError(
          'conflict',
          `You have approved ${approvalLimit(event.capacity)} people, the most this event allows. Waitlist the rest.`,
        )
      }
      move(booking, 'approved')
      booking.waitlistPosition = null
      notify(db, booking.userId, 'request_approved', 'You’re in', `${event.title}. The address is now on your plan.`, '/app/plans')
    } else if (decision === 'waitlist') {
      if (booking.status !== 'waitlisted') {
        move(booking, 'waitlisted')
        booking.waitlistPosition =
          db.bookings.filter((candidate) => candidate.eventId === event.id && candidate.status === 'waitlisted').length
      }
      notify(db, booking.userId, 'request_declined', 'You’re on the waitlist', `${event.title}. We’ll tell you if a place opens.`, '/app/plans')
    } else {
      move(booking, 'declined')
      booking.waitlistPosition = null
      notify(db, booking.userId, 'request_declined', `${event.title} is full`, 'This one filled up. Here are a few similar events.', '/app')
    }
    renumberWaitlist(db, event.id)
    saveDb()
    return copy(booking)
  },

  async getHostCapacity(eventId) {
    await latency(0.6)
    const db = getDb()
    const event = eventOf(db, eventId)
    requireManager(db, event)
    const count = (status: BookingStatus) =>
      db.bookings.filter((booking) => booking.eventId === eventId && booking.status === status).length
    return {
      eventId,
      capacity: event.capacity,
      approvalLimit: approvalLimit(event.capacity),
      approved: holdingCount(db, eventId),
      requested: count('requested'),
      waitlisted: count('waitlisted'),
      checkedIn: db.checkIns.filter((checkIn) => checkIn.eventId === eventId).length,
    }
  },

  async listAttendees(eventId) {
    await latency()
    const db = getDb()
    const event = eventOf(db, eventId)
    requireManager(db, event)
    return copy(
      db.bookings
        .filter((booking) => booking.eventId === eventId && (holdsPlace(booking.status) || booking.status === 'no_show'))
        .map((booking) => ({
          booking,
          person: personPreview(db, booking.userId),
          checkIn: db.checkIns.find((checkIn) => checkIn.eventId === eventId && checkIn.userId === booking.userId) ?? null,
        }))
        .sort((a, b) => a.person.firstName.localeCompare(b.person.firstName)),
    )
  },

  async checkIn(eventId, userId, method) {
    await latency(0.5)
    const db = getDb()
    const event = eventOf(db, eventId)
    const manager = requireManager(db, event)
    const checkIn = recordCheckIn(db, event, userId, method, manager.id)
    saveDb()
    return copy(checkIn)
  },

  async checkInWithTicket(eventId, ticketCode) {
    await latency(0.9)
    const db = getDb()
    const event = eventOf(db, eventId)
    const manager = requireManager(db, event)
    const [prefix, codeEventId, bookingId] = ticketCode.trim().split(':')
    const booking = db.bookings.find((candidate) => candidate.id === bookingId)
    if (prefix !== 'KOLLIDE' || !booking) throw invalid('That is not a Kollide ticket.')
    if (codeEventId !== eventId || booking.eventId !== eventId) throw invalid('This ticket is for a different event.')
    const checkIn = recordCheckIn(db, event, booking.userId, 'qr', manager.id)
    saveDb()
    return copy(checkIn)
  },

  async closeOutEvent(eventId) {
    await latency()
    const db = getDb()
    const event = eventOf(db, eventId)
    requireManager(db, event)
    if (new Date(event.startsAt) > now()) throw invalid('You can close out an event once it has started.')

    let noShows = 0
    for (const booking of db.bookings.filter((candidate) => candidate.eventId === eventId)) {
      if (['approved', 'confirmed', 'paid'].includes(booking.status)) {
        booking.status = 'no_show'
        booking.updatedAt = nowIso()
        noShows += 1
      } else if (booking.status === 'attended') {
        notify(db, booking.userId, 'feedback_open', `How was ${event.title}?`, 'Share a few tags for the people you met. It stays open for 72 hours.', '/app/plans')
      }
    }
    event.status = 'completed'
    saveDb()
    return { attended: db.checkIns.filter((checkIn) => checkIn.eventId === eventId).length, noShows }
  },
}

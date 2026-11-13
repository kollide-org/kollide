import type { ID, ISODateTime } from './common'
import type { EventAddress, EventListItem } from './event'
import type { ProfileCard, PersonPreview } from './user'

/** A free booking: requested, then decided by the host, then confirmed, then closed out. */
export type FreeBookingStatus =
  | 'requested'
  | 'approved'
  | 'waitlisted'
  | 'declined'
  | 'confirmed'
  | 'attended'
  | 'no_show'
  | 'cancelled'

/** A paid booking for one of Kollide's own events. */
export type PaidBookingStatus = 'pending_payment' | 'paid' | 'attended' | 'no_show' | 'cancelled' | 'refunded'

export type BookingStatus = FreeBookingStatus | PaidBookingStatus
export type BookingFlow = 'free' | 'paid'

export interface Booking {
  id: ID
  eventId: ID
  userId: ID
  flow: BookingFlow
  status: BookingStatus
  /** An optional note from the member to the host. */
  note: string | null
  /** 1 is next in line. `null` unless waitlisted. */
  waitlistPosition: number | null
  /** When the member answered "Still coming?". */
  reconfirmedAt: ISODateTime | null
  paymentId: ID | null
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

/** A booking as "My plans" shows it. */
export interface BookingWithEvent extends Booking {
  event: EventListItem
  /** True in the 24 hours before the event, until the member reconfirms. */
  needsReconfirmation: boolean
  /** Present only when the booking is approved, confirmed or paid. */
  address: EventAddress | null
  /** True while the 72-hour feedback window is open and feedback is still owed. */
  feedbackOpen: boolean
}

/** One card in the host's request inbox. */
export interface JoinRequest {
  booking: Booking
  requester: ProfileCard
}

export type RequestDecision = 'approve' | 'decline' | 'waitlist'

/** How full an event is, from the host's side. */
export interface HostCapacity {
  eventId: ID
  capacity: number
  /** Hosts may approve up to 30% over capacity, because some people don't turn up. */
  approvalLimit: number
  approved: number
  requested: number
  waitlisted: number
  checkedIn: number
}

export type CheckInMethod = 'qr' | 'manual'

export interface CheckIn {
  id: ID
  eventId: ID
  userId: ID
  method: CheckInMethod
  checkedInAt: ISODateTime
  /** The host or admin who checked the guest in. */
  checkedInBy: ID
}

/** One row of the host's attendee list. */
export interface Attendee {
  booking: Booking
  person: PersonPreview
  checkIn: CheckIn | null
}

/** The member's QR ticket. */
export interface Ticket {
  bookingId: ID
  eventId: ID
  /** The text encoded in the QR code. */
  code: string
  holderFirstName: string
}

/** Returned when a place opens up and the next person on the waitlist gets it. */
export interface WaitlistPromotion {
  promoted: Booking
  person: PersonPreview
}

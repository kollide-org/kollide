import type { TagCount } from './feedback'

/** pending_payment, paid, expired and refunded are reserved for P1 (payments) and never appear in v1. */
export type BookingStatus =
  | 'requested' | 'approved' | 'waitlisted' | 'declined' | 'confirmed' | 'attended' | 'no_show' | 'cancelled'
  | 'pending_payment' | 'paid' | 'expired' | 'refunded'

export interface CurrentBooking {
  bookingId: string
  status: BookingStatus
  squadId: string | null
  waitlistPosition: number | null
}

export interface MyBooking {
  bookingId: string
  eventId: string
  status: BookingStatus
  eventTitle: string
  eventStatus: string
  startsAt: string
  endsAt: string
  areaName: string
  coverKey: string | null
  squadId: string | null
  cancelReason: string | null
  requestedAt: string
  waitlistPosition: number | null
}

/** One person asking to come, shown to the host as a profile card. Never includes phone, date of birth or gender. */
export interface InboxItem {
  bookingId: string
  userId: string
  status: BookingStatus
  requestedAt: string
  squadName: string | null
  firstName: string | null
  age: number | null
  areaId: number | null
  isVerified: boolean
  photoKeys: string[]
  interestIds: number[]
  languageIds: number[]
  prompts: { prompt: string; answer: string }[]
  showsUpAttended: number
  showsUpTotal: number
  /** Their three most common tags from the last 12 months. */
  topTags: TagCount[]
  eventsInCommon: number
}

export type HostDecision = 'approve' | 'waitlist' | 'decline'

export interface ReconfirmResult {
  status: 'confirmed'
  already: boolean
  eventId: string
  eventTitle: string
}

export interface BookingsService {
  requestToJoin(eventId: string): Promise<{ bookingId: string; status: BookingStatus }>
  getMyBooking(eventId: string): Promise<CurrentBooking | null>
  myBookings(): Promise<MyBooking[]>
  cancel(bookingId: string): Promise<void>
  /** The one-tap link from the "Still coming?" email. Works without signing in. */
  reconfirm(token: string): Promise<ReconfirmResult>
  hostInbox(eventId: string): Promise<InboxItem[]>
  decide(bookingId: string, decision: HostDecision): Promise<void>
  /** Admins only: sends the "Still coming?" email now, for testing. */
  sendReconfirmationNow(bookingId: string): Promise<void>
}

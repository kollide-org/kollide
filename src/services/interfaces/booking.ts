import type {
  Attendee,
  Booking,
  BookingWithEvent,
  CheckIn,
  CheckInMethod,
  HostCapacity,
  ID,
  JoinRequest,
  RequestDecision,
  Ticket,
  WaitlistPromotion,
} from '../types'

export interface BookingService {
  /** "My plans": upcoming and past, newest event first. */
  listMyBookings(): Promise<BookingWithEvent[]>
  /** Community events. Rejects with `account_on_hold` while a safety report is open. */
  requestToJoin(eventId: ID, note?: string): Promise<Booking>
  /** Frees the place and promotes the next person on the waitlist, if there is one. */
  cancelBooking(bookingId: ID): Promise<{ booking: Booking; promotion: WaitlistPromotion | null }>
  /** Answers "Still coming?" in the 24 hours before the event. */
  reconfirm(bookingId: ID): Promise<Booking>
  getTicket(bookingId: ID): Promise<Ticket>

  /** Host: the request inbox, as profile cards. */
  listRequests(eventId: ID): Promise<JoinRequest[]>
  /** Host: accept, decline or waitlist. Accepting is capped at 30% over capacity. */
  decideRequest(bookingId: ID, decision: RequestDecision): Promise<Booking>
  getHostCapacity(eventId: ID): Promise<HostCapacity>
  listAttendees(eventId: ID): Promise<Attendee[]>
  /** Host: tap-to-check-in, or the result of a scanned ticket. */
  checkIn(eventId: ID, userId: ID, method: CheckInMethod): Promise<CheckIn>
  checkInWithTicket(eventId: ID, ticketCode: string): Promise<CheckIn>
  /** Host: closes the event. Anyone approved who did not check in becomes a no-show. */
  closeOutEvent(eventId: ID): Promise<{ attended: number; noShows: number }>
}

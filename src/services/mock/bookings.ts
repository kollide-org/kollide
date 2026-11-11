import type { BookingsService, CurrentBooking, MyBooking } from '../types/bookings'

let current = new Map<string, CurrentBooking>()

export const mockBookings: BookingsService = {
  async requestToJoin(eventId) {
    const bookingId = `mock-booking-${eventId}`
    current.set(eventId, { bookingId, status: 'requested', squadId: null, waitlistPosition: null })
    return { bookingId, status: 'requested' }
  },
  async getMyBooking(eventId) {
    return current.get(eventId) ?? null
  },
  async myBookings(): Promise<MyBooking[]> {
    return [...current.entries()].map(([eventId, b]) => ({
      bookingId: b.bookingId, eventId, status: b.status, eventTitle: 'Sample event', eventStatus: 'published',
      startsAt: new Date(Date.now() + 3 * 86_400_000).toISOString(), endsAt: new Date(Date.now() + 3 * 86_400_000 + 7_200_000).toISOString(),
      areaName: 'Indiranagar', coverKey: null, squadId: null, cancelReason: null, requestedAt: new Date().toISOString(), waitlistPosition: null,
    }))
  },
  async cancel(bookingId) {
    current = new Map([...current].filter(([, b]) => b.bookingId !== bookingId))
  },
  async reconfirm() {
    return { status: 'confirmed', already: false, eventId: 'mock', eventTitle: 'Sample event' }
  },
  async hostInbox() {
    return [{
      bookingId: 'mock-request-1', userId: 'mock-user-9', status: 'requested', requestedAt: new Date().toISOString(), squadName: null,
      firstName: 'Riya', age: 27, areaId: 1, isVerified: true, photoKeys: [], interestIds: [1, 2], languageIds: [1],
      prompts: [{ prompt: 'A perfect Saturday', answer: 'Coffee and board games.' }], showsUpAttended: 0, showsUpTotal: 0, eventsInCommon: 1,
    }]
  },
  async decide() {},
  async sendReconfirmationNow() {},
}

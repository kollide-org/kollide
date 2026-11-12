/** What the host sees after checking someone in. */
export interface CheckinResult {
  checkinId: string
  bookingId: string
  userId: string
  method: 'qr' | 'manual'
  firstName: string | null
  photoKey: string | null
}

/** One person holding a seat, on the host's check-in screen. */
export interface CheckinRow {
  bookingId: string
  userId: string
  firstName: string | null
  photoKey: string | null
  status: 'approved' | 'confirmed' | 'attended' | 'no_show' | string
  squadName: string | null
  checkedIn: boolean
  checkedInAt: string | null
  method: 'qr' | 'manual' | null
}

/** The text inside a ticket QR code. The scanner accepts a bare token too. */
export const QR_PREFIX = 'kollide:checkin:'

export function tokenFromQr(text: string): string | null {
  const value = text.trim()
  const token = value.startsWith(QR_PREFIX) ? value.slice(QR_PREFIX.length) : value
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token) ? token.toLowerCase() : null
}

export interface CheckinService {
  /** The attendee's own QR token. */
  myToken(bookingId: string): Promise<string>
  /** Host or admin: scan. */
  checkIn(token: string): Promise<CheckinResult>
  /** Host or admin: tick a name off by hand. */
  checkInManual(bookingId: string): Promise<CheckinResult>
  hostList(eventId: string): Promise<CheckinRow[]>
  /** Admins only: count attendance now instead of two hours after the event ends (staging and testing). */
  finaliseNow(eventId: string, markNoShows?: boolean): Promise<string>
}

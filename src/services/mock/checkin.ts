import { QR_PREFIX, type CheckinRow, type CheckinService } from '../types/checkin'

const rows: CheckinRow[] = [
  { bookingId: 'mock-b1', userId: 'mock-u1', firstName: 'Meera', photoKey: null, status: 'approved', squadName: null, checkedIn: false, checkedInAt: null, method: null },
  { bookingId: 'mock-b2', userId: 'mock-u2', firstName: 'Kabir', photoKey: null, status: 'confirmed', squadName: 'Board gamers', checkedIn: false, checkedInAt: null, method: null },
]

export const mockCheckin: CheckinService = {
  async myToken(bookingId) {
    return `${QR_PREFIX}00000000-0000-4000-8000-${bookingId.replace(/[^0-9a-f]/gi, '0').padEnd(12, '0').slice(0, 12)}`
  },
  async checkIn() {
    const row = rows.find((r) => !r.checkedIn) ?? rows[0]
    row.checkedIn = true
    row.method = 'qr'
    return { checkinId: 'mock-c', bookingId: row.bookingId, userId: row.userId, method: 'qr', firstName: row.firstName, photoKey: null }
  },
  async checkInManual(bookingId) {
    const row = rows.find((r) => r.bookingId === bookingId) ?? rows[0]
    row.checkedIn = true
    row.method = 'manual'
    row.checkedInAt = new Date().toISOString()
    return { checkinId: 'mock-c', bookingId: row.bookingId, userId: row.userId, method: 'manual', firstName: row.firstName, photoKey: null }
  },
  async hostList() {
    return rows.map((r) => ({ ...r }))
  },
  async finaliseNow() {
    return 'finalised'
  },
}

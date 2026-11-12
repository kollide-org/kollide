import { ServiceError } from '../types/errors'
import { QR_PREFIX, type CheckinResult, type CheckinService } from '../types/checkin'

const client = () => import('./client').then((module) => module.supabase)

function fail(error: { message: string }): never {
  throw new ServiceError(/^[a-z0-9_]+$/.test(error.message) ? error.message : 'unknown', error.message)
}

function parse(data: unknown): CheckinResult {
  const r = data as { checkin_id: string; booking_id: string; user_id: string; method: 'qr' | 'manual'; first_name: string | null; photo_key: string | null }
  return { checkinId: r.checkin_id, bookingId: r.booking_id, userId: r.user_id, method: r.method, firstName: r.first_name, photoKey: r.photo_key }
}

export const realCheckin: CheckinService = {
  async myToken(bookingId) {
    const supabase = await client()
    const { data, error } = await supabase.rpc('my_checkin_token', { p_booking: bookingId })
    if (error) fail(error)
    return `${QR_PREFIX}${data as string}`
  },

  async checkIn(token) {
    const supabase = await client()
    const { data, error } = await supabase.rpc('check_in', { p_token: token })
    if (error) fail(error)
    return parse(data)
  },

  async checkInManual(bookingId) {
    const supabase = await client()
    const { data, error } = await supabase.rpc('check_in_manual', { p_booking: bookingId })
    if (error) fail(error)
    return parse(data)
  },

  async hostList(eventId) {
    const supabase = await client()
    const { data, error } = await supabase.rpc('host_checkin_list', { p_event: eventId })
    if (error) fail(error)
    return (data ?? []).map((r) => ({
      bookingId: r.booking_id, userId: r.user_id, firstName: r.first_name, photoKey: r.photo_key, status: r.status,
      squadName: r.squad_name, checkedIn: r.checked_in, checkedInAt: r.checked_in_at, method: r.method as 'qr' | 'manual' | null,
    }))
  },

  async finaliseNow(eventId, markNoShows = false) {
    const supabase = await client()
    const { data, error } = await supabase.rpc('admin_finalise_event_now', { p_event: eventId, p_mark_no_shows: markNoShows })
    if (error) fail(error)
    return data as string
  },
}

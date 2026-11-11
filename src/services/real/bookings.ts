import { ServiceError } from '../types/errors'
import type { BookingsService, BookingStatus, InboxItem, MyBooking } from '../types/bookings'

const client = () => import('./client').then((module) => module.supabase)

function fail(error: { message: string }): never {
  throw new ServiceError(/^[a-z0-9_]+$/.test(error.message) ? error.message : 'unknown', error.message)
}

export const realBookings: BookingsService = {
  async requestToJoin(eventId) {
    const supabase = await client()
    const { data, error } = await supabase.rpc('request_to_join', { p_event: eventId })
    if (error) fail(error)
    const r = data as { booking_id: string; status: BookingStatus }
    return { bookingId: r.booking_id, status: r.status }
  },

  async getMyBooking(eventId) {
    const supabase = await client()
    const { data, error } = await supabase.rpc('get_my_booking', { p_event: eventId })
    if (error) fail(error)
    if (!data) return null
    const r = data as { booking_id: string; status: BookingStatus; squad_id: string | null; waitlist_position: number | null }
    return { bookingId: r.booking_id, status: r.status, squadId: r.squad_id, waitlistPosition: r.waitlist_position }
  },

  async myBookings(): Promise<MyBooking[]> {
    const supabase = await client()
    const { data, error } = await supabase.rpc('my_bookings')
    if (error) fail(error)
    return (data ?? []).map((r) => ({
      bookingId: r.booking_id, eventId: r.event_id, status: r.status, eventTitle: r.event_title, eventStatus: r.event_status,
      startsAt: r.starts_at, endsAt: r.ends_at, areaName: r.area_name, coverKey: r.cover_key, squadId: r.squad_id,
      cancelReason: r.cancel_reason, requestedAt: r.requested_at, waitlistPosition: r.waitlist_position,
    }))
  },

  async cancel(bookingId) {
    const supabase = await client()
    const { error } = await supabase.rpc('cancel_my_booking', { p_booking: bookingId })
    if (error) fail(error)
  },

  async reconfirm(token) {
    const supabase = await client()
    const { data, error } = await supabase.rpc('reconfirm_booking', { p_token: token })
    if (error) fail(error)
    const r = data as { status: 'confirmed'; already: boolean; event_id: string; event_title: string }
    return { status: r.status, already: r.already, eventId: r.event_id, eventTitle: r.event_title }
  },

  async hostInbox(eventId): Promise<InboxItem[]> {
    const supabase = await client()
    const { data, error } = await supabase.rpc('host_inbox', { p_event: eventId })
    if (error) fail(error)
    return (data ?? []).map((r) => ({
      bookingId: r.booking_id, userId: r.user_id, status: r.status, requestedAt: r.requested_at, squadName: r.squad_name,
      firstName: r.first_name, age: r.age, areaId: r.area_id, isVerified: r.is_verified, photoKeys: r.photo_keys ?? [],
      interestIds: r.interest_ids ?? [], languageIds: r.language_ids ?? [],
      prompts: Array.isArray(r.bio_prompts) ? (r.bio_prompts as { prompt: string; answer: string }[]) : [],
      showsUpAttended: r.shows_up_attended, showsUpTotal: r.shows_up_total, eventsInCommon: r.events_in_common,
    }))
  },

  async decide(bookingId, decision) {
    const supabase = await client()
    const { error } = await supabase.rpc('decide_request', { p_booking: bookingId, p_decision: decision })
    if (error) fail(error)
  },

  async sendReconfirmationNow(bookingId) {
    const supabase = await client()
    const { error } = await supabase.rpc('admin_send_reconfirmation', { p_booking: bookingId })
    if (error) fail(error)
  },
}

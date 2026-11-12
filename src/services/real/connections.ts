import { ServiceError } from '../types/errors'
import type { ConnectionsService } from '../types/connections'

const client = () => import('./client').then((module) => module.supabase)

function fail(error: { message: string }): never {
  throw new ServiceError(/^[a-z0-9_]+$/.test(error.message) ? error.message : 'unknown', error.message)
}

export const realConnections: ConnectionsService = {
  async tap(eventId, userId) {
    const supabase = await client()
    const { data, error } = await supabase.rpc('tap_meet_again', { p_event: eventId, p_user: userId })
    if (error) fail(error)
    return { mutual: (data as { mutual: boolean }).mutual }
  },

  async myTaps(eventId) {
    const supabase = await client()
    const { data, error } = await supabase.from('connections').select('to_user').eq('event_id', eventId)
    if (error) fail(error)
    return (data ?? []).map((r) => r.to_user)
  },

  async list() {
    const supabase = await client()
    const { data, error } = await supabase.rpc('my_connections')
    if (error) fail(error)
    return (data ?? []).map((r) => ({
      userId: r.user_id, firstName: r.first_name, photoKey: r.photo_key, eventId: r.event_id, eventTitle: r.event_title, connectedAt: r.connected_at,
    }))
  },
}

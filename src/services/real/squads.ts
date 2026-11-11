import { ServiceError } from '../types/errors'
import type { SquadsService } from '../types/squads'

const client = () => import('./client').then((module) => module.supabase)

function fail(error: { message: string }): never {
  throw new ServiceError(/^[a-z0-9_]+$/.test(error.message) ? error.message : 'unknown', error.message)
}

export const realSquads: SquadsService = {
  async eventSquads(eventId) {
    const supabase = await client()
    const { data, error } = await supabase.rpc('event_squads', { p_event: eventId })
    if (error) fail(error)
    return (data ?? []).map((r) => ({
      id: r.id, name: r.name, creatorId: r.creator_id, creatorFirstName: r.creator_first_name, memberCount: r.member_count,
      spotsLeft: r.spots_left, complete: r.complete, myStatus: r.my_status as 'requested' | 'approved' | 'declined' | 'left' | null,
    }))
  },
  async create(eventId, meetingPoint, name) {
    const supabase = await client()
    const { data, error } = await supabase.rpc('create_squad', { p_event: eventId, p_meeting_point: meetingPoint, p_name: name })
    if (error) fail(error)
    return data as string
  },
  async requestToJoin(squadId) {
    const supabase = await client()
    const { error } = await supabase.rpc('request_to_join_squad', { p_squad: squadId })
    if (error) fail(error)
  },
  async decide(squadId, userId, approve) {
    const supabase = await client()
    const { error } = await supabase.rpc('decide_squad_request', { p_squad: squadId, p_user: userId, p_approve: approve })
    if (error) fail(error)
  },
  async leave(squadId) {
    const supabase = await client()
    const { error } = await supabase.rpc('leave_squad', { p_squad: squadId })
    if (error) fail(error)
  },
  async disband(squadId) {
    const supabase = await client()
    const { error } = await supabase.rpc('disband_squad', { p_squad: squadId })
    if (error) fail(error)
  },
  async getSquad(squadId) {
    const supabase = await client()
    const { data, error } = await supabase.rpc('get_squad', { p_squad: squadId })
    if (error) fail(error)
    const r = data as { id: string; event_id: string; name: string | null; meeting_point: string; is_creator: boolean; members: { user_id: string; first_name: string | null; status: 'requested' | 'approved' }[] }
    return { id: r.id, eventId: r.event_id, name: r.name, meetingPoint: r.meeting_point, isCreator: r.is_creator,
      members: r.members.map((m) => ({ userId: m.user_id, firstName: m.first_name, status: m.status })) }
  },
  async mySquads() {
    const supabase = await client()
    const { data, error } = await supabase.rpc('my_squads')
    if (error) fail(error)
    return (data ?? []).map((r) => ({
      id: r.id, eventId: r.event_id, eventTitle: r.event_title, name: r.name, myStatus: r.my_status as 'requested' | 'approved',
      isCreator: r.is_creator, memberCount: r.member_count, requestCount: r.request_count,
    }))
  },
}

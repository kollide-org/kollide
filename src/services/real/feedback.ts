import { ServiceError } from '../types/errors'
import type { FeedbackPerson, FeedbackService, FeedbackTask } from '../types/feedback'

const client = () => import('./client').then((module) => module.supabase)

function fail(error: { message: string }): never {
  throw new ServiceError(/^[a-z0-9_]+$/.test(error.message) ? error.message : 'unknown', error.message)
}

export const realFeedback: FeedbackService = {
  async tags() {
    const supabase = await client()
    const { data, error } = await supabase.from('positive_tags').select('id, slug, label').eq('active', true).order('sort_order')
    if (error) fail(error)
    return data ?? []
  },

  async tasks() {
    const supabase = await client()
    const { data, error } = await supabase.rpc('my_feedback_tasks')
    if (error) fail(error)
    return (data ?? []).map((r): FeedbackTask => ({
      eventId: r.event_id, eventTitle: r.event_title, closesAt: r.closes_at, hostId: r.host_id, canRateHost: r.can_rate_host, hostRated: r.host_rated,
      people: ((r.people ?? []) as { user_id: string; first_name: string | null; photo_key: string | null; is_host: boolean; tagged: boolean; flagged: boolean }[]).map(
        (p): FeedbackPerson => ({ userId: p.user_id, firstName: p.first_name, photoKey: p.photo_key, isHost: p.is_host, tagged: p.tagged, flagged: p.flagged }),
      ),
    }))
  },

  async giveTags(eventId, toUser, tagIds) {
    const supabase = await client()
    const { error } = await supabase.rpc('give_tags', { p_event: eventId, p_to: toUser, p_tag_ids: tagIds })
    if (error) fail(error)
  },

  async submitPrivate(eventId, aboutUser, issue, note) {
    const supabase = await client()
    const { error } = await supabase.rpc('submit_private_feedback', { p_event: eventId, p_about: aboutUser, p_issue: issue, p_note: note })
    if (error) fail(error)
  },

  async rateHost(eventId, ratings) {
    const supabase = await client()
    const { error } = await supabase.rpc('rate_host', {
      p_event: eventId, p_as_described: ratings.asDescribed, p_felt_safe: ratings.feltSafe, p_well_organised: ratings.wellOrganised,
    })
    if (error) fail(error)
  },
}

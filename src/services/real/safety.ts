import { ServiceError } from '../types/errors'
import type { Appeal, SafetyService, Tip } from '../types/safety'

const client = () => import('./client').then((module) => module.supabase)

function fail(error: { message: string }): never {
  throw new ServiceError(/^[a-z0-9_]+$/.test(error.message) ? error.message : 'unknown', error.message)
}

export const realSafety: SafetyService = {
  async report(subject, subjectId, reason, details) {
    const supabase = await client()
    const { error } = await supabase.rpc('report', { p_subject_type: subject, p_subject_id: subjectId, p_reason: reason, p_details: details })
    if (error) fail(error) // the result is deliberately dropped: the reporter is never told whether anyone was put on hold
  },

  async myTips(): Promise<Tip[]> {
    const supabase = await client()
    const { data, error } = await supabase.from('profile_tips').select('id, message, created_at').eq('status', 'active').order('created_at', { ascending: false })
    if (error) fail(error)
    return (data ?? []).map((r) => ({ id: r.id, message: r.message, createdAt: r.created_at }))
  },

  async myAppeals(): Promise<Appeal[]> {
    const supabase = await client()
    const { data, error } = await supabase
      .from('appeals')
      .select('id, kind, tip_id, message, status, due_at, admin_note, created_at')
      .order('created_at', { ascending: false })
    if (error) fail(error)
    return (data ?? []).map((r) => ({
      id: r.id, kind: r.kind as Appeal['kind'], tipId: r.tip_id, message: r.message, status: r.status as Appeal['status'],
      dueAt: r.due_at, adminNote: r.admin_note, createdAt: r.created_at,
    }))
  },

  async createAppeal(kind, message, tipId) {
    const supabase = await client()
    const { error } = await supabase.rpc('create_appeal', { p_kind: kind, p_tip_id: tipId, p_message: message })
    if (error) fail(error)
  },
}

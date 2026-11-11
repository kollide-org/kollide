import { ServiceError } from '../types/errors'
import type { AdminService } from '../types/admin'
import { api } from './api'

const client = () => import('./client').then((module) => module.supabase)

function fail(error: { message: string }): never {
  throw new ServiceError(/^[a-z0-9_]+$/.test(error.message) ? error.message : 'unknown', error.message)
}

export const realAdmin: AdminService = {
  async listPendingVerifications() {
    const supabase = await client()
    const { data, error } = await supabase.rpc('admin_list_pending_verifications')
    if (error) throw new ServiceError(/^[a-z0-9_]+$/.test(error.message) ? error.message : 'unknown', error.message)
    return (data ?? []).map((row) => ({ id: row.id, userId: row.user_id, firstName: row.first_name, createdAt: row.created_at }))
  },

  async getSelfieUrl(verificationId) {
    const result = await api<{ url: string }>(`/admin/selfies/${verificationId}/view`)
    return result.url
  },

  async reviewVerification(verificationId, approved) {
    const supabase = await client()
    const { error } = await supabase.rpc('review_verification', { p_id: verificationId, p_approved: approved })
    if (error) throw new ServiceError(/^[a-z0-9_]+$/.test(error.message) ? error.message : 'unknown', error.message)
  },

  async listHostApplications() {
    const supabase = await client()
    const { data, error } = await supabase.rpc('admin_list_host_applications')
    if (error) throw fail(error)
    return (data ?? []).map((row) => ({ id: row.id, userId: row.user_id, firstName: row.first_name, message: row.message, createdAt: row.created_at }))
  },

  async reviewHostApplication(id, approved, note) {
    const supabase = await client()
    const { error } = await supabase.rpc('review_host_application', { p_id: id, p_approved: approved, p_note: note })
    if (error) throw fail(error)
  },

  async listEvents(status) {
    const supabase = await client()
    const { data, error } = await supabase
      .from('events')
      .select('id, title, type, status, starts_at, host_id, profiles:host_id(first_name)')
      .eq('status', status)
      .order('starts_at')
    if (error) throw fail(error)
    const featured = await supabase.from('featured_slots').select('event_id, position')
    const positions = new Map((featured.data ?? []).map((row) => [row.event_id, row.position]))
    return (data ?? []).map((row) => ({
      id: row.id, title: row.title, type: row.type, status: row.status, startsAt: row.starts_at,
      hostFirstName: (row.profiles as { first_name: string | null } | null)?.first_name ?? null,
      featuredPosition: positions.get(row.id) ?? null,
    }))
  },

  async approveEvent(id, note) {
    const supabase = await client()
    const { error } = await supabase.rpc('approve_event', { p_event: id, p_note: note })
    if (error) throw fail(error)
  },

  async rejectEvent(id, note) {
    const supabase = await client()
    const { error } = await supabase.rpc('reject_event', { p_event: id, p_note: note })
    if (error) throw fail(error)
  },

  async featureEvent(id, position) {
    const supabase = await client()
    const { error } = await supabase.rpc('feature_event', { p_event: id, p_position: position })
    if (error) throw fail(error)
  },

  async unfeatureEvent(id) {
    const supabase = await client()
    const { error } = await supabase.rpc('unfeature_event', { p_event: id })
    if (error) throw fail(error)
  },

  async listHubs() {
    const supabase = await client()
    const { data, error } = await supabase.from('hubs').select('*, hub_events(event_id, sort_order)').order('sort_order')
    if (error) throw fail(error)
    return (data ?? []).map((row) => ({
      id: row.id, slug: row.slug, title: row.title, subtitle: row.subtitle, artKey: row.art_key, accentColor: row.accent_color,
      startsOn: row.starts_on, endsOn: row.ends_on, sortOrder: row.sort_order, published: row.published,
      eventIds: [...row.hub_events].sort((a, b) => a.sort_order - b.sort_order).map((link) => link.event_id),
    }))
  },

  async saveHub(input) {
    const supabase = await client()
    const { data, error } = await supabase.rpc('admin_upsert_hub', {
      p_id: (input.id ?? null) as unknown as string, p_slug: input.slug, p_title: input.title, p_subtitle: input.subtitle,
      p_accent_color: input.accentColor, p_starts_on: input.startsOn as unknown as string, p_ends_on: input.endsOn as unknown as string,
      p_sort_order: input.sortOrder, p_published: input.published, p_art_key: input.artKey,
    })
    if (error) throw fail(error)
    return data as string
  },

  async setHubEvents(hubId, eventIds) {
    const supabase = await client()
    const { error } = await supabase.rpc('admin_set_hub_events', { p_hub: hubId, p_event_ids: eventIds })
    if (error) throw fail(error)
  },

  async deleteHub(id) {
    const supabase = await client()
    const { error } = await supabase.rpc('admin_delete_hub', { p_hub: id })
    if (error) throw fail(error)
  },

  async jobRuns() {
    const supabase = await client()
    const { data, error } = await supabase.rpc('admin_job_runs')
    if (error) throw fail(error)
    return (data ?? []).map((r) => ({
      job: r.job, lastFinishedAt: r.last_finished_at, lastStatus: r.last_status as 'ok' | 'warning' | 'error' | 'skipped' | null,
      lastDetail: r.last_detail as Record<string, unknown> | null, lastError: r.last_error, runCount: Number(r.run_count), errorCount: Number(r.error_count),
    }))
  },
}

import { ServiceError } from '../types/errors'
import type {
  AdminService, AppealRow, AuditEntry, FlagRow, ModerationAction, PartnerEvent, ReportDetail, ReportRow, ReportStatus, UserDetail, UserRow,
} from '../types/admin'
import type { UserStatus } from '../types/profile'

type JobRunStatus = 'ok' | 'warning' | 'error' | 'skipped' | null
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
  // ---------------------------------------------------------------- B7: reports, users, flags, appeals
  async listReports(status) {
    const supabase = await client()
    const { data, error } = await supabase.rpc('admin_list_reports', { p_status: status ?? undefined, p_limit: 100 })
    if (error) throw fail(error)
    return (data ?? []).map((r): ReportRow => ({
      id: r.id, subjectType: r.subject_type as ReportRow['subjectType'], subjectId: r.subject_id, subjectUserId: r.subject_user_id,
      subjectFirstName: r.subject_first_name, subjectStatus: r.subject_status as UserStatus, reporterFirstName: r.reporter_first_name,
      reason: r.reason, status: r.status as ReportStatus, held: r.held, actionTaken: r.action_taken, createdAt: r.created_at,
      reviewerFirstName: r.reviewer_first_name,
    }))
  },

  async getReport(id) {
    const supabase = await client()
    const { data, error } = await supabase.rpc('admin_get_report', { p_id: id })
    if (error) throw fail(error)
    const r = data as Record<string, any>
    const subject = r.subject
    return {
      id: r.id, subjectType: r.subject_type, subjectLabel: r.subject_label, reason: r.reason, details: r.details, status: r.status, held: r.held,
      actionTaken: r.action_taken, adminNote: r.admin_note, userNote: r.user_note, createdAt: r.created_at, reviewerFirstName: r.reviewer_first_name,
      reporter: r.reporter ? { id: r.reporter.id, firstName: r.reporter.first_name, isVerified: r.reporter.is_verified } : null,
      subject: {
        id: subject.id, firstName: subject.first_name, status: subject.status, isVerified: subject.is_verified, createdAt: subject.created_at,
        roles: subject.roles ?? [], showsUpAttended: subject.shows_up_attended, showsUpTotal: subject.shows_up_total,
      },
      otherReports: (r.other_reports ?? []).map((o: any) => ({ id: o.id, reason: o.reason, status: o.status, held: o.held, createdAt: o.created_at })),
      flags: (r.flags ?? []).map((f: any) => ({ id: f.id, kind: f.kind, status: f.status, createdAt: f.created_at })),
      privateFeedback: (r.private_feedback ?? []).map((f: any) => ({ issueCode: f.issue_code, note: f.note, month: f.month })),
      moderation: (r.moderation ?? []).map((m: any) => ({ action: m.action as ModerationAction, reason: m.reason, createdAt: m.created_at })),
    } satisfies ReportDetail
  },

  async startReview(id) {
    const supabase = await client()
    const { error } = await supabase.rpc('admin_start_review', { p_id: id })
    if (error) throw fail(error)
  },

  async resolveReport(id, outcome, internalNote, userNote) {
    const supabase = await client()
    const { error } = await supabase.rpc('admin_resolve_report', { p_id: id, p_action: outcome, p_internal_note: internalNote, p_user_note: userNote })
    if (error) throw fail(error)
  },

  async liftHold(userId, note) {
    const supabase = await client()
    const { error } = await supabase.rpc('admin_lift_hold', { p_user: userId, p_note: note })
    if (error) throw fail(error)
  },

  async searchUsers(query) {
    const supabase = await client()
    const { data, error } = await supabase.rpc('admin_search_users', {
      p_q: query.q || undefined, p_status: query.status, p_limit: query.limit ?? 25, p_offset: query.offset ?? 0,
    })
    if (error) throw fail(error)
    return (data ?? []).map((r): UserRow => ({
      userId: r.user_id, firstName: r.first_name, lastName: r.last_name, email: r.email, phoneHint: r.phone_hint, status: r.status as UserStatus,
      isVerified: r.is_verified, roles: r.roles ?? [], createdAt: r.created_at, onboarded: r.onboarded, openReports: r.open_reports,
    }))
  },

  async userDetail(userId) {
    const supabase = await client()
    const { data, error } = await supabase.rpc('admin_user_detail', { p_user: userId })
    if (error) throw fail(error)
    const r = data as Record<string, any>
    return {
      id: r.id, firstName: r.first_name, lastName: r.last_name, email: r.email, phoneHint: r.phone_hint, age: r.age, status: r.status,
      isVerified: r.is_verified, createdAt: r.created_at, onboarded: r.onboarded, roles: r.roles ?? [],
      verification: r.verification ? { result: r.verification.result, reviewedAt: r.verification.reviewed_at, submittedAt: r.verification.submitted_at } : null,
      reputation: r.reputation ? {
        eventsAttended: r.reputation.events_attended, showsUpAttended: r.reputation.shows_up_attended, showsUpTotal: r.reputation.shows_up_total,
        eventsHosted: r.reputation.events_hosted, topTags: r.reputation.top_tags ?? [],
      } : null,
      flags: (r.flags ?? []).map((f: any) => ({ id: f.id, kind: f.kind, status: f.status, details: f.details ?? {}, createdAt: f.created_at })),
      reportsAbout: (r.reports_about ?? []).map((o: any) => ({ id: o.id, reason: o.reason, status: o.status, held: o.held, actionTaken: o.action_taken, createdAt: o.created_at })),
      moderation: (r.moderation ?? []).map((m: any) => ({ action: m.action, reason: m.reason, userNote: m.user_note, adminFirstName: m.admin_first_name, createdAt: m.created_at })),
      tips: (r.tips ?? []).map((t: any) => ({ id: t.id, message: t.message, createdAt: t.created_at })),
    } satisfies UserDetail
  },

  async setUserStatus(userId, action, reason, userNote) {
    const supabase = await client()
    const { error } = await supabase.rpc('admin_set_user_status', { p_user: userId, p_action: action, p_reason: reason, p_user_note: userNote })
    if (error) throw fail(error)
  },

  async listFlags(status) {
    const supabase = await client()
    const { data, error } = await supabase.rpc('admin_list_flags', { p_status: status ?? undefined, p_limit: 100 })
    if (error) throw fail(error)
    return (data ?? []).map((r): FlagRow => ({
      id: r.id, kind: r.kind as FlagRow['kind'], status: r.status as FlagRow['status'], subjectUserId: r.subject_user_id, subjectFirstName: r.subject_first_name,
      eventId: r.event_id, eventTitle: r.event_title, details: (r.details ?? {}) as Record<string, unknown>, createdAt: r.created_at,
      resolvedAt: r.resolved_at, resolutionNote: r.resolution_note,
    }))
  },

  async resolveFlag(id, status, note) {
    const supabase = await client()
    const { error } = await supabase.rpc('admin_resolve_flag', { p_id: id, p_status: status, p_note: note })
    if (error) throw fail(error)
  },

  async listAppeals(status) {
    const supabase = await client()
    const { data, error } = await supabase.rpc('admin_list_appeals', { p_status: status ?? undefined, p_limit: 100 })
    if (error) throw fail(error)
    return (data ?? []).map((r): AppealRow => ({
      id: r.id, userId: r.user_id, firstName: r.first_name, userStatus: r.user_status as UserStatus, kind: r.kind as AppealRow['kind'], tipMessage: r.tip_message,
      message: r.message, status: r.status as AppealRow['status'], dueAt: r.due_at, overdue: r.overdue, adminNote: r.admin_note, createdAt: r.created_at, resolvedAt: r.resolved_at,
    }))
  },

  async resolveAppeal(id, decision, note) {
    const supabase = await client()
    const { error } = await supabase.rpc('resolve_appeal', { p_appeal: id, p_decision: decision, p_note: note })
    if (error) throw fail(error)
  },

  async listPartnerEvents() {
    const supabase = await client()
    const { data, error } = await supabase.rpc('admin_list_partner_events')
    if (error) throw fail(error)
    return (data ?? []).map((r): PartnerEvent => ({
      eventId: r.event_id, title: r.title, status: r.status, startsAt: r.starts_at, hostFirstName: r.host_first_name, partnerUrl: r.partner_url,
      referralCode: r.referral_code, clicks7d: Number(r.clicks_7d), clicks30d: Number(r.clicks_30d), clicksTotal: Number(r.clicks_total),
    }))
  },

  async setPartnerLink(eventId, url, referralCode) {
    const supabase = await client()
    const { error } = await supabase.rpc('admin_set_partner_link', { p_event: eventId, p_url: url, p_referral: referralCode })
    if (error) throw fail(error)
  },

  async auditLog(filters) {
    const supabase = await client()
    const { data, error } = await supabase.rpc('admin_audit_log', {
      p_actor: filters.actor, p_action: filters.action, p_table: filters.table, p_from: filters.from, p_to: filters.to,
      p_limit: filters.limit ?? 50, p_before: filters.before,
    })
    if (error) throw fail(error)
    return (data ?? []).map((r): AuditEntry => ({
      id: r.id, at: r.at, actorId: r.actor_id, actorFirstName: r.actor_first_name, action: r.action as AuditEntry['action'], tableName: r.table_name,
      rowPk: r.row_pk, oldData: r.old_data as Record<string, unknown> | null, newData: r.new_data as Record<string, unknown> | null,
    }))
  },

  async auditTables() {
    const supabase = await client()
    const { data, error } = await supabase.rpc('admin_audit_tables')
    if (error) throw fail(error)
    return data ?? []
  },

  async jobHealth() {
    const supabase = await client()
    const { data, error } = await supabase.rpc('admin_job_health')
    if (error) throw fail(error)
    return (data ?? []).map((r) => ({
      job: r.job, lastFinishedAt: r.last_finished_at, lastStatus: r.last_status as JobRunStatus, lastDetail: r.last_detail as Record<string, unknown> | null,
      lastError: r.last_error, runCount: Number(r.run_count), errorCount: Number(r.error_count), everyMinutes: r.every_minutes, late: r.late,
    }))
  },

  async emailUsage() {
    const supabase = await client()
    const { data, error } = await supabase.rpc('admin_email_usage')
    if (error) throw fail(error)
    const r = data as { sent_today: number; daily_cap: number; warn_at: number; queued: number; failed_24h: number }
    return { sentToday: r.sent_today, dailyCap: r.daily_cap, warnAt: r.warn_at, queued: r.queued, failed24h: r.failed_24h }
  },
}

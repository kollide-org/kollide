import type { AdminHub, AdminService, AppealRow, FlagRow, HostApplication, PendingVerification, ReportDetail, ReportRow, UserDetail, UserRow } from '../types/admin'

let applications: HostApplication[] = [
  { id: 'mock-application-1', userId: 'mock-user-2', firstName: 'Noor', message: 'I run a monthly pottery meetup.', createdAt: '2026-11-10T10:00:00Z' },
]
let hubs: AdminHub[] = []
const now = () => new Date().toISOString()
let reports: ReportRow[] = [
  { id: 'mock-report-1', subjectType: 'user', subjectId: 'mock-user-4', subjectUserId: 'mock-user-4', subjectFirstName: 'Kabir', subjectStatus: 'on_hold', reporterFirstName: 'Meera',
    reason: 'harassment', status: 'open', held: true, actionTaken: null, createdAt: now(), reviewerFirstName: null },
]
let flags: FlagRow[] = [
  { id: 'mock-flag-1', kind: 'no_checkins', status: 'open', subjectUserId: null, subjectFirstName: null, eventId: 'mock-event', eventTitle: 'Sunday board games', details: { seats: 4 }, createdAt: now(), resolvedAt: null, resolutionNote: null },
]
let appeals: AppealRow[] = [
  { id: 'mock-appeal-1', userId: 'mock-user-4', firstName: 'Kabir', userStatus: 'on_hold', kind: 'account_status', tipMessage: null, message: 'I think this was a mistake.', status: 'open',
    dueAt: new Date(Date.now() + 40 * 3_600_000).toISOString(), overdue: false, adminNote: null, createdAt: now(), resolvedAt: null },
]
const users: UserRow[] = [
  { userId: 'mock-user-4', firstName: 'Kabir', lastName: 'Rao', email: 'kabir@example.com', phoneHint: '••••1234', status: 'on_hold', isVerified: true, roles: [], createdAt: now(), onboarded: true, openReports: 1 },
]
let pending: PendingVerification[] = [
  { id: 'mock-verification-1', userId: 'mock-user-1', firstName: 'Meera', createdAt: '2026-11-11T10:00:00Z' },
]

export const mockAdmin: AdminService = {
  async listPendingVerifications() {
    return pending
  },
  async getSelfieUrl() {
    return 'about:blank'
  },
  async reviewVerification(id) {
    pending = pending.filter((item) => item.id !== id)
  },
  async listHostApplications() {
    return applications
  },
  async reviewHostApplication(id) {
    applications = applications.filter((item) => item.id !== id)
  },
  async listEvents(status) {
    return status === 'pending_review'
      ? [{ id: 'mock-pending', title: 'Pending sample event', type: 'community', status: 'pending_review', startsAt: new Date().toISOString(), hostFirstName: 'Dev', featuredPosition: null }]
      : [{ id: 'mock-published', title: 'Published sample event', type: 'community', status: 'published', startsAt: new Date().toISOString(), hostFirstName: 'Dev', featuredPosition: 1 }]
  },
  async approveEvent() {},
  async rejectEvent() {},
  async featureEvent() {},
  async unfeatureEvent() {},
  async listHubs() {
    return hubs
  },
  async saveHub(input) {
    return input.id ?? 'mock-hub'
  },
  async setHubEvents() {},
  async deleteHub(id) {
    hubs = hubs.filter((hub) => hub.id !== id)
  },
  async jobRuns() {
    return [{ job: 'flush-email', lastFinishedAt: new Date().toISOString(), lastStatus: 'ok', lastDetail: { sent: 0 }, lastError: null, runCount: 1, errorCount: 0 }]
  },
  async listReports(status) {
    return reports.filter((r) => (status === null ? true : status === 'pending' ? r.status === 'open' || r.status === 'reviewing' : r.status === status))
  },
  async getReport(id): Promise<ReportDetail> {
    const r = reports.find((x) => x.id === id) ?? reports[0]
    return {
      id: r.id, subjectType: r.subjectType, subjectLabel: null, reason: r.reason, details: 'They would not stop messaging me.', status: r.status, held: r.held, actionTaken: r.actionTaken,
      adminNote: null, userNote: null, createdAt: r.createdAt, reviewerFirstName: r.reviewerFirstName, reporter: { id: 'mock-user-3', firstName: r.reporterFirstName, isVerified: true },
      subject: { id: r.subjectUserId, firstName: r.subjectFirstName, status: r.subjectStatus, isVerified: true, createdAt: now(), roles: [], showsUpAttended: 3, showsUpTotal: 4 },
      otherReports: [], flags: [], privateFeedback: [{ issueCode: 'disrespectful', note: 'Talked over everyone.', month: '2026-11' }], moderation: [],
    }
  },
  async startReview(id) {
    reports = reports.map((r) => (r.id === id ? { ...r, status: 'reviewing', reviewerFirstName: 'Asha' } : r))
  },
  async resolveReport(id, outcome) {
    reports = reports.map((r) => (r.id === id ? { ...r, status: outcome === 'dismiss' ? 'dismissed' : 'resolved', actionTaken: outcome } : r))
  },
  async liftHold() {},
  async searchUsers(query) {
    const q = (query.q ?? '').toLowerCase()
    return users.filter((u) => (!q || `${u.firstName} ${u.email}`.toLowerCase().includes(q)) && (!query.status || u.status === query.status))
  },
  async userDetail(userId): Promise<UserDetail> {
    const u = users.find((x) => x.userId === userId) ?? users[0]
    return {
      id: u.userId, firstName: u.firstName, lastName: u.lastName, email: u.email, phoneHint: u.phoneHint, age: 29, status: u.status, isVerified: u.isVerified, createdAt: u.createdAt,
      onboarded: true, roles: [], verification: { result: 'approved', reviewedAt: now(), submittedAt: now() },
      reputation: { eventsAttended: 3, showsUpAttended: 3, showsUpTotal: 4, eventsHosted: 0, topTags: [{ slug: 'warm', label: 'Warm', count: 2 }] },
      flags: [], reportsAbout: [], moderation: [], tips: [],
    }
  },
  async setUserStatus() {},
  async listFlags(status) {
    return flags.filter((f) => status === null || f.status === status)
  },
  async resolveFlag(id, status, note) {
    flags = flags.map((f) => (f.id === id ? { ...f, status, resolutionNote: note ?? null, resolvedAt: now() } : f))
  },
  async listAppeals(status) {
    return appeals.filter((a) => status === null || a.status === status)
  },
  async resolveAppeal(id, decision, note) {
    appeals = appeals.map((a) => (a.id === id ? { ...a, status: decision, adminNote: note ?? null, resolvedAt: now() } : a))
  },
  async listPartnerEvents() {
    return [{ eventId: 'mock-partner', title: 'Concert night', status: 'published', startsAt: now(), hostFirstName: 'Dev', partnerUrl: 'https://tickets.example.com/a', referralCode: 'KOLLIDE', clicks7d: 4, clicks30d: 9, clicksTotal: 12 }]
  },
  async setPartnerLink() {},
  async auditLog() {
    return [{ id: 1, at: now(), actorId: 'mock-admin', actorFirstName: 'Asha', action: 'UPDATE', tableName: 'events', rowPk: 'mock-event', oldData: { status: 'pending_review' }, newData: { status: 'published' } }]
  },
  async auditTables() {
    return ['events', 'safety_reports', 'moderation_actions']
  },
  async jobHealth() {
    return [{ job: 'flush-email', lastFinishedAt: now(), lastStatus: 'ok', lastDetail: { sent_today: 12, daily_cap: 280 }, lastError: null, runCount: 40, errorCount: 0, everyMinutes: 1, late: false }]
  },
  async emailUsage() {
    return { sentToday: 12, dailyCap: 280, warnAt: 224, queued: 0, failed24h: 0 }
  },
}

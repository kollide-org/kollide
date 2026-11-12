import type { EventStatus, EventType } from './events'
import type { TagCount } from './feedback'
import type { UserStatus } from './profile'

export interface PendingVerification {
  id: string
  userId: string
  firstName: string | null
  createdAt: string
}

export interface HostApplication {
  id: string
  userId: string
  firstName: string | null
  message: string
  createdAt: string
}

export interface AdminEvent {
  id: string
  title: string
  type: EventType
  status: EventStatus
  startsAt: string
  hostFirstName: string | null
  featuredPosition: number | null
}

export interface AdminHub {
  id: string
  slug: string
  title: string
  subtitle: string | null
  artKey: string | null
  accentColor: string
  startsOn: string | null
  endsOn: string | null
  sortOrder: number
  published: boolean
  eventIds: string[]
}

export interface HubInput {
  id?: string
  slug: string
  title: string
  subtitle: string
  accentColor: string
  startsOn: string | null
  endsOn: string | null
  sortOrder: number
  published: boolean
  artKey?: string
}

export interface JobRun {
  job: string
  lastFinishedAt: string | null
  lastStatus: 'ok' | 'warning' | 'error' | 'skipped' | null
  lastDetail: Record<string, unknown> | null
  lastError: string | null
  runCount: number
  errorCount: number
}

// ---------------------------------------------------------------- moderation (B7)
export type ModerationAction = 'note' | 'warn' | 'hold' | 'suspend' | 'ban' | 'reactivate'
export type ReportOutcome = 'dismiss' | 'warn' | 'suspend' | 'ban'
export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed'

export interface ReportRow {
  id: string
  subjectType: 'user' | 'event' | 'squad'
  subjectId: string
  subjectUserId: string
  subjectFirstName: string | null
  subjectStatus: UserStatus
  reporterFirstName: string | null
  reason: string
  status: ReportStatus
  held: boolean
  actionTaken: string | null
  createdAt: string
  reviewerFirstName: string | null
}

export interface ReportDetail {
  id: string
  subjectType: 'user' | 'event' | 'squad'
  subjectLabel: string | null
  reason: string
  details: string | null
  status: ReportStatus
  held: boolean
  actionTaken: string | null
  adminNote: string | null
  userNote: string | null
  createdAt: string
  reviewerFirstName: string | null
  reporter: { id: string; firstName: string | null; isVerified: boolean } | null
  subject: { id: string; firstName: string | null; status: UserStatus; isVerified: boolean; createdAt: string; roles: string[]; showsUpAttended: number; showsUpTotal: number }
  otherReports: { id: string; reason: string; status: ReportStatus; held: boolean; createdAt: string }[]
  flags: { id: string; kind: string; status: string; createdAt: string }[]
  /** Never includes who wrote it, or which event. */
  privateFeedback: { issueCode: string; note: string | null; month: string }[]
  moderation: { action: ModerationAction; reason: string; createdAt: string }[]
}

export interface UserRow {
  userId: string
  firstName: string | null
  lastName: string | null
  email: string | null
  phoneHint: string | null
  status: UserStatus
  isVerified: boolean
  roles: string[]
  createdAt: string
  onboarded: boolean
  openReports: number
}

export interface UserDetail {
  id: string
  firstName: string | null
  lastName: string | null
  email: string | null
  phoneHint: string | null
  age: number | null
  status: UserStatus
  isVerified: boolean
  createdAt: string
  onboarded: boolean
  roles: string[]
  /** The result only. The selfie itself is deleted after review. */
  verification: { result: 'pending' | 'approved' | 'rejected'; reviewedAt: string | null; submittedAt: string } | null
  reputation: { eventsAttended: number; showsUpAttended: number; showsUpTotal: number; eventsHosted: number; topTags: TagCount[] } | null
  flags: { id: string; kind: string; status: string; details: Record<string, unknown>; createdAt: string }[]
  reportsAbout: { id: string; reason: string; status: ReportStatus; held: boolean; actionTaken: string | null; createdAt: string }[]
  moderation: { action: ModerationAction; reason: string; userNote: string | null; adminFirstName: string | null; createdAt: string }[]
  tips: { id: string; message: string; createdAt: string }[]
}

export interface FlagRow {
  id: string
  kind: 'no_checkins' | 'collusion' | 'retaliation' | 'low_host_score' | 'repeat_event_group'
  status: 'open' | 'reviewed' | 'dismissed'
  subjectUserId: string | null
  subjectFirstName: string | null
  eventId: string | null
  eventTitle: string | null
  details: Record<string, unknown>
  createdAt: string
  resolvedAt: string | null
  resolutionNote: string | null
}

export interface AppealRow {
  id: string
  userId: string
  firstName: string | null
  userStatus: UserStatus
  kind: 'tip' | 'account_status'
  tipMessage: string | null
  message: string
  status: 'open' | 'upheld' | 'overturned'
  dueAt: string
  overdue: boolean
  adminNote: string | null
  createdAt: string
  resolvedAt: string | null
}

export interface PartnerEvent {
  eventId: string
  title: string
  status: EventStatus
  startsAt: string
  hostFirstName: string | null
  partnerUrl: string | null
  referralCode: string | null
  clicks7d: number
  clicks30d: number
  clicksTotal: number
}

export interface AuditEntry {
  id: number
  at: string
  actorId: string | null
  actorFirstName: string | null
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  tableName: string
  rowPk: string | null
  oldData: Record<string, unknown> | null
  newData: Record<string, unknown> | null
}

export interface AuditFilters {
  actor?: string
  action?: 'INSERT' | 'UPDATE' | 'DELETE'
  table?: string
  from?: string
  to?: string
  /** The id of the last entry you already have (newest first). */
  before?: number
  limit?: number
}

export interface JobHealth {
  job: string
  lastFinishedAt: string | null
  lastStatus: 'ok' | 'warning' | 'error' | 'skipped' | null
  lastDetail: Record<string, unknown> | null
  lastError: string | null
  runCount: number
  errorCount: number
  everyMinutes: number
  late: boolean
}

export interface EmailUsage {
  sentToday: number
  dailyCap: number
  warnAt: number
  queued: number
  failed24h: number
}

export interface AdminService {
  listPendingVerifications(): Promise<PendingVerification[]>
  /** A link that works for 5 minutes. */
  getSelfieUrl(verificationId: string): Promise<string>
  /** Approving verifies the person. Either way the selfie is deleted. */
  reviewVerification(verificationId: string, approved: boolean): Promise<void>

  listHostApplications(): Promise<HostApplication[]>
  /** Approving adds the host role. */
  reviewHostApplication(id: string, approved: boolean, note?: string): Promise<void>

  /** Events waiting for review, published events (for featuring), and finished or cancelled ones for the record. */
  listEvents(status: 'pending_review' | 'published' | 'completed' | 'cancelled'): Promise<AdminEvent[]>
  approveEvent(id: string, note?: string): Promise<void>
  rejectEvent(id: string, note: string): Promise<void>
  featureEvent(id: string, position: number): Promise<void>
  unfeatureEvent(id: string): Promise<void>

  listHubs(): Promise<AdminHub[]>
  saveHub(input: HubInput): Promise<string>
  setHubEvents(hubId: string, eventIds: string[]): Promise<void>
  deleteHub(id: string): Promise<void>

  /** The last run of each scheduled job. */
  jobRuns(): Promise<JobRun[]>

  // ---- B7
  listReports(status: 'pending' | ReportStatus | null): Promise<ReportRow[]>
  getReport(id: string): Promise<ReportDetail>
  startReview(id: string): Promise<void>
  /** Suspend and ban need an internal note. The user note (max 300 characters) is shown to the person. */
  resolveReport(id: string, outcome: ReportOutcome, internalNote?: string, userNote?: string): Promise<void>
  liftHold(userId: string, note: string): Promise<void>

  searchUsers(query: { q?: string; status?: UserStatus; limit?: number; offset?: number }): Promise<UserRow[]>
  userDetail(userId: string): Promise<UserDetail>
  /** Hold, suspend, ban, reactivate, or just send a warning or note. A reason is required; the user note is what they are told. */
  setUserStatus(userId: string, action: ModerationAction, reason: string, userNote?: string): Promise<void>

  listFlags(status: 'open' | 'reviewed' | 'dismissed' | null): Promise<FlagRow[]>
  resolveFlag(id: string, status: 'reviewed' | 'dismissed', note?: string): Promise<void>
  listAppeals(status: 'open' | 'upheld' | 'overturned' | null): Promise<AppealRow[]>
  resolveAppeal(id: string, decision: 'upheld' | 'overturned', note?: string): Promise<void>

  listPartnerEvents(): Promise<PartnerEvent[]>
  setPartnerLink(eventId: string, url: string, referralCode?: string): Promise<void>

  auditLog(filters: AuditFilters): Promise<AuditEntry[]>
  auditTables(): Promise<string[]>

  jobHealth(): Promise<JobHealth[]>
  emailUsage(): Promise<EmailUsage>
}

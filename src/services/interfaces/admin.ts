import type {
  AccountStatus,
  AdminUserRow,
  Appeal,
  AppealQueueItem,
  CollusionFlag,
  Event,
  EventReviewItem,
  Host,
  HostApplication,
  Hub,
  HubInput,
  ID,
  PartnerLink,
  ReportQueueItem,
  SafetyReport,
  SafetyReportStatus,
  User,
} from '../types'

/** Every method rejects with `forbidden` for anyone who is not an admin. */
export interface AdminService {
  listHostApplications(): Promise<HostApplication[]>
  decideHostApplication(userId: ID, decision: 'approve' | 'decline'): Promise<Host>

  listEventsForReview(): Promise<EventReviewItem[]>
  decideEvent(eventId: ID, decision: 'approve' | 'decline'): Promise<Event>
  setEventFeatured(eventId: ID, featured: boolean): Promise<Event>

  createHub(input: HubInput): Promise<Hub>
  updateHub(hubId: ID, patch: Partial<HubInput>): Promise<Hub>
  /** Only one hub is active at a time. */
  setActiveHub(hubId: ID | null): Promise<Hub[]>

  listReports(): Promise<ReportQueueItem[]>
  updateReport(reportId: ID, change: { status: SafetyReportStatus; resolution?: string }): Promise<SafetyReport>

  listUsers(search?: string): Promise<AdminUserRow[]>
  /** Put on hold, suspend, ban, or restore to active. */
  setUserStatus(userId: ID, status: AccountStatus, reason: string): Promise<User>
  decideVerification(userId: ID, decision: 'verify' | 'reject'): Promise<void>

  listAppeals(): Promise<AppealQueueItem[]>
  decideAppeal(appealId: ID, decision: 'upheld' | 'overturned'): Promise<Appeal>

  listCollusionFlags(): Promise<CollusionFlag[]>

  listPartnerLinks(): Promise<PartnerLink[]>
  updatePartnerLink(eventId: ID, ticketUrl: string): Promise<PartnerLink>
}

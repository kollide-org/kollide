import type { EventStatus, EventType } from './events'

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

export interface AdminService {
  listPendingVerifications(): Promise<PendingVerification[]>
  /** A link that works for 5 minutes. */
  getSelfieUrl(verificationId: string): Promise<string>
  /** Approving verifies the person. Either way the selfie is deleted. */
  reviewVerification(verificationId: string, approved: boolean): Promise<void>

  listHostApplications(): Promise<HostApplication[]>
  /** Approving adds the host role. */
  reviewHostApplication(id: string, approved: boolean, note?: string): Promise<void>

  /** Events waiting for review, and published events (for featuring). */
  listEvents(status: 'pending_review' | 'published'): Promise<AdminEvent[]>
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
}

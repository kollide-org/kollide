import type { ID, ISODateTime } from './common'
import type { Event } from './event'
import type { Appeal, SafetyReport } from './review'
import type { AccountStatus, Host, PersonPreview, Reputation, User } from './user'

export interface HostApplication {
  host: Host
  applicant: PersonPreview
  reputation: Reputation
}

export interface EventReviewItem {
  event: Event
  host: PersonPreview | null
}

export interface ReportQueueItem {
  report: SafetyReport
  reporter: PersonPreview
  /** The reported person. `null` when the report is about an event. */
  subjectPerson: PersonPreview | null
  subjectEventTitle: string | null
  /** How many other reports name the same subject. */
  otherReportsAboutSubject: number
}

export interface AdminUserRow {
  user: Pick<User, 'id' | 'role' | 'status' | 'email' | 'createdAt'>
  person: PersonPreview
  reputation: Reputation
  openReports: number
}

export interface UserStatusChange {
  userId: ID
  status: AccountStatus
  reason: string
}

/** A small group whose members only ever review each other. For an admin to look at. */
export interface CollusionFlag {
  people: PersonPreview[]
  reviewsBetweenThem: number
  eventIds: ID[]
}

export interface PartnerLink {
  eventId: ID
  eventTitle: string
  partnerName: string
  ticketUrl: string
  startsAt: ISODateTime
}

export interface AppealQueueItem {
  appeal: Appeal
  person: PersonPreview
}

export interface HubInput {
  title: string
  subtitle: string
  description: string
  artworkUrl: string
  artworkAlt: string
  accentColor: string
  accentForeground: string
  startsAt: ISODateTime
  endsAt: ISODateTime
  eventIds: ID[]
}

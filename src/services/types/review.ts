import type { ID, ISODateTime } from './common'
import type { PersonPreview } from './user'

/** The fixed list of public, positive tags. There are no free-text reviews of people. */
export const POSITIVE_TAGS = [
  'Great conversation',
  'Punctual',
  'Welcoming',
  'Fun energy',
  'Respectful',
  'Good listener',
] as const
export type PositiveTag = (typeof POSITIVE_TAGS)[number]

export const MAX_TAGS_PER_REVIEW = 3

/**
 * One person's review of another, for one event.
 * It stays hidden until both people have submitted, or the window closes.
 */
export interface TagReview {
  id: ID
  eventId: ID
  reviewerId: ID
  subjectId: ID
  /** Up to three. */
  tags: PositiveTag[]
  /** "Want to meet again?" Two yeses make a connection. */
  wantsToMeetAgain: boolean
  submittedAt: ISODateTime
}

export const PRIVATE_FEEDBACK_CATEGORIES = ['ran_late', 'was_rude', 'talked_over_people', 'other'] as const
export type PrivateFeedbackCategory = (typeof PRIVATE_FEEDBACK_CATEGORIES)[number]

/** "Something felt off." Never shown publicly, and never shown with its author. */
export interface PrivateFeedback {
  id: ID
  eventId: ID
  reviewerId: ID
  subjectId: ID
  category: PrivateFeedbackCategory
  note: string | null
  submittedAt: ISODateTime
}

/**
 * A gentle, anonymous nudge on a person's own profile. It appears only once
 * enough different people, across enough events, have said the same thing.
 */
export interface GentleTip {
  category: PrivateFeedbackCategory
  message: string
  appeal: Appeal | null
}

export const SAFETY_REPORT_CATEGORIES = [
  'harassment',
  'inappropriate_behaviour',
  'felt_unsafe',
  'fake_profile',
  'other',
] as const
export type SafetyReportCategory = (typeof SAFETY_REPORT_CATEGORIES)[number]

export type SafetyReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed'

/** Goes straight to the admin queue. A report about a person puts them on hold. */
export interface SafetyReport {
  id: ID
  reporterId: ID
  subjectType: 'user' | 'event'
  subjectId: ID
  /** The event it happened at, when the report is about a person. */
  eventId: ID | null
  category: SafetyReportCategory
  details: string
  status: SafetyReportStatus
  resolution: string | null
  createdAt: ISODateTime
  resolvedAt: ISODateTime | null
}

/** Hosts are rated too. Each answer is a yes or a no. */
export interface HostRating {
  id: ID
  eventId: ID
  raterId: ID
  hostId: ID
  asDescribed: boolean
  feltSafe: boolean
  wellOrganised: boolean
  submittedAt: ISODateTime
}

/** Shown on the host card. Each value is the share of yeses, from 0 to 1. */
export interface HostRatingSummary {
  ratings: number
  asDescribed: number
  feltSafe: number
  wellOrganised: number
}

export type AppealStatus = 'under_review' | 'upheld' | 'overturned'

/** A user disputing a tip or a suspension. */
export interface Appeal {
  id: ID
  userId: ID
  about: 'tip' | 'suspension'
  /** The tip category, or the account status being disputed. */
  reference: string
  message: string
  status: AppealStatus
  createdAt: ISODateTime
  decidedAt: ISODateTime | null
}

/** Two people who both said yes to meeting again. */
export interface Connection {
  id: ID
  userIds: [ID, ID]
  eventId: ID
  createdAt: ISODateTime
}

export interface ConnectionWithPerson extends Connection {
  person: PersonPreview
  eventTitle: string
}

/** Three or more people who all said yes to each other. A nudge to plan a repeat. */
export interface RepeatSuggestion {
  eventId: ID
  eventTitle: string
  people: PersonPreview[]
}

export interface ReviewablePerson extends PersonPreview {
  /** True once the viewer has reviewed this person for this event. */
  reviewed: boolean
}

/** Everything the feedback screen needs for one event. */
export interface FeedbackForm {
  eventId: ID
  eventTitle: string
  eventCoverUrl: string
  opensAt: ISODateTime
  /** 72 hours after the event ends. */
  closesAt: ISODateTime
  /** Other people who checked in. Only they can be reviewed. */
  people: ReviewablePerson[]
  host: PersonPreview | null
  hostRated: boolean
}

export interface ReviewInput {
  eventId: ID
  subjectId: ID
  tags: PositiveTag[]
  wantsToMeetAgain: boolean
  privateFeedback?: { category: PrivateFeedbackCategory; note?: string }
}

export interface HostRatingInput {
  eventId: ID
  asDescribed: boolean
  feltSafe: boolean
  wellOrganised: boolean
}

export interface SafetyReportInput {
  subjectType: 'user' | 'event'
  subjectId: ID
  eventId?: ID
  category: SafetyReportCategory
  details: string
}

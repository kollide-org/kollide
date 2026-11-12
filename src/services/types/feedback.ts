export interface PositiveTag {
  id: number
  slug: string
  label: string
}

/** A tag with how many times it was given. Shown on profile cards. */
export interface TagCount {
  slug: string
  label: string
  count: number
}

export interface FeedbackPerson {
  userId: string
  firstName: string | null
  photoKey: string | null
  isHost: boolean
  /** I already sent tags to this person for this event. */
  tagged: boolean
  /** I already sent a private note about this person for this event. */
  flagged: boolean
}

/** An event whose 72-hour feedback window is open for me. */
export interface FeedbackTask {
  eventId: string
  eventTitle: string
  closesAt: string
  hostId: string
  canRateHost: boolean
  hostRated: boolean
  people: FeedbackPerson[]
}

export type IssueCode = 'made_uncomfortable' | 'disrespectful' | 'unsafe' | 'not_as_described' | 'harassment' | 'other'

export const ISSUE_OPTIONS: { value: IssueCode; label: string }[] = [
  { value: 'made_uncomfortable', label: 'They made me uncomfortable' },
  { value: 'disrespectful', label: 'They were disrespectful' },
  { value: 'unsafe', label: 'I did not feel safe' },
  { value: 'not_as_described', label: 'Not as described' },
  { value: 'harassment', label: 'Unwelcome attention' },
  { value: 'other', label: 'Something else' },
]

export interface FeedbackService {
  tags(): Promise<PositiveTag[]>
  tasks(): Promise<FeedbackTask[]>
  /** Up to 3 tags. Hidden until the other person has answered or the window closes. The answer never says which. */
  giveTags(eventId: string, toUser: string, tagIds: number[]): Promise<void>
  /** Never visible to the person it is about. */
  submitPrivate(eventId: string, aboutUser: string, issue: IssueCode, note?: string): Promise<void>
  rateHost(eventId: string, ratings: { asDescribed: number; feltSafe: number; wellOrganised: number }): Promise<void>
}

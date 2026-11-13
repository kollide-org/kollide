import type { ID, ISODateTime } from './common'
import type { PersonPreview } from './user'

export const SQUAD_MIN_SIZE = 4
export const SQUAD_MAX_SIZE = 6

export interface MeetingPoint {
  /** A public place, such as a café near the venue. */
  place: string
  minutesBefore: number
}

/** A small group going to the same event together. */
export interface Squad {
  id: ID
  eventId: ID
  creatorId: ID
  name: string
  meetingPoint: MeetingPoint
  /** Between 4 and 6, including the creator. */
  size: number
  womenOnly: boolean
  createdAt: ISODateTime
}

export type SquadMemberStatus = 'requested' | 'approved' | 'declined' | 'left'

export interface SquadMember {
  squadId: ID
  userId: ID
  role: 'creator' | 'member'
  status: SquadMemberStatus
  requestedAt: ISODateTime
  decidedAt: ISODateTime | null
}

export interface SquadEventRef {
  id: ID
  slug: string
  title: string
  startsAt: ISODateTime
  area: string
  coverUrl: string
}

export interface SquadWithMembers extends Squad {
  event: SquadEventRef
  /** Approved members, creator first. */
  members: PersonPreview[]
  /** People waiting for the creator's answer. Only the creator receives these. */
  pendingRequests: PersonPreview[]
  spotsLeft: number
  /** The viewer's own place in this squad, if any. */
  viewerStatus: SquadMemberStatus | null
  viewerIsCreator: boolean
}

export interface SquadDraft {
  eventId: ID
  name: string
  meetingPoint: MeetingPoint
  size: number
  womenOnly: boolean
}

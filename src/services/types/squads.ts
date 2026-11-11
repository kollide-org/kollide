export interface SquadCard {
  id: string
  name: string | null
  creatorId: string
  creatorFirstName: string | null
  memberCount: number
  spotsLeft: number
  /** A squad is complete once it has 4 members. The most it can have is 6. */
  complete: boolean
  myStatus: 'requested' | 'approved' | 'declined' | 'left' | null
}

export interface SquadMember {
  userId: string
  firstName: string | null
  status: 'requested' | 'approved'
}

export interface SquadDetail {
  id: string
  eventId: string
  name: string | null
  meetingPoint: string
  isCreator: boolean
  members: SquadMember[]
}

export interface MySquad {
  id: string
  eventId: string
  eventTitle: string
  name: string | null
  myStatus: 'requested' | 'approved'
  isCreator: boolean
  memberCount: number
  requestCount: number
}

export interface SquadsService {
  eventSquads(eventId: string): Promise<SquadCard[]>
  create(eventId: string, meetingPoint: string, name?: string): Promise<string>
  requestToJoin(squadId: string): Promise<void>
  decide(squadId: string, userId: string, approve: boolean): Promise<void>
  leave(squadId: string): Promise<void>
  disband(squadId: string): Promise<void>
  getSquad(squadId: string): Promise<SquadDetail>
  mySquads(): Promise<MySquad[]>
}

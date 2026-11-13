import type { ID, SquadDraft, SquadMember, SquadWithMembers } from '../types'

export interface SquadService {
  /** Squads with room left, for the "Squads forming" row. */
  listSquadsForming(): Promise<SquadWithMembers[]>
  listSquadsForEvent(eventId: ID): Promise<SquadWithMembers[]>
  listMySquads(): Promise<SquadWithMembers[]>
  getSquad(squadId: ID): Promise<SquadWithMembers>
  createSquad(draft: SquadDraft): Promise<SquadWithMembers>
  /** Works like event requests: the creator approves each person. */
  requestToJoin(squadId: ID): Promise<SquadMember>
  decideRequest(squadId: ID, userId: ID, decision: 'approve' | 'decline'): Promise<SquadMember>
  leaveSquad(squadId: ID): Promise<void>
}

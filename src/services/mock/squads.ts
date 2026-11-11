import type { SquadsService } from '../types/squads'

export const mockSquads: SquadsService = {
  async eventSquads() {
    return [{ id: 'mock-squad', name: 'Board gamers', creatorId: 'mock-user-8', creatorFirstName: 'Asha', memberCount: 3, spotsLeft: 3, complete: false, myStatus: null }]
  },
  async create() {
    return 'mock-squad'
  },
  async requestToJoin() {},
  async decide() {},
  async leave() {},
  async disband() {},
  async getSquad() {
    return { id: 'mock-squad', eventId: 'mock', name: 'Board gamers', meetingPoint: 'Cafe near Gate 2', isCreator: false, members: [] }
  },
  async mySquads() {
    return []
  },
}

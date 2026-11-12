import type { Connection, ConnectionsService } from '../types/connections'

const taps = new Set<string>()

export const mockConnections: ConnectionsService = {
  async tap(_eventId, userId) {
    taps.add(userId)
    return { mutual: false }
  },
  async myTaps() {
    return [...taps]
  },
  async list(): Promise<Connection[]> {
    return [{ userId: 'mock-u2', firstName: 'Kabir', photoKey: null, eventId: 'mock-event', eventTitle: 'Sunday board games', connectedAt: new Date().toISOString() }]
  },
}

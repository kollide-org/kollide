/** Two people who both said "meet again" after the same event. */
export interface Connection {
  userId: string
  firstName: string | null
  photoKey: string | null
  eventId: string
  eventTitle: string
  connectedAt: string
}

export interface ConnectionsService {
  /** A one-way tap. Nobody can see who tapped them: only a mutual tap shows up. */
  tap(eventId: string, userId: string): Promise<{ mutual: boolean }>
  /** The people I have tapped for this event. */
  myTaps(eventId: string): Promise<string[]>
  list(): Promise<Connection[]>
}

import type { Event, EventAddress, EventDetail, EventDraft, EventFilters, EventListItem, Hub, HubWithEvents, ID } from '../types'

export interface EventService {
  /** Published, upcoming events, soonest first. */
  listEvents(filters?: EventFilters): Promise<EventListItem[]>
  getEvent(idOrSlug: string): Promise<EventDetail>
  /** Rejects with `forbidden` unless the viewer is approved, paid, the host or an admin. */
  getEventAddress(eventId: ID): Promise<EventAddress>
  /** Suggestions for a gentle decline or a full event. */
  listSimilarEvents(eventId: ID): Promise<EventListItem[]>
  listHubs(): Promise<Hub[]>
  getActiveHub(): Promise<HubWithEvents | null>
  /** Events the signed-in host created, in every status. */
  listHostedEvents(): Promise<EventListItem[]>
  /** Hosts only. The new event waits for admin approval. */
  createEvent(draft: EventDraft): Promise<Event>
  updateEvent(eventId: ID, patch: Partial<EventDraft>): Promise<Event>
  cancelEvent(eventId: ID): Promise<Event>
}

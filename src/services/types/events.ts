export type EventType = 'partner' | 'community' | 'kollide'
/** `paid` exists for P1 and is never offered while payments are off. */
export type PricingMode = 'free' | 'pay_at_venue' | 'cost_split' | 'paid'
export type EventStatus = 'draft' | 'pending_review' | 'published' | 'completed' | 'cancelled'

/** What a listing shows. Never includes the exact address, notes or the partner's raw link. */
export interface EventCard {
  id: string
  type: EventType
  title: string
  description: string
  houseRules: string | null
  categoryId: number | null
  categoryName: string | null
  areaId: number
  areaName: string
  startsAt: string
  endsAt: string
  capacity: number | null
  overbookPct: number
  approvalMode: 'instant' | 'host_approval'
  womenOnly: boolean
  minAge: number
  maxAge: number | null
  pricingMode: PricingMode
  priceLabel: string | null
  houseParty: boolean
  coverKey: string | null
  hostId: string
  hostFirstName: string | null
  hostIsVerified: boolean
  hasPartnerLink: boolean
  /** Null for partner events. */
  spotsLeft: number | null
  attendeeAvatars: string[]
}

export interface EventFilters {
  from?: string
  to?: string
  areaIds?: number[]
  categoryIds?: number[]
  pricing?: PricingMode[]
  womenOnly?: boolean
  /** At least this many spots left. */
  groupSize?: number
  types?: EventType[]
}

export interface HubCard {
  id: string
  slug: string
  title: string
  subtitle: string | null
  artKey: string | null
  accentColor: string
  startsOn: string | null
  endsOn: string | null
  eventCount: number
}

export interface EventInput {
  type?: EventType
  title: string
  description: string
  categoryId: number | null
  areaId: number | null
  startsAt: string
  endsAt: string
  capacity: number | null
  womenOnly: boolean
  minAge: number
  maxAge: number | null
  houseRules: string
  pricingMode: PricingMode
  priceLabel: string
  houseParty: boolean
  address: string
  directionsNote: string
  hostNotes: string
  partnerUrl?: string
  referralCode?: string
}

export interface EventForEdit extends EventInput {
  id: string
  status: EventStatus
  coverKey: string | null
  reviewNote: string | null
  overbookPct: number
}

export interface MyEvent {
  id: string
  title: string
  type: EventType
  status: EventStatus
  startsAt: string
  coverKey: string | null
  reviewNote: string | null
}

export interface EventAddress {
  address: string | null
  directionsNote: string | null
}

export interface EventsService {
  search(filters: EventFilters, page?: { limit: number; offset: number }): Promise<EventCard[]>
  featured(): Promise<EventCard[]>
  hubs(): Promise<HubCard[]>
  getHub(slug: string): Promise<{ hub: HubCard; events: EventCard[] } | null>
  getEvent(id: string): Promise<EventCard | null>
  /** The exact address, or null when this person is not allowed to see it. */
  getAddress(id: string): Promise<EventAddress | null>
  myEvents(): Promise<MyEvent[]>
  getForEdit(id: string): Promise<EventForEdit>
  create(input: EventInput): Promise<string>
  update(id: string, input: Partial<EventInput>): Promise<void>
  submit(id: string): Promise<void>
  cancel(id: string, reason?: string): Promise<void>
  setCover(eventId: string, key: string): Promise<void>
}

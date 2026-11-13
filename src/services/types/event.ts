import type { Booking } from './booking'
import type { Area, ID, ISODateTime } from './common'
import type { HostSummary, PersonPreview } from './user'

/**
 * - `partner`: run by a venue. Tickets are bought on the partner's site.
 * - `community`: hosted by a member. People request to join and the host approves.
 * - `kollide`: run by Kollide and paid for in the app.
 */
export type EventType = 'partner' | 'community' | 'kollide'

/**
 * - `free`, `pay_at_venue`, `cost_split`: labels for community events.
 * - `paid`: Kollide's own events, paid in the app.
 * - `partner_ticket`: bought through the partner's outbound link.
 */
export type PricingMode = 'free' | 'pay_at_venue' | 'cost_split' | 'paid' | 'partner_ticket'

export interface Pricing {
  mode: PricingMode
  /** In rupees. `null` when there is nothing to quote. */
  amountInr: number | null
  /** Extra context, such as "Split the groceries on the night". */
  note: string | null
}

export const EVENT_CATEGORIES = [
  'house_party',
  'games',
  'food_drink',
  'music',
  'outdoors',
  'arts',
  'wellness',
  'nightlife',
] as const
export type EventCategory = (typeof EVENT_CATEGORIES)[number]

/** `host_approval` is always used for community events. */
export type ApprovalMode = 'host_approval' | 'instant'

export type EventStatus = 'draft' | 'pending_review' | 'published' | 'declined' | 'cancelled' | 'completed'

export interface AgeRange {
  min: number
  max: number | null
}

export interface PartnerInfo {
  name: string
  /** The outbound link where tickets are bought. */
  ticketUrl: string
}

/**
 * An event as anyone may see it. The exact address is deliberately not part of
 * this type. It is fetched separately, and only once a booking is approved or paid.
 */
export interface Event {
  id: ID
  slug: string
  type: EventType
  status: EventStatus
  title: string
  summary: string
  description: string
  category: EventCategory
  coverUrl: string
  coverAlt: string
  /** The member hosting it. `null` for partner events. */
  hostId: ID | null
  partner: PartnerInfo | null
  hubId: ID | null
  startsAt: ISODateTime
  endsAt: ISODateTime
  area: Area
  /** A public venue name, such as a café. `null` for homes. */
  venueName: string | null
  pricing: Pricing
  capacity: number
  approvalMode: ApprovalMode
  womenOnly: boolean
  ageRange: AgeRange
  houseRules: string[]
  featured: boolean
  createdAt: ISODateTime
}

/** Private. Returned only to the host, admins, and guests who are approved or paid. */
export interface EventAddress {
  eventId: ID
  exactAddress: string
  directions: string | null
}

/** An event with the calculated values a card needs. */
export interface EventListItem extends Event {
  spotsLeft: number
  goingCount: number
  host: HostSummary | null
  /** Verified people attending, for the avatar stack. */
  attendeePreview: PersonPreview[]
  /** Squads for this event that still have room. */
  squadsForming: number
}

export interface EventViewerState {
  booking: Booking | null
  canSeeAddress: boolean
  isHost: boolean
  /** The viewer's squad for this event, if any. */
  squadId: ID | null
}

export interface EventDetail extends EventListItem {
  viewer: EventViewerState
}

export type DateFilter = 'today' | 'this_week' | 'this_weekend' | 'this_month'
export type PriceFilter = 'free' | 'paid'
/** Small is up to 10 people, medium up to 25, large is more. */
export type GroupSizeFilter = 'small' | 'medium' | 'large'

export interface EventFilters {
  date?: DateFilter
  areas?: Area[]
  categories?: EventCategory[]
  price?: PriceFilter
  womenOnly?: boolean
  groupSize?: GroupSizeFilter
  hubId?: ID
  type?: EventType
}

/** A seasonal collection, such as "New Year's Eve in Bengaluru". Any theme works. */
export interface Hub {
  id: ID
  slug: string
  title: string
  subtitle: string
  description: string
  artworkUrl: string
  artworkAlt: string
  /** Any CSS colour. The hub section uses it in place of the default accent. */
  accentColor: string
  /** A text colour that is readable on `accentColor`. */
  accentForeground: string
  active: boolean
  startsAt: ISODateTime
  endsAt: ISODateTime
}

export interface HubWithEvents extends Hub {
  events: EventListItem[]
}

/** What the create-event form submits. */
export interface EventDraft {
  title: string
  summary: string
  description: string
  category: EventCategory
  coverUrl: string
  coverAlt: string
  startsAt: ISODateTime
  endsAt: ISODateTime
  area: Area
  venueName: string | null
  exactAddress: string
  directions: string | null
  pricing: Pricing
  capacity: number
  womenOnly: boolean
  ageRange: AgeRange
  houseRules: string[]
}

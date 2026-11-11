import type { EventCard, EventFilters, EventForEdit, EventInput, EventsService, HubCard, MyEvent } from '../types/events'

const day = (offset: number, hour: number) => {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  date.setHours(hour, 0, 0, 0)
  return date.toISOString()
}

const card = (id: string, patch: Partial<EventCard>): EventCard => ({
  id, type: 'community', title: 'Sample event', description: 'A sample event for the mock services.', houseRules: null,
  categoryId: 4, categoryName: 'Games', areaId: 1, areaName: 'Indiranagar', startsAt: day(3, 17), endsAt: day(3, 20),
  capacity: 12, overbookPct: 30, approvalMode: 'instant', womenOnly: false, minAge: 18, maxAge: null, pricingMode: 'free',
  priceLabel: null, houseParty: false, coverKey: null, hostId: 'mock-host', hostFirstName: 'Dev', hostIsVerified: true,
  hasPartnerLink: false, spotsLeft: 12, attendeeAvatars: [], ...patch,
})

const events: EventCard[] = [
  card('00000000-0000-4000-8000-0000000000a1', { title: 'Sunday board games at a cafe' }),
  card('00000000-0000-4000-8000-0000000000a2', { title: 'Women’s 5k easy run', womenOnly: true, areaId: 2, areaName: 'Koramangala', categoryId: 7, categoryName: 'Sports', startsAt: day(5, 6) }),
  card('00000000-0000-4000-8000-0000000000a3', { title: 'Street food crawl', type: 'kollide', pricingMode: 'cost_split', priceLabel: 'About ₹500 each, split on the night', capacity: 8, spotsLeft: 8, areaId: 2, areaName: 'Koramangala', categoryId: 1, categoryName: 'Food and drink', startsAt: day(8, 18) }),
  card('00000000-0000-4000-8000-0000000000a4', { title: 'Indie acoustic evening', type: 'partner', pricingMode: 'pay_at_venue', priceLabel: 'Tickets from ₹350 on the partner site', hasPartnerLink: true, capacity: null, spotsLeft: null, categoryId: 3, categoryName: 'Music', startsAt: day(6, 19) }),
]

const hubs: HubCard[] = [
  { id: 'mock-hub-1', slug: 'new-years-eve-in-bengaluru', title: 'New Year’s Eve in Bengaluru', subtitle: 'Ring it in with people you can trust', artKey: null, accentColor: '#F2A93B', startsOn: null, endsOn: null, eventCount: 2 },
]

const matches = (event: EventCard, filters: EventFilters) =>
  (!filters.from || event.startsAt >= filters.from) &&
  (!filters.to || event.startsAt < filters.to) &&
  (!filters.areaIds?.length || filters.areaIds.includes(event.areaId)) &&
  (!filters.categoryIds?.length || (event.categoryId !== null && filters.categoryIds.includes(event.categoryId))) &&
  (!filters.pricing?.length || filters.pricing.includes(event.pricingMode)) &&
  (!filters.types?.length || filters.types.includes(event.type)) &&
  (!filters.womenOnly || event.womenOnly) &&
  (!filters.groupSize || event.spotsLeft === null || event.spotsLeft >= filters.groupSize)

const draft = (id: string): EventForEdit => ({
  id, type: 'community', title: 'My draft event', description: '', categoryId: null, areaId: 1, startsAt: day(10, 17), endsAt: day(10, 20),
  capacity: 10, womenOnly: false, minAge: 18, maxAge: null, houseRules: '', pricingMode: 'free', priceLabel: '', houseParty: false,
  address: '', directionsNote: '', hostNotes: '', status: 'draft', coverKey: null, reviewNote: null, overbookPct: 30,
})

export const mockEvents: EventsService = {
  async search(filters, page = { limit: 20, offset: 0 }) {
    return events.filter((event) => matches(event, filters)).slice(page.offset, page.offset + page.limit)
  },
  async featured() {
    return events.slice(0, 2)
  },
  async hubs() {
    return hubs
  },
  async getHub(slug) {
    const hub = hubs.find((item) => item.slug === slug)
    return hub ? { hub, events: events.slice(0, 2) } : null
  },
  async getEvent(id) {
    return events.find((event) => event.id === id) ?? null
  },
  async getAddress() {
    return null
  },
  async myEvents(): Promise<MyEvent[]> {
    return [{ id: 'mock-draft', title: 'My draft event', type: 'community', status: 'draft', startsAt: day(10, 17), coverKey: null, reviewNote: null }]
  },
  async getForEdit(id) {
    return draft(id)
  },
  async create(_input: EventInput) {
    return 'mock-draft'
  },
  async update() {},
  async submit() {},
  async cancel() {},
  async setCover() {},
}

import type { Area, EventCategory, EventStatus, EventType, Hub, Pricing } from '../../types'
import type { EventRecord } from '../db'

import { coverUrl, hubArtworkUrl } from './assets'

const HOUR = 3_600_000

/** A day relative to today, at a set local time. */
function dayAt(now: Date, days: number, hour: number, minute = 0): Date {
  const date = new Date(now)
  date.setDate(date.getDate() + days)
  date.setHours(hour, minute, 0, 0)
  return date
}

/** A moment a number of hours from now, rounded to the half hour. */
function inHours(now: Date, hours: number): Date {
  const date = new Date(now.getTime() + hours * HOUR)
  date.setMinutes(date.getMinutes() < 30 ? 0 : 30, 0, 0)
  return date
}

/** The next New Year's Eve that is still at least two days away. */
function nextNewYearsEve(now: Date, hour: number, minute = 0): Date {
  const eve = new Date(now.getFullYear(), 11, 31, hour, minute, 0, 0)
  if (eve.getTime() - now.getTime() < 48 * HOUR) eve.setFullYear(eve.getFullYear() + 1)
  return eve
}

interface EventSpec {
  id: string
  slug: string
  type: EventType
  status?: EventStatus
  title: string
  summary: string
  description: string
  category: EventCategory
  coverAlt: string
  hostId?: string
  partner?: { name: string; ticketUrl: string }
  hubId?: string
  start: Date
  hours: number
  area: Area
  venueName?: string
  exactAddress: string
  directions?: string
  pricing: Pricing
  capacity: number
  womenOnly?: boolean
  ageRange?: { min: number; max: number | null }
  houseRules: string[]
  featured?: boolean
  createdDaysAgo?: number
}

const free = (note: string | null = null): Pricing => ({ mode: 'free', amountInr: null, note })
const payAtVenue = (note: string): Pricing => ({ mode: 'pay_at_venue', amountInr: null, note })
const costSplit = (amountInr: number, note: string): Pricing => ({ mode: 'cost_split', amountInr, note })
const paid = (amountInr: number): Pricing => ({ mode: 'paid', amountInr, note: null })
const partnerTicket = (amountInr: number): Pricing => ({ mode: 'partner_ticket', amountInr, note: 'Tickets are sold by the venue.' })

const BASE_RULES = ['Be kind to everyone at the table.', 'Kollide is not a dating app. Come to make friends.']

export const HUB_NYE = 'hub-nye'
export const HUB_LONG_WEEKEND = 'hub-long-weekend'

export function buildHubs(now: Date): Hub[] {
  const eve = nextNewYearsEve(now, 18)
  return [
    {
      id: HUB_NYE,
      slug: 'new-years-eve',
      title: 'New Year’s Eve in Bengaluru',
      subtitle: 'Walk into midnight with people you’ll want to see again.',
      description:
        'Rooftops, long tables and small house parties. Pick a plan, join a squad, and count down with a group instead of a crowd.',
      artworkUrl: hubArtworkUrl('new-years-eve'),
      artworkAlt: 'Abstract overlapping circles in champagne gold and deep wine.',
      accentColor: '#d9b26a',
      accentForeground: '#2a2224',
      active: true,
      startsAt: new Date(eve.getTime() - 60 * 24 * HOUR).toISOString(),
      endsAt: new Date(eve.getTime() + 12 * HOUR).toISOString(),
    },
    {
      id: HUB_LONG_WEEKEND,
      slug: 'long-weekend-outdoors',
      title: 'The long weekend, outdoors',
      subtitle: 'Sunrise treks, lake walks and slow breakfasts.',
      description: 'Three days off and nowhere to be. Small groups heading out of the city, and back in time for dinner.',
      artworkUrl: hubArtworkUrl('long-weekend-outdoors'),
      artworkAlt: 'Abstract overlapping circles in sage green and warm sand.',
      accentColor: '#7f9a7a',
      accentForeground: '#1f1719',
      active: false,
      startsAt: new Date(now.getTime() + 60 * 24 * HOUR).toISOString(),
      endsAt: new Date(now.getTime() + 75 * 24 * HOUR).toISOString(),
    },
  ]
}

/** The fifteen events on show: four partner, seven community and four of Kollide's own. */
function primarySpecs(now: Date): EventSpec[] {
  return [
    // Partner events. Tickets are bought through the venue's own link.
    {
      id: 'ev-vinyl-night',
      slug: 'vinyl-and-indie-night',
      type: 'partner',
      title: 'Vinyl and indie night',
      summary: 'Two local bands and a DJ playing records between sets.',
      description:
        'A small room, a good sound system and two Bengaluru bands worth knowing. Doors open at 7:30. Join a squad and you will have people to stand with from the first song.',
      category: 'music',
      coverAlt: 'A warm, dimly lit room with a small stage and a record player.',
      partner: { name: 'The Lantern Room', ticketUrl: 'https://example.com/lantern-room/vinyl-night' },
      start: dayAt(now, 3, 19, 30),
      hours: 3.5,
      area: 'Indiranagar',
      venueName: 'The Lantern Room',
      exactAddress: 'The Lantern Room, 2nd floor, 12th Main Road, Indiranagar, Bengaluru 560038',
      pricing: partnerTicket(799),
      capacity: 120,
      ageRange: { min: 21, max: null },
      houseRules: ['Carry a photo ID. The venue checks at the door.', ...BASE_RULES],
    },
    {
      id: 'ev-nye-rooftop',
      slug: 'nye-rooftop-countdown',
      type: 'partner',
      title: 'Rooftop countdown',
      summary: 'City lights, a live band until midnight, and fireworks on the skyline.',
      description:
        'A rooftop above Church Street with a live band and an open view of the fireworks. It gets busy, which is why most people here come as a squad.',
      category: 'nightlife',
      coverAlt: 'A rooftop terrace at night with string lights and the city skyline.',
      partner: { name: 'Skyline Terrace', ticketUrl: 'https://example.com/skyline-terrace/nye' },
      hubId: HUB_NYE,
      start: nextNewYearsEve(now, 20),
      hours: 5,
      area: 'Church Street',
      venueName: 'Skyline Terrace',
      exactAddress: 'Skyline Terrace, 9th floor, Church Street, Bengaluru 560001',
      pricing: partnerTicket(2499),
      capacity: 200,
      ageRange: { min: 21, max: null },
      houseRules: ['Carry a photo ID.', 'Arrange your ride home before you arrive.', ...BASE_RULES],
      featured: true,
    },
    {
      id: 'ev-open-mic',
      slug: 'stand-up-open-mic',
      type: 'partner',
      title: 'Stand-up open mic',
      summary: 'Twelve comics, five minutes each, one very honest audience.',
      description:
        'New material, first-timers and a few familiar names trying things out. Sit near the back if you would rather not be part of the act.',
      category: 'arts',
      coverAlt: 'A single microphone on a small stage under a warm spotlight.',
      partner: { name: 'Backroom Comedy', ticketUrl: 'https://example.com/backroom-comedy/open-mic' },
      start: dayAt(now, 6, 20),
      hours: 2,
      area: 'Koramangala',
      venueName: 'Backroom Comedy',
      exactAddress: 'Backroom Comedy, 80 Feet Road, 4th Block, Koramangala, Bengaluru 560034',
      pricing: partnerTicket(399),
      capacity: 60,
      houseRules: ['Phones on silent during sets.', ...BASE_RULES],
    },
    {
      id: 'ev-nye-jazz-supper',
      slug: 'nye-jazz-supper',
      type: 'partner',
      title: 'New Year’s Eve jazz supper',
      summary: 'A four-course dinner with a quartet, finished well before the traffic.',
      description:
        'A seated dinner with a jazz quartet, for people who would like to welcome the year at a table rather than on a dance floor.',
      category: 'food_drink',
      coverAlt: 'A candlelit dinner table with a double bass in the background.',
      partner: { name: 'Marigold House', ticketUrl: 'https://example.com/marigold-house/nye-supper' },
      hubId: HUB_NYE,
      start: nextNewYearsEve(now, 19, 30),
      hours: 4,
      area: 'MG Road',
      venueName: 'Marigold House',
      exactAddress: 'Marigold House, Lavelle Road, off MG Road, Bengaluru 560001',
      pricing: partnerTicket(3200),
      capacity: 48,
      houseRules: ['Smart casual.', ...BASE_RULES],
    },

    // Community events. Members request to join and the host approves.
    {
      id: 'ev-board-games',
      slug: 'board-games-and-filter-coffee',
      type: 'community',
      title: 'Board games and filter coffee',
      summary: 'A small, friendly table for people who are new to the city.',
      description:
        'I bring the games, the café brings the coffee. We start with something easy so nobody has to read a rulebook, then split into two tables. Come alone. Most people do.',
      category: 'games',
      coverAlt: 'A wooden café table with a board game, steel tumblers of coffee and warm light.',
      hostId: 'u03',
      start: inHours(now, 20),
      hours: 3,
      area: 'Indiranagar',
      venueName: 'Third Wave Courtyard',
      exactAddress: 'Third Wave Courtyard, 1st floor, 100 Feet Road, Indiranagar, Bengaluru 560038',
      directions: 'We are at the long table by the window. Ask for Arjun.',
      pricing: payAtVenue('Pay for what you order.'),
      capacity: 10,
      houseRules: ['Arrive within fifteen minutes of the start, so games can begin.', ...BASE_RULES],
    },
    {
      id: 'ev-terrace-party',
      slug: 'terrace-party-90s-bollywood',
      type: 'community',
      title: 'Terrace party: 90s Bollywood',
      summary: 'A playlist you know every word to, on a terrace with fairy lights.',
      description:
        'Twenty people, one terrace and three hours of songs from the films we grew up on. Food is ordered in and split evenly. The address is shared once you are approved.',
      category: 'house_party',
      coverAlt: 'A terrace at dusk with fairy lights, floor cushions and a speaker.',
      hostId: 'u04',
      start: dayAt(now, 4, 19),
      hours: 4,
      area: 'HSR Layout',
      exactAddress: 'Flat 402, Sai Residency, 17th Cross, Sector 3, HSR Layout, Bengaluru 560102',
      directions: 'Take the lift to the fourth floor, then the stairs up to the terrace.',
      pricing: costSplit(400, 'Food and soft drinks, split evenly on the night.'),
      capacity: 20,
      ageRange: { min: 21, max: 40 },
      houseRules: [
        'Music goes down at 10:30 pm for the neighbours.',
        'No smoking indoors.',
        'Nobody is pressured to drink.',
        ...BASE_RULES,
      ],
    },
    {
      id: 'ev-cubbon-walk',
      slug: 'cubbon-park-walk-and-breakfast',
      type: 'community',
      title: 'Cubbon Park walk and breakfast',
      summary: 'An easy 4 km loop, then dosa and coffee nearby.',
      description:
        'We meet at the bandstand, walk the outer loop at a pace where everyone can talk, and finish with breakfast. A gentle way to meet twelve new people before 10 am.',
      category: 'outdoors',
      coverAlt: 'A tree-lined path in Cubbon Park in soft morning light.',
      hostId: 'u05',
      start: dayAt(now, 3, 7),
      hours: 2.5,
      area: 'Cubbon Park',
      venueName: 'Cubbon Park bandstand',
      exactAddress: 'The bandstand, Cubbon Park, Kasturba Road entrance, Bengaluru 560001',
      directions: 'Enter from Kasturba Road. The bandstand is a two-minute walk straight ahead.',
      pricing: free('Breakfast afterwards is pay for what you order.'),
      capacity: 12,
      houseRules: ['We leave the bandstand at 7:10 sharp.', ...BASE_RULES],
    },
    {
      id: 'ev-womens-brunch',
      slug: 'womens-brunch-and-book-swap',
      type: 'community',
      title: 'Women’s brunch and book swap',
      summary: 'Bring a book you loved, leave with one you have not read.',
      description:
        'Eight women, a long brunch and a pile of books in the middle of the table. Bring one you would press into a friend’s hands.',
      category: 'food_drink',
      coverAlt: 'A brunch table with books, flowers and plates in soft daylight.',
      hostId: 'u06',
      start: dayAt(now, 6, 11),
      hours: 2.5,
      area: 'Jayanagar',
      venueName: 'The Reading Room Café',
      exactAddress: 'The Reading Room Café, 11th Main Road, 4th Block, Jayanagar, Bengaluru 560011',
      pricing: payAtVenue('Pay for what you order.'),
      capacity: 8,
      womenOnly: true,
      houseRules: ['Bring one book to swap.', ...BASE_RULES],
    },
    {
      id: 'ev-potluck-games',
      slug: 'potluck-game-night',
      type: 'community',
      title: 'Potluck game night',
      summary: 'Everyone brings a dish. The games are already here.',
      description:
        'A living room, a dining table full of home food and a cupboard of games. Tell me what you are bringing when you request, so we do not end up with twelve desserts.',
      category: 'house_party',
      coverAlt: 'A living room with a low table, shared dishes and a card game in progress.',
      hostId: 'u07',
      start: dayAt(now, 8, 18, 30),
      hours: 4,
      area: 'Koramangala',
      exactAddress: 'No. 28, 5th Cross, 6th Block, Koramangala, Bengaluru 560095',
      directions: 'The blue gate. Ring the bell for the first floor.',
      pricing: free('Bring one dish to share.'),
      capacity: 12,
      houseRules: ['Shoes off at the door.', 'Label anything with nuts.', ...BASE_RULES],
    },
    {
      id: 'ev-nye-house-party',
      slug: 'nye-small-and-cosy',
      type: 'community',
      title: 'New Year’s Eve, small and cosy',
      summary: 'Eighteen people, home-cooked food and a countdown on the balcony.',
      description:
        'For anyone who would rather not spend the evening in a queue. Dinner at nine, games after, and the balcony at midnight. The address is shared once you are approved.',
      category: 'house_party',
      coverAlt: 'A balcony at night with candles, blankets and a view of city lights.',
      hostId: 'u03',
      hubId: HUB_NYE,
      start: nextNewYearsEve(now, 20, 30),
      hours: 4.5,
      area: 'Indiranagar',
      exactAddress: 'Flat 3B, Defence Colony 6th Main, Indiranagar, Bengaluru 560038',
      directions: 'Third floor. The lift is slow, the stairs are quicker.',
      pricing: costSplit(800, 'Dinner and drinks, split evenly.'),
      capacity: 18,
      ageRange: { min: 21, max: null },
      houseRules: ['Nobody is pressured to drink.', 'Arrange your ride home before midnight.', ...BASE_RULES],
    },
    {
      id: 'ev-sketch-and-chai',
      slug: 'sketch-and-chai-evening',
      type: 'community',
      status: 'completed',
      title: 'Sketch and chai evening',
      summary: 'An hour of drawing each other badly, then chai.',
      description:
        'No skill needed. We drew quick portraits of the person opposite, swapped seats every ten minutes and finished with chai and samosas.',
      category: 'arts',
      coverAlt: 'Sketchbooks, pencils and glasses of chai on a café table.',
      hostId: 'u04',
      start: inHours(now, -21),
      hours: 2.5,
      area: 'Indiranagar',
      venueName: 'Paper Boat Studio',
      exactAddress: 'Paper Boat Studio, 80 Feet Road, Indiranagar, Bengaluru 560038',
      pricing: payAtVenue('Pay for what you order.'),
      capacity: 10,
      houseRules: BASE_RULES,
      createdDaysAgo: 16,
    },
    {
      id: 'ev-karaoke-at-mine',
      slug: 'karaoke-night-at-mine',
      type: 'community',
      status: 'pending_review',
      title: 'Karaoke night at mine',
      summary: 'A proper karaoke machine and a living room that forgives.',
      description:
        'Fourteen people, two microphones and a songbook that goes from Kishore Kumar to Coldplay. Snacks are on me. Bring your one song.',
      category: 'house_party',
      coverAlt: 'A living room with a microphone, a songbook and warm lamps.',
      hostId: 'u06',
      start: dayAt(now, 14, 19, 30),
      hours: 3.5,
      area: 'Indiranagar',
      exactAddress: 'No. 9, 2nd Stage, Indiranagar, Bengaluru 560038',
      pricing: free('Snacks are on the host.'),
      capacity: 14,
      houseRules: ['Music goes down at 10:30 pm.', ...BASE_RULES],
      createdDaysAgo: 1,
    },

    // Kollide's own events. Paid in the app.
    {
      id: 'ev-supper-club',
      slug: 'supper-club-coastal-karnataka',
      type: 'kollide',
      title: 'Supper club: coastal Karnataka',
      summary: 'Six courses from Mangaluru to Karwar, at one long table.',
      description:
        'A home chef cooks six courses from the Karnataka coast. Sixteen seats at one table, with places set so you sit beside someone new. A vegetarian menu is available.',
      category: 'food_drink',
      coverAlt: 'A long dinner table set with banana leaves, brass bowls and candles.',
      hostId: 'u01',
      start: dayAt(now, 9, 19, 30),
      hours: 3,
      area: 'Indiranagar',
      venueName: 'The Courtyard Kitchen',
      exactAddress: 'The Courtyard Kitchen, 3rd Cross, HAL 2nd Stage, Indiranagar, Bengaluru 560038',
      directions: 'The green door beside the bakery. We are in the courtyard at the back.',
      pricing: paid(1800),
      capacity: 16,
      houseRules: ['Tell us about allergies when you book.', ...BASE_RULES],
      featured: true,
    },
    {
      id: 'ev-nye-long-table',
      slug: 'nye-the-long-table',
      type: 'kollide',
      title: 'New Year’s Eve: the long table',
      summary: 'Forty people, one table, a five-course dinner and a toast at midnight.',
      description:
        'Kollide’s own New Year’s Eve. A five-course dinner at a single long table, a small live set, and a countdown with people you met three hours earlier and will want to see again.',
      category: 'food_drink',
      coverAlt: 'A long candlelit table under hanging lights, set for a celebration.',
      hostId: 'u01',
      hubId: HUB_NYE,
      start: nextNewYearsEve(now, 20),
      hours: 4.5,
      area: 'Indiranagar',
      venueName: 'The Glasshouse',
      exactAddress: 'The Glasshouse, 12th Main Road, HAL 2nd Stage, Indiranagar, Bengaluru 560038',
      pricing: paid(3500),
      capacity: 40,
      ageRange: { min: 21, max: null },
      houseRules: ['Arrange your ride home before midnight.', ...BASE_RULES],
      featured: true,
    },
    {
      id: 'ev-sunrise-trek',
      slug: 'sunrise-trek-nandi-foothills',
      type: 'kollide',
      title: 'Sunrise trek: Nandi foothills',
      summary: 'An easy 5 km climb, breakfast at the top, back by noon.',
      description:
        'A guided beginner trek in a group of fourteen. Transport from Hebbal, a trek leader and breakfast are included. We set off early to catch the sunrise.',
      category: 'outdoors',
      coverAlt: 'A group silhouetted on a hilltop at sunrise with mist in the valley.',
      hostId: 'u01',
      start: inHours(now, 44),
      hours: 6,
      area: 'Hebbal',
      venueName: 'Hebbal pick-up point',
      exactAddress: 'Pick-up outside Esteem Mall, Bellary Road, Hebbal, Bengaluru 560024',
      directions: 'Look for the white tempo traveller with a Kollide sign in the window.',
      pricing: paid(1200),
      capacity: 14,
      houseRules: ['Wear shoes with grip and carry a litre of water.', ...BASE_RULES],
    },
    {
      id: 'ev-clay-evening',
      slug: 'clay-evening',
      type: 'kollide',
      title: 'Clay evening',
      summary: 'Two hours at the wheel with a potter, then dinner together.',
      description:
        'A studio potter teaches the basics, you make two pieces, and the studio fires them for you. Dinner afterwards is included. Ten places.',
      category: 'arts',
      coverAlt: 'Hands shaping clay on a pottery wheel in a sunlit studio.',
      hostId: 'u01',
      start: dayAt(now, 12, 17),
      hours: 3.5,
      area: 'JP Nagar',
      venueName: 'Slow Clay Studio',
      exactAddress: 'Slow Clay Studio, 24th Main Road, 2nd Phase, JP Nagar, Bengaluru 560078',
      pricing: paid(1500),
      capacity: 10,
      houseRules: ['Wear something you do not mind getting clay on.', ...BASE_RULES],
    },
  ]
}

const ARCHIVE: {
  title: string
  category: EventCategory
  type: EventType
  hostId: string
  area: Area
  daysAgo: number
  amountInr?: number
}[] = [
  { title: 'Quiz night at the brewery', category: 'games', type: 'community', hostId: 'u03', area: 'Koramangala', daysAgo: 6 },
  { title: 'Lalbagh morning walk', category: 'outdoors', type: 'community', hostId: 'u05', area: 'Jayanagar', daysAgo: 13 },
  { title: 'Supper club: Chettinad', category: 'food_drink', type: 'kollide', hostId: 'u01', area: 'Indiranagar', daysAgo: 20, amountInr: 1800 },
  { title: 'Carrom and chai', category: 'games', type: 'community', hostId: 'u07', area: 'Basavanagudi', daysAgo: 27 },
  { title: 'Terrace film night', category: 'house_party', type: 'community', hostId: 'u04', area: 'HSR Layout', daysAgo: 41 },
  { title: 'Badminton doubles social', category: 'wellness', type: 'community', hostId: 'u05', area: 'Basavanagudi', daysAgo: 55 },
  { title: 'Street food walk, VV Puram', category: 'food_drink', type: 'kollide', hostId: 'u01', area: 'Basavanagudi', daysAgo: 76, amountInr: 900 },
  { title: 'Board games marathon', category: 'games', type: 'community', hostId: 'u03', area: 'Indiranagar', daysAgo: 97 },
  { title: 'Monsoon potluck', category: 'house_party', type: 'community', hostId: 'u06', area: 'Indiranagar', daysAgo: 125 },
  { title: 'Sunrise cycle to the lake', category: 'outdoors', type: 'community', hostId: 'u07', area: 'Whitefield', daysAgo: 160 },
  { title: 'Open-air sketch walk', category: 'arts', type: 'community', hostId: 'u04', area: 'Church Street', daysAgo: 230 },
  { title: 'The first long table', category: 'food_drink', type: 'kollide', hostId: 'u01', area: 'Indiranagar', daysAgo: 400, amountInr: 1500 },
]

/** Finished events. They exist so that reliability and tags have a history to be worked out from. */
function archiveSpecs(now: Date): EventSpec[] {
  return ARCHIVE.map((past, index) => ({
    id: `ev-past-${String(index + 1).padStart(2, '0')}`,
    slug: `past-${past.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')}`,
    type: past.type,
    status: 'completed' as const,
    title: past.title,
    summary: 'A past Kollide event.',
    description: 'This event has finished.',
    category: past.category,
    coverAlt: `Abstract artwork for ${past.title}.`,
    hostId: past.hostId,
    start: dayAt(now, -past.daysAgo, 18),
    hours: 3,
    area: past.area,
    exactAddress: `${past.area}, Bengaluru`,
    pricing: past.amountInr ? paid(past.amountInr) : free(),
    capacity: 16,
    houseRules: BASE_RULES,
    createdDaysAgo: past.daysAgo + 14,
  }))
}

function toRecord(spec: EventSpec, now: Date, isArchive: boolean): EventRecord {
  return {
    id: spec.id,
    slug: spec.slug,
    type: spec.type,
    status: spec.status ?? 'published',
    title: spec.title,
    summary: spec.summary,
    description: spec.description,
    category: spec.category,
    coverUrl: coverUrl(isArchive ? `category-${spec.category}` : spec.slug),
    coverAlt: spec.coverAlt,
    hostId: spec.hostId ?? null,
    partner: spec.partner ?? null,
    hubId: spec.hubId ?? null,
    startsAt: spec.start.toISOString(),
    endsAt: new Date(spec.start.getTime() + spec.hours * HOUR).toISOString(),
    area: spec.area,
    venueName: spec.venueName ?? null,
    pricing: spec.pricing,
    capacity: spec.capacity,
    approvalMode: spec.type === 'community' ? 'host_approval' : 'instant',
    womenOnly: spec.womenOnly ?? false,
    ageRange: spec.ageRange ?? { min: 18, max: null },
    houseRules: spec.houseRules,
    featured: spec.featured ?? false,
    createdAt: new Date(now.getTime() - (spec.createdDaysAgo ?? 12) * 24 * HOUR).toISOString(),
    exactAddress: spec.exactAddress,
    directions: spec.directions ?? null,
    cancelledByKollide: false,
  }
}

export function buildEvents(now: Date): EventRecord[] {
  return [
    ...primarySpecs(now).map((spec) => toRecord(spec, now, false)),
    ...archiveSpecs(now).map((spec) => toRecord(spec, now, true)),
  ]
}

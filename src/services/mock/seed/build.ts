import { mutualPairs } from '@/domain/connections'

import { INTERESTS, LANGUAGES, POSITIVE_TAGS } from '../../types'
import type {
  Booking,
  BookingStatus,
  NotificationKind,
  PositiveTag,
  PrivateFeedbackCategory,
  SquadMemberStatus,
} from '../../types'
import { DB_VERSION, type Db, type EventRecord } from '../db'

import { AVATAR_VARIANTS, avatarUrl } from './assets'
import { buildEvents, buildHubs } from './events'
import { PEOPLE, PROMPT_BANK, type SeedPerson } from './people'
import { createRandom } from './random'

const HOUR = 3_600_000
const DAY = 24 * HOUR

/** People who must be at a past event, so the reputation examples below have something to stand on. */
const ARCHIVE_GUESTS: Record<string, string[]> = {
  'ev-past-01': ['u02', 'u11', 'u24', 'u18'],
  'ev-past-02': ['u02', 'u10', 'u17', 'u19', 'u28', 'u06'],
  'ev-past-03': ['u02', 'u10', 'u12', 'u13', 'u22', 'u20'],
  'ev-past-04': ['u14', 'u15', 'u16', 'u02'],
  'ev-past-05': ['u10', 'u12', 'u22', 'u25', 'u29', 'u35'],
  'ev-past-06': ['u14', 'u15', 'u16', 'u27'],
  'ev-past-07': ['u12', 'u13'],
}
/** People who booked a past event and then did not turn up. */
const ARCHIVE_NO_SHOWS: Record<string, string[]> = { 'ev-past-05': ['u27'], 'ev-past-03': ['u35'], 'ev-past-09': ['u02'] }
/** A trio who only ever review each other. The collusion check should flag them. */
const CLOSED_TRIO = ['u14', 'u15', 'u16']

/**
 * Builds the whole demo data set, relative to `now`, so there are always
 * events coming up. The same seed number gives the same data everywhere.
 */
export function buildSeed(now: Date): Db {
  const random = createRandom(20261113)
  const iso = (time: number) => new Date(time).toISOString()
  const ago = (days: number) => iso(now.getTime() - days * DAY)
  const personById = new Map(PEOPLE.map((person) => [person.id, person]))

  const db: Db = {
    version: DB_VERSION,
    seededAt: now.toISOString(),
    sessionUserId: null,
    emailCodes: {},
    users: [],
    profiles: [],
    hosts: [],
    events: buildEvents(now),
    hubs: buildHubs(now),
    bookings: [],
    squads: [],
    squadMembers: [],
    checkIns: [],
    tagReviews: [],
    privateFeedback: [],
    safetyReports: [],
    hostRatings: [],
    connections: [],
    appeals: [],
    payments: [],
    refunds: [],
    credits: [],
    notifications: [],
  }

  const counters: Record<string, number> = {}
  const id = (prefix: string) => {
    counters[prefix] = (counters[prefix] ?? 0) + 1
    return `${prefix}-${String(counters[prefix]).padStart(3, '0')}`
  }
  const event = (eventId: string): EventRecord => {
    const found = db.events.find((candidate) => candidate.id === eventId)
    if (!found) throw new Error(`Seed refers to an unknown event: ${eventId}`)
    return found
  }
  const startOf = (eventId: string) => new Date(event(eventId).startsAt).getTime()
  const endOf = (eventId: string) => new Date(event(eventId).endsAt).getTime()

  // People
  for (const person of PEOPLE) {
    const month = String(random.int(1, 12)).padStart(2, '0')
    const day = String(random.int(1, 28)).padStart(2, '0')
    const joinedAt = ago(person.joinedDaysAgo)
    db.users.push({
      id: person.id,
      role: person.role,
      status: person.status,
      email: `${person.firstName}.${person.lastName}`.toLowerCase().replace(/[^a-z.]/g, '') + '@example.com',
      phone: `+91 98${random.int(10000000, 99999999)}`,
      lastName: person.lastName,
      dateOfBirth: `${person.birthYear}-${month}-${day}`,
      onboardingComplete: true,
      consentAcceptedAt: joinedAt,
      createdAt: joinedAt,
    })

    const verifiedAt = ago(Math.max(1, person.joinedDaysAgo - 2))
    db.profiles.push({
      userId: person.id,
      firstName: person.firstName,
      gender: person.gender,
      area: person.area,
      interests: random.sample(INTERESTS, random.int(3, 5)),
      languages: ['English', ...random.sample(LANGUAGES.slice(1), random.int(1, 2))],
      prompts: random.sample(PROMPT_BANK, random.int(2, 3)).map((prompt) => ({
        promptId: prompt.promptId,
        question: prompt.question,
        answer: random.pick(prompt.answers),
      })),
      photos: Array.from({ length: AVATAR_VARIANTS }, (_, index) => ({
        id: `${person.id}-photo-${index + 1}`,
        url: avatarUrl(person.id, index + 1),
        alt: `Photo ${index + 1} of ${person.firstName}`,
        position: index,
      })),
      verification: {
        status: person.verification,
        submittedAt: person.verification === 'unverified' ? null : verifiedAt,
        reviewedAt: person.verification === 'verified' ? verifiedAt : null,
      },
      workplace: person.workplace ?? null,
      joinedAt,
    })
  }

  // Hosts: five approved members, the Kollide team account, and two applications waiting.
  for (const hostId of ['u01', 'u03', 'u04', 'u05', 'u06', 'u07']) {
    const joined = personById.get(hostId)!.joinedDaysAgo
    db.hosts.push({
      userId: hostId,
      status: 'approved',
      about:
        hostId === 'u01' ? 'The Kollide team. We run the supper clubs and the long tables.' : 'I like putting good people in a room.',
      appliedAt: ago(joined - 20),
      decidedAt: ago(joined - 22),
    })
  }
  db.hosts.push(
    {
      userId: 'u08',
      status: 'pending',
      about: 'I run a monthly book circle for friends and would like to open it to new people.',
      appliedAt: ago(3),
      decidedAt: null,
    },
    {
      userId: 'u09',
      status: 'pending',
      about: 'I have hosted quiz nights at home for two years. Eight to ten people, always a good mix.',
      appliedAt: ago(1),
      decidedAt: null,
    },
  )

  // Bookings
  const book = (
    eventId: string,
    userId: string,
    status: BookingStatus,
    options: { createdAt?: number; updatedAt?: number; waitlistPosition?: number; note?: string; reconfirmed?: boolean } = {},
  ): Booking => {
    const record = event(eventId)
    const flow = record.pricing.mode === 'paid' ? 'paid' : 'free'
    const createdAt = options.createdAt ?? Math.min(now.getTime() - random.int(6, 120) * HOUR, startOf(eventId) - 4 * HOUR)
    const booking: Booking = {
      id: id('bk'),
      eventId,
      userId,
      flow,
      status,
      note: options.note ?? null,
      waitlistPosition: options.waitlistPosition ?? null,
      reconfirmedAt: options.reconfirmed ? iso(startOf(eventId) - 12 * HOUR) : null,
      paymentId: null,
      createdAt: iso(createdAt),
      updatedAt: iso(options.updatedAt ?? createdAt + 2 * HOUR),
    }
    if (flow === 'paid' && status !== 'pending_payment') {
      const paymentId = id('pay')
      booking.paymentId = paymentId
      db.payments.push({
        id: paymentId,
        bookingId: booking.id,
        userId,
        amountInr: record.pricing.amountInr ?? 0,
        creditAppliedInr: 0,
        method: random.chance(0.7) ? 'upi' : 'card',
        status: status === 'refunded' || status === 'cancelled' ? 'refunded' : 'succeeded',
        reference: `KOL${random.int(100000, 999999)}`,
        failureReason: null,
        createdAt: booking.createdAt,
      })
    }
    db.bookings.push(booking)
    return booking
  }

  const checkIn = (eventId: string, userId: string) => {
    db.checkIns.push({
      id: id('ci'),
      eventId,
      userId,
      method: random.chance(0.6) ? 'qr' : 'manual',
      checkedInAt: iso(startOf(eventId) + random.int(-10, 25) * 60_000),
      checkedInBy: event(eventId).hostId ?? 'u01',
    })
  }

  const review = (eventId: string, reviewerId: string, subjectId: string, wantsToMeetAgain: boolean, tags?: PositiveTag[]) => {
    if (db.tagReviews.some((r) => r.eventId === eventId && r.reviewerId === reviewerId && r.subjectId === subjectId)) return
    const knownFor = personById.get(subjectId)?.knownFor ?? []
    const chosen =
      tags ??
      [...new Set(Array.from({ length: random.int(1, 3) }, () => (random.chance(0.8) && knownFor.length ? random.pick(knownFor) : random.pick(POSITIVE_TAGS))))]
    db.tagReviews.push({
      id: id('rv'),
      eventId,
      reviewerId,
      subjectId,
      tags: chosen,
      wantsToMeetAgain,
      submittedAt: iso(Math.min(endOf(eventId) + random.int(2, 60) * HOUR, now.getTime() - HOUR)),
    })
  }

  const rateHost = (eventId: string, raterId: string) => {
    const hostId = event(eventId).hostId
    if (!hostId) return
    db.hostRatings.push({
      id: id('hr'),
      eventId,
      raterId,
      hostId,
      asDescribed: random.chance(0.95),
      feltSafe: random.chance(0.97),
      wellOrganised: random.chance(0.9),
      submittedAt: iso(Math.min(endOf(eventId) + random.int(2, 48) * HOUR, now.getTime() - HOUR)),
    })
  }

  // Past events: who went, who did not, and what people said about each other.
  const attendedBy = new Map<string, string[]>()
  const archive = db.events.filter((candidate) => candidate.id.startsWith('ev-past-'))
  for (const past of archive) {
    const daysAgo = (now.getTime() - new Date(past.startsAt).getTime()) / DAY
    const forced = ARCHIVE_GUESTS[past.id] ?? []
    const noShows = ARCHIVE_NO_SHOWS[past.id] ?? []
    const eligible = PEOPLE.filter(
      (person: SeedPerson) =>
        person.joinedDaysAgo > daysAgo + 3 &&
        person.id !== past.hostId &&
        person.id !== 'u01' &&
        !CLOSED_TRIO.includes(person.id) &&
        !forced.includes(person.id) &&
        !noShows.includes(person.id) &&
        // Ananya cancelled the street food walk, which is where her credit comes from.
        !(past.id === 'ev-past-07' && person.id === 'u02'),
    ).map((person) => person.id)
    const extras = random.sample(eligible, Math.max(0, random.int(9, 13) - forced.length))

    const attended: string[] = []
    const created = new Date(past.startsAt).getTime() - random.int(3, 10) * DAY
    for (const userId of [...forced, ...extras, ...noShows]) {
      const showedUp = forced.includes(userId) || (!noShows.includes(userId) && random.chance(personById.get(userId)!.showsUp))
      book(past.id, userId, showedUp ? 'attended' : 'no_show', { createdAt: created, updatedAt: endOf(past.id) })
      if (showedUp) {
        attended.push(userId)
        checkIn(past.id, userId)
      }
    }
    attendedBy.set(past.id, attended)

    for (const reviewerId of attended) {
      const inTrio = CLOSED_TRIO.includes(reviewerId)
      const others = attended.filter((other) => other !== reviewerId && (!inTrio || CLOSED_TRIO.includes(other)))
      const subjects = inTrio ? others : random.sample(others, random.int(2, 5))
      for (const subjectId of subjects) review(past.id, reviewerId, subjectId, random.chance(0.45))
      if (random.chance(0.7)) rateHost(past.id, reviewerId)
    }
  }

  // A trio from the quiz night who all want to meet again. Kollide suggests a repeat.
  for (const [a, b] of [['u02', 'u28'], ['u02', 'u06'], ['u06', 'u28']]) {
    for (const [reviewerId, subjectId] of [[a, b], [b, a]]) {
      const existing = db.tagReviews.find(
        (r) => r.eventId === 'ev-past-02' && r.reviewerId === reviewerId && r.subjectId === subjectId,
      )
      if (existing) existing.wantsToMeetAgain = true
      else review('ev-past-02', reviewerId, subjectId, true)
    }
  }

  // Private "something felt off" feedback.
  const feltOff = (eventId: string, reviewerId: string, subjectId: string, category: PrivateFeedbackCategory, note: string | null = null) => {
    db.privateFeedback.push({
      id: id('pf'),
      eventId,
      reviewerId,
      subjectId,
      category,
      note,
      submittedAt: iso(endOf(eventId) + random.int(3, 40) * HOUR),
    })
  }
  const bystanders = (eventId: string, exclude: string[], count: number) =>
    (attendedBy.get(eventId) ?? []).filter((userId) => !exclude.includes(userId) && !CLOSED_TRIO.includes(userId)).slice(0, count)

  // Rohit: four people across three events said the same thing, so he sees a gentle tip.
  feltOff('ev-past-02', 'u17', 'u10', 'talked_over_people')
  feltOff('ev-past-02', 'u19', 'u10', 'talked_over_people', 'Kept steering every topic back to himself.')
  feltOff('ev-past-03', 'u22', 'u10', 'talked_over_people')
  feltOff('ev-past-05', 'u25', 'u10', 'talked_over_people')
  // Aman: two people, one event. Below the threshold, so nothing is shown.
  for (const reviewerId of bystanders('ev-past-06', ['u27'], 2)) feltOff('ev-past-06', reviewerId, 'u27', 'ran_late')
  // Tanvi: three people across two events, but one of them is Sameer, whom she had
  // reported earlier. His feedback is discounted, so the threshold is not met.
  feltOff('ev-past-03', 'u13', 'u12', 'was_rude', 'Was short with me all evening.')
  for (const reviewerId of bystanders('ev-past-03', ['u12', 'u13', 'u10', 'u02'], 1)) feltOff('ev-past-03', reviewerId, 'u12', 'was_rude')
  for (const reviewerId of bystanders('ev-past-05', ['u12', 'u10'], 1)) feltOff('ev-past-05', reviewerId, 'u12', 'was_rude')

  // Safety reports.
  db.safetyReports.push(
    {
      id: id('sr'),
      reporterId: 'u12',
      subjectType: 'user',
      subjectId: 'u13',
      eventId: 'ev-past-07',
      category: 'inappropriate_behaviour',
      details: 'Made repeated comments about my appearance after I asked him to stop.',
      status: 'resolved',
      resolution: 'Spoke to both members. A written warning was issued.',
      createdAt: iso(endOf('ev-past-07') + 5 * HOUR),
      resolvedAt: iso(endOf('ev-past-07') + 4 * DAY),
    },
    {
      id: id('sr'),
      reporterId: 'u24',
      subjectType: 'user',
      subjectId: 'u11',
      eventId: 'ev-past-01',
      category: 'harassment',
      details: 'Followed me to my cab after the event and kept asking for my number.',
      status: 'open',
      resolution: null,
      createdAt: iso(endOf('ev-past-01') + 3 * HOUR),
      resolvedAt: null,
    },
    {
      id: id('sr'),
      reporterId: 'u22',
      subjectType: 'user',
      subjectId: 'u35',
      eventId: 'ev-past-03',
      category: 'felt_unsafe',
      details: 'Booked, did not turn up, then sent angry messages to the host’s guests about the guest list.',
      status: 'resolved',
      resolution: 'Second report about this member. Account suspended for 60 days.',
      createdAt: iso(endOf('ev-past-03') + 20 * HOUR),
      resolvedAt: iso(endOf('ev-past-03') + 3 * DAY),
    },
    {
      id: id('sr'),
      reporterId: 'u18',
      subjectType: 'event',
      subjectId: 'ev-open-mic',
      eventId: null,
      category: 'other',
      details: 'The listing promises twelve comics. Last month there were five and it ended in forty minutes.',
      status: 'reviewing',
      resolution: null,
      createdAt: ago(2),
      resolvedAt: null,
    },
  )
  db.appeals.push({
    id: id('ap'),
    userId: 'u35',
    about: 'suspension',
    reference: 'suspended',
    message: 'I missed the event because of a family emergency. I should not have messaged anyone and I am sorry.',
    status: 'under_review',
    createdAt: iso(endOf('ev-past-03') + 5 * DAY),
    decidedAt: null,
  })

  // Yesterday's event. Its 72-hour feedback window is open right now.
  const sketch = 'ev-sketch-and-chai'
  const sketchGuests = ['u02', 'u17', 'u18', 'u22', 'u28', 'u06', 'u25']
  for (const userId of sketchGuests) {
    book(sketch, userId, 'attended', { createdAt: startOf(sketch) - 6 * DAY, updatedAt: endOf(sketch) })
    checkIn(sketch, userId)
  }
  book(sketch, 'u27', 'no_show', { createdAt: startOf(sketch) - 5 * DAY, updatedAt: endOf(sketch) })
  attendedBy.set(sketch, sketchGuests)
  // Aditi and Ishaan have reviewed each other, and both have said yes to Ananya.
  // Ananya has not answered yet, so their reviews of her stay hidden.
  review(sketch, 'u17', 'u18', true, ['Fun energy', 'Great conversation'])
  review(sketch, 'u18', 'u17', true, ['Good listener', 'Welcoming'])
  review(sketch, 'u17', 'u02', true, ['Great conversation', 'Welcoming'])
  review(sketch, 'u18', 'u02', true, ['Good listener'])
  review(sketch, 'u22', 'u28', false, ['Welcoming'])
  rateHost(sketch, 'u17')
  rateHost(sketch, 'u18')

  // Upcoming events.
  const eligibleFor = (eventId: string, exclude: string[]) => {
    const record = event(eventId)
    const taken = new Set(db.bookings.filter((booking) => booking.eventId === eventId).map((booking) => booking.userId))
    return PEOPLE.filter(
      (person) =>
        person.status === 'active' &&
        person.joinedDaysAgo > 20 &&
        person.id !== record.hostId &&
        person.id !== 'u01' &&
        !CLOSED_TRIO.includes(person.id) &&
        !taken.has(person.id) &&
        !exclude.includes(person.id) &&
        (!record.womenOnly || person.gender === 'woman'),
    ).map((person) => person.id)
  }
  // Always call `fill` after an event's hand-written bookings, so nobody is booked twice.
  const fill = (eventId: string, status: BookingStatus, count: number, exclude: string[] = ['u02']) => {
    for (const userId of random.sample(eligibleFor(eventId, exclude), count)) book(eventId, userId, status)
  }

  // Board games, tomorrow. Arjun's inbox has requests, and Ananya is asked "Still coming?".
  for (const userId of ['u17', 'u18', 'u25']) book('ev-board-games', userId, 'confirmed', { reconfirmed: true })
  for (const userId of ['u02', 'u22', 'u28', 'u19']) book('ev-board-games', userId, 'approved')
  const requestNotes: Record<string, string> = {
    u20: 'I moved to Bengaluru in August and have been looking for a games group.',
    u24: 'Happy to bring Codenames and Azul.',
    u26: 'First Kollide event. A friend said yours are the friendliest.',
    u30: 'I am free all evening and I do not mind teaching rules.',
    u36: 'New here. I would love a small group to start with.',
    u10: 'I know most of these games already, so I can run a table.',
  }
  for (const [userId, note] of Object.entries(requestNotes)) book('ev-board-games', userId, 'requested', { note })
  book('ev-board-games', 'u27', 'waitlisted', { waitlistPosition: 1 })
  book('ev-board-games', 'u33', 'waitlisted', { waitlistPosition: 2 })

  // Terrace party. Ananya's request is waiting for an answer.
  book('ev-terrace-party', 'u02', 'requested', { note: 'I know every word to Dil To Pagal Hai. Count me in.' })
  for (const userId of ['u21', 'u37']) book('ev-terrace-party', userId, 'requested')
  fill('ev-terrace-party', 'approved', 12)

  // Cubbon Park walk is full. Ananya is first on the waitlist.
  book('ev-cubbon-walk', 'u02', 'waitlisted', { waitlistPosition: 1 })
  book('ev-cubbon-walk', 'u31', 'waitlisted', { waitlistPosition: 2 })
  fill('ev-cubbon-walk', 'approved', 12)

  book('ev-womens-brunch', 'u38', 'requested', { note: 'I have a copy of The Covenant of Water to pass on.' })
  fill('ev-womens-brunch', 'approved', 5)

  // Potluck. Ananya was gently declined, so she sees similar events.
  book('ev-potluck-games', 'u02', 'declined')
  for (const userId of ['u32', 'u34']) book('ev-potluck-games', userId, 'requested')
  fill('ev-potluck-games', 'approved', 6)

  for (const userId of ['u26', 'u30', 'u32', 'u09']) book('ev-nye-house-party', userId, 'requested')
  fill('ev-nye-house-party', 'approved', 9)

  // Kollide's paid events. Ananya has paid for two: one more than 72 hours away, one less.
  book('ev-supper-club', 'u02', 'paid')
  fill('ev-supper-club', 'paid', 8)
  book('ev-sunrise-trek', 'u02', 'paid')
  fill('ev-sunrise-trek', 'paid', 10)
  fill('ev-nye-long-table', 'paid', 22)
  fill('ev-clay-evening', 'paid', 8)

  // Ananya cancelled a paid event at short notice, so the amount came back as credit.
  const cancelled = book('ev-past-07', 'u02', 'cancelled', {
    createdAt: startOf('ev-past-07') - 9 * DAY,
    updatedAt: startOf('ev-past-07') - 30 * HOUR,
  })
  const refundId = id('rf')
  db.refunds.push({
    id: refundId,
    paymentId: cancelled.paymentId!,
    bookingId: cancelled.id,
    userId: 'u02',
    kind: 'credit',
    amountInr: 900,
    createdAt: cancelled.updatedAt,
  })
  db.credits.push({
    id: id('cr'),
    userId: 'u02',
    amountInr: 900,
    reason: 'Credit for cancelling “Street food walk, VV Puram” inside 72 hours',
    refundId,
    createdAt: cancelled.updatedAt,
    usedAt: null,
  })

  // Squads
  const squad = (
    squadId: string,
    eventId: string,
    name: string,
    place: string,
    size: number,
    womenOnly: boolean,
    members: [string, SquadMemberStatus][],
  ) => {
    const [creatorId] = members[0]
    const createdAt = now.getTime() - random.int(2, 6) * DAY
    db.squads.push({
      id: squadId,
      eventId,
      creatorId,
      name,
      meetingPoint: { place, minutesBefore: 30 },
      size,
      womenOnly,
      createdAt: iso(createdAt),
    })
    members.forEach(([userId, status], index) => {
      const requestedAt = createdAt + index * 5 * HOUR
      db.squadMembers.push({
        squadId,
        userId,
        role: index === 0 ? 'creator' : 'member',
        status,
        requestedAt: iso(requestedAt),
        decidedAt: status === 'requested' ? null : iso(requestedAt + 2 * HOUR),
      })
    })
  }
  squad('sq-vinyl', 'ev-vinyl-night', 'Front-row regulars', 'Araku Coffee, 12th Main', 6, false, [
    ['u18', 'approved'],
    ['u17', 'approved'],
    ['u26', 'approved'],
    ['u21', 'requested'],
  ])
  squad('sq-rooftop', 'ev-nye-rooftop', 'Midnight on the roof', 'Koshy’s, St Mark’s Road', 5, false, [
    ['u06', 'approved'],
    ['u28', 'approved'],
    ['u02', 'approved'],
    ['u19', 'approved'],
  ])
  squad('sq-open-mic', 'ev-open-mic', 'Back-row laughers', 'Third Wave Coffee, 80 Feet Road', 4, true, [
    ['u12', 'approved'],
    ['u24', 'approved'],
    ['u02', 'requested'],
  ])

  // Connections: every pair who both said yes after the same event, once its reviews are revealed.
  const closed = db.tagReviews.filter((r) => endOf(r.eventId) + 72 * HOUR <= now.getTime())
  for (const pair of mutualPairs(closed)) {
    db.connections.push({ id: id('cn'), userIds: pair.userIds, eventId: pair.eventId, createdAt: iso(endOf(pair.eventId) + 72 * HOUR) })
  }
  // Aditi and Ishaan both submitted, so theirs is revealed already.
  db.connections.push({ id: id('cn'), userIds: ['u17', 'u18'], eventId: sketch, createdAt: iso(now.getTime() - 3 * HOUR) })

  // Notifications
  const notify = (userId: string, kind: NotificationKind, title: string, body: string, href: string | null, hoursAgo: number, read = false) => {
    db.notifications.push({ id: id('nt'), userId, kind, title, body, href, read, createdAt: iso(now.getTime() - hoursAgo * HOUR) })
  }
  notify('u02', 'reconfirm', 'Still coming tomorrow?', 'Board games and filter coffee starts in under 24 hours. Let Arjun know you’re in.', '/app/plans', 1)
  notify('u02', 'feedback_open', 'How was Sketch and chai?', 'Share a few tags for the people you met. It stays open for 72 hours.', '/app/plans', 16)
  notify('u02', 'squad_approved', 'You’re in the squad', 'Sneha added you to “Midnight on the roof”.', '/app/squads', 30, true)
  notify('u02', 'request_declined', 'Potluck game night is full', 'This one filled up. Here are a few similar evenings.', '/app', 52, true)
  notify('u02', 'refund', '₹900 added as Kollide credit', 'It will be used automatically on your next paid booking.', '/app/plans', 24 * 75, true)
  for (const [userId, hoursAgo] of [['u20', 3], ['u24', 5], ['u26', 9], ['u30', 14], ['u36', 20], ['u10', 26]] as const) {
    const firstName = personById.get(userId)!.firstName
    notify('u03', 'request_received', `${firstName} asked to join`, 'Board games and filter coffee', '/app/host', hoursAgo, hoursAgo > 15)
  }
  notify('u01', 'host_application', 'Two host applications are waiting', 'Divya and Nikhil have applied to host.', '/admin', 20)
  notify('u01', 'account', 'A new safety report needs review', 'Reported after “Quiz night at the brewery”.', '/admin/reports', 6 * 24)
  notify('u01', 'event_review', 'An event is waiting for approval', 'Karaoke night at mine, hosted by Sneha.', '/admin/events', 22)

  return db
}

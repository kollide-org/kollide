import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { isServiceError } from '../errors'
import type { OnboardingInput } from '../types'

import { mockDevTools } from './auth'
import { getDb, useMemoryDb } from './db'
import { mockServices } from './index'
import { setMockDelay } from './runtime'
import { buildSeed } from './seed/build'

const {
  authService,
  profileService,
  eventService,
  bookingService,
  squadService,
  reviewService,
  paymentService,
  adminService,
  notificationService,
} = mockServices

const START = new Date('2026-11-13T10:00:00.000Z')
const HOUR = 3_600_000

const onboarding: OnboardingInput = {
  firstName: 'Isha',
  dateOfBirth: '1998-05-20',
  gender: 'woman',
  area: 'Indiranagar',
  interests: ['Board games'],
  languages: ['English'],
  prompts: [
    { promptId: 'perfect-sunday', question: 'A perfect Sunday is…', answer: 'A long walk.' },
    { promptId: 'ask-me-about', question: 'Ask me about…', answer: 'My plants.' },
  ],
  photos: [1, 2, 3].map((n) => ({ url: `blob:photo-${n}`, alt: `Photo ${n}` })),
  phone: '+91 9800000000',
  acceptedConduct: true,
  acceptedPrivacy: true,
}

async function rejection(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    return isServiceError(error) ? error.code : `unexpected: ${String(error)}`
  }
  return 'resolved'
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(START)
  setMockDelay(0)
  useMemoryDb(buildSeed(START))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('seed data', () => {
  it('has the people, events and squads the brief asks for', () => {
    const db = getDb()
    expect(db.profiles).toHaveLength(40)
    expect(db.events.filter((event) => !event.id.startsWith('ev-past-'))).toHaveLength(16)
    expect(db.squads).toHaveLength(3)
    expect(db.tagReviews.length).toBeGreaterThan(100)
  })

  it('never books one person twice for the same event', () => {
    const seen = new Set<string>()
    for (const booking of getDb().bookings) {
      const key = `${booking.eventId}|${booking.userId}`
      expect(seen.has(key), key).toBe(false)
      seen.add(key)
    }
  })

  it('is the same every time it is built', () => {
    expect(buildSeed(START)).toEqual(buildSeed(START))
  })

  it('lists upcoming published events without ever exposing an address', async () => {
    const events = await eventService.listEvents()
    expect(events).toHaveLength(14)
    expect(JSON.stringify(events)).not.toContain('exactAddress')
    expect(JSON.stringify(events)).not.toContain('Sai Residency')
    expect(events.map((event) => event.startsAt)).toEqual([...events.map((event) => event.startsAt)].sort())
    const hub = await eventService.getActiveHub()
    expect(hub?.events.length).toBe(4)
  })

  it('filters events', async () => {
    expect((await eventService.listEvents({ womenOnly: true })).map((event) => event.slug)).toEqual(['womens-brunch-and-book-swap'])
    expect((await eventService.listEvents({ type: 'partner' })).length).toBe(4)
    expect((await eventService.listEvents({ price: 'free' })).every((event) => ['free', 'pay_at_venue'].includes(event.pricing.mode))).toBe(true)
    expect((await eventService.listEvents({ groupSize: 'small' })).every((event) => event.capacity <= 10)).toBe(true)
    expect((await eventService.listEvents({ areas: ['Jayanagar'] })).length).toBe(1)
  })
})

describe('reputation, calculated from source records', () => {
  it('shows reliability for regulars and a badge for newcomers', async () => {
    await mockDevTools.signInAs('member')
    const ananya = await profileService.getProfileCard('u02')
    expect(ananya.reputation.isNew).toBe(false)
    expect(ananya.reputation.reliability!.outOf).toBeGreaterThanOrEqual(4)
    expect(ananya.reputation.topTags.length).toBeGreaterThan(0)
    expect(ananya).not.toHaveProperty('lastName')
    expect(ananya).not.toHaveProperty('email')

    const newcomer = await profileService.getProfileCard('u38')
    expect(newcomer.reputation).toEqual({ eventsAttended: 0, reliability: null, topTags: [], isNew: true })

    const flaky = await profileService.getProfileCard('u27')
    expect(flaky.reputation.reliability!.showedUp).toBeLessThan(flaky.reputation.reliability!.outOf)
  })

  it('shows a gentle tip only once three people across two events agree', async () => {
    const db = getDb()
    db.sessionUserId = 'u10'
    expect((await profileService.getMyTips()).map((tip) => tip.category)).toEqual(['talked_over_people'])
    db.sessionUserId = 'u27'
    expect(await profileService.getMyTips()).toEqual([])
  })

  it('discounts feedback from someone the subject had reported', async () => {
    const db = getDb()
    expect(db.privateFeedback.filter((feedback) => feedback.subjectId === 'u12' && feedback.category === 'was_rude')).toHaveLength(3)
    db.sessionUserId = 'u12'
    expect(await profileService.getMyTips()).toEqual([])
  })

  it('flags the trio who only review each other', async () => {
    await mockDevTools.signInAs('admin')
    const flags = await adminService.listCollusionFlags()
    expect(flags.map((flag) => flag.people.map((person) => person.userId))).toEqual([['u14', 'u15', 'u16']])
  })
})

describe('a new member, from sign-up to feedback', () => {
  it('signs up, joins, is approved, checks in, reviews, and sees reliability update', async () => {
    // Sign up. Under-18s are turned away.
    const session = await authService.signInWithGoogle()
    expect(session.profile).toBeNull()
    expect(await rejection(profileService.completeOnboarding({ ...onboarding, dateOfBirth: '2010-01-01' }))).toBe('validation')
    const profile = await profileService.completeOnboarding(onboarding)
    expect(profile.age).toBe(28)
    const me = session.user.id
    expect((await profileService.getProfileCard(me)).reputation.isNew).toBe(true)

    // Find an event and ask to join. The address stays hidden.
    const event = (await eventService.listEvents({ type: 'community' })).find((item) => item.slug === 'board-games-and-filter-coffee')!
    const booking = await bookingService.requestToJoin(event.id, 'Hello!')
    expect(booking.status).toBe('requested')
    expect(await rejection(bookingService.requestToJoin(event.id))).toBe('conflict')
    expect(await rejection(eventService.getEventAddress(event.id))).toBe('forbidden')
    expect((await eventService.getEvent(event.slug)).viewer.canSeeAddress).toBe(false)

    // The host sees a profile card and approves.
    await mockDevTools.signInAs('host')
    const requests = await bookingService.listRequests(event.id)
    const mine = requests.find((request) => request.booking.id === booking.id)!
    expect(mine.requester.firstName).toBe('Isha')
    expect(mine.requester.reputation.isNew).toBe(true)
    expect((await bookingService.decideRequest(booking.id, 'approve')).status).toBe('approved')

    // Now the address is visible, and the member gets a ticket.
    getDb().sessionUserId = me
    expect((await eventService.getEventAddress(event.id)).exactAddress).toContain('Third Wave Courtyard')
    const ticket = await bookingService.getTicket(booking.id)
    const plans = await bookingService.listMyBookings()
    expect(plans[0].needsReconfirmation).toBe(true)
    expect((await bookingService.reconfirm(booking.id)).status).toBe('confirmed')
    expect((await notificationService.listNotifications())[0].kind).toBe('request_approved')

    // The host scans the ticket, checks in another guest, and closes the event.
    vi.setSystemTime(new Date(new Date(event.startsAt).getTime() + HOUR / 2))
    await mockDevTools.signInAs('host')
    expect(await rejection(bookingService.checkInWithTicket(event.id, 'KOLLIDE:other:nope'))).toBe('validation')
    expect((await bookingService.checkInWithTicket(event.id, ticket.code)).userId).toBe(me)
    await bookingService.checkIn(event.id, 'u17', 'manual')
    vi.setSystemTime(new Date(new Date(event.endsAt).getTime() + HOUR))
    const closed = await bookingService.closeOutEvent(event.id)
    expect(closed.attended).toBe(2)
    expect(closed.noShows).toBeGreaterThan(0)

    // Feedback: only people who checked in, one review each, double-blind.
    getDb().sessionUserId = me
    const [form] = await reviewService.listPendingFeedback()
    expect(form.people.map((person) => person.userId)).toEqual(['u17'])
    expect(await rejection(reviewService.submitReview({ eventId: event.id, subjectId: 'u22', tags: [], wantsToMeetAgain: false }))).toBe('forbidden')
    const first = await reviewService.submitReview({ eventId: event.id, subjectId: 'u17', tags: ['Welcoming', 'Good listener'], wantsToMeetAgain: true })
    expect(first.connected).toBe(false)
    expect(await rejection(reviewService.submitReview({ eventId: event.id, subjectId: 'u17', tags: [], wantsToMeetAgain: true }))).toBe('conflict')
    await reviewService.submitHostRating({ eventId: event.id, asDescribed: true, feltSafe: true, wellOrganised: true })
    expect(await reviewService.listPendingFeedback()).toEqual([])

    // Aditi's review of Isha is revealed because both have now submitted.
    getDb().sessionUserId = 'u17'
    const back = await reviewService.submitReview({ eventId: event.id, subjectId: me, tags: ['Fun energy'], wantsToMeetAgain: true })
    expect(back.connected).toBe(true)

    // Reliability is worked out from the check-in.
    getDb().sessionUserId = me
    const card = await profileService.getProfileCard(me)
    expect(card.reputation).toMatchObject({ eventsAttended: 1, reliability: { showedUp: 1, outOf: 1 }, isNew: true })
    expect(card.reputation.topTags).toEqual([{ tag: 'Fun energy', count: 1 }])
    expect((await reviewService.listConnections()).map((connection) => connection.person.userId)).toEqual(['u17'])
  })
})

describe('bookings', () => {
  it('caps approvals at 30% over capacity', async () => {
    await mockDevTools.signInAs('host')
    const event = getDb().events.find((candidate) => candidate.id === 'ev-board-games')!
    const capacity = await bookingService.getHostCapacity(event.id)
    expect(capacity).toMatchObject({ capacity: 10, approvalLimit: 13, approved: 7, requested: 6, waitlisted: 2 })
    const requests = await bookingService.listRequests(event.id)
    const outcomes: string[] = []
    for (const request of requests) outcomes.push(await rejection(bookingService.decideRequest(request.booking.id, 'approve')))
    expect(outcomes.filter((outcome) => outcome === 'resolved')).toHaveLength(6)
    expect(outcomes.filter((outcome) => outcome === 'conflict')).toHaveLength(2)
  })

  it('promotes the next person on the waitlist when someone drops out', async () => {
    const db = getDb()
    await mockDevTools.signInAs('member')
    const walk = (await eventService.getEvent('cubbon-park-walk-and-breakfast'))
    expect(walk.spotsLeft).toBe(0)
    expect(walk.viewer.booking).toMatchObject({ status: 'waitlisted', waitlistPosition: 1 })

    const leaver = db.bookings.find((booking) => booking.eventId === walk.id && booking.status === 'approved')!
    db.sessionUserId = leaver.userId
    const { promotion } = await bookingService.cancelBooking(leaver.id)
    expect(promotion?.person.userId).toBe('u02')
    expect(db.bookings.find((booking) => booking.eventId === walk.id && booking.userId === 'u31')?.waitlistPosition).toBe(1)
  })

  it('stops a member who is on hold from sending requests', async () => {
    getDb().sessionUserId = 'u11'
    expect(await rejection(bookingService.requestToJoin('ev-potluck-games'))).toBe('account_on_hold')
  })

  it('keeps women-only events for women', async () => {
    getDb().sessionUserId = 'u18'
    expect(await rejection(bookingService.requestToJoin('ev-womens-brunch'))).toBe('forbidden')
  })
})

describe('payments (simulated)', () => {
  it('applies credit, takes payment, and handles a decline', async () => {
    await mockDevTools.signInAs('member')
    const checkout = await paymentService.startCheckout('ev-clay-evening')
    expect(checkout).toMatchObject({ priceInr: 1500, creditAppliedInr: 900, payableInr: 600 })
    expect(checkout.booking.status).toBe('pending_payment')

    expect(await rejection(paymentService.pay(checkout.booking.id, { method: 'upi', upiId: 'nope' }))).toBe('validation')
    expect(await rejection(paymentService.pay(checkout.booking.id, { method: 'upi', upiId: 'ananya@fail' }))).toBe('payment_failed')
    const result = await paymentService.pay(checkout.booking.id, { method: 'upi', upiId: 'ananya@okbank' })
    expect(result.booking.status).toBe('paid')
    expect(result.payment).toMatchObject({ amountInr: 600, creditAppliedInr: 900, status: 'succeeded' })
    expect((await paymentService.listMyCredits()).filter((credit) => !credit.usedAt)).toEqual([])
    expect((await eventService.getEventAddress('ev-clay-evening')).exactAddress).toContain('Slow Clay Studio')
  })

  it('follows the refund rules', async () => {
    await mockDevTools.signInAs('member')
    const plans = await bookingService.listMyBookings()
    const supper = plans.find((plan) => plan.eventId === 'ev-supper-club')!
    const trek = plans.find((plan) => plan.eventId === 'ev-sunrise-trek')!
    expect(await paymentService.getRefundQuote(supper.id)).toMatchObject({ outcome: 'full', amountInr: 1800 })
    expect(await paymentService.getRefundQuote(trek.id)).toMatchObject({ outcome: 'credit', amountInr: 1200 })

    const { refund, credit } = await paymentService.cancelAndRefund(trek.id)
    expect(refund?.kind).toBe('credit')
    expect(credit?.amountInr).toBe(1200)

    // When Kollide cancels, the refund is automatic.
    await mockDevTools.signInAs('admin')
    await eventService.cancelEvent('ev-supper-club')
    expect(getDb().bookings.find((booking) => booking.id === supper.id)?.status).toBe('refunded')
    expect(getDb().refunds.some((candidate) => candidate.bookingId === supper.id && candidate.kind === 'cancelled_by_kollide')).toBe(true)
  })
})

describe('squads', () => {
  it('lists squads forming and lets the creator approve requests', async () => {
    await mockDevTools.signInAs('member')
    const forming = await squadService.listSquadsForming()
    expect(forming.map((squad) => `${squad.members.length} of ${squad.size}`)).toEqual(['3 of 6', '2 of 4', '4 of 5'])
    expect(forming.every((squad) => squad.pendingRequests.length === 0)).toBe(true)
    expect((await squadService.listMySquads()).map((squad) => squad.viewerStatus)).toEqual(['requested', 'approved'])

    getDb().sessionUserId = 'u12'
    const mine = await squadService.getSquad('sq-open-mic')
    expect(mine.pendingRequests.map((person) => person.userId)).toEqual(['u02'])
    await squadService.decideRequest('sq-open-mic', 'u02', 'approve')
    expect((await squadService.getSquad('sq-open-mic')).spotsLeft).toBe(1)
  })
})

describe('meet again', () => {
  it('turns two yeses into a connection and three into a repeat suggestion', async () => {
    await mockDevTools.signInAs('member')
    const before = await reviewService.listRepeatSuggestions()
    expect(before.map((suggestion) => suggestion.people.map((person) => person.userId).sort())).toEqual([['u06', 'u28']])

    const [form] = await reviewService.listPendingFeedback()
    expect(form.eventId).toBe('ev-sketch-and-chai')
    expect(form.people).toHaveLength(6)
    const tagsBefore = (await profileService.getProfileCard('u02')).reputation.topTags

    for (const subjectId of ['u17', 'u18']) {
      const result = await reviewService.submitReview({ eventId: form.eventId, subjectId, tags: ['Fun energy'], wantsToMeetAgain: true })
      expect(result.connected).toBe(true)
    }
    const after = await reviewService.listRepeatSuggestions()
    expect(after.map((suggestion) => suggestion.eventId).sort()).toEqual(['ev-past-02', 'ev-sketch-and-chai'])

    // Their reviews of Ananya were hidden until she reviewed them.
    const tagsAfter = (await profileService.getProfileCard('u02')).reputation.topTags
    const total = (tags: typeof tagsAfter) => tags.reduce((sum, tag) => sum + tag.count, 0)
    expect(total(tagsAfter)).toBeGreaterThan(total(tagsBefore))
  })
})

describe('admin', () => {
  it('is closed to everyone else', async () => {
    await mockDevTools.signInAs('host')
    expect(await rejection(adminService.listReports())).toBe('forbidden')
    await mockDevTools.signInAs('visitor')
    expect(await rejection(adminService.listUsers())).toBe('unauthenticated')
  })

  it('approves hosts and events', async () => {
    await mockDevTools.signInAs('admin')
    expect((await adminService.listHostApplications()).map((item) => item.applicant.firstName)).toEqual(['Divya', 'Nikhil'])
    await adminService.decideHostApplication('u08', 'approve')
    expect(getDb().users.find((user) => user.id === 'u08')?.role).toBe('host')

    const [pending] = await adminService.listEventsForReview()
    expect(pending.event.title).toBe('Karaoke night at mine')
    await adminService.decideEvent(pending.event.id, 'approve')
    expect((await eventService.listEvents()).some((event) => event.id === pending.event.id)).toBe(true)
  })

  it('puts a reported member on hold and releases them when the report is closed', async () => {
    await mockDevTools.signInAs('member')
    const report = await reviewService.submitSafetyReport({
      subjectType: 'user',
      subjectId: 'u18',
      category: 'inappropriate_behaviour',
      details: 'Kept interrupting and made an unkind joke about another guest.',
    })
    expect(getDb().users.find((user) => user.id === 'u18')?.status).toBe('on_hold')
    expect((await profileService.getProfileCard('u18')).onHold).toBe(true)

    await mockDevTools.signInAs('admin')
    const queue = await adminService.listReports()
    expect(queue[0].report.status).toBe('open')
    expect(await rejection(adminService.updateReport(report.id, { status: 'resolved' }))).toBe('validation')
    await adminService.updateReport(report.id, { status: 'resolved', resolution: 'Spoke to the member. No further action.' })
    expect(getDb().users.find((user) => user.id === 'u18')?.status).toBe('active')

    await adminService.setUserStatus('u18', 'suspended', 'Repeated reports within one month.')
    getDb().sessionUserId = 'u18'
    expect(await rejection(bookingService.requestToJoin('ev-potluck-games'))).toBe('forbidden')
  })
})

import { describe, expect, it } from 'vitest'

import type { PrivateFeedback, TagReview } from '@/services/types'

import { approvalLimit, canApproveAnother, canTransition, needsReconfirmation, nextOnWaitlist, spotsLeft } from './bookings'
import { findCollusionGroups } from './collusion'
import { completesConnection, mutualPairs, repeatGroups } from './connections'
import { activeTipCategories, decayFactor, effectiveWeight, reviewerWeight, type FeedbackContext } from './private-feedback'
import { decideRefund } from './refunds'
import { buildReputation, computeReliability } from './reliability'
import { isReviewRevealed, reviewBlocker, topTags } from './reviews'
import { ageFromDateOfBirth, isAdult } from './time'

const NOW = new Date('2026-11-13T12:00:00.000Z')
const hoursFromNow = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000).toISOString()

describe('age', () => {
  it('counts whole years and blocks anyone under 18', () => {
    expect(ageFromDateOfBirth('2008-11-13', NOW)).toBe(18)
    expect(ageFromDateOfBirth('2008-11-14', NOW)).toBe(17)
    expect(isAdult('2008-11-13', NOW)).toBe(true)
    expect(isAdult('2008-11-14', NOW)).toBe(false)
  })
})

describe('reliability', () => {
  it('counts check-ins against closed-out bookings only', () => {
    expect(computeReliability(['attended', 'attended', 'no_show', 'cancelled', 'approved', 'declined'])).toEqual({
      showedUp: 2,
      outOf: 3,
    })
  })

  it('never shows a low score for a new member', () => {
    const tags = [{ tag: 'Punctual' as const, count: 1 }]
    expect(buildReputation([], [])).toEqual({ eventsAttended: 0, reliability: null, topTags: [], isNew: true })
    expect(buildReputation(['no_show', 'attended'], tags)).toEqual({ eventsAttended: 1, reliability: null, topTags: tags, isNew: true })
    expect(buildReputation(['attended'], [])).toMatchObject({ reliability: { showedUp: 1, outOf: 1 }, isNew: true })
    expect(buildReputation(['attended', 'no_show', 'attended'], [])).toMatchObject({
      reliability: { showedUp: 2, outOf: 3 },
      isNew: false,
    })
  })
})

describe('reviews', () => {
  const base = {
    reviewerId: 'a',
    subjectId: 'b',
    tags: ['Punctual'],
    eventEndsAt: hoursFromNow(-10),
    checkedInUserIds: new Set(['a', 'b']),
    existingReviews: [],
    now: NOW,
  }

  it('only lets people checked in at the same event review each other', () => {
    expect(reviewBlocker(base)).toBeNull()
    expect(reviewBlocker({ ...base, subjectId: 'a' })).toBe('self')
    expect(reviewBlocker({ ...base, checkedInUserIds: new Set(['b']) })).toBe('reviewer_not_checked_in')
    expect(reviewBlocker({ ...base, checkedInUserIds: new Set(['a']) })).toBe('subject_not_checked_in')
  })

  it('allows one review per pair, inside 72 hours, with up to three known tags', () => {
    expect(reviewBlocker({ ...base, existingReviews: [{ reviewerId: 'a', subjectId: 'b' }] })).toBe('already_reviewed')
    expect(reviewBlocker({ ...base, eventEndsAt: hoursFromNow(-73) })).toBe('window_closed')
    expect(reviewBlocker({ ...base, eventEndsAt: hoursFromNow(2) })).toBe('window_closed')
    expect(reviewBlocker({ ...base, tags: ['Punctual', 'Welcoming', 'Respectful', 'Fun energy'] })).toBe('too_many_tags')
    expect(reviewBlocker({ ...base, tags: ['Charming'] })).toBe('unknown_tag')
  })

  it('is double-blind until both submit or the window closes', () => {
    const mine = { eventId: 'e', reviewerId: 'a', subjectId: 'b' }
    const theirs = { eventId: 'e', reviewerId: 'b', subjectId: 'a' }
    expect(isReviewRevealed(mine, [mine], hoursFromNow(-10), NOW)).toBe(false)
    expect(isReviewRevealed(mine, [mine, theirs], hoursFromNow(-10), NOW)).toBe(true)
    expect(isReviewRevealed(mine, [mine], hoursFromNow(-80), NOW)).toBe(true)
  })

  it('ranks the three most common tags', () => {
    const reviews = [
      { tags: ['Punctual', 'Welcoming'] },
      { tags: ['Welcoming', 'Fun energy'] },
      { tags: ['Welcoming', 'Punctual', 'Respectful'] },
    ] as Pick<TagReview, 'tags'>[]
    expect(topTags(reviews)).toEqual([
      { tag: 'Welcoming', count: 3 },
      { tag: 'Punctual', count: 2 },
      { tag: 'Fun energy', count: 1 },
    ])
  })
})

describe('private feedback', () => {
  const trusted = { verified: true, accountAgeDays: 400, reliability: { showedUp: 11, outOf: 12 } }
  const context: FeedbackContext = { standingOf: () => trusted, priorReports: [], now: NOW }
  const feedback = (reviewerId: string, eventId: string, daysAgo = 5): PrivateFeedback => ({
    id: `${reviewerId}-${eventId}`,
    eventId,
    reviewerId,
    subjectId: 'subject',
    category: 'talked_over_people',
    note: null,
    submittedAt: hoursFromNow(-24 * daysAgo),
  })

  it('weights verified, long-standing, reliable reviewers more', () => {
    expect(reviewerWeight(trusted)).toBe(1.5)
    expect(reviewerWeight({ verified: false, accountAgeDays: 10, reliability: null })).toBe(0.7)
  })

  it('fades feedback older than 12 months', () => {
    expect(decayFactor(hoursFromNow(-24 * 30), NOW)).toBe(1)
    expect(decayFactor(hoursFromNow(-24 * 500), NOW)).toBe(0.5)
    expect(decayFactor(hoursFromNow(-24 * 900), NOW)).toBe(0.2)
  })

  it('needs three different people across two events', () => {
    expect(activeTipCategories([feedback('r1', 'e1'), feedback('r2', 'e1'), feedback('r3', 'e1')], context)).toEqual([])
    expect(activeTipCategories([feedback('r1', 'e1'), feedback('r2', 'e2')], context)).toEqual([])
    expect(activeTipCategories([feedback('r1', 'e1'), feedback('r1', 'e2'), feedback('r2', 'e2')], context)).toEqual([])
    expect(activeTipCategories([feedback('r1', 'e1'), feedback('r2', 'e1'), feedback('r3', 'e2')], context)).toEqual([
      'talked_over_people',
    ])
  })

  it('discounts feedback from someone the subject had already reported', () => {
    const guarded: FeedbackContext = {
      ...context,
      priorReports: [{ reporterId: 'subject', subjectId: 'r3', createdAt: hoursFromNow(-24 * 20) }],
    }
    expect(effectiveWeight(feedback('r3', 'e2'), guarded)).toBeLessThan(0.5)
    expect(activeTipCategories([feedback('r1', 'e1'), feedback('r2', 'e1'), feedback('r3', 'e2')], guarded)).toEqual([])
  })
})

describe('collusion', () => {
  const review = (reviewerId: string, subjectId: string, eventId: string) => ({ reviewerId, subjectId, eventId })

  it('flags a small group who only review each other', () => {
    const trio = ['e1', 'e2'].flatMap((eventId) => [
      review('a', 'b', eventId),
      review('a', 'c', eventId),
      review('b', 'a', eventId),
      review('b', 'c', eventId),
      review('c', 'a', eventId),
      review('c', 'b', eventId),
    ])
    const ordinary = [review('x', 'y', 'e1'), review('x', 'z', 'e2'), review('y', 'q', 'e3')]
    expect(findCollusionGroups([...trio, ...ordinary])).toEqual([
      { userIds: ['a', 'b', 'c'], reviewCount: 12, eventIds: ['e1', 'e2'] },
    ])
  })

  it('leaves a group alone once a member reviews someone outside it', () => {
    const reviews = ['e1', 'e2'].flatMap((eventId) => [
      review('a', 'b', eventId),
      review('a', 'b', `${eventId}x`),
      review('b', 'a', eventId),
      review('b', 'a', `${eventId}x`),
    ])
    expect(findCollusionGroups(reviews)).toHaveLength(1)
    expect(findCollusionGroups([...reviews, review('a', 'z', 'e9')])).toEqual([])
  })
})

describe('bookings', () => {
  it('lets a host approve up to 30% over capacity', () => {
    expect(approvalLimit(10)).toBe(13)
    expect(approvalLimit(25)).toBe(32)
    expect(canApproveAnother(10, 12)).toBe(true)
    expect(canApproveAnother(10, 13)).toBe(false)
    expect(spotsLeft(10, 13)).toBe(0)
  })

  it('asks "Still coming?" only in the last 24 hours', () => {
    const approved = { status: 'approved' as const, reconfirmedAt: null }
    expect(needsReconfirmation(approved, hoursFromNow(20), NOW)).toBe(true)
    expect(needsReconfirmation(approved, hoursFromNow(30), NOW)).toBe(false)
    expect(needsReconfirmation({ ...approved, reconfirmedAt: NOW.toISOString() }, hoursFromNow(20), NOW)).toBe(false)
    expect(needsReconfirmation({ status: 'requested', reconfirmedAt: null }, hoursFromNow(20), NOW)).toBe(false)
  })

  it('promotes the first person on the waitlist', () => {
    const waiting = [
      { id: 'late', status: 'waitlisted' as const, waitlistPosition: 2, createdAt: hoursFromNow(-5) },
      { id: 'first', status: 'waitlisted' as const, waitlistPosition: 1, createdAt: hoursFromNow(-2) },
      { id: 'in', status: 'approved' as const, waitlistPosition: null, createdAt: hoursFromNow(-9) },
    ]
    expect(nextOnWaitlist(waiting)?.id).toBe('first')
    expect(nextOnWaitlist([waiting[2]])).toBeNull()
  })

  it('only allows the moves each status permits', () => {
    expect(canTransition('requested', 'approved')).toBe(true)
    expect(canTransition('approved', 'confirmed')).toBe(true)
    expect(canTransition('pending_payment', 'paid')).toBe(true)
    expect(canTransition('declined', 'approved')).toBe(false)
    expect(canTransition('attended', 'no_show')).toBe(false)
  })
})

describe('refunds', () => {
  const paid = { amountPaidInr: 1800, bookingStatus: 'paid' as const, eventCancelledByKollide: false, now: NOW }

  it('follows the four refund rules', () => {
    expect(decideRefund({ ...paid, eventStartsAt: hoursFromNow(100) })).toMatchObject({ outcome: 'full', amountInr: 1800 })
    expect(decideRefund({ ...paid, eventStartsAt: hoursFromNow(40) })).toMatchObject({ outcome: 'credit', amountInr: 1800 })
    expect(decideRefund({ ...paid, bookingStatus: 'no_show', eventStartsAt: hoursFromNow(-5) })).toMatchObject({
      outcome: 'none',
      amountInr: 0,
    })
    expect(decideRefund({ ...paid, eventCancelledByKollide: true, eventStartsAt: hoursFromNow(10) })).toMatchObject({
      outcome: 'cancelled_by_kollide',
      amountInr: 1800,
    })
  })
})

describe('meet again', () => {
  const vote = (reviewerId: string, subjectId: string, wantsToMeetAgain = true, eventId = 'e1') => ({
    eventId,
    reviewerId,
    subjectId,
    wantsToMeetAgain,
  })

  it('connects two people only when both say yes', () => {
    expect(mutualPairs([vote('a', 'b'), vote('b', 'a', false)])).toEqual([])
    expect(mutualPairs([vote('a', 'b'), vote('b', 'a')])).toEqual([{ eventId: 'e1', userIds: ['a', 'b'] }])
    expect(completesConnection(vote('b', 'a'), [vote('a', 'b')])).toBe(true)
    expect(completesConnection(vote('b', 'a'), [vote('a', 'b', true, 'e2')])).toBe(false)
  })

  it('suggests a repeat when three or more all say yes to each other', () => {
    const all = (people: string[]) => people.flatMap((a) => people.filter((b) => b !== a).map((b) => vote(a, b)))
    expect(repeatGroups(all(['a', 'b', 'c', 'd']))).toEqual([{ eventId: 'e1', userIds: ['a', 'b', 'c', 'd'] }])
    expect(repeatGroups([...all(['a', 'b', 'c']), vote('c', 'd'), vote('d', 'c')])).toEqual([
      { eventId: 'e1', userIds: ['a', 'b', 'c'] },
    ])
    expect(repeatGroups([vote('a', 'b'), vote('b', 'a')])).toEqual([])
  })
})

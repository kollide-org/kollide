import { completesConnection, repeatGroups } from '@/domain/connections'
import { isReviewRevealed, isReviewWindowOpen, reviewBlocker, reviewWindow, type ReviewBlocker } from '@/domain/reviews'

import { ServiceError } from '../errors'
import type { ReviewService } from '../interfaces'
import type { FeedbackForm, ID, SafetyReport, TagReview } from '../types'

import { getDb, saveDb, type Db, type EventRecord } from './db'
import { notify, notifyAdmins } from './notify'
import { copy, invalid, latency, newId, notFound, now, nowIso, requireUser } from './runtime'
import { personPreview } from './views'

const BLOCKER_MESSAGES: Record<ReviewBlocker, string> = {
  self: 'You cannot review yourself.',
  reviewer_not_checked_in: 'Feedback is open to people who checked in at this event.',
  subject_not_checked_in: 'You can only review people who checked in at the same event.',
  window_closed: 'Feedback for this event has closed. It stays open for 72 hours.',
  already_reviewed: 'You have already shared feedback about this person for this event.',
  too_many_tags: 'Choose up to three tags.',
  unknown_tag: 'Choose tags from the list.',
}

function eventOf(db: Db, eventId: ID): EventRecord {
  const event = db.events.find((candidate) => candidate.id === eventId)
  if (!event) throw notFound('event')
  return event
}

function checkedInIds(db: Db, eventId: ID): Set<ID> {
  return new Set(db.checkIns.filter((checkIn) => checkIn.eventId === eventId).map((checkIn) => checkIn.userId))
}

function buildForm(db: Db, event: EventRecord, viewerId: ID): FeedbackForm {
  const window = reviewWindow(event.endsAt)
  const reviewed = new Set(
    db.tagReviews.filter((review) => review.eventId === event.id && review.reviewerId === viewerId).map((review) => review.subjectId),
  )
  const hostIsSomeoneElse = Boolean(event.hostId && event.hostId !== viewerId)
  return {
    eventId: event.id,
    eventTitle: event.title,
    eventCoverUrl: event.coverUrl,
    opensAt: window.opensAt,
    closesAt: window.closesAt,
    people: [...checkedInIds(db, event.id)]
      .filter((userId) => userId !== viewerId)
      .map((userId) => ({ ...personPreview(db, userId), reviewed: reviewed.has(userId) }))
      .sort((a, b) => a.firstName.localeCompare(b.firstName)),
    host: hostIsSomeoneElse ? personPreview(db, event.hostId!) : null,
    hostRated: !hostIsSomeoneElse || db.hostRatings.some((rating) => rating.eventId === event.id && rating.raterId === viewerId),
  }
}

function revealed(db: Db, at: Date): TagReview[] {
  return db.tagReviews.filter((review) => isReviewRevealed(review, db.tagReviews, eventOf(db, review.eventId).endsAt, at))
}

export const mockReviewService: ReviewService = {
  async listPendingFeedback() {
    await latency()
    const db = getDb()
    const user = requireUser(db)
    const at = now()
    return copy(
      db.checkIns
        .filter((checkIn) => checkIn.userId === user.id)
        .map((checkIn) => eventOf(db, checkIn.eventId))
        .filter((event) => isReviewWindowOpen(event.endsAt, at))
        .map((event) => buildForm(db, event, user.id))
        .filter((form) => form.people.some((person) => !person.reviewed) || !form.hostRated)
        .sort((a, b) => a.closesAt.localeCompare(b.closesAt)),
    )
  },

  async getFeedbackForm(eventId) {
    await latency()
    const db = getDb()
    const user = requireUser(db)
    const event = eventOf(db, eventId)
    if (!checkedInIds(db, eventId).has(user.id)) {
      throw new ServiceError('forbidden', BLOCKER_MESSAGES.reviewer_not_checked_in)
    }
    return copy(buildForm(db, event, user.id))
  },

  async submitReview(input) {
    await latency(0.8)
    const db = getDb()
    const user = requireUser(db)
    const event = eventOf(db, input.eventId)
    const existing = db.tagReviews.filter((review) => review.eventId === event.id)
    const blocker = reviewBlocker({
      reviewerId: user.id,
      subjectId: input.subjectId,
      tags: input.tags,
      eventEndsAt: event.endsAt,
      checkedInUserIds: checkedInIds(db, event.id),
      existingReviews: existing,
      now: now(),
    })
    if (blocker) {
      const code = blocker === 'already_reviewed' ? 'conflict' : blocker.endsWith('checked_in') ? 'forbidden' : 'validation'
      throw new ServiceError(code, BLOCKER_MESSAGES[blocker])
    }

    const review: TagReview = {
      id: newId('rv'),
      eventId: event.id,
      reviewerId: user.id,
      subjectId: input.subjectId,
      tags: [...new Set(input.tags)],
      wantsToMeetAgain: input.wantsToMeetAgain,
      submittedAt: nowIso(),
    }
    const connected = completesConnection(review, existing)
    db.tagReviews.push(review)

    if (input.privateFeedback) {
      db.privateFeedback.push({
        id: newId('pf'),
        eventId: event.id,
        reviewerId: user.id,
        subjectId: input.subjectId,
        category: input.privateFeedback.category,
        note: input.privateFeedback.note?.trim() || null,
        submittedAt: review.submittedAt,
      })
    }

    if (connected) {
      const pair = [user.id, input.subjectId].sort() as [ID, ID]
      db.connections.push({ id: newId('cn'), userIds: pair, eventId: event.id, createdAt: review.submittedAt })
      const me = personPreview(db, user.id).firstName
      const them = personPreview(db, input.subjectId).firstName
      notify(db, input.subjectId, 'connection', `You and ${me} want to meet again`, `From ${event.title}.`, '/app/connections')
      notify(db, user.id, 'connection', `You and ${them} want to meet again`, `From ${event.title}.`, '/app/connections')
    }
    saveDb()
    return copy({ review, connected })
  },

  async submitHostRating(input) {
    await latency(0.8)
    const db = getDb()
    const user = requireUser(db)
    const event = eventOf(db, input.eventId)
    if (!event.hostId || event.hostId === user.id) throw invalid('There is no host to rate for this event.')
    if (!checkedInIds(db, event.id).has(user.id)) throw new ServiceError('forbidden', BLOCKER_MESSAGES.reviewer_not_checked_in)
    if (!isReviewWindowOpen(event.endsAt, now())) throw invalid(BLOCKER_MESSAGES.window_closed)
    if (db.hostRatings.some((rating) => rating.eventId === event.id && rating.raterId === user.id)) {
      throw new ServiceError('conflict', 'You have already rated the host for this event.')
    }
    const rating = {
      id: newId('hr'),
      eventId: event.id,
      raterId: user.id,
      hostId: event.hostId,
      asDescribed: input.asDescribed,
      feltSafe: input.feltSafe,
      wellOrganised: input.wellOrganised,
      submittedAt: nowIso(),
    }
    db.hostRatings.push(rating)
    saveDb()
    return copy(rating)
  },

  async submitSafetyReport(input) {
    await latency()
    const db = getDb()
    const user = requireUser(db)
    if (input.details.trim().length < 10) throw invalid('Tell us what happened, in a sentence or two.')
    if (input.subjectType === 'user' && input.subjectId === user.id) throw invalid('You cannot report yourself.')
    const exists =
      input.subjectType === 'user'
        ? db.users.some((candidate) => candidate.id === input.subjectId)
        : db.events.some((candidate) => candidate.id === input.subjectId)
    if (!exists) throw notFound(input.subjectType === 'user' ? 'profile' : 'event')

    const report: SafetyReport = {
      id: newId('sr'),
      reporterId: user.id,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      eventId: input.eventId ?? null,
      category: input.category,
      details: input.details.trim(),
      status: 'open',
      resolution: null,
      createdAt: nowIso(),
      resolvedAt: null,
    }
    db.safetyReports.push(report)

    if (input.subjectType === 'user') {
      // The reported person is put on hold until an admin has looked.
      const subject = db.users.find((candidate) => candidate.id === input.subjectId)
      if (subject && subject.status === 'active' && subject.role !== 'admin') subject.status = 'on_hold'
    }
    notifyAdmins(db, 'account', 'A new safety report needs review', 'Open the reports queue to look at it.', '/admin/reports')
    saveDb()
    return copy(report)
  },

  async listConnections() {
    await latency()
    const db = getDb()
    const user = requireUser(db)
    return copy(
      db.connections
        .filter((connection) => connection.userIds.includes(user.id))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((connection) => ({
          ...connection,
          person: personPreview(db, connection.userIds.find((userId) => userId !== user.id)!),
          eventTitle: eventOf(db, connection.eventId).title,
        })),
    )
  },

  async listRepeatSuggestions() {
    await latency()
    const db = getDb()
    const user = requireUser(db)
    return copy(
      repeatGroups(revealed(db, now()))
        .filter((group) => group.userIds.includes(user.id))
        .map((group) => ({
          eventId: group.eventId,
          eventTitle: eventOf(db, group.eventId).title,
          people: group.userIds.filter((userId) => userId !== user.id).map((userId) => personPreview(db, userId)),
        })),
    )
  },
}

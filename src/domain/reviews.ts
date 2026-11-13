import { MAX_TAGS_PER_REVIEW, POSITIVE_TAGS } from '@/services/types'
import type { ID, ISODateTime, PositiveTag, TagCount, TagReview } from '@/services/types'

import { HOUR_MS } from './time'

/** Feedback opens when the event ends and stays open for 72 hours. */
export const REVIEW_WINDOW_HOURS = 72

export interface ReviewWindow {
  opensAt: ISODateTime
  closesAt: ISODateTime
}

export function reviewWindow(eventEndsAt: ISODateTime): ReviewWindow {
  const opens = new Date(eventEndsAt).getTime()
  return {
    opensAt: new Date(opens).toISOString(),
    closesAt: new Date(opens + REVIEW_WINDOW_HOURS * HOUR_MS).toISOString(),
  }
}

export function isReviewWindowOpen(eventEndsAt: ISODateTime, now: Date): boolean {
  const { opensAt, closesAt } = reviewWindow(eventEndsAt)
  const time = now.getTime()
  return time >= new Date(opensAt).getTime() && time < new Date(closesAt).getTime()
}

export type ReviewBlocker =
  | 'self'
  | 'reviewer_not_checked_in'
  | 'subject_not_checked_in'
  | 'window_closed'
  | 'already_reviewed'
  | 'too_many_tags'
  | 'unknown_tag'

interface ReviewAttempt {
  reviewerId: ID
  subjectId: ID
  tags: readonly string[]
  eventEndsAt: ISODateTime
  /** Everyone checked in at this event. */
  checkedInUserIds: ReadonlySet<ID>
  /** Reviews already submitted for this event. */
  existingReviews: readonly Pick<TagReview, 'reviewerId' | 'subjectId'>[]
  now: Date
}

/**
 * Why a review may not be submitted, or `null` if it may.
 * Only people checked in at the same event can review each other, once each,
 * inside the 72-hour window, with at most three tags from the fixed list.
 */
export function reviewBlocker(attempt: ReviewAttempt): ReviewBlocker | null {
  const { reviewerId, subjectId, tags, eventEndsAt, checkedInUserIds, existingReviews, now } = attempt
  if (reviewerId === subjectId) return 'self'
  if (!checkedInUserIds.has(reviewerId)) return 'reviewer_not_checked_in'
  if (!checkedInUserIds.has(subjectId)) return 'subject_not_checked_in'
  if (!isReviewWindowOpen(eventEndsAt, now)) return 'window_closed'
  if (existingReviews.some((review) => review.reviewerId === reviewerId && review.subjectId === subjectId)) {
    return 'already_reviewed'
  }
  if (tags.length > MAX_TAGS_PER_REVIEW) return 'too_many_tags'
  if (tags.some((tag) => !(POSITIVE_TAGS as readonly string[]).includes(tag))) return 'unknown_tag'
  return null
}

/**
 * Double-blind: a review is revealed only when the other person has also
 * submitted theirs for the same event, or when the window has closed.
 */
export function isReviewRevealed(
  review: Pick<TagReview, 'eventId' | 'reviewerId' | 'subjectId'>,
  allReviews: readonly Pick<TagReview, 'eventId' | 'reviewerId' | 'subjectId'>[],
  eventEndsAt: ISODateTime,
  now: Date,
): boolean {
  if (now.getTime() >= new Date(reviewWindow(eventEndsAt).closesAt).getTime()) return true
  return allReviews.some(
    (other) =>
      other.eventId === review.eventId &&
      other.reviewerId === review.subjectId &&
      other.subjectId === review.reviewerId,
  )
}

/** The tags a person has received most often, from revealed reviews only. */
export function topTags(revealedReviewsAboutPerson: readonly Pick<TagReview, 'tags'>[], limit = 3): TagCount[] {
  const counts = new Map<PositiveTag, number>()
  for (const review of revealedReviewsAboutPerson) {
    for (const tag of review.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || POSITIVE_TAGS.indexOf(a.tag) - POSITIVE_TAGS.indexOf(b.tag))
    .slice(0, limit)
}

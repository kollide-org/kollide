import type { ID, TagReview } from '@/services/types'

export const COLLUSION_MAX_GROUP_SIZE = 4
export const COLLUSION_MIN_REVIEWS_EACH = 3
export const COLLUSION_MIN_EVENTS = 2

export interface CollusionGroup {
  userIds: ID[]
  reviewCount: number
  eventIds: ID[]
}

/**
 * Flags small groups who only ever rate each other. A group is flagged when
 * it has at most four people, every review any member has given went to
 * another member, each member has given several, and it spans two or more events.
 * A flag is a prompt for an admin to look, not a verdict.
 */
export function findCollusionGroups(
  reviews: readonly Pick<TagReview, 'reviewerId' | 'subjectId' | 'eventId'>[],
): CollusionGroup[] {
  const given = new Map<ID, Pick<TagReview, 'reviewerId' | 'subjectId' | 'eventId'>[]>()
  for (const review of reviews) given.set(review.reviewerId, [...(given.get(review.reviewerId) ?? []), review])

  const groups = new Map<string, CollusionGroup>()
  for (const [userId, own] of given) {
    const members = new Set<ID>([userId, ...own.map((review) => review.subjectId)])
    if (members.size < 2 || members.size > COLLUSION_MAX_GROUP_SIZE) continue

    let closed = true
    let reviewCount = 0
    const eventIds = new Set<ID>()
    for (const member of members) {
      const memberReviews = given.get(member) ?? []
      if (memberReviews.length < COLLUSION_MIN_REVIEWS_EACH || memberReviews.some((r) => !members.has(r.subjectId))) {
        closed = false
        break
      }
      reviewCount += memberReviews.length
      for (const review of memberReviews) eventIds.add(review.eventId)
    }
    if (!closed || eventIds.size < COLLUSION_MIN_EVENTS) continue

    const userIds = [...members].sort()
    groups.set(userIds.join('|'), { userIds, reviewCount, eventIds: [...eventIds].sort() })
  }
  return [...groups.values()]
}

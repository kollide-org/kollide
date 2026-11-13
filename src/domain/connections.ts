import type { ID, TagReview } from '@/services/types'

type MeetAgainVote = Pick<TagReview, 'eventId' | 'reviewerId' | 'subjectId' | 'wantsToMeetAgain'>

export interface MutualPair {
  eventId: ID
  userIds: [ID, ID]
}

/** Two people connect when both said yes to meeting again after the same event. */
export function mutualPairs(reviews: readonly MeetAgainVote[]): MutualPair[] {
  const yes = new Set<string>()
  for (const review of reviews) {
    if (review.wantsToMeetAgain) yes.add(`${review.eventId}|${review.reviewerId}|${review.subjectId}`)
  }
  const pairs: MutualPair[] = []
  for (const key of yes) {
    const [eventId, a, b] = key.split('|')
    if (a < b && yes.has(`${eventId}|${b}|${a}`)) pairs.push({ eventId, userIds: [a, b] })
  }
  return pairs
}

/** True when this review completes a mutual yes. */
export function completesConnection(review: MeetAgainVote, earlierReviews: readonly MeetAgainVote[]): boolean {
  return (
    review.wantsToMeetAgain &&
    earlierReviews.some(
      (other) =>
        other.eventId === review.eventId &&
        other.reviewerId === review.subjectId &&
        other.subjectId === review.reviewerId &&
        other.wantsToMeetAgain,
    )
  )
}

export interface RepeatGroup {
  eventId: ID
  userIds: ID[]
}

/**
 * Groups of three or more people from one event who all said yes to each
 * other. These are the largest such groups, so a group of four is suggested
 * once, not as four overlapping trios.
 */
export function repeatGroups(reviews: readonly MeetAgainVote[]): RepeatGroup[] {
  const byEvent = new Map<ID, Map<ID, Set<ID>>>()
  for (const { eventId, userIds } of mutualPairs(reviews)) {
    const graph = byEvent.get(eventId) ?? new Map<ID, Set<ID>>()
    byEvent.set(eventId, graph)
    const [a, b] = userIds
    graph.set(a, (graph.get(a) ?? new Set()).add(b))
    graph.set(b, (graph.get(b) ?? new Set()).add(a))
  }

  const groups: RepeatGroup[] = []
  for (const [eventId, graph] of byEvent) {
    // Bron–Kerbosch: every maximal set of people who are all connected to each other.
    const expand = (current: ID[], candidates: ID[], excluded: ID[]) => {
      if (candidates.length === 0 && excluded.length === 0) {
        if (current.length >= 3) groups.push({ eventId, userIds: [...current].sort() })
        return
      }
      let remaining = [...candidates]
      let seen = [...excluded]
      for (const person of candidates) {
        const neighbours = graph.get(person) ?? new Set<ID>()
        expand(
          [...current, person],
          remaining.filter((other) => neighbours.has(other)),
          seen.filter((other) => neighbours.has(other)),
        )
        remaining = remaining.filter((other) => other !== person)
        seen = [...seen, person]
      }
    }
    expand([], [...graph.keys()], [])
  }
  return groups
}

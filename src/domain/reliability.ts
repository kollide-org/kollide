import type { BookingStatus, Reliability, Reputation, TagCount } from '@/services/types'

/**
 * A person is "New to Kollide" until this many of their bookings have been
 * closed out. Until then a score is shown only if it is perfect, so nobody
 * starts out with a low one on display.
 */
export const MIN_EVENTS_FOR_RELIABILITY = 3

/**
 * "Shows up: X of Y". Counted from bookings that were closed out after the
 * event: checked in counts as showing up, a no-show does not.
 * Cancelling in advance is not held against anyone.
 */
export function computeReliability(statuses: readonly BookingStatus[]): Reliability {
  let showedUp = 0
  let outOf = 0
  for (const status of statuses) {
    if (status === 'attended') {
      showedUp += 1
      outOf += 1
    } else if (status === 'no_show') {
      outOf += 1
    }
  }
  return { showedUp, outOf }
}

export function buildReputation(statuses: readonly BookingStatus[], topTags: TagCount[]): Reputation {
  const reliability = computeReliability(statuses)
  const isNew = reliability.outOf < MIN_EVENTS_FOR_RELIABILITY
  // A new member's score is shown only while it is perfect, so the first
  // check-in is rewarded straight away and an early miss is never on display.
  const showScore = !isNew || (reliability.outOf > 0 && reliability.showedUp === reliability.outOf)
  return {
    eventsAttended: reliability.showedUp,
    reliability: showScore ? reliability : null,
    topTags,
    isNew,
  }
}

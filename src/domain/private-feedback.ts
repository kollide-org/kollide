import type { ID, ISODateTime, PrivateFeedback, PrivateFeedbackCategory, Reliability } from '@/services/types'

import { daysBetween } from './time'

/**
 * Private "something felt off" feedback only counts once enough different
 * people, across enough events, have said the same thing. These are the limits.
 */
export const TIP_MIN_REVIEWERS = 3
export const TIP_MIN_EVENTS = 2
/** The weighted total the reports must also reach. Three ordinary reviewers clear it. */
export const TIP_MIN_WEIGHT = 2.4
/** How much a report counts when its author had earlier been reported by the subject. */
export const RETALIATION_DISCOUNT = 0.25
/** A report with less weight than this does not count as one of the "different people". */
export const MIN_COUNTED_WEIGHT = 0.5

export interface ReviewerStanding {
  verified: boolean
  accountAgeDays: number
  /** `null` while the reviewer is new. */
  reliability: Reliability | null
}

/**
 * Verified, long-standing and reliable reviewers count more.
 * The result is between 0.7 and 1.5.
 */
export function reviewerWeight(standing: ReviewerStanding): number {
  let weight = 0.7
  if (standing.verified) weight += 0.3
  if (standing.accountAgeDays >= 180) weight += 0.2
  else if (standing.accountAgeDays >= 60) weight += 0.1
  if (standing.reliability && standing.reliability.outOf > 0) {
    const rate = standing.reliability.showedUp / standing.reliability.outOf
    if (rate >= 0.9) weight += 0.3
    else if (rate >= 0.75) weight += 0.15
  }
  return Math.round(weight * 100) / 100
}

/** The last 12 months count most. Older feedback fades, and after two years barely counts. */
export function decayFactor(submittedAt: ISODateTime, now: Date): number {
  const ageDays = daysBetween(submittedAt, now)
  if (ageDays <= 365) return 1
  if (ageDays <= 730) return 0.5
  return 0.2
}

export interface PriorReport {
  reporterId: ID
  subjectId: ID
  createdAt: ISODateTime
}

/**
 * Retaliation guard. If A reported B, then B's later negative feedback about A
 * is discounted. `feedback.subjectId` is A and `feedback.reviewerId` is B.
 */
export function isRetaliation(
  feedback: Pick<PrivateFeedback, 'reviewerId' | 'subjectId' | 'submittedAt'>,
  reports: readonly PriorReport[],
): boolean {
  return reports.some(
    (report) =>
      report.reporterId === feedback.subjectId &&
      report.subjectId === feedback.reviewerId &&
      new Date(report.createdAt).getTime() <= new Date(feedback.submittedAt).getTime(),
  )
}

export interface FeedbackContext {
  standingOf: (reviewerId: ID) => ReviewerStanding
  /** Earlier reports and negative feedback, used by the retaliation guard. */
  priorReports: readonly PriorReport[]
  now: Date
}

/** How much one piece of feedback counts, after weighting, decay and the retaliation guard. */
export function effectiveWeight(feedback: PrivateFeedback, context: FeedbackContext): number {
  let weight = reviewerWeight(context.standingOf(feedback.reviewerId)) * decayFactor(feedback.submittedAt, context.now)
  if (isRetaliation(feedback, context.priorReports)) weight *= RETALIATION_DISCOUNT
  return Math.round(weight * 100) / 100
}

/**
 * The feedback categories that have crossed the threshold for one person:
 * three or more different people, across two or more events, said the same thing.
 */
export function activeTipCategories(
  feedbackAboutPerson: readonly PrivateFeedback[],
  context: FeedbackContext,
): PrivateFeedbackCategory[] {
  const byCategory = new Map<PrivateFeedbackCategory, PrivateFeedback[]>()
  for (const item of feedbackAboutPerson) {
    byCategory.set(item.category, [...(byCategory.get(item.category) ?? []), item])
  }

  const active: PrivateFeedbackCategory[] = []
  for (const [category, items] of byCategory) {
    if (category === 'other') continue
    // A reviewer counts once, at the highest weight any of their reports reached.
    const weightByReviewer = new Map<ID, number>()
    const events = new Set<ID>()
    for (const item of items) {
      const weight = effectiveWeight(item, context)
      if (weight < MIN_COUNTED_WEIGHT) continue
      weightByReviewer.set(item.reviewerId, Math.max(weightByReviewer.get(item.reviewerId) ?? 0, weight))
      events.add(item.eventId)
    }
    const total = [...weightByReviewer.values()].reduce((sum, weight) => sum + weight, 0)
    if (weightByReviewer.size >= TIP_MIN_REVIEWERS && events.size >= TIP_MIN_EVENTS && total >= TIP_MIN_WEIGHT) {
      active.push(category)
    }
  }
  return active
}

/** The words a person sees on their own profile. Kind, specific and anonymous. */
export const TIP_MESSAGES: Record<Exclude<PrivateFeedbackCategory, 'other'>, string> = {
  ran_late: 'A few people noticed late arrivals. Leaving ten minutes earlier makes the start easier for everyone.',
  was_rude: 'A few people felt some comments landed harshly. A little extra warmth goes a long way with new faces.',
  talked_over_people: 'A few people felt conversations were one-sided. Try asking more questions.',
}

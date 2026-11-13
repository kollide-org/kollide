import type {
  ConnectionWithPerson,
  FeedbackForm,
  HostRating,
  HostRatingInput,
  ID,
  RepeatSuggestion,
  ReviewInput,
  SafetyReport,
  SafetyReportInput,
  TagReview,
} from '../types'

export interface ReviewService {
  /** Events whose 72-hour window is open and where the viewer still owes feedback. */
  listPendingFeedback(): Promise<FeedbackForm[]>
  getFeedbackForm(eventId: ID): Promise<FeedbackForm>
  /**
   * One review per person, per other person, per event. Both must have checked in.
   * Returns `connected: true` when the other person had already said yes to meeting again.
   */
  submitReview(input: ReviewInput): Promise<{ review: TagReview; connected: boolean }>
  submitHostRating(input: HostRatingInput): Promise<HostRating>
  /** Goes to the admin queue. A report about a person puts them on hold. */
  submitSafetyReport(input: SafetyReportInput): Promise<SafetyReport>
  listConnections(): Promise<ConnectionWithPerson[]>
  /** Groups of three or more who all said yes to each other. */
  listRepeatSuggestions(): Promise<RepeatSuggestion[]>
}

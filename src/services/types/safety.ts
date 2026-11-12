export type ReportSubject = 'user' | 'event' | 'squad'
export type ReportReason = 'harassment' | 'unsafe' | 'fake_profile' | 'inappropriate_content' | 'spam' | 'other'

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'harassment', label: 'Harassment or unwelcome behaviour' },
  { value: 'unsafe', label: 'I felt unsafe' },
  { value: 'fake_profile', label: 'Fake or misleading profile' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'spam', label: 'Spam' },
  { value: 'other', label: 'Something else' },
]

/** A gentle, anonymous note about the signed-in person. Never says who or how many. */
export interface Tip {
  id: string
  message: string
  createdAt: string
}

export interface Appeal {
  id: string
  kind: 'tip' | 'account_status'
  tipId: string | null
  message: string
  status: 'open' | 'upheld' | 'overturned'
  dueAt: string
  adminNote: string | null
  createdAt: string
}

export interface SafetyService {
  /** Works even when your own account is on hold. The result never says whether anyone was put on hold. */
  report(subject: ReportSubject, subjectId: string, reason: ReportReason, details?: string): Promise<void>
  myTips(): Promise<Tip[]>
  myAppeals(): Promise<Appeal[]>
  createAppeal(kind: 'tip' | 'account_status', message: string, tipId?: string): Promise<void>
}

import type { PrivateFeedbackCategory, SafetyReportCategory } from '@/services'

export const PRIVATE_FEEDBACK_LABELS: Record<PrivateFeedbackCategory, string> = {
  ran_late: 'Ran late',
  was_rude: 'Was rude',
  talked_over_people: 'Talked over people',
  other: 'Something else',
}

export const SAFETY_REPORT_LABELS: Record<SafetyReportCategory, string> = {
  harassment: 'Harassment',
  inappropriate_behaviour: 'Inappropriate behaviour',
  felt_unsafe: 'I felt unsafe',
  fake_profile: 'A fake profile',
  other: 'Something else',
}

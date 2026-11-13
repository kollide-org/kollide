import type { OnboardingDraft } from '@/features/onboarding/draft'

export interface StepProps {
  draft: OnboardingDraft
  update: (patch: Partial<OnboardingDraft>) => void
  /** Moves to the next step. */
  onNext: () => void
}

import type { OnboardingDraft } from './draft'
import {
  ageFor,
  areaSchema,
  consentSchema,
  genderSchema,
  interestsSchema,
  isOldEnough,
  languagesSchema,
  nameSchema,
  phoneSchema,
  photosSchema,
  promptsSchema,
} from './schemas'

export interface OnboardingStep {
  id: string
  /** True once the step has what it needs. Later steps stay locked until then. */
  isComplete: (draft: OnboardingDraft) => boolean
  optional?: boolean
}

/**
 * The steps, in order. Age comes early, so that nobody under 18 is asked for
 * photos or a phone number before being told Kollide is not for them yet.
 */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  { id: 'name', isComplete: (draft) => nameSchema.safeParse(draft).success },
  { id: 'birthday', isComplete: (draft) => isOldEnough(ageFor(draft)) },
  { id: 'gender', isComplete: (draft) => genderSchema.safeParse(draft.gender).success },
  { id: 'area', isComplete: (draft) => areaSchema.safeParse(draft.area).success },
  { id: 'photos', isComplete: (draft) => photosSchema.safeParse(draft.photos).success },
  { id: 'interests', isComplete: (draft) => interestsSchema.safeParse(draft.interests).success },
  { id: 'languages', isComplete: (draft) => languagesSchema.safeParse(draft.languages).success },
  { id: 'prompts', isComplete: (draft) => promptsSchema.safeParse(draft.prompts).success },
  { id: 'phone', isComplete: (draft) => phoneSchema.safeParse(draft).success },
  { id: 'selfie', isComplete: () => true, optional: true },
  { id: 'consent', isComplete: (draft) => consentSchema.safeParse(draft).success },
]

export const FIRST_STEP = ONBOARDING_STEPS[0].id

export function stepIndex(id: string | undefined): number {
  return ONBOARDING_STEPS.findIndex((step) => step.id === id)
}

/** The earliest step that still needs something. */
export function firstIncompleteStep(draft: OnboardingDraft): string {
  return (ONBOARDING_STEPS.find((step) => !step.optional && !step.isComplete(draft)) ?? ONBOARDING_STEPS.at(-1)!).id
}

/** A step can be opened only when every required step before it is done. */
export function canOpenStep(id: string, draft: OnboardingDraft): boolean {
  const index = stepIndex(id)
  return index >= 0 && ONBOARDING_STEPS.slice(0, index).every((step) => step.optional || step.isComplete(draft))
}

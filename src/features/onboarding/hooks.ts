import { useMutation, useQueryClient } from '@tanstack/react-query'

import { SESSION_QUERY_KEY } from '@/app/providers/session-context'
import { profileKeys } from '@/features/profile/queries'
import { authService, profileService, type OnboardingInput } from '@/services'

import { clearOnboardingDraft, type OnboardingDraft } from './draft'
import { toIsoDate } from './schemas'
import { tidyPrompts } from '@/domain/prompts'

function toInput(draft: OnboardingDraft): OnboardingInput {
  const firstName = draft.firstName.trim()
  return {
    firstName,
    dateOfBirth: toIsoDate(draft.birthYear, draft.birthMonth, draft.birthDay),
    gender: draft.gender!,
    city: draft.city,
    area: draft.area!,
    zone: draft.zone ?? undefined,
    interests: draft.interests,
    languages: draft.languages,
    prompts: tidyPrompts(draft.prompts),
    photos: draft.photos.map((url, index) => ({ url, alt: `Photo ${index + 1} of ${firstName}` })),
    phone: `+91 ${draft.phone.replace(/[\s-]/g, '')}`,
    acceptedConduct: draft.acceptedConduct,
    acceptedPrivacy: draft.acceptedPrivacy,
  }
}

/** Creates the profile, sends the selfie if there is one, and refreshes the session. */
export function useCompleteOnboarding(userId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (draft: OnboardingDraft) => {
      await profileService.completeOnboarding(toInput(draft))
      if (draft.selfie) await profileService.submitVerificationSelfie()
      return authService.getSession()
    },
    onSuccess: (session) => {
      queryClient.setQueryData(SESSION_QUERY_KEY, session)
      void queryClient.invalidateQueries({ queryKey: profileKeys.all })
      clearOnboardingDraft(userId)
    },
  })
}

/** Sends a selfie for the verified badge. The badge shows "pending review" at once. */
export function useSubmitSelfie(userId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => profileService.submitVerificationSelfie(),
    onSuccess: async () => {
      queryClient.setQueryData(SESSION_QUERY_KEY, await authService.getSession())
      await queryClient.invalidateQueries({ queryKey: profileKeys.card(userId) })
    },
  })
}

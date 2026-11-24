import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'

import { SESSION_QUERY_KEY } from '@/app/providers/session-context'
import { profileService, type ProfilePatch } from '@/services'

export const profileKeys = {
  all: ['profiles'] as const,
  card: (userId: string) => ['profiles', 'card', userId] as const,
  myTips: ['profiles', 'my-tips'] as const,
  myAppeals: ['profiles', 'my-appeals'] as const,
  mine: ['profiles', 'mine'] as const,
}

/** The profile card for one member, with reputation worked out by the service. */
export function useProfileCard(userId: string, enabled = true) {
  return useQuery({ queryKey: profileKeys.card(userId), queryFn: () => profileService.getProfileCard(userId), enabled })
}

export function useProfileCards(userIds: readonly string[], enabled = true) {
  return useQueries({
    queries: userIds.map((userId) => ({
      queryKey: profileKeys.card(userId),
      queryFn: () => profileService.getProfileCard(userId),
      enabled,
    })),
  })
}

/** Gentle tips for the signed-in member. Nobody else ever sees them. */
export function useMyTips(enabled = true) {
  return useQuery({ queryKey: profileKeys.myTips, queryFn: () => profileService.getMyTips(), enabled })
}

export function useMyAppeals(enabled = true) {
  return useQuery({ queryKey: profileKeys.myAppeals, queryFn: () => profileService.getMyAppeals(), enabled })
}

/** Disputes a tip or an account hold. It shows as "under review" straight away. */
export function useSubmitAppeal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Parameters<typeof profileService.submitAppeal>[0]) => profileService.submitAppeal(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.myTips })
      void queryClient.invalidateQueries({ queryKey: profileKeys.myAppeals })
    },
  })
}

/** The signed-in member's own profile, as stored, for editing. */
export function useMyProfile() {
  return useQuery({ queryKey: profileKeys.mine, queryFn: () => profileService.getMyProfile() })
}

/** Saves profile changes and refreshes everything that shows the profile. */
export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: ProfilePatch) => profileService.updateProfile(patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.all })
      void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
    },
  })
}

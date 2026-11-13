import { useQueries, useQuery } from '@tanstack/react-query'

import { profileService } from '@/services'

export const profileKeys = {
  all: ['profiles'] as const,
  card: (userId: string) => ['profiles', 'card', userId] as const,
  myTips: ['profiles', 'my-tips'] as const,
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

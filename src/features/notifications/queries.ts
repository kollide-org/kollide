import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { notificationService } from '@/services'

export const notificationKeys = { all: ['notifications'] as const }

export function useNotifications(enabled = true) {
  return useQuery({ queryKey: notificationKeys.all, queryFn: () => notificationService.listNotifications(), enabled })
}

export function useMarkAllRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  })
}

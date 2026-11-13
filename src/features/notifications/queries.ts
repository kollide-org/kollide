import { useQuery } from '@tanstack/react-query'

import { notificationService } from '@/services'

export const notificationKeys = {
  all: ['notifications'] as const,
}

export function useNotifications(enabled = true) {
  return useQuery({ queryKey: notificationKeys.all, queryFn: () => notificationService.listNotifications(), enabled })
}

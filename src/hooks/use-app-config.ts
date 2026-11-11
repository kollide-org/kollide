import { useQuery } from '@tanstack/react-query'

import { services } from '@/services'

export function useAppConfig() {
  return useQuery({ queryKey: ['app-config'], queryFn: () => services.appConfig.get(), staleTime: 5 * 60_000 })
}

/** False in v1. Hide every screen and button about paying while this is false. */
export function usePaymentsEnabled(): boolean {
  return useAppConfig().data?.paymentsEnabled ?? false
}

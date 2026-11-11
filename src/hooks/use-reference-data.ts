import { useQuery } from '@tanstack/react-query'

import { services } from '@/services'

export function useReferenceData() {
  return useQuery({ queryKey: ['reference'], queryFn: () => services.reference.get(), staleTime: 60 * 60_000 })
}

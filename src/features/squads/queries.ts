import { useQuery } from '@tanstack/react-query'

import { squadService } from '@/services'

export const squadKeys = {
  all: ['squads'] as const,
  forming: ['squads', 'forming'] as const,
  mine: ['squads', 'mine'] as const,
  forEvent: (eventId: string) => ['squads', 'event', eventId] as const,
  detail: (squadId: string) => ['squads', 'detail', squadId] as const,
}

/** Squads with room left, for the "Squads forming" row. */
export function useSquadsForming() {
  return useQuery({ queryKey: squadKeys.forming, queryFn: () => squadService.listSquadsForming() })
}

export function useSquadsForEvent(eventId: string, enabled = true) {
  return useQuery({ queryKey: squadKeys.forEvent(eventId), queryFn: () => squadService.listSquadsForEvent(eventId), enabled })
}

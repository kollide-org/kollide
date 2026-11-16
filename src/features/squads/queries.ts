import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { squadService } from '@/services'
import type { SquadDraft } from '@/services'

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

/** Squads the member is in, or has asked to join. */
export function useMySquads() {
  return useQuery({ queryKey: squadKeys.mine, queryFn: () => squadService.listMySquads() })
}

export function useSquad(squadId: string) {
  return useQuery({ queryKey: squadKeys.detail(squadId), queryFn: () => squadService.getSquad(squadId) })
}

/** Every squad mutation changes several lists, and the event page's squad count. */
function useRefreshSquads() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: squadKeys.all })
    void queryClient.invalidateQueries({ queryKey: ['events'] })
  }
}

export function useCreateSquad() {
  const refresh = useRefreshSquads()
  return useMutation({ mutationFn: (draft: SquadDraft) => squadService.createSquad(draft), onSettled: refresh })
}

export function useRequestSquad() {
  const refresh = useRefreshSquads()
  return useMutation({ mutationFn: (squadId: string) => squadService.requestToJoin(squadId), onSettled: refresh })
}

export function useDecideSquadRequest(squadId: string) {
  const refresh = useRefreshSquads()
  return useMutation({
    mutationFn: ({ userId, decision }: { userId: string; decision: 'approve' | 'decline' }) =>
      squadService.decideRequest(squadId, userId, decision),
    onSettled: refresh,
  })
}

export function useLeaveSquad() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (squadId: string) => squadService.leaveSquad(squadId),
    onSuccess: (_result, squadId) => queryClient.removeQueries({ queryKey: squadKeys.detail(squadId) }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: squadKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })
}

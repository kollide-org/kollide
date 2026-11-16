import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { bookingService } from '@/services'
import type { JoinRequest, RequestDecision } from '@/services'

export const bookingKeys = {
  all: ['bookings'] as const,
  mine: ['bookings', 'mine'] as const,
  requests: (eventId: string) => ['bookings', 'requests', eventId] as const,
  capacity: (eventId: string) => ['bookings', 'capacity', eventId] as const,
  attendees: (eventId: string) => ['bookings', 'attendees', eventId] as const,
}

/** "My plans": every booking the member has, with its event. */
export function useMyBookings(enabled = true) {
  return useQuery({ queryKey: bookingKeys.mine, queryFn: () => bookingService.listMyBookings(), enabled })
}

/** Host: requests and waitlist places for one event, as profile cards. */
export function useJoinRequests(eventId: string, enabled = true) {
  return useQuery({ queryKey: bookingKeys.requests(eventId), queryFn: () => bookingService.listRequests(eventId), enabled })
}

export function useHostCapacity(eventId: string, enabled = true) {
  return useQuery({ queryKey: bookingKeys.capacity(eventId), queryFn: () => bookingService.getHostCapacity(eventId), enabled })
}

export function useAttendees(eventId: string, enabled = true) {
  return useQuery({ queryKey: bookingKeys.attendees(eventId), queryFn: () => bookingService.listAttendees(eventId), enabled })
}

/**
 * Accept, decline or waitlist one request. The card leaves the inbox at once
 * and comes back if the service says no. Either way the inbox reloads
 * afterwards, so a request someone else already answered shows where it stands.
 */
export function useDecideRequest(eventId: string) {
  const queryClient = useQueryClient()
  const key = bookingKeys.requests(eventId)
  return useMutation({
    mutationFn: ({ bookingId, decision }: { bookingId: string; decision: RequestDecision }) =>
      bookingService.decideRequest(bookingId, decision),
    onMutate: async ({ bookingId, decision }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<JoinRequest[]>(key)
      if (previous) {
        const next =
          decision === 'waitlist'
            ? previous.map((request) =>
                request.booking.id === bookingId
                  ? { ...request, booking: { ...request.booking, status: 'waitlisted' as const, waitlistPosition: null } }
                  : request,
              )
            : previous.filter((request) => request.booking.id !== bookingId)
        queryClient.setQueryData<JoinRequest[]>(key, next)
      }
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['bookings'] })
      void queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })
}

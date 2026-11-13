import { useQuery } from '@tanstack/react-query'

import { bookingService } from '@/services'

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

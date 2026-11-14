import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { adminService, bookingService, eventService, type Booking, type EventDetail, type EventDraft, type EventFilters } from '@/services'

export const eventKeys = {
  all: ['events'] as const,
  list: (filters: EventFilters = {}) => [...eventKeys.all, 'list', filters] as const,
  detail: (idOrSlug: string) => [...eventKeys.all, 'detail', idOrSlug] as const,
  address: (eventId: string) => [...eventKeys.all, 'address', eventId] as const,
  similar: (eventId: string) => [...eventKeys.all, 'similar', eventId] as const,
  hosted: ['events', 'hosted'] as const,
  review: ['events', 'review'] as const,
  hubs: ['hubs'] as const,
  activeHub: ['hubs', 'active'] as const,
}

export const eventQueries = {
  list: (filters: EventFilters = {}) =>
    queryOptions({ queryKey: eventKeys.list(filters), queryFn: () => eventService.listEvents(filters) }),
  detail: (idOrSlug: string) =>
    queryOptions({ queryKey: eventKeys.detail(idOrSlug), queryFn: () => eventService.getEvent(idOrSlug) }),
  activeHub: () => queryOptions({ queryKey: eventKeys.activeHub, queryFn: () => eventService.getActiveHub() }),
}

/** Upcoming events, soonest first. */
export function useEvents(filters: EventFilters = {}) {
  return useQuery({ ...eventQueries.list(filters), placeholderData: (previous) => previous })
}

export function useEvent(idOrSlug: string) {
  return useQuery(eventQueries.detail(idOrSlug))
}

/** The seasonal hub at the top of the home page, with its events. */
export function useActiveHub() {
  return useQuery(eventQueries.activeHub())
}

/** The exact address. Only fetched once the viewer is allowed to see it. */
export function useEventAddress(eventId: string, enabled: boolean) {
  return useQuery({ queryKey: eventKeys.address(eventId), queryFn: () => eventService.getEventAddress(eventId), enabled })
}

export function useSimilarEvents(eventId: string, enabled: boolean) {
  return useQuery({ queryKey: eventKeys.similar(eventId), queryFn: () => eventService.listSimilarEvents(eventId), enabled })
}

/** Events the signed-in host created, in every status. */
export function useHostedEvents() {
  return useQuery({ queryKey: eventKeys.hosted, queryFn: () => eventService.listHostedEvents() })
}

export function useCreateEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (draft: EventDraft) => eventService.createEvent(draft),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: eventKeys.all }),
  })
}

/**
 * Sends a request to join. The event page shows "Request sent" at once, and
 * goes back to how it was if the service says no.
 */
export function useRequestToJoin(slug: string) {
  const queryClient = useQueryClient()
  const key = eventKeys.detail(slug)
  return useMutation({
    mutationFn: ({ eventId, note }: { eventId: string; note?: string }) => bookingService.requestToJoin(eventId, note),
    onMutate: async ({ eventId, note }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<EventDetail>(key)
      if (previous) {
        const now = new Date().toISOString()
        const optimistic: Booking = {
          id: 'pending',
          eventId,
          userId: 'me',
          flow: 'free',
          status: 'requested',
          note: note ?? null,
          waitlistPosition: null,
          reconfirmedAt: null,
          paymentId: null,
          createdAt: now,
          updatedAt: now,
        }
        queryClient.setQueryData<EventDetail>(key, { ...previous, viewer: { ...previous.viewer, booking: optimistic } })
      }
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key })
      void queryClient.invalidateQueries({ queryKey: ['bookings'] })
    },
  })
}

/** Withdraws a request or a waitlist place. */
export function useCancelBooking(slug: string) {
  const queryClient = useQueryClient()
  const key = eventKeys.detail(slug)
  return useMutation({
    mutationFn: (bookingId: string) => bookingService.cancelBooking(bookingId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<EventDetail>(key)
      if (previous) queryClient.setQueryData<EventDetail>(key, { ...previous, viewer: { ...previous.viewer, booking: null } })
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: eventKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['bookings'] })
    },
  })
}

/** Admin: events waiting for approval. */
export function useEventsForReview() {
  return useQuery({ queryKey: eventKeys.review, queryFn: () => adminService.listEventsForReview() })
}

export function useDecideEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ eventId, decision }: { eventId: string; decision: 'approve' | 'decline' }) => adminService.decideEvent(eventId, decision),
    // The reviewed event leaves the queue straight away.
    onMutate: async ({ eventId }) => {
      await queryClient.cancelQueries({ queryKey: eventKeys.review })
      const previous = queryClient.getQueryData<Awaited<ReturnType<typeof adminService.listEventsForReview>>>(eventKeys.review)
      if (previous) queryClient.setQueryData(eventKeys.review, previous.filter((item) => item.event.id !== eventId))
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(eventKeys.review, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: eventKeys.all }),
  })
}

import { queryOptions, useQuery } from '@tanstack/react-query'

import { eventService, type EventFilters } from '@/services'

export const eventKeys = {
  all: ['events'] as const,
  list: (filters: EventFilters = {}) => [...eventKeys.all, 'list', filters] as const,
  detail: (idOrSlug: string) => [...eventKeys.all, 'detail', idOrSlug] as const,
  similar: (eventId: string) => [...eventKeys.all, 'similar', eventId] as const,
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
  return useQuery(eventQueries.list(filters))
}

export function useEvent(idOrSlug: string) {
  return useQuery(eventQueries.detail(idOrSlug))
}

/** The seasonal hub at the top of the home page, with its events. */
export function useActiveHub() {
  return useQuery(eventQueries.activeHub())
}

import { useQuery } from '@tanstack/react-query'

import { services, type EventFilters } from '@/services'

export const useEventSearch = (filters: EventFilters) =>
  useQuery({ queryKey: ['events', 'search', filters], queryFn: () => services.events.search(filters, { limit: 30, offset: 0 }) })

export const useFeaturedEvents = () => useQuery({ queryKey: ['events', 'featured'], queryFn: () => services.events.featured() })
export const useHubs = () => useQuery({ queryKey: ['hubs'], queryFn: () => services.events.hubs() })
export const useHub = (slug: string) => useQuery({ queryKey: ['hub', slug], queryFn: () => services.events.getHub(slug) })
export const useEvent = (id: string) => useQuery({ queryKey: ['event', id], queryFn: () => services.events.getEvent(id) })
export const useEventAddress = (id: string) => useQuery({ queryKey: ['event-address', id], queryFn: () => services.events.getAddress(id) })
export const useMyEvents = () => useQuery({ queryKey: ['my-events'], queryFn: () => services.events.myEvents() })

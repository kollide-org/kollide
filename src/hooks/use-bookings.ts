import { useQuery } from '@tanstack/react-query'

import { services } from '@/services'

export const useMyBooking = (eventId: string, enabled = true) =>
  useQuery({ queryKey: ['my-booking', eventId], queryFn: () => services.bookings.getMyBooking(eventId), enabled })
export const useMyBookings = () => useQuery({ queryKey: ['my-bookings'], queryFn: () => services.bookings.myBookings() })
export const useHostInbox = (eventId: string) => useQuery({ queryKey: ['host-inbox', eventId], queryFn: () => services.bookings.hostInbox(eventId) })
export const useEventSquads = (eventId: string) => useQuery({ queryKey: ['event-squads', eventId], queryFn: () => services.squads.eventSquads(eventId) })
export const useMySquads = () => useQuery({ queryKey: ['my-squads'], queryFn: () => services.squads.mySquads() })
export const useNotifications = () => useQuery({ queryKey: ['notifications'], queryFn: () => services.notifications.list() })
export const useUnreadCount = () =>
  useQuery({ queryKey: ['notifications-unread'], queryFn: () => services.notifications.unreadCount(), refetchInterval: 60_000 })

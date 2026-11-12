import { useQuery } from '@tanstack/react-query'

import { services } from '@/services'

export const useFeedbackTasks = () => useQuery({ queryKey: ['feedback-tasks'], queryFn: () => services.feedback.tasks() })
export const useFeedbackTags = () => useQuery({ queryKey: ['feedback-tags'], queryFn: () => services.feedback.tags(), staleTime: 60 * 60_000 })
export const useMyTaps = (eventId: string) => useQuery({ queryKey: ['my-taps', eventId], queryFn: () => services.connections.myTaps(eventId) })
export const useConnections = () => useQuery({ queryKey: ['connections'], queryFn: () => services.connections.list() })
export const useMyTips = () => useQuery({ queryKey: ['my-tips'], queryFn: () => services.safety.myTips() })
export const useMyAppeals = () => useQuery({ queryKey: ['my-appeals'], queryFn: () => services.safety.myAppeals() })
export const useMyReputation = (userId: string) =>
  useQuery({ queryKey: ['my-reputation', userId], queryFn: () => services.profile.getMyReputation(userId), enabled: Boolean(userId) })
export const useHostCheckinList = (eventId: string) =>
  useQuery({ queryKey: ['host-checkin', eventId], queryFn: () => services.checkin.hostList(eventId), refetchInterval: 15_000 })

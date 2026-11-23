import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'

import { eventKeys } from '@/features/events/queries'
import { adminService, type AccountStatus, type HubInput, type SafetyReportStatus } from '@/services'

export const adminKeys = {
  all: ['admin'] as const,
  hosts: ['admin', 'hosts'] as const,
  hubs: ['admin', 'hubs'] as const,
  reports: ['admin', 'reports'] as const,
  appeals: ['admin', 'appeals'] as const,
  patterns: ['admin', 'patterns'] as const,
  users: (search: string) => ['admin', 'users', search] as const,
  selfies: ['admin', 'selfies'] as const,
  partners: ['admin', 'partners'] as const,
}

/** Most admin changes ripple into other lists, so each one refreshes everything the admin area shows. */
function useAdminMutation<Input, Output>(mutationFn: (input: Input) => Promise<Output>, also: QueryKey[] = []) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSettled: () =>
      Promise.all([adminKeys.all, ...also].map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  })
}

export function useHostApplications() {
  return useQuery({ queryKey: adminKeys.hosts, queryFn: () => adminService.listHostApplications() })
}

export function useDecideHost() {
  return useAdminMutation(({ userId, decision }: { userId: string; decision: 'approve' | 'decline' }) =>
    adminService.decideHostApplication(userId, decision),
  )
}

export function useSetFeatured() {
  return useAdminMutation(
    ({ eventId, featured }: { eventId: string; featured: boolean }) => adminService.setEventFeatured(eventId, featured),
    [eventKeys.all],
  )
}

export function useHubs() {
  return useQuery({ queryKey: adminKeys.hubs, queryFn: () => adminService.listHubs() })
}

export function useSaveHub() {
  return useAdminMutation(
    ({ hubId, input }: { hubId: string | null; input: HubInput }) =>
      hubId ? adminService.updateHub(hubId, input) : adminService.createHub(input),
    [eventKeys.all, eventKeys.hubs],
  )
}

export function useSetActiveHub() {
  return useAdminMutation((hubId: string | null) => adminService.setActiveHub(hubId), [eventKeys.all, eventKeys.hubs])
}

export function useReports() {
  return useQuery({ queryKey: adminKeys.reports, queryFn: () => adminService.listReports() })
}

export function useUpdateReport() {
  return useAdminMutation(({ reportId, status, resolution }: { reportId: string; status: SafetyReportStatus; resolution?: string }) =>
    adminService.updateReport(reportId, { status, resolution }),
  )
}

export function useAppeals() {
  return useQuery({ queryKey: adminKeys.appeals, queryFn: () => adminService.listAppeals() })
}

export function useDecideAppeal() {
  return useAdminMutation(({ appealId, decision }: { appealId: string; decision: 'upheld' | 'overturned' }) =>
    adminService.decideAppeal(appealId, decision),
  )
}

export function useReviewPatterns() {
  return useQuery({ queryKey: adminKeys.patterns, queryFn: () => adminService.listCollusionFlags() })
}

export function useAdminUsers(search: string) {
  return useQuery({
    queryKey: adminKeys.users(search),
    queryFn: () => adminService.listUsers(search),
    placeholderData: (previous) => previous,
  })
}

export function useSetUserStatus() {
  return useAdminMutation(({ userId, status, reason }: { userId: string; status: AccountStatus; reason: string }) =>
    adminService.setUserStatus(userId, status, reason),
  )
}

export function useSelfieQueue() {
  return useQuery({ queryKey: adminKeys.selfies, queryFn: () => adminService.listVerificationQueue() })
}

export function useDecideSelfie() {
  return useAdminMutation(({ userId, decision }: { userId: string; decision: 'verify' | 'reject' }) =>
    adminService.decideVerification(userId, decision),
  )
}

export function usePartnerLinks() {
  return useQuery({ queryKey: adminKeys.partners, queryFn: () => adminService.listPartnerLinks() })
}

export function useUpdatePartnerLink() {
  return useAdminMutation(({ eventId, ticketUrl }: { eventId: string; ticketUrl: string }) =>
    adminService.updatePartnerLink(eventId, ticketUrl),
  )
}

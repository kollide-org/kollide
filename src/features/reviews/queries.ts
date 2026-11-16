import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { reviewService } from '@/services'
import type { HostRatingInput, ReviewInput, SafetyReportInput } from '@/services'

export const reviewKeys = {
  all: ['reviews'] as const,
  pending: ['reviews', 'pending'] as const,
  form: (eventId: string) => ['reviews', 'form', eventId] as const,
  connections: ['reviews', 'connections'] as const,
  repeats: ['reviews', 'repeats'] as const,
}

export function useFeedbackForm(eventId: string) {
  return useQuery({ queryKey: reviewKeys.form(eventId), queryFn: () => reviewService.getFeedbackForm(eventId), retry: false })
}

/** Everything a review can change: the form, plans, profiles, connections and suggestions. */
function useRefreshAfterReview() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: reviewKeys.all })
    void queryClient.invalidateQueries({ queryKey: ['bookings'] })
    void queryClient.invalidateQueries({ queryKey: ['profiles'] })
    void queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }
}

export function useSubmitReview() {
  const refresh = useRefreshAfterReview()
  return useMutation({ mutationFn: (input: ReviewInput) => reviewService.submitReview(input), onSuccess: refresh })
}

export function useSubmitHostRating() {
  const refresh = useRefreshAfterReview()
  return useMutation({ mutationFn: (input: HostRatingInput) => reviewService.submitHostRating(input), onSuccess: refresh })
}

export function useSubmitSafetyReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SafetyReportInput) => reviewService.submitSafetyReport(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profiles'] })
      void queryClient.invalidateQueries({ queryKey: ['admin'] })
    },
  })
}

export function useConnections() {
  return useQuery({ queryKey: reviewKeys.connections, queryFn: () => reviewService.listConnections() })
}

export function useRepeatSuggestions() {
  return useQuery({ queryKey: reviewKeys.repeats, queryFn: () => reviewService.listRepeatSuggestions() })
}

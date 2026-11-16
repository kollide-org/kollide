import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { paymentService } from '@/services'
import type { PaymentInput } from '@/services'

export const paymentKeys = {
  all: ['payments'] as const,
  checkout: (eventId: string) => ['payments', 'checkout', eventId] as const,
  mine: ['payments', 'mine'] as const,
  credits: ['payments', 'credits'] as const,
  quote: (bookingId: string) => ['payments', 'quote', bookingId] as const,
}

/** Everything a booking touches: the event's places, the member's plans, payments and credit. */
function useRefreshAfterPayment() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['events'] })
    void queryClient.invalidateQueries({ queryKey: ['bookings'] })
    void queryClient.invalidateQueries({ queryKey: paymentKeys.mine })
    void queryClient.invalidateQueries({ queryKey: paymentKeys.credits })
    void queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }
}

/**
 * Starts a paid booking and returns the summary. It is fetched once and never
 * refetched, because once the booking is paid the service would answer
 * "already booked", and the success screen must stay where it is.
 */
export function useCheckout(eventId: string, enabled = true) {
  return useQuery({
    queryKey: paymentKeys.checkout(eventId),
    queryFn: () => paymentService.startCheckout(eventId),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
    retry: false,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

export function usePay() {
  const refresh = useRefreshAfterPayment()
  return useMutation({
    mutationFn: ({ bookingId, input }: { bookingId: string; input: PaymentInput }) => paymentService.pay(bookingId, input),
    onSuccess: refresh,
  })
}

export function useRefundQuote(bookingId: string, enabled = true) {
  return useQuery({ queryKey: paymentKeys.quote(bookingId), queryFn: () => paymentService.getRefundQuote(bookingId), enabled })
}

export function useCancelAndRefund() {
  const refresh = useRefreshAfterPayment()
  return useMutation({ mutationFn: (bookingId: string) => paymentService.cancelAndRefund(bookingId), onSuccess: refresh })
}

export function useMyPayments() {
  return useQuery({ queryKey: paymentKeys.mine, queryFn: () => paymentService.listMyPayments() })
}

export function useMyCredits() {
  return useQuery({ queryKey: paymentKeys.credits, queryFn: () => paymentService.listMyCredits() })
}

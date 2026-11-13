import type { Checkout, Credit, ID, Payment, PaymentInput, PaymentResult, Refund, RefundQuote } from '../types'

/**
 * Every payment screen talks to this interface and nothing else.
 * A real gateway is plugged in by writing one implementation of it.
 */
export interface PaymentService {
  /** Starts a paid booking in `pending_payment` and returns the summary to show. */
  startCheckout(eventId: ID): Promise<Checkout>
  /** Rejects with `payment_failed` when the payment does not go through. */
  pay(bookingId: ID, input: PaymentInput): Promise<PaymentResult>
  getRefundQuote(bookingId: ID): Promise<RefundQuote>
  /** Cancels a paid booking and applies the refund rules. */
  cancelAndRefund(bookingId: ID): Promise<{ refund: Refund | null; credit: Credit | null }>
  listMyPayments(): Promise<Payment[]>
  listMyCredits(): Promise<Credit[]>
}

import type { Booking } from './booking'
import type { ID, ISODateTime } from './common'

export type PaymentMethodType = 'upi' | 'card'
export type PaymentStatus = 'processing' | 'succeeded' | 'failed' | 'refunded'

export interface Payment {
  id: ID
  bookingId: ID
  userId: ID
  amountInr: number
  /** Kollide credit used towards this payment. */
  creditAppliedInr: number
  method: PaymentMethodType
  status: PaymentStatus
  /** A reference the user can quote to support. */
  reference: string
  failureReason: string | null
  createdAt: ISODateTime
}

/**
 * - `full`: money back, up to 72 hours before the event.
 * - `credit`: Kollide credit, inside 72 hours.
 * - `cancelled_by_kollide`: automatic, when Kollide cancels the event.
 */
export type RefundKind = 'full' | 'credit' | 'cancelled_by_kollide'

export interface Refund {
  id: ID
  paymentId: ID
  bookingId: ID
  userId: ID
  kind: RefundKind
  amountInr: number
  createdAt: ISODateTime
}

export interface Credit {
  id: ID
  userId: ID
  amountInr: number
  reason: string
  refundId: ID | null
  createdAt: ISODateTime
  usedAt: ISODateTime | null
}

/** What the member would get back if they cancelled now. */
export interface RefundQuote {
  bookingId: ID
  /** `none` for no-shows and for bookings that were never paid. */
  outcome: RefundKind | 'none'
  amountInr: number
  explanation: string
}

/** The booking summary shown before paying. */
export interface Checkout {
  booking: Booking
  eventTitle: string
  priceInr: number
  creditAvailableInr: number
  creditAppliedInr: number
  payableInr: number
}

export type PaymentInput =
  | { method: 'upi'; upiId: string }
  | { method: 'card'; cardNumber: string; expiry: string; cvv: string; nameOnCard: string }

export interface PaymentResult {
  payment: Payment
  booking: Booking
}

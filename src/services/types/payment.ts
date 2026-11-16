import type { Booking } from './booking'
import type { ID, ISODateTime } from './common'

/** `credit` is only for a booking that Kollide credit pays for in full. */
export type PaymentMethodType = 'upi' | 'card' | 'credit'
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
  /** The part that goes back to the card or UPI account it came from. */
  moneyBackInr: number
  /** The part that comes back as Kollide credit. */
  creditBackInr: number
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
  | { method: 'credit' }

export interface PaymentResult {
  payment: Payment
  booking: Booking
}

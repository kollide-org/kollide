import type { BookingStatus } from '@/services'

type BadgeVariant = 'soft' | 'success' | 'warning' | 'secondary' | 'highlight-soft' | 'outline'

/**
 * How each booking status reads to a member. A decline is worded gently:
 * the word "rejected" is never used anywhere in the product.
 */
export const BOOKING_STATUS: Record<BookingStatus, { label: string; variant: BadgeVariant }> = {
  requested: { label: 'Request sent', variant: 'soft' },
  approved: { label: 'Approved', variant: 'success' },
  waitlisted: { label: 'On the waitlist', variant: 'warning' },
  declined: { label: 'This one’s full', variant: 'secondary' },
  confirmed: { label: 'Confirmed', variant: 'success' },
  attended: { label: 'Attended', variant: 'highlight-soft' },
  no_show: { label: 'Missed', variant: 'secondary' },
  cancelled: { label: 'Cancelled', variant: 'outline' },
  pending_payment: { label: 'Awaiting payment', variant: 'warning' },
  paid: { label: 'Booked', variant: 'success' },
  refunded: { label: 'Refunded', variant: 'outline' },
}

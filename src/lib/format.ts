import type { Pricing } from '@/services'

const LOCALE = 'en-IN'

const dayFormat = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' })
const timeFormat = new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit', hour12: true })
const rupeeFormat = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

/** "Sat 14 Nov" */
export function formatDay(iso: string): string {
  return dayFormat.format(new Date(iso)).replace(',', '')
}

/** "7:30 pm" */
export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso)).toLowerCase()
}

/** "Sat 14 Nov · 7:30 pm" */
export function formatEventDate(iso: string): string {
  return `${formatDay(iso)} · ${formatTime(iso)}`
}

/** "₹1,800" */
export function formatInr(amount: number): string {
  return rupeeFormat.format(amount)
}

/** The price label an event card shows. */
export function priceLabel(pricing: Pricing): string {
  switch (pricing.mode) {
    case 'free':
      return 'Free'
    case 'pay_at_venue':
      return 'Pay at venue'
    case 'cost_split':
      return pricing.amountInr ? `${formatInr(pricing.amountInr)} split` : 'Cost split'
    case 'partner_ticket':
      return pricing.amountInr ? `From ${formatInr(pricing.amountInr)}` : 'Tickets'
    case 'paid':
      return pricing.amountInr ? formatInr(pricing.amountInr) : 'Paid'
  }
}

/** "4 spots left", "1 spot left" or "Full". */
export function spotsLabel(spotsLeft: number): string {
  if (spotsLeft <= 0) return 'Full'
  return `${spotsLeft} ${spotsLeft === 1 ? 'spot' : 'spots'} left`
}

/** "7:30 pm to 10:30 pm" */
export function formatTimeRange(startsAt: string, endsAt: string): string {
  return `${formatTime(startsAt)} to ${formatTime(endsAt)}`
}

/** "18 and over" or "21 to 40". */
export function ageRangeLabel(range: { min: number; max: number | null }): string {
  return range.max ? `${range.min} to ${range.max}` : `${range.min} and over`
}

/** 0.96 becomes "96%". */
export function percent(share: number): string {
  return `${Math.round(share * 100)}%`
}

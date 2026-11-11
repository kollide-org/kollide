import type { EventCard } from '@/services'

const TZ = 'Asia/Kolkata'

/** "Sat 14 Dec, 6:30 pm" in Bengaluru time. */
export function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ,
  }).format(new Date(iso))
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ }).format(new Date(iso))
}

/** What the price line says. No money moves through Kollide, so this is text only. */
export function priceText(event: Pick<EventCard, 'pricingMode' | 'priceLabel'>): string {
  if (event.priceLabel) return event.priceLabel
  if (event.pricingMode === 'free') return 'Free'
  if (event.pricingMode === 'pay_at_venue') return 'Pay at the venue'
  if (event.pricingMode === 'cost_split') return 'Cost split on the night'
  return 'Paid'
}

export const PRICE_OPTIONS: { value: 'free' | 'pay_at_venue' | 'cost_split'; label: string }[] = [
  { value: 'free', label: 'Free' },
  { value: 'pay_at_venue', label: 'Pay at the venue' },
  { value: 'cost_split', label: 'Cost split' },
]

/** A local date-time string for a datetime-local input, from an ISO string. */
export function toLocalInput(iso: string): string {
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

import type { DateFilter, EventCategory, EventStatus, EventType, GroupSizeFilter, PricingMode } from '@/services'

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  house_party: 'House party',
  games: 'Games',
  food_drink: 'Food and drink',
  music: 'Music',
  outdoors: 'Outdoors',
  arts: 'Arts',
  wellness: 'Wellness',
  nightlife: 'Nightlife',
}

export const TYPE_LABELS: Record<EventType, string> = {
  partner: 'Partner event',
  community: 'Community',
  kollide: 'By Kollide',
}

export const DATE_LABELS: Record<DateFilter, string> = {
  today: 'Today',
  this_week: 'This week',
  this_weekend: 'This weekend',
  this_month: 'This month',
}

export const GROUP_SIZE_LABELS: Record<GroupSizeFilter, string> = {
  small: 'Up to 10',
  medium: '11 to 25',
  large: 'More than 25',
}

/** The pricing choices a host has for a community event. */
export const HOST_PRICING_LABELS: Record<Extract<PricingMode, 'free' | 'pay_at_venue' | 'cost_split'>, { label: string; hint: string }> = {
  free: { label: 'Free', hint: 'Nobody pays anything.' },
  pay_at_venue: { label: 'Pay at venue', hint: 'Everyone pays for what they order.' },
  cost_split: { label: 'Cost-split', hint: 'Guests share the cost of food and drink on the night.' },
}

export const EVENT_STATUS_LABELS: Record<EventStatus, { label: string; variant: 'soft' | 'success' | 'warning' | 'secondary' | 'outline' }> = {
  draft: { label: 'Draft', variant: 'outline' },
  pending_review: { label: 'Waiting for approval', variant: 'warning' },
  published: { label: 'Live', variant: 'success' },
  declined: { label: 'Needs changes', variant: 'secondary' },
  cancelled: { label: 'Cancelled', variant: 'outline' },
  completed: { label: 'Finished', variant: 'secondary' },
}

import { AREAS, EVENT_CATEGORIES } from '@/services/types'
import type { Area, DateFilter, EventCategory, EventFilters, GroupSizeFilter, PriceFilter } from '@/services'

/**
 * The event filters live in the page address, so a filtered view can be
 * shared, bookmarked, and stepped through with the back button.
 */
const DATES: readonly DateFilter[] = ['today', 'this_week', 'this_weekend', 'this_month']
const PRICES: readonly PriceFilter[] = ['free', 'paid']
const SIZES: readonly GroupSizeFilter[] = ['small', 'medium', 'large']

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : undefined
}

function listOf<T extends string>(value: string | null, allowed: readonly T[]): T[] | undefined {
  const items = (value ?? '').split(',').filter((item): item is T => (allowed as readonly string[]).includes(item))
  return items.length > 0 ? items : undefined
}

export function filtersFromParams(params: URLSearchParams): EventFilters {
  const filters: EventFilters = {}
  const date = oneOf(params.get('date'), DATES)
  const areas = listOf<Area>(params.get('areas'), AREAS)
  const categories = listOf<EventCategory>(params.get('categories'), EVENT_CATEGORIES)
  const price = oneOf(params.get('price'), PRICES)
  const groupSize = oneOf(params.get('size'), SIZES)
  const hubId = params.get('hub')
  if (date) filters.date = date
  if (areas) filters.areas = areas
  if (categories) filters.categories = categories
  if (price) filters.price = price
  if (groupSize) filters.groupSize = groupSize
  if (params.get('women') === '1') filters.womenOnly = true
  if (hubId) filters.hubId = hubId
  return filters
}

export function filtersToParams(filters: EventFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.date) params.set('date', filters.date)
  if (filters.areas?.length) params.set('areas', filters.areas.join(','))
  if (filters.categories?.length) params.set('categories', filters.categories.join(','))
  if (filters.price) params.set('price', filters.price)
  if (filters.groupSize) params.set('size', filters.groupSize)
  if (filters.womenOnly) params.set('women', '1')
  if (filters.hubId) params.set('hub', filters.hubId)
  return params
}

/** How many filters are switched on. Each area or category counts once. */
export function countFilters(filters: EventFilters): number {
  return (
    (filters.date ? 1 : 0) +
    (filters.areas?.length ?? 0) +
    (filters.categories?.length ?? 0) +
    (filters.price ? 1 : 0) +
    (filters.groupSize ? 1 : 0) +
    (filters.womenOnly ? 1 : 0) +
    (filters.hubId ? 1 : 0)
  )
}

export function toggleInList<T>(list: readonly T[] | undefined, item: T): T[] | undefined {
  const next = list?.includes(item) ? list.filter((other) => other !== item) : [...(list ?? []), item]
  return next.length > 0 ? next : undefined
}

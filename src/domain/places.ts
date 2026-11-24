import { AREA_MAX_LENGTH, findLocality, isOpenCity, ZONES, type Area, type CityId, type Zone } from '@/services/types/places'

export type AreaProblem = 'city_closed' | 'empty' | 'too_long' | 'needs_zone'

export const AREA_PROBLEMS: Record<AreaProblem, string> = {
  city_closed: 'Kollide isn’t open in that city yet.',
  empty: 'Choose your area.',
  too_long: `Keep the area to ${AREA_MAX_LENGTH} characters. Just the locality, not an address.`,
  needs_zone: 'Choose which part of the city it’s in.',
}

/**
 * Turns what someone chose or typed into a stored area. A listed locality
 * takes its own name and zone, whatever zone was sent. A typed one is tidied
 * and keeps the zone the person picked.
 */
export function resolveArea(
  city: string,
  typed: string,
  zone: string | undefined,
): { ok: true; city: CityId; area: Area; zone: Zone } | { ok: false; problem: AreaProblem } {
  if (!isOpenCity(city)) return { ok: false, problem: 'city_closed' }
  const area = typed.trim().replace(/\s+/g, ' ')
  if (!area) return { ok: false, problem: 'empty' }
  const listed = findLocality(city, area)
  if (listed) return { ok: true, city, area: listed.name, zone: listed.zone }
  if (area.length > AREA_MAX_LENGTH) return { ok: false, problem: 'too_long' }
  if (!zone || !ZONES.includes(zone as Zone)) return { ok: false, problem: 'needs_zone' }
  return { ok: true, city, area, zone: zone as Zone }
}

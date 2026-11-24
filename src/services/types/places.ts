/**
 * Where people and events are. A city, then a locality inside it, and the
 * part of the city that locality sits in, so filters stay simple however many
 * localities there are.
 *
 * Kollide opens one city at a time. Adding a city later means adding its
 * localities here and setting `open: true`; nothing else in the app changes.
 */

export const CITIES = [
  { id: 'bengaluru', name: 'Bengaluru', open: true },
  { id: 'mumbai', name: 'Mumbai', open: false },
  { id: 'delhi-ncr', name: 'Delhi NCR', open: false },
  { id: 'hyderabad', name: 'Hyderabad', open: false },
  { id: 'pune', name: 'Pune', open: false },
  { id: 'chennai', name: 'Chennai', open: false },
] as const

export type CityId = (typeof CITIES)[number]['id']

/** The city that is open now. Places with no city of their own belong here. */
export const OPEN_CITY: CityId = 'bengaluru'

export function isOpenCity(city: string): city is CityId {
  return CITIES.some((candidate) => candidate.id === city && candidate.open)
}

export const ZONES = ['central', 'north', 'south', 'east', 'west'] as const
export type Zone = (typeof ZONES)[number]

export const ZONE_LABELS: Record<Zone, string> = {
  central: 'Central',
  north: 'North',
  south: 'South',
  east: 'East',
  west: 'West',
}

/** A locality's name, as people say it. Free text is allowed, so this is a plain string. */
export type Area = string

/** The longest area name accepted, typed or listed. It is a locality, never an address. */
export const AREA_MAX_LENGTH = 40

export interface Locality {
  name: Area
  zone: Zone
  /** Other names people type for the same place. */
  aka?: string[]
}

/**
 * Bengaluru's localities, a first pass. Zones follow the usual way people
 * describe the city; places on a border sit in the zone they are most often
 * counted in. Anyone can still type an area that is not here.
 */
const BENGALURU: Locality[] = [
  // Central
  { name: 'MG Road', zone: 'central' },
  { name: 'Brigade Road', zone: 'central' },
  { name: 'Church Street', zone: 'central' },
  { name: 'Cubbon Park', zone: 'central' },
  { name: 'Lavelle Road', zone: 'central' },
  { name: 'Residency Road', zone: 'central' },
  { name: 'Richmond Town', zone: 'central' },
  { name: 'Langford Town', zone: 'central' },
  { name: 'Shanthinagar', zone: 'central' },
  { name: 'Ashok Nagar', zone: 'central' },
  { name: 'Shivajinagar', zone: 'central' },
  { name: 'Commercial Street', zone: 'central' },
  { name: 'Vasanth Nagar', zone: 'central' },
  { name: 'Cunningham Road', zone: 'central' },
  { name: 'Ulsoor', zone: 'central', aka: ['Halasuru'] },
  { name: 'Majestic', zone: 'central', aka: ['Gandhinagar'] },
  { name: 'Chickpet', zone: 'central' },
  { name: 'Seshadripuram', zone: 'central' },
  { name: 'Sampangi Rama Nagar', zone: 'central' },

  // North
  { name: 'Hebbal', zone: 'north' },
  { name: 'Yelahanka', zone: 'north' },
  { name: 'Yelahanka New Town', zone: 'north' },
  { name: 'RT Nagar', zone: 'north' },
  { name: 'Sahakar Nagar', zone: 'north' },
  { name: 'Sanjaynagar', zone: 'north' },
  { name: 'Sadashivanagar', zone: 'north' },
  { name: 'Malleshwaram', zone: 'north', aka: ['Malleswaram'] },
  { name: 'Yeshwanthpur', zone: 'north' },
  { name: 'Mathikere', zone: 'north' },
  { name: 'Jalahalli', zone: 'north' },
  { name: 'Vidyaranyapura', zone: 'north' },
  { name: 'Jakkur', zone: 'north' },
  { name: 'Thanisandra', zone: 'north' },
  { name: 'Hennur', zone: 'north' },
  { name: 'Nagawara', zone: 'north' },
  { name: 'Manyata Tech Park', zone: 'north' },
  { name: 'Kodigehalli', zone: 'north' },
  { name: 'Byatarayanapura', zone: 'north' },
  { name: 'Amruthahalli', zone: 'north' },
  { name: 'Dollars Colony', zone: 'north' },
  { name: 'Ganganagar', zone: 'north' },
  { name: 'Benson Town', zone: 'north' },
  { name: 'Bagalur', zone: 'north' },
  { name: 'Devanahalli', zone: 'north' },

  // South
  { name: 'Koramangala', zone: 'south' },
  { name: 'HSR Layout', zone: 'south' },
  { name: 'Jayanagar', zone: 'south' },
  { name: 'JP Nagar', zone: 'south' },
  { name: 'BTM Layout', zone: 'south' },
  { name: 'Basavanagudi', zone: 'south' },
  { name: 'Banashankari', zone: 'south' },
  { name: 'Wilson Garden', zone: 'south' },
  { name: 'Lalbagh', zone: 'south' },
  { name: 'Hanumanthanagar', zone: 'south' },
  { name: 'Girinagar', zone: 'south' },
  { name: 'Padmanabhanagar', zone: 'south' },
  { name: 'Kumaraswamy Layout', zone: 'south' },
  { name: 'Uttarahalli', zone: 'south' },
  { name: 'Konanakunte', zone: 'south' },
  { name: 'Kanakapura Road', zone: 'south' },
  { name: 'Bannerghatta Road', zone: 'south' },
  { name: 'Arekere', zone: 'south' },
  { name: 'Hulimavu', zone: 'south' },
  { name: 'Begur', zone: 'south' },
  { name: 'Bommanahalli', zone: 'south' },
  { name: 'Hongasandra', zone: 'south' },
  { name: 'Madiwala', zone: 'south' },
  { name: 'Electronic City', zone: 'south' },
  { name: 'Silk Board', zone: 'south' },
  { name: 'Adugodi', zone: 'south' },
  { name: 'Ejipura', zone: 'south' },
  { name: 'Viveknagar', zone: 'south' },

  // East
  { name: 'Indiranagar', zone: 'east' },
  { name: 'Domlur', zone: 'east' },
  { name: 'Old Airport Road', zone: 'east' },
  { name: 'HAL', zone: 'east' },
  { name: 'Murugeshpalya', zone: 'east' },
  { name: 'Jeevan Bima Nagar', zone: 'east' },
  { name: 'CV Raman Nagar', zone: 'east' },
  { name: 'Kaggadasapura', zone: 'east' },
  { name: 'Frazer Town', zone: 'east' },
  { name: 'Cox Town', zone: 'east' },
  { name: 'Cooke Town', zone: 'east' },
  { name: 'Banaswadi', zone: 'east' },
  { name: 'Kammanahalli', zone: 'east' },
  { name: 'Kalyan Nagar', zone: 'east' },
  { name: 'HBR Layout', zone: 'east' },
  { name: 'Ramamurthy Nagar', zone: 'east' },
  { name: 'KR Puram', zone: 'east' },
  { name: 'Mahadevapura', zone: 'east' },
  { name: 'Whitefield', zone: 'east' },
  { name: 'Brookefield', zone: 'east' },
  { name: 'Kundalahalli', zone: 'east' },
  { name: 'Hoodi', zone: 'east' },
  { name: 'Kadugodi', zone: 'east' },
  { name: 'Varthur', zone: 'east' },
  { name: 'Marathahalli', zone: 'east' },
  { name: 'Munnekolala', zone: 'east' },
  { name: 'Bellandur', zone: 'east' },
  { name: 'Kadubeesanahalli', zone: 'east' },
  { name: 'Panathur', zone: 'east' },
  { name: 'Sarjapur Road', zone: 'east' },
  { name: 'Kasavanahalli', zone: 'east' },
  { name: 'Haralur', zone: 'east', aka: ['Harlur'] },
  { name: 'Agara', zone: 'east' },

  // West
  { name: 'Rajajinagar', zone: 'west' },
  { name: 'Basaveshwaranagar', zone: 'west' },
  { name: 'Vijayanagar', zone: 'west' },
  { name: 'Mahalakshmi Layout', zone: 'west' },
  { name: 'Nandini Layout', zone: 'west' },
  { name: 'Kamakshipalya', zone: 'west' },
  { name: 'Nagarbhavi', zone: 'west' },
  { name: 'Chandra Layout', zone: 'west' },
  { name: 'Magadi Road', zone: 'west' },
  { name: 'Mysore Road', zone: 'west' },
  { name: 'Rajarajeshwari Nagar', zone: 'west', aka: ['RR Nagar'] },
  { name: 'Kengeri', zone: 'west' },
  { name: 'Sunkadakatte', zone: 'west' },
  { name: 'Peenya', zone: 'west' },
  { name: 'Herohalli', zone: 'west' },
  { name: 'Ullal', zone: 'west' },
]

export const LOCALITIES: Record<'bengaluru', readonly Locality[]> = { bengaluru: BENGALURU }

/** A city's listed localities. Cities that are not open yet have none. */
export function localitiesOf(city: CityId): readonly Locality[] {
  return city === 'bengaluru' ? LOCALITIES.bengaluru : []
}

/** Lower-case, single-spaced, for comparing what someone typed with the list. */
export function areaKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** The listed locality someone meant, by its name or another name for it. */
export function findLocality(city: CityId, typed: string): Locality | null {
  const key = areaKey(typed)
  if (!key) return null
  return localitiesOf(city).find((locality) => areaKey(locality.name) === key || locality.aka?.some((name) => areaKey(name) === key)) ?? null
}

/** Shared building blocks for every entity. */

export type ID = string
/** A moment in time, as an ISO 8601 string in UTC. */
export type ISODateTime = string
/** A calendar date, as YYYY-MM-DD. */
export type ISODate = string


export const INTERESTS = [
  'Board games',
  'Live music',
  'Filter coffee',
  'Running',
  'Trekking',
  'Stand-up comedy',
  'Cooking',
  'Reading',
  'Photography',
  'Cycling',
  'Quizzing',
  'Dancing',
  'Films',
  'Art and sketching',
  'Pottery',
  'Yoga',
  'Karaoke',
  'Street food',
  'Craft beer',
  'Gardening',
  'Theatre',
  'Badminton',
] as const
export type Interest = (typeof INTERESTS)[number]



export const GENDER_OPTIONS = [
  { value: 'woman', label: 'Woman' },
  { value: 'man', label: 'Man' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
] as const

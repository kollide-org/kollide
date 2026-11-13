/** Shared building blocks for every entity. */

export type ID = string
/** A moment in time, as an ISO 8601 string in UTC. */
export type ISODateTime = string
/** A calendar date, as YYYY-MM-DD. */
export type ISODate = string

/** Version 1 covers Bengaluru only. Events show an area, never an address. */
export const AREAS = [
  'Indiranagar',
  'Koramangala',
  'HSR Layout',
  'Jayanagar',
  'JP Nagar',
  'Whitefield',
  'Malleshwaram',
  'Church Street',
  'MG Road',
  'Cubbon Park',
  'Hebbal',
  'Bellandur',
  'Basavanagudi',
  'Frazer Town',
] as const
export type Area = (typeof AREAS)[number]

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

export const LANGUAGES = [
  'English',
  'Kannada',
  'Hindi',
  'Tamil',
  'Telugu',
  'Malayalam',
  'Marathi',
  'Bengali',
  'Gujarati',
  'Punjabi',
] as const
export type Language = (typeof LANGUAGES)[number]

/** The prompts a member can answer on their profile. They choose two or three. */
export const PROFILE_PROMPTS = [
  { promptId: 'perfect-sunday', question: 'A perfect Sunday is…' },
  { promptId: 'ask-me-about', question: 'Ask me about…' },
  { promptId: 'find-me-at', question: 'You’ll find me at…' },
  { promptId: 'looking-for', question: 'I’m looking for people to…' },
  { promptId: 'best-of-bengaluru', question: 'The best thing about Bengaluru is…' },
  { promptId: 'say-yes-to', question: 'I will always say yes to…' },
  { promptId: 'new-in-town', question: 'Something I want to try in this city…' },
] as const

export const GENDER_OPTIONS = [
  { value: 'woman', label: 'Woman' },
  { value: 'man', label: 'Man' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
] as const

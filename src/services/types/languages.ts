/**
 * Languages a member speaks, or is learning. Indian languages come first,
 * then languages from around the world.
 */

export const INDIAN_LANGUAGES = [
  'English',
  'Hindi',
  'Kannada',
  'Tamil',
  'Telugu',
  'Malayalam',
  'Marathi',
  'Bengali',
  'Gujarati',
  'Punjabi',
  'Urdu',
  'Odia',
  'Assamese',
  'Konkani',
  'Tulu',
  'Kodava',
  'Beary',
  'Sindhi',
  'Kashmiri',
  'Nepali',
  'Manipuri',
  'Bhojpuri',
  'Maithili',
  'Rajasthani',
  'Marwari',
  'Haryanvi',
  'Dogri',
  'Santali',
  'Bodo',
  'Khasi',
  'Mizo',
  'Garo',
  'Sanskrit',
  'Badaga',
  'Dakhini',
  'Lambadi',
  'Saurashtra',
] as const

export const WORLD_LANGUAGES = [
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Japanese',
  'Korean',
  'Mandarin',
  'Cantonese',
  'Arabic',
  'Russian',
  'Turkish',
  'Persian',
  'Dutch',
  'Swedish',
  'Norwegian',
  'Danish',
  'Finnish',
  'Polish',
  'Czech',
  'Greek',
  'Hebrew',
  'Thai',
  'Vietnamese',
  'Indonesian',
  'Malay',
  'Tagalog',
  'Sinhala',
  'Burmese',
  'Khmer',
  'Swahili',
  'Amharic',
  'Hungarian',
  'Romanian',
  'Ukrainian',
  'Irish',
  'Welsh',
  'Catalan',
  'Basque',
  'Latin',
  'Esperanto',
  'Indian Sign Language',
  'American Sign Language',
  'British Sign Language',
] as const

export const LANGUAGES = [...INDIAN_LANGUAGES, ...WORLD_LANGUAGES] as const
export type Language = (typeof LANGUAGES)[number]

export function isLanguage(value: string): value is Language {
  return (LANGUAGES as readonly string[]).includes(value)
}

export const LANGUAGE_LEVELS = ['fluent', 'conversational', 'learning'] as const
export type LanguageLevel = (typeof LANGUAGE_LEVELS)[number]

export const LANGUAGE_LEVEL_LABELS: Record<LanguageLevel, string> = {
  fluent: 'Fluent',
  conversational: 'Conversational',
  learning: 'Learning',
}

export interface SpokenLanguage {
  language: Language
  level: LanguageLevel
}

export const MAX_LANGUAGES = 10

import { isLanguage, LANGUAGE_LEVELS, MAX_LANGUAGES, type LanguageLevel, type SpokenLanguage } from '@/services/types/languages'

/** Why a list of languages can't be saved, in words a member can act on, or `null` when it can. */
export function languagesProblem(list: readonly { language: string; level: string }[]): string | null {
  if (list.length === 0) return 'Add at least one language.'
  if (list.length > MAX_LANGUAGES) return `Add up to ${MAX_LANGUAGES} languages.`
  const seen = new Set<string>()
  for (const entry of list) {
    if (!isLanguage(entry.language)) return `“${entry.language}” isn’t a language we know yet.`
    if (!LANGUAGE_LEVELS.includes(entry.level as LanguageLevel)) return `Say how well you speak ${entry.language}.`
    if (seen.has(entry.language)) return `${entry.language} is in the list twice.`
    seen.add(entry.language)
  }
  if (list.every((entry) => entry.level === 'learning')) return 'Add at least one language you can already chat in.'
  return null
}

/** "Speaks English and Kannada", then the ones that are conversational, then the ones being learned. */
export function describeLanguages(list: readonly SpokenLanguage[]): { speaks: string[]; conversational: string[]; learning: string[] } {
  const of = (level: LanguageLevel) => list.filter((entry) => entry.level === level).map((entry) => entry.language)
  return { speaks: of('fluent'), conversational: of('conversational'), learning: of('learning') }
}

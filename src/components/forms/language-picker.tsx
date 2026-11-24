import { Plus, Search, X } from 'lucide-react'
import { useId, useState } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  LANGUAGE_LEVEL_LABELS,
  LANGUAGE_LEVELS,
  LANGUAGES,
  MAX_LANGUAGES,
  WORLD_LANGUAGES,
  type Language,
  type LanguageLevel,
  type SpokenLanguage,
} from '@/services/types/languages'

/** Shown before anything is typed: the languages most people here add, and a few people learn. */
const SUGGESTED: Language[] = ['English', 'Hindi', 'Kannada', 'Tamil', 'Telugu', 'Malayalam', 'Marathi', 'Bengali', 'Spanish', 'French', 'Japanese', 'Korean']

interface LanguagePickerProps {
  value: readonly SpokenLanguage[]
  onChange: (value: SpokenLanguage[]) => void
  describedBy?: string
}

/** The languages you speak, each with how well, and any you are learning. */
export function LanguagePicker({ value, onChange, describedBy }: LanguagePickerProps) {
  const id = useId()
  const [query, setQuery] = useState('')
  const chosen = new Set(value.map((entry) => entry.language))
  const full = value.length >= MAX_LANGUAGES
  const key = query.trim().toLowerCase()
  const options = (key ? LANGUAGES.filter((language) => language.toLowerCase().includes(key)) : SUGGESTED)
    .filter((language) => !chosen.has(language))
    .slice(0, 12)

  const add = (language: Language) => {
    // A language from further away is more often one people are learning.
    const level: LanguageLevel = (WORLD_LANGUAGES as readonly string[]).includes(language) ? 'learning' : 'fluent'
    onChange([...value, { language, level }])
    setQuery('')
  }
  const setLevel = (language: Language, level: LanguageLevel) =>
    onChange(value.map((entry) => (entry.language === language ? { ...entry, level } : entry)))
  const remove = (language: Language) => onChange(value.filter((entry) => entry.language !== language))

  return (
    <div className="grid min-w-0 gap-7" aria-describedby={describedBy}>
      {value.length > 0 ? (
        <ul className="grid gap-3" aria-label="Your languages">
          {value.map((entry) => (
            <li key={entry.language} className="rounded-2xl border border-border/70 bg-card p-4 shadow-card">
              <div className="flex items-center justify-between gap-3">
                <p className="font-display text-h4">{entry.language}</p>
                <button
                  type="button"
                  onClick={() => remove(entry.language)}
                  aria-label={`Remove ${entry.language}`}
                  className="-mr-2 flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <X className="size-4.5" aria-hidden="true" />
                </button>
              </div>
              <fieldset className="mt-3 min-w-0">
                <legend className="sr-only">How well do you speak {entry.language}?</legend>
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
                  {LANGUAGE_LEVELS.map((level) => {
                    const checked = entry.level === level
                    return (
                      <label
                        key={level}
                        className={cn(
                          'relative flex min-h-10 cursor-pointer items-center justify-center rounded-lg px-1 text-center text-sm font-semibold transition-colors has-focus-visible:outline-2 has-focus-visible:outline-ring',
                          checked ? 'bg-card text-foreground shadow-card' : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <input
                          type="radio"
                          name={`${id}-${entry.language}`}
                          value={level}
                          checked={checked}
                          onChange={() => setLevel(entry.language, level)}
                          className="sr-only"
                        />
                        {LANGUAGE_LEVEL_LABELS[level]}
                      </label>
                    )
                  })}
                </div>
              </fieldset>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-3">
        <Label htmlFor={`${id}-search`}>{value.length > 0 ? 'Add another language' : 'Add a language'}</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id={`${id}-search`}
            type="search"
            value={query}
            disabled={full}
            onChange={(change) => setQuery(change.target.value)}
            placeholder={full ? `That’s ${MAX_LANGUAGES}, the most you can add` : `Search ${LANGUAGES.length} languages`}
            autoComplete="off"
            className="pl-11"
            aria-describedby={`${id}-results`}
          />
        </div>
        <p id={`${id}-results`} className="sr-only" aria-live="polite">
          {key ? `${options.length} ${options.length === 1 ? 'language' : 'languages'} found` : ''}
        </p>
        {!full ? (
          <ul className="flex flex-wrap gap-2" aria-label={key ? 'Matching languages' : 'Suggested languages'}>
            {options.map((language) => (
              <li key={language}>
                <button
                  type="button"
                  onClick={() => add(language)}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-input bg-card px-4 font-medium transition-colors hover:border-foreground/60"
                >
                  <Plus className="size-4" aria-hidden="true" />
                  {language}
                </button>
              </li>
            ))}
            {key && options.length === 0 ? <li className="text-muted-foreground">No language by that name yet.</li> : null}
          </ul>
        ) : null}
      </div>
    </div>
  )
}

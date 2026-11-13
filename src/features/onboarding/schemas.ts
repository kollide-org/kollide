import { z } from 'zod'

import { ageFromDateOfBirth, MINIMUM_AGE } from '@/domain/time'
import { AREAS, GENDER_OPTIONS, INTERESTS, LANGUAGES, PROFILE_PROMPTS } from '@/services/types/common'

/**
 * Validation for each onboarding step. The same rules are checked again by the
 * service when the profile is created.
 */

export const nameSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, 'Enter your first name.')
    .max(30, 'Keep it to 30 characters or fewer.')
    .regex(/^[\p{L}][\p{L}\p{M}' -]*$/u, 'Use letters only.'),
})

const numberIn = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, message)
    .refine((value) => Number(value) >= min && Number(value) <= max, message)

export const birthdaySchema = z
  .object({
    birthDay: numberIn(1, 31, 'Enter a day from 1 to 31.'),
    birthMonth: numberIn(1, 12, 'Enter a month from 1 to 12.'),
    birthYear: numberIn(1900, 2100, 'Enter the full year, such as 1996.'),
  })
  .refine(({ birthDay, birthMonth, birthYear }) => isRealDate(Number(birthYear), Number(birthMonth), Number(birthDay)), {
    path: ['birthDay'],
    message: 'That date doesn’t exist. Check the day and month.',
  })
  .refine(({ birthDay, birthMonth, birthYear }) => toDate(birthYear, birthMonth, birthDay) <= new Date(), {
    path: ['birthYear'],
    message: 'Your date of birth can’t be in the future.',
  })

function isRealDate(year: number, month: number, day: number): boolean {
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

function toDate(year: string, month: string, day: string): Date {
  return new Date(Number(year), Number(month) - 1, Number(day))
}

/** YYYY-MM-DD, the format the profile service expects. */
export function toIsoDate(year: string, month: string, day: string): string {
  return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

/** The age for a typed date of birth, or `null` if it is not a complete, real date yet. */
export function ageFor(draft: { birthDay: string; birthMonth: string; birthYear: string }, now = new Date()): number | null {
  if (!birthdaySchema.safeParse(draft).success) return null
  return ageFromDateOfBirth(toIsoDate(draft.birthYear, draft.birthMonth, draft.birthDay), now)
}

export function isOldEnough(age: number | null): boolean {
  return age !== null && age >= MINIMUM_AGE
}

export const genderSchema = z.enum(GENDER_OPTIONS.map((option) => option.value), 'Choose one option.')
export const areaSchema = z.enum(AREAS, 'Choose your area.')

export const PHOTO_COUNT = 3
export const photosSchema = z.array(z.string().min(1)).length(PHOTO_COUNT, 'Add three photos to continue.')

export const MIN_INTERESTS = 3
export const MAX_INTERESTS = 8
export const interestsSchema = z
  .array(z.enum(INTERESTS))
  .min(MIN_INTERESTS, `Pick at least ${MIN_INTERESTS}, so people have something to ask you about.`)
  .max(MAX_INTERESTS, `Pick up to ${MAX_INTERESTS}.`)

export const languagesSchema = z.array(z.enum(LANGUAGES)).min(1, 'Pick at least one language.')

export const MIN_PROMPTS = 2
export const MAX_PROMPTS = 3
export const PROMPT_MAX_LENGTH = 160
const promptIds = PROFILE_PROMPTS.map((prompt) => prompt.promptId)
export const promptsSchema = z
  .array(
    z.object({
      promptId: z.enum(promptIds),
      question: z.string(),
      answer: z
        .string()
        .trim()
        .min(3, 'Write a few words for each prompt you chose.')
        .max(PROMPT_MAX_LENGTH, `Keep each answer to ${PROMPT_MAX_LENGTH} characters.`),
    }),
  )
  .min(MIN_PROMPTS, `Answer at least ${MIN_PROMPTS} prompts.`)
  .max(MAX_PROMPTS)

/** An Indian mobile number: ten digits, starting with 6 to 9. */
export const phoneSchema = z.object({
  phone: z
    .string()
    .transform((value) => value.replace(/[\s-]/g, ''))
    .pipe(z.string().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit mobile number.')),
})

export const consentSchema = z.object({
  acceptedConduct: z.literal(true, 'Accept the code of conduct to continue.'),
  acceptedPrivacy: z.literal(true, 'Accept the privacy notice to continue.'),
})

import { z } from 'zod'

import { HOUSE_PARTY_MAX_GUESTS } from '@/domain/bookings'
import { MINIMUM_AGE } from '@/domain/time'
import { AREAS, EVENT_CATEGORIES } from '@/services/types'
import type { Area, EventCategory, EventDraft } from '@/services'

/** What a host types while creating an event. Numbers are kept as typed until they are checked. */
export interface EventFormDraft {
  title: string
  category: EventCategory | null
  summary: string
  description: string
  coverUrl: string | null
  date: string
  startTime: string
  endTime: string
  area: Area | null
  venueName: string
  exactAddress: string
  directions: string
  capacity: string
  womenOnly: boolean
  ageMin: string
  ageMax: string
  pricingMode: 'free' | 'pay_at_venue' | 'cost_split'
  amount: string
  pricingNote: string
  houseRules: string[]
}

export const EMPTY_EVENT_DRAFT: EventFormDraft = {
  title: '',
  category: null,
  summary: '',
  description: '',
  coverUrl: null,
  date: '',
  startTime: '',
  endTime: '',
  area: null,
  venueName: '',
  exactAddress: '',
  directions: '',
  capacity: '',
  womenOnly: false,
  ageMin: String(MINIMUM_AGE),
  ageMax: '',
  pricingMode: 'free',
  amount: '',
  pricingNote: '',
  houseRules: ['Be kind to everyone at the table.'],
}

/** Every event carries this rule. Hosts cannot remove it. */
export const FIXED_RULE = 'Kollide is not a dating app. Come to make friends.'

export const SUGGESTED_RULES = [
  'Arrive within fifteen minutes of the start.',
  'Shoes off at the door.',
  'Music goes down at 10:30 pm for the neighbours.',
  'No smoking indoors.',
  'Nobody is pressured to drink.',
  'Tell the host about allergies in advance.',
]

export function coverForCategory(category: EventCategory): string {
  return `/assets/covers/category-${category}.svg`
}

export const COVER_OPTIONS = EVENT_CATEGORIES.map((category) => ({ category, url: coverForCategory(category) }))

const wholeNumber = (message: string) => z.string().trim().regex(/^\d+$/, message)

export const basicsSchema = z.object({
  title: z.string().trim().min(5, 'Give it a title of at least five characters.').max(60, 'Keep the title to 60 characters.'),
  category: z.enum(EVENT_CATEGORIES, 'Choose what kind of event it is.'),
  summary: z.string().trim().min(15, 'Describe it in a sentence.').max(120, 'Keep the summary to 120 characters.'),
})

export const detailsSchema = z.object({
  description: z.string().trim().min(40, 'Tell guests a little more, in two or three sentences.').max(800, 'Keep it to 800 characters.'),
})

/** The start and end as dates. An end time earlier than the start means it runs past midnight. */
export function eventTimes(draft: Pick<EventFormDraft, 'date' | 'startTime' | 'endTime'>): { startsAt: Date; endsAt: Date } | null {
  if (!draft.date || !draft.startTime || !draft.endTime) return null
  const startsAt = new Date(`${draft.date}T${draft.startTime}`)
  const endsAt = new Date(`${draft.date}T${draft.endTime}`)
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return null
  if (endsAt <= startsAt) endsAt.setDate(endsAt.getDate() + 1)
  return { startsAt, endsAt }
}

export const placeSchema = z
  .object({
    date: z.string().min(1, 'Choose a date.'),
    startTime: z.string().min(1, 'Choose a start time.'),
    endTime: z.string().min(1, 'Choose an end time.'),
    area: z.enum(AREAS, 'Choose the area.'),
    venueName: z.string().trim().max(60),
    exactAddress: z.string().trim().min(10, 'Add the full address. Guests see it only once they are approved.'),
    directions: z.string().trim().max(200),
  })
  .refine((draft) => (eventTimes(draft)?.startsAt.getTime() ?? 0) > Date.now(), {
    path: ['date'],
    message: 'Choose a start time in the future.',
  })

export function guestsSchema(category: EventCategory | null) {
  const cap = category === 'house_party' ? HOUSE_PARTY_MAX_GUESTS : 200
  return z
    .object({
      capacity: wholeNumber('Enter how many guests you have room for.')
        .refine((value) => Number(value) >= 2, 'An event needs room for at least two guests.')
        .refine(
          (value) => Number(value) <= cap,
          category === 'house_party' ? `House parties are capped at ${HOUSE_PARTY_MAX_GUESTS} guests.` : `Keep it to ${cap} guests or fewer.`,
        ),
      ageMin: wholeNumber('Enter the youngest age.').refine((value) => Number(value) >= MINIMUM_AGE, `Kollide is for people aged ${MINIMUM_AGE} and over.`),
      ageMax: z.string().trim().regex(/^\d*$/, 'Enter an age, or leave it empty.'),
    })
    .refine((draft) => !draft.ageMax || Number(draft.ageMax) >= Number(draft.ageMin), {
      path: ['ageMax'],
      message: 'The oldest age must be at least the youngest.',
    })
}

export const costSchema = z
  .object({
    pricingMode: z.enum(['free', 'pay_at_venue', 'cost_split']),
    amount: z.string().trim(),
    pricingNote: z.string().trim().max(80, 'Keep the note to 80 characters.'),
  })
  .refine((draft) => draft.pricingMode !== 'cost_split' || (/^\d+$/.test(draft.amount) && Number(draft.amount) > 0), {
    path: ['amount'],
    message: 'Enter roughly what each guest will pay, in rupees.',
  })

export const rulesSchema = z.object({
  houseRules: z.array(z.string().trim().min(3)).min(1, 'Add at least one house rule.').max(8, 'Keep it to eight rules.'),
})

export const CREATE_STEPS = [
  { id: 'basics', check: (draft: EventFormDraft) => basicsSchema.safeParse(draft).success },
  { id: 'details', check: (draft: EventFormDraft) => detailsSchema.safeParse(draft).success },
  { id: 'place', check: (draft: EventFormDraft) => placeSchema.safeParse(draft).success },
  { id: 'guests', check: (draft: EventFormDraft) => guestsSchema(draft.category).safeParse(draft).success },
  { id: 'cost', check: (draft: EventFormDraft) => costSchema.safeParse(draft).success },
  { id: 'rules', check: (draft: EventFormDraft) => rulesSchema.safeParse(draft).success },
  { id: 'review', check: () => true },
] as const

export type CreateStepId = (typeof CREATE_STEPS)[number]['id']

/** The first step that still needs something, or the review step if all are done. */
export function firstOpenStep(draft: EventFormDraft): CreateStepId {
  return (CREATE_STEPS.find((step) => !step.check(draft)) ?? CREATE_STEPS.at(-1)!).id
}

/** Turns a finished form into what the event service expects. */
export function toEventDraft(draft: EventFormDraft): EventDraft {
  const times = eventTimes(draft)!
  const category = draft.category!
  return {
    title: draft.title.trim(),
    summary: draft.summary.trim(),
    description: draft.description.trim(),
    category,
    coverUrl: draft.coverUrl ?? coverForCategory(category),
    coverAlt: `Abstract artwork for ${draft.title.trim()}.`,
    startsAt: times.startsAt.toISOString(),
    endsAt: times.endsAt.toISOString(),
    area: draft.area!,
    venueName: draft.venueName.trim() || null,
    exactAddress: draft.exactAddress.trim(),
    directions: draft.directions.trim() || null,
    pricing: {
      mode: draft.pricingMode,
      amountInr: draft.pricingMode === 'cost_split' ? Number(draft.amount) : null,
      note: draft.pricingNote.trim() || null,
    },
    capacity: Number(draft.capacity),
    womenOnly: draft.womenOnly,
    ageRange: { min: Number(draft.ageMin), max: draft.ageMax ? Number(draft.ageMax) : null },
    houseRules: [...draft.houseRules.map((rule) => rule.trim()).filter(Boolean), FIXED_RULE],
  }
}

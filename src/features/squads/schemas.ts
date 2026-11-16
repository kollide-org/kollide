import { z } from 'zod'

import { SQUAD_MAX_SIZE, SQUAD_MIN_SIZE } from '@/services/types'

/** How long before the event a squad meets. */
export const MEET_MINUTES = [15, 30, 45, 60] as const
export const SQUAD_SIZES = [4, 5, 6] as const

export const squadFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Give your squad a name.')
    .max(40, 'Keep the name under 40 characters.'),
  place: z
    .string()
    .trim()
    .min(3, 'Add a public place to meet, such as a café near the venue.')
    .max(80, 'Keep the place under 80 characters.'),
  minutesBefore: z.union(MEET_MINUTES.map((minutes) => z.literal(minutes))),
  size: z
    .number()
    .int()
    .min(SQUAD_MIN_SIZE, `A squad is ${SQUAD_MIN_SIZE} to ${SQUAD_MAX_SIZE} people.`)
    .max(SQUAD_MAX_SIZE, `A squad is ${SQUAD_MIN_SIZE} to ${SQUAD_MAX_SIZE} people.`),
  womenOnly: z.boolean(),
})

export type SquadForm = z.infer<typeof squadFormSchema>

export const EMPTY_SQUAD_FORM: SquadForm = { name: '', place: '', minutesBefore: 30, size: 5, womenOnly: false }

/** When the squad meets, worked out from the event's start. */
export function meetingTime(startsAt: string, minutesBefore: number): Date {
  return new Date(new Date(startsAt).getTime() - minutesBefore * 60_000)
}

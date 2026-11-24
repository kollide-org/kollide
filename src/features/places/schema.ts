import { z } from 'zod'

import { AREA_PROBLEMS, resolveArea } from '@/domain/places'

/** The same check the service runs: an open city, an area, and a part of the city for a typed one. */
export const areaChoiceSchema = z
  .object({ city: z.string(), area: z.string(), zone: z.string().nullable() })
  .superRefine((value, context) => {
    const result = resolveArea(value.city, value.area, value.zone ?? undefined)
    if (!result.ok) context.addIssue({ code: 'custom', message: AREA_PROBLEMS[result.problem], path: [result.problem === 'needs_zone' ? 'zone' : 'area'] })
  })

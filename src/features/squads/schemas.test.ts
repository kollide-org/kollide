import { describe, expect, it } from 'vitest'

import { EMPTY_SQUAD_FORM, meetingTime, squadFormSchema } from './schemas'

describe('squad form', () => {
  it('needs a name and a public place to meet', () => {
    const result = squadFormSchema.safeParse(EMPTY_SQUAD_FORM)
    expect(result.success).toBe(false)
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(['name', 'place'])
  })

  it('accepts four to six people and the offered meeting times', () => {
    const valid = { ...EMPTY_SQUAD_FORM, name: 'Early birds', place: 'Third Wave Coffee, Hebbal' }
    expect(squadFormSchema.safeParse(valid).success).toBe(true)
    expect(squadFormSchema.safeParse({ ...valid, size: 3 }).success).toBe(false)
    expect(squadFormSchema.safeParse({ ...valid, size: 7 }).success).toBe(false)
    expect(squadFormSchema.safeParse({ ...valid, minutesBefore: 20 }).success).toBe(false)
  })

  it('trims what people type', () => {
    const parsed = squadFormSchema.parse({ ...EMPTY_SQUAD_FORM, name: '  Early birds ', place: ' Koshy’s  ' })
    expect(parsed).toMatchObject({ name: 'Early birds', place: 'Koshy’s' })
  })

  it('works out the meeting time from the start time', () => {
    expect(meetingTime('2026-12-31T20:00:00.000Z', 30).toISOString()).toBe('2026-12-31T19:30:00.000Z')
  })
})

import { describe, expect, it } from 'vitest'

import { basicsSchema, costSchema, EMPTY_EVENT_DRAFT, eventTimes, firstOpenStep, FIXED_RULE, guestsSchema, toEventDraft, type EventFormDraft } from './create-schemas'

const nextYear = new Date().getFullYear() + 1
const complete: EventFormDraft = {
  ...EMPTY_EVENT_DRAFT,
  title: 'Carrom and chai',
  category: 'games',
  summary: 'A relaxed evening of carrom, with chai and bajji.',
  description: 'Two boards, four players each, and a kettle that never stops. Beginners are welcome and will be taught.',
  date: `${nextYear}-03-14`,
  startTime: '18:00',
  endTime: '21:00',
  area: 'Jayanagar',
  exactAddress: 'No. 12, 4th Cross, Jayanagar 4th Block',
  capacity: '8',
}

describe('creating an event', () => {
  it('walks the host through the steps in order', () => {
    expect(firstOpenStep(EMPTY_EVENT_DRAFT)).toBe('basics')
    expect(firstOpenStep({ ...complete, description: '' })).toBe('details')
    expect(firstOpenStep({ ...complete, exactAddress: '' })).toBe('place')
    expect(firstOpenStep({ ...complete, capacity: '' })).toBe('guests')
    expect(firstOpenStep(complete)).toBe('review')
  })

  it('needs a real title, category and summary', () => {
    expect(basicsSchema.safeParse({ title: 'Hi', category: 'games', summary: 'A relaxed evening of carrom.' }).success).toBe(false)
    expect(basicsSchema.safeParse({ title: 'Carrom night', category: null, summary: 'A relaxed evening of carrom.' }).success).toBe(false)
  })

  it('caps house parties at 25 guests and keeps everyone 18 or over', () => {
    const guests = (capacity: string, ageMin = '18', ageMax = '') => ({ capacity, ageMin, ageMax })
    expect(guestsSchema('house_party').safeParse(guests('25')).success).toBe(true)
    expect(guestsSchema('house_party').safeParse(guests('26')).success).toBe(false)
    expect(guestsSchema('games').safeParse(guests('26')).success).toBe(true)
    expect(guestsSchema('games').safeParse(guests('1')).success).toBe(false)
    expect(guestsSchema('games').safeParse(guests('10', '16')).success).toBe(false)
    expect(guestsSchema('games').safeParse(guests('10', '25', '21')).success).toBe(false)
  })

  it('asks for an amount only when the cost is split', () => {
    expect(costSchema.safeParse({ pricingMode: 'free', amount: '', pricingNote: '' }).success).toBe(true)
    expect(costSchema.safeParse({ pricingMode: 'cost_split', amount: '', pricingNote: '' }).success).toBe(false)
    expect(costSchema.safeParse({ pricingMode: 'cost_split', amount: '400', pricingNote: '' }).success).toBe(true)
  })

  it('treats an end time before the start as the next day', () => {
    const times = eventTimes({ date: `${nextYear}-03-14`, startTime: '20:00', endTime: '01:00' })!
    expect(times.endsAt.getDate()).toBe(15)
    expect(times.endsAt.getTime() - times.startsAt.getTime()).toBe(5 * 3_600_000)
  })

  it('builds what the service expects, and always adds the fixed rule', () => {
    const draft = toEventDraft({ ...complete, pricingMode: 'cost_split', amount: '300', ageMax: '40' })
    expect(draft).toMatchObject({
      title: 'Carrom and chai',
      category: 'games',
      coverUrl: '/assets/covers/category-games.svg',
      venueName: null,
      pricing: { mode: 'cost_split', amountInr: 300, note: null },
      capacity: 8,
      ageRange: { min: 18, max: 40 },
    })
    expect(draft.houseRules.at(-1)).toBe(FIXED_RULE)
  })
})

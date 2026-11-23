import { describe, expect, it } from 'vitest'

import { bengaluruHour, dayPart } from './day-part'

describe('time of day', () => {
  it('reads the hour in Bengaluru, whatever the device’s time zone', () => {
    // 12:30 UTC is 18:00 in Bengaluru.
    expect(bengaluruHour(new Date('2026-11-20T12:30:00Z'))).toBe(18)
    expect(bengaluruHour(new Date('2026-11-20T20:00:00Z'))).toBe(1)
  })

  it('names each part of the day', () => {
    expect([4, 5, 9, 16, 19, 21, 23].map(dayPart)).toEqual(['night', 'dawn', 'day', 'golden', 'dusk', 'night', 'night'])
  })
})

import { describe, expect, it } from 'vitest'

import { bengaluruClock, fromBengaluru } from './time'

describe('Bengaluru time', () => {
  it('builds a Bengaluru wall-clock time whatever the device time zone', () => {
    expect(fromBengaluru(2026, 10, 24, 18, 30).toISOString()).toBe('2026-11-24T13:00:00.000Z')
  })

  it('reads the Bengaluru date, which can be a day ahead of UTC', () => {
    // 20:00 UTC on the 23rd is 01:30 on the 24th in Bengaluru, a Tuesday.
    expect(bengaluruClock(new Date('2026-11-23T20:00:00Z'))).toEqual({ year: 2026, month: 10, day: 24, weekday: 2 })
  })

  it('lets days run over into the next month', () => {
    expect(fromBengaluru(2026, 10, 31, 9).toISOString()).toBe('2026-12-01T03:30:00.000Z')
  })
})

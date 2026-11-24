import { describe, expect, it } from 'vitest'

import { countFilters, filtersFromParams, filtersToParams, toggleInList } from './filters'

describe('event filters in the address', () => {
  it('round-trips every filter', () => {
    const filters = {
      date: 'this_weekend' as const,
      zones: ['east' as const, 'south' as const],
      categories: ['games' as const],
      price: 'free' as const,
      groupSize: 'small' as const,
      womenOnly: true,
      hubId: 'hub-nye',
    }
    const params = filtersToParams(filters)
    expect(params.toString()).toBe('date=this_weekend&zones=east%2Csouth&categories=games&price=free&size=small&women=1&hub=hub-nye')
    expect(filtersFromParams(params)).toEqual(filters)
    expect(countFilters(filters)).toBe(8)
  })

  it('ignores anything it does not recognise', () => {
    const params = new URLSearchParams('date=yesterday&zones=mumbai,east&price=cheap&women=yes&size=huge')
    expect(filtersFromParams(params)).toEqual({ zones: ['east'] })
    expect(filtersFromParams(new URLSearchParams())).toEqual({})
    expect(countFilters({})).toBe(0)
  })

  it('adds and removes items, leaving nothing behind when empty', () => {
    expect(toggleInList(undefined, 'a')).toEqual(['a'])
    expect(toggleInList(['a'], 'b')).toEqual(['a', 'b'])
    expect(toggleInList(['a'], 'a')).toBeUndefined()
  })
})

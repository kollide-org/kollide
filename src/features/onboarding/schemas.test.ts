import { describe, expect, it } from 'vitest'

import { EMPTY_DRAFT } from './draft'
import { ageFor, birthdaySchema, isOldEnough, nameSchema, phoneSchema, promptsSchema, toIsoDate } from './schemas'
import { canOpenStep, firstIncompleteStep } from './steps'

const NOW = new Date(2026, 10, 13)
const birthday = (birthDay: string, birthMonth: string, birthYear: string) => ({ birthDay, birthMonth, birthYear })

describe('onboarding validation', () => {
  it('accepts real first names and rejects the rest', () => {
    for (const firstName of ['Ananya', 'Mira D’Souza'.split(' ')[0], 'José', 'Anne-Marie']) {
      expect(nameSchema.safeParse({ firstName }).success, firstName).toBe(true)
    }
    for (const firstName of ['', 'A', '1234', '@ananya']) expect(nameSchema.safeParse({ firstName }).success, firstName).toBe(false)
  })

  it('only accepts dates that exist and are in the past', () => {
    expect(birthdaySchema.safeParse(birthday('29', '2', '1996')).success).toBe(true)
    expect(birthdaySchema.safeParse(birthday('29', '2', '1997')).success).toBe(false)
    expect(birthdaySchema.safeParse(birthday('31', '4', '1996')).success).toBe(false)
    expect(birthdaySchema.safeParse(birthday('1', '13', '1996')).success).toBe(false)
    expect(birthdaySchema.safeParse(birthday('1', '1', '2999')).success).toBe(false)
    expect(toIsoDate('1996', '4', '7')).toBe('1996-04-07')
  })

  it('works out age and blocks anyone under 18', () => {
    expect(ageFor(birthday('13', '11', '2008'), NOW)).toBe(18)
    expect(isOldEnough(ageFor(birthday('13', '11', '2008'), NOW))).toBe(true)
    expect(isOldEnough(ageFor(birthday('14', '11', '2008'), NOW))).toBe(false)
    expect(ageFor(birthday('', '', ''), NOW)).toBeNull()
    expect(isOldEnough(null)).toBe(false)
  })

  it('accepts Indian mobile numbers, with or without spaces', () => {
    expect(phoneSchema.parse({ phone: '98450 12345' })).toEqual({ phone: '9845012345' })
    expect(phoneSchema.safeParse({ phone: '12345' }).success).toBe(false)
    expect(phoneSchema.safeParse({ phone: '5845012345' }).success).toBe(false)
  })

  it('needs two or three answered prompts', () => {
    const prompt = (promptId: string, answer: string) => ({ promptId, question: 'A question', answer })
    expect(promptsSchema.safeParse([prompt('perfect-sunday', 'A long walk.')]).success).toBe(false)
    expect(promptsSchema.safeParse([prompt('perfect-sunday', 'A long walk.'), prompt('ask-me-about', 'My plants.')]).success).toBe(true)
    expect(promptsSchema.safeParse([prompt('perfect-sunday', 'A long walk.'), prompt('ask-me-about', ' ')]).success).toBe(false)
  })
})

describe('onboarding steps', () => {
  it('starts at the name and unlocks one step at a time', () => {
    expect(firstIncompleteStep(EMPTY_DRAFT)).toBe('name')
    expect(canOpenStep('name', EMPTY_DRAFT)).toBe(true)
    expect(canOpenStep('photos', EMPTY_DRAFT)).toBe(false)

    const named = { ...EMPTY_DRAFT, firstName: 'Isha' }
    expect(firstIncompleteStep(named)).toBe('birthday')
    expect(canOpenStep('birthday', named)).toBe(true)
    expect(canOpenStep('gender', named)).toBe(false)
  })

  it('never lets someone under 18 past the birthday step', () => {
    const year = String(new Date().getFullYear() - 16)
    const young = { ...EMPTY_DRAFT, firstName: 'Isha', ...birthday('1', '1', year) }
    expect(firstIncompleteStep(young)).toBe('birthday')
    expect(canOpenStep('photos', { ...young, gender: 'woman' as const, area: 'Indiranagar' as const })).toBe(false)
  })
})

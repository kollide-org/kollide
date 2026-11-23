import type { ISODate, ISODateTime } from '@/services/types'

export const HOUR_MS = 60 * 60 * 1000
export const DAY_MS = 24 * HOUR_MS

export function hoursBetween(from: ISODateTime | Date, to: ISODateTime | Date): number {
  return (new Date(to).getTime() - new Date(from).getTime()) / HOUR_MS
}

export function daysBetween(from: ISODateTime | Date, to: ISODateTime | Date): number {
  return (new Date(to).getTime() - new Date(from).getTime()) / DAY_MS
}

/** India keeps one offset all year, with no daylight saving. */
const BENGALURU_OFFSET_MS = 5.5 * HOUR_MS

/** The calendar date and time in Bengaluru, whatever time zone the device is in. */
export function bengaluruClock(at: Date): { year: number; month: number; day: number; weekday: number } {
  const shifted = new Date(at.getTime() + BENGALURU_OFFSET_MS)
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth(), day: shifted.getUTCDate(), weekday: shifted.getUTCDay() }
}

/** A moment given as a Bengaluru date and time. `month` counts from 0; days may overflow into the next month. */
export function fromBengaluru(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  return new Date(Date.UTC(year, month, day, hour, minute) - BENGALURU_OFFSET_MS)
}

/** Age in whole years on `now`, by the Bengaluru calendar. */
export function ageFromDateOfBirth(dateOfBirth: ISODate, now: Date): number {
  const [year, month, day] = dateOfBirth.split('-').map(Number)
  const today = bengaluruClock(now)
  let age = today.year - year
  const hadBirthday = today.month + 1 > month || (today.month + 1 === month && today.day >= day)
  if (!hadBirthday) age -= 1
  return age
}

export const MINIMUM_AGE = 18

/** Kollide is for adults only. */
export function isAdult(dateOfBirth: ISODate, now: Date): boolean {
  return ageFromDateOfBirth(dateOfBirth, now) >= MINIMUM_AGE
}

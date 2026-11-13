import type { ISODate, ISODateTime } from '@/services/types'

export const HOUR_MS = 60 * 60 * 1000
export const DAY_MS = 24 * HOUR_MS

export function hoursBetween(from: ISODateTime | Date, to: ISODateTime | Date): number {
  return (new Date(to).getTime() - new Date(from).getTime()) / HOUR_MS
}

export function daysBetween(from: ISODateTime | Date, to: ISODateTime | Date): number {
  return (new Date(to).getTime() - new Date(from).getTime()) / DAY_MS
}

/** Age in whole years on `now`. */
export function ageFromDateOfBirth(dateOfBirth: ISODate, now: Date): number {
  const [year, month, day] = dateOfBirth.split('-').map(Number)
  let age = now.getFullYear() - year
  const hadBirthday = now.getMonth() + 1 > month || (now.getMonth() + 1 === month && now.getDate() >= day)
  if (!hadBirthday) age -= 1
  return age
}

export const MINIMUM_AGE = 18

/** Kollide is for adults only. */
export function isAdult(dateOfBirth: ISODate, now: Date): boolean {
  return ageFromDateOfBirth(dateOfBirth, now) >= MINIMUM_AGE
}

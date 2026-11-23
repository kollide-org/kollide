/** Kollide is a Bengaluru product, so the time of day is always Bengaluru's, wherever the device is. */
export function bengaluruHour(date: Date = new Date()): number {
  const hour = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }).format(date)
  return Number(hour)
}

export type DayPart = 'dawn' | 'day' | 'golden' | 'dusk' | 'night'

export function dayPart(hour: number): DayPart {
  if (hour >= 5 && hour < 8) return 'dawn'
  if (hour >= 8 && hour < 16) return 'day'
  if (hour >= 16 && hour < 19) return 'golden'
  if (hour >= 19 && hour < 21) return 'dusk'
  return 'night'
}

export const DAY_PART_LABELS: Record<DayPart, string> = {
  dawn: 'Early light',
  day: 'Daytime',
  golden: 'Golden hour',
  dusk: 'Dusk',
  night: 'After dark',
}

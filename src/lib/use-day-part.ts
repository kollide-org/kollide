import { useEffect, useState } from 'react'

import { bengaluruHour, dayPart, type DayPart } from './day-part'

/** The part of the day in Bengaluru, checked every few minutes. */
export function useDayPart(): DayPart {
  const [part, setPart] = useState(() => dayPart(bengaluruHour()))
  useEffect(() => {
    const timer = window.setInterval(() => setPart(dayPart(bengaluruHour())), 5 * 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return part
}

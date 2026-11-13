import { useEffect, useState } from 'react'

import { useMotionAllowed } from './use-media-query'

/**
 * Counts from zero to `target` once `active` becomes true.
 * With reduced motion it shows the final number straight away.
 */
export function useCountUp(target: number, active: boolean, durationMs = 1100): number {
  const motionAllowed = useMotionAllowed()
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!active || !motionAllowed) return
    let frame = 0
    const started = performance.now()
    const tick = (time: number) => {
      const progress = Math.min(1, (time - started) / durationMs)
      // Ease out, so the count settles gently on the final number.
      setValue(Math.round(target * (1 - (1 - progress) ** 3)))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [active, durationMs, motionAllowed, target])

  return motionAllowed ? value : target
}

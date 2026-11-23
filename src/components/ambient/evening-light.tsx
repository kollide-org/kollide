import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'

import type { DayPart } from '@/lib/day-part'

/**
 * A soft light behind the top of the page that follows the time of day in
 * Bengaluru: peach at dawn, almost nothing by day, amber at golden hour, rose
 * at dusk, and a low glow after dark. When the part of the day changes, the
 * new light fades in over the old one. It drifts very slowly, and it is
 * purely decorative.
 */
export function EveningLight({ part }: { part: DayPart }) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[46rem] overflow-hidden">
      <AnimatePresence initial={false}>
        <m.div
          key={part}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2.4, ease: 'easeInOut' }}
        >
          <div className={`light-${part} absolute -inset-[8%] animate-drift-a`} />
        </m.div>
      </AnimatePresence>
    </div>
  )
}

import { stagger, type Transition, type Variants } from 'motion/react'

/**
 * Shared motion settings. Interface feedback stays between 150 and 300 ms,
 * uses springs, and only ever moves position, scale and opacity.
 */
export const spring = {
  /** Presses, toggles, small controls. */
  snappy: { type: 'spring', visualDuration: 0.18, bounce: 0.15 },
  /** Cards, pills, list items. */
  soft: { type: 'spring', visualDuration: 0.28, bounce: 0.2 },
  /** Larger surfaces. No overshoot. */
  gentle: { type: 'spring', visualDuration: 0.4, bounce: 0 },
} as const satisfies Record<string, Transition>

/** A list whose children appear one after another. */
export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { delayChildren: stagger(0.06) } },
}

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: spring.gentle },
}

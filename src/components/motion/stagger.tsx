import type { HTMLMotionProps } from 'motion/react'
import * as m from 'motion/react-m'

import { staggerContainer, staggerItem } from '@/lib/motion'

/** A group whose `StaggerItem` children appear one after another. */
export function Stagger({ inView = false, ...props }: HTMLMotionProps<'div'> & { inView?: boolean }) {
  return (
    <m.div
      variants={staggerContainer}
      initial="hidden"
      {...(inView ? { whileInView: 'visible', viewport: { once: true, margin: '-80px' } } : { animate: 'visible' })}
      {...props}
    />
  )
}

export function StaggerItem(props: HTMLMotionProps<'div'>) {
  return <m.div variants={staggerItem} {...props} />
}

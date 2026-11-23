import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import type { ReactNode } from 'react'

import { Skeleton } from '@/components/ui/skeleton'
import { spring } from '@/lib/motion'
import { cn } from '@/lib/utils'

/** A list of items an admin works through. A decided item eases out and the rest close the gap. */
export function QueueList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ul className={cn('grid grid-cols-1 gap-5', className)}>
      <AnimatePresence initial={false}>
        {children}
      </AnimatePresence>
    </ul>
  )
}

export function QueueItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <m.li
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={spring.soft}
      className={cn('rounded-2xl border border-border/70 bg-card shadow-card', className)}
    >
      {children}
    </m.li>
  )
}

export function QueueSkeleton({ label, rows = 3, className = 'h-44' }: { label: string; rows?: number; className?: string }) {
  return (
    <div role="status" aria-label={label} className="grid gap-5">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className={cn('rounded-2xl', className)} />
      ))}
    </div>
  )
}

/** A count next to a tab or heading. */
export function Count({ value }: { value: number | undefined }) {
  if (!value) return null
  return (
    <span className="ml-1.5 inline-flex min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground tabular-nums">
      {value}
    </span>
  )
}

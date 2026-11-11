import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  /** At most one action, so the screen keeps a single primary button. */
  action?: ReactNode
  /** Use 'h1' when this is the only heading on the page. */
  headingLevel?: 'h1' | 'h2'
  className?: string
}

/** Shown when a screen has loaded and there is nothing to list yet. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  headingLevel: Heading = 'h2',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-2xl border border-dashed border-foreground/20 px-6 py-14 text-center sm:py-20',
        className,
      )}
    >
      <span className="mb-6 inline-flex size-16 items-center justify-center rounded-full bg-highlight-soft text-highlight-soft-foreground">
        <Icon className="size-7" strokeWidth={1.5} aria-hidden="true" />
      </span>
      <Heading className="text-h3">{title}</Heading>
      <p className="mt-2 max-w-md text-muted-foreground">{description}</p>
      {action ? <div className="mt-8">{action}</div> : null}
    </div>
  )
}

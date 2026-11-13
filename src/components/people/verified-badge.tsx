import { BadgeCheck } from 'lucide-react'

import { cn } from '@/lib/utils'

/** The verified mark. It always carries a text label for screen readers. */
export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex text-primary', className)}>
      <BadgeCheck className="size-[1.1em]" aria-hidden="true" />
      <span className="sr-only">Verified</span>
    </span>
  )
}

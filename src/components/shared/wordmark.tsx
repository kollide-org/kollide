import { cn } from '@/lib/utils'

import { AppLink } from './app-link'

interface WordmarkProps {
  className?: string
  /** Where the wordmark links to. Pass `null` for a plain, unlinked mark. */
  to?: string | null
}

/** The Kollide wordmark, set in the display font. */
export function Wordmark({ className, to = '/' }: WordmarkProps) {
  const mark = (
    <span className={cn('font-display text-[1.75rem] leading-none tracking-[-0.01em] text-primary', className)}>
      kollide
    </span>
  )

  if (to === null) return mark

  return (
    <AppLink to={to} aria-label="Kollide home" className="inline-flex items-center rounded-md py-1">
      {mark}
    </AppLink>
  )
}

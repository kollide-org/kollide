import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/** A plain browser select, styled like Input. It works well on phones and with assistive technology. */
export function NativeSelect({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-11 w-full rounded-xl border border-input bg-card px-3.5 text-base text-foreground outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}

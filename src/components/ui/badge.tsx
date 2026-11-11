import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex h-7 w-fit shrink-0 items-center justify-center gap-1.5 rounded-full border border-transparent px-3 text-sm font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3.5',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        soft: 'bg-primary-soft text-primary-soft-foreground',
        highlight: 'bg-highlight text-highlight-foreground',
        'highlight-soft': 'bg-highlight-soft text-highlight-soft-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        outline: 'border-foreground/25 text-foreground',
        success: 'bg-success-soft text-success-strong',
        warning: 'bg-warning-soft text-warning-strong',
        destructive: 'bg-destructive-soft text-destructive-strong',
      },
      size: {
        default: '',
        sm: 'h-6 gap-1 px-2.5 text-xs font-semibold',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Badge({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span'

  return <Comp data-slot="badge" data-variant={variant} className={cn(badgeVariants({ variant, size }), className)} {...props} />
}

export { Badge, badgeVariants }

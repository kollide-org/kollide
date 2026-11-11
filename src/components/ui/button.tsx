import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center rounded-xl border border-transparent font-medium whitespace-nowrap outline-none select-none transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-200 ease-out-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[1.125em]",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-card hover:bg-primary-hover hover:shadow-lift',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_7%)]',
        soft: 'bg-primary-soft text-primary-soft-foreground hover:bg-[color-mix(in_oklch,var(--primary-soft),var(--primary)_12%)]',
        outline:
          'border-foreground/25 bg-transparent text-foreground hover:border-foreground/45 hover:bg-accent aria-expanded:bg-accent',
        ghost: 'text-foreground hover:bg-accent aria-expanded:bg-accent',
        destructive:
          'bg-destructive-soft text-destructive-strong hover:bg-[color-mix(in_oklch,var(--destructive-soft),var(--destructive)_14%)]',
        link: 'h-auto rounded-sm px-0 text-primary underline-offset-4 hover:underline active:scale-100',
      },
      size: {
        default: 'h-11 gap-2 px-5 text-base',
        sm: 'h-9 gap-1.5 rounded-lg px-3.5 text-sm',
        lg: 'h-13 gap-2.5 rounded-2xl px-7 text-base',
        icon: 'size-11',
        'icon-sm': 'size-9 rounded-lg',
      },
    },
    compoundVariants: [{ variant: 'link', className: 'h-auto px-0' }],
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

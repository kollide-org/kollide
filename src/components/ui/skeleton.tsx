import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="skeleton" aria-hidden="true" className={cn('skeleton-sheen rounded-lg bg-muted', className)} {...props} />
}

export { Skeleton }

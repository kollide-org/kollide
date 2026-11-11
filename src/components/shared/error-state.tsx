import { CircleAlert, RotateCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  /** Use 'h1' when this is the only heading on the page. */
  headingLevel?: 'h1' | 'h2'
  className?: string
}

/** Shown when loading a screen fails. Uses an icon and words, never colour alone. */
export function ErrorState({
  title = 'That didn’t load',
  description = 'Something went wrong on our side. Your plans are safe. Please try again.',
  onRetry,
  headingLevel: Heading = 'h2',
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center rounded-2xl border border-destructive/30 bg-destructive-soft/50 px-6 py-14 text-center',
        className,
      )}
    >
      <span className="mb-6 inline-flex size-16 items-center justify-center rounded-full bg-destructive-soft text-destructive-strong">
        <CircleAlert className="size-7" strokeWidth={1.5} aria-hidden="true" />
      </span>
      <Heading className="text-h3">{title}</Heading>
      <p className="mt-2 max-w-md text-muted-foreground">{description}</p>
      {onRetry ? (
        <Button variant="outline" className="mt-8" onClick={onRetry}>
          <RotateCw aria-hidden="true" />
          Try again
        </Button>
      ) : null}
    </div>
  )
}

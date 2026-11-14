import { ArrowRight, CircleAlert } from 'lucide-react'
import { useEffect, useRef, type FormEvent, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'

interface StepFormProps {
  title: string
  description?: ReactNode
  onSubmit: () => void
  submitLabel?: string
  /** Shown on the button while the step is saving. */
  pendingLabel?: string
  pending?: boolean
  /** A quieter action beside the main button, such as "Skip for now". */
  secondary?: ReactNode
  /** A problem with the step as a whole, shown above the button. */
  error?: string | null
  children: ReactNode
}

/**
 * One onboarding step: a large question, its fields, and a single main button
 * that stays within reach at the bottom of the screen.
 */
export function StepForm({
  title,
  description,
  onSubmit,
  submitLabel = 'Continue',
  pendingLabel = 'Saving…',
  pending = false,
  secondary,
  error,
  children,
}: StepFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Move focus into the new step: to its first field if it has one, else to the question.
  useEffect(() => {
    const field = formRef.current?.querySelector<HTMLElement>('[data-autofocus]')
    ;(field ?? headingRef.current)?.focus({ preventScroll: true })
  }, [])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!pending) onSubmit()
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="flex flex-1 flex-col">
      <div className="flex-1 pt-6 pb-10 sm:pt-10">
        <h1 ref={headingRef} tabIndex={-1} className="text-h1 outline-none">
          {title}
        </h1>
        {description ? <p className="mt-3 text-lead text-muted-foreground">{description}</p> : null}
        <div className="mt-9">{children}</div>
      </div>

      {/* Inside the app, the page sets --step-footer-offset so this clears the tab bar. */}
      <div className="sticky bottom-(--step-footer-offset,0px) -mx-5 border-t border-border bg-background/92 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-10 sm:backdrop-blur-none">
        {error ? (
          <p role="alert" className="mb-4 flex items-start gap-2 text-sm text-destructive-strong">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          {secondary}
          <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto sm:min-w-44">
            {pending ? pendingLabel : submitLabel}
            {pending ? null : <ArrowRight aria-hidden="true" />}
          </Button>
        </div>
      </div>
    </form>
  )
}

/** A field's error message, tied to the field by id. */
export function FieldError({ id, message }: { id: string; message?: string | null }) {
  if (!message) return null
  return (
    <p id={id} className="flex items-center gap-1.5 text-sm text-destructive-strong">
      <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  )
}

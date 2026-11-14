import { zodResolver } from '@hookform/resolvers/zod'
import { Cake } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'

import { useSession } from '@/app/providers/session-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ageFor, birthdaySchema, isOldEnough } from '@/features/onboarding/schemas'

import { FieldError, StepForm } from '@/components/forms/step-form'

import type { StepProps } from './types'

const FIELDS = [
  { name: 'birthDay', label: 'Day', placeholder: 'DD', maxLength: 2, autoComplete: 'bday-day', width: 'w-20' },
  { name: 'birthMonth', label: 'Month', placeholder: 'MM', maxLength: 2, autoComplete: 'bday-month', width: 'w-20' },
  { name: 'birthYear', label: 'Year', placeholder: 'YYYY', maxLength: 4, autoComplete: 'bday-year', width: 'w-28' },
] as const

export function BirthdayStep({ draft, update, onNext }: StepProps) {
  const { signOut } = useSession()
  const [tooYoung, setTooYoung] = useState(false)
  const form = useForm({
    resolver: zodResolver(birthdaySchema),
    defaultValues: { birthDay: draft.birthDay, birthMonth: draft.birthMonth, birthYear: draft.birthYear },
  })
  const typed = useWatch({ control: form.control })
  const age = ageFor({ birthDay: typed.birthDay ?? '', birthMonth: typed.birthMonth ?? '', birthYear: typed.birthYear ?? '' })
  const errors = form.formState.errors
  const error = errors.birthDay?.message ?? errors.birthMonth?.message ?? errors.birthYear?.message

  const submit = form.handleSubmit((values) => {
    update(values)
    if (isOldEnough(ageFor(values))) onNext()
    else setTooYoung(true)
  })

  // Kollide is for adults only. This is the end of the road until they are 18.
  if (tooYoung) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
        <span className="inline-flex size-16 items-center justify-center rounded-full bg-highlight-soft text-highlight-soft-foreground">
          <Cake className="size-7" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <h1 className="mt-6 text-h1">Kollide is for people aged 18 and over.</h1>
        <p className="mt-4 max-w-md text-lead text-muted-foreground">
          Thank you for wanting to join. We’d love to have you once you turn 18.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <Button variant="outline" onClick={() => setTooYoung(false)}>
            I typed the wrong date
          </Button>
          <Button variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    )
  }

  return (
    <StepForm
      title="When’s your birthday?"
      description="Kollide is for adults. Other members only ever see your age, never the date."
      onSubmit={() => void submit()}
    >
      <fieldset aria-describedby={error ? 'birthday-error' : 'birthday-age'}>
        <legend className="sr-only">Date of birth</legend>
        <div className="flex gap-3">
          {FIELDS.map((field, index) => (
            <div key={field.name} className="grid gap-2">
              <Label htmlFor={field.name}>{field.label}</Label>
              <Input
                id={field.name}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder={field.placeholder}
                maxLength={field.maxLength}
                autoComplete={field.autoComplete}
                data-autofocus={index === 0 ? '' : undefined}
                className={`h-14 text-center text-lead tabular-nums ${field.width}`}
                aria-invalid={errors[field.name] ? true : undefined}
                {...form.register(field.name, {
                  onChange: (event: { target: HTMLInputElement }) => {
                    // Step to the next box once this one is full.
                    const next = FIELDS[index + 1]
                    if (next && event.target.value.length >= field.maxLength) form.setFocus(next.name)
                  },
                })}
              />
            </div>
          ))}
        </div>
      </fieldset>
      <div className="mt-4 min-h-6">
        {error ? (
          <FieldError id="birthday-error" message={error} />
        ) : (
          <p id="birthday-age" className="text-muted-foreground" aria-live="polite">
            {age !== null && age >= 0 && age < 120 ? `You’ll appear as ${age}.` : ''}
          </p>
        )}
      </div>
    </StepForm>
  )
}

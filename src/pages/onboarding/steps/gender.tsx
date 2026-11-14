import { useState } from 'react'

import { genderSchema } from '@/features/onboarding/schemas'
import { GENDER_OPTIONS } from '@/services/types/common'

import { ChoiceCard } from '@/components/forms/choice'
import { FieldError, StepForm } from '@/components/forms/step-form'

import type { StepProps } from './types'

export function GenderStep({ draft, update, onNext }: StepProps) {
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const result = genderSchema.safeParse(draft.gender)
    if (result.success) onNext()
    else setError(result.error.issues[0].message)
  }

  return (
    <StepForm
      title="How do you describe yourself?"
      description="We ask because some events and squads are for women only."
      onSubmit={submit}
    >
      <fieldset aria-describedby={error ? 'gender-error' : undefined}>
        <legend className="sr-only">Gender</legend>
        <div className="grid gap-3">
          {GENDER_OPTIONS.map((option, index) => (
            <ChoiceCard
              key={option.value}
              name="gender"
              value={option.value}
              checked={draft.gender === option.value}
              autoFocus={draft.gender ? draft.gender === option.value : index === 0}
              onChange={() => {
                update({ gender: option.value })
                setError(null)
              }}
            >
              {option.label}
            </ChoiceCard>
          ))}
        </div>
      </fieldset>
      <div className="mt-4">
        <FieldError id="gender-error" message={error} />
      </div>
    </StepForm>
  )
}

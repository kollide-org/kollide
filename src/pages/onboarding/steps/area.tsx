import { useState } from 'react'

import { areaSchema } from '@/features/onboarding/schemas'
import { AREAS } from '@/services/types/common'

import { ChoiceChips } from '@/components/forms/choice'
import { FieldError, StepForm } from '@/components/forms/step-form'

import type { StepProps } from './types'

export function AreaStep({ draft, update, onNext }: StepProps) {
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const result = areaSchema.safeParse(draft.area)
    if (result.success) onNext()
    else setError(result.error.issues[0].message)
  }

  return (
    <StepForm
      title="Which part of Bengaluru are you in?"
      description="We’ll show you what’s on nearby. Your profile shows the area, never an address."
      onSubmit={submit}
    >
      <ChoiceChips
        legend="Your area"
        name="area"
        options={AREAS}
        value={draft.area}
        describedBy={error ? 'area-error' : undefined}
        onChange={(area) => {
          update({ area })
          setError(null)
        }}
      />
      <div className="mt-4">
        <FieldError id="area-error" message={error} />
      </div>
    </StepForm>
  )
}

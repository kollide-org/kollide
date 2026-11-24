import { useState } from 'react'

import { AreaPicker } from '@/components/forms/area-picker'
import { FieldError, StepForm } from '@/components/forms/step-form'
import { areaSchema } from '@/features/onboarding/schemas'

import type { StepProps } from './types'

export function AreaStep({ draft, update, onNext }: StepProps) {
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const result = areaSchema.safeParse({ city: draft.city, area: draft.area ?? '', zone: draft.zone })
    if (result.success) onNext()
    else setError(result.error.issues[0].message)
  }

  return (
    <StepForm
      title="Where in the city are you?"
      description="We’ll show you what’s on nearby. Your profile shows the area, never an address."
      onSubmit={submit}
    >
      <AreaPicker
        label="Your area"
        value={{ city: draft.city, area: draft.area ?? '', zone: draft.zone }}
        describedBy={error ? 'area-error' : undefined}
        invalid={Boolean(error)}
        onChange={(choice) => {
          update({ city: choice.city, area: choice.area || null, zone: choice.zone })
          setError(null)
        }}
      />
      <div className="mt-4">
        <FieldError id="area-error" message={error} />
      </div>
    </StepForm>
  )
}

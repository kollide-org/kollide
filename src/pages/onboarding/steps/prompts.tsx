import { useState } from 'react'

import { PromptsEditor } from '@/components/forms/prompts-editor'
import { FieldError, StepForm } from '@/components/forms/step-form'
import { MAX_PROMPTS, MIN_PROMPTS, promptsSchema } from '@/features/onboarding/schemas'

import type { StepProps } from './types'

export function PromptsStep({ draft, update, onNext }: StepProps) {
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const result = promptsSchema.safeParse(draft.prompts)
    if (result.success) onNext()
    else setError(result.error.issues[0].message)
  }

  return (
    <StepForm
      title="Give people something to ask you about."
      description={`Choose ${MIN_PROMPTS} or ${MAX_PROMPTS}: finish a sentence, pick a side, or set a little game of two truths and a lie.`}
      onSubmit={submit}
    >
      <PromptsEditor
        value={draft.prompts}
        onChange={(prompts) => {
          update({ prompts })
          setError(null)
        }}
      />
      <div className="mt-4">
        <FieldError id="prompts-error" message={error} />
      </div>
    </StepForm>
  )
}

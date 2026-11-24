import { useState } from 'react'

import { interestsSchema, languagesSchema, MAX_INTERESTS, MIN_INTERESTS } from '@/features/onboarding/schemas'
import { INTERESTS } from '@/services/types/common'

import { LanguagePicker } from '@/components/forms/language-picker'

import { ChoiceChips } from '@/components/forms/choice'
import { FieldError, StepForm } from '@/components/forms/step-form'

import type { StepProps } from './types'

function toggle<T>(list: readonly T[], item: T): T[] {
  return list.includes(item) ? list.filter((other) => other !== item) : [...list, item]
}

export function InterestsStep({ draft, update, onNext }: StepProps) {
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const result = interestsSchema.safeParse(draft.interests)
    if (result.success) onNext()
    else setError(result.error.issues[0].message)
  }

  return (
    <StepForm
      title="What are you into?"
      description={`Pick ${MIN_INTERESTS} to ${MAX_INTERESTS}. They help hosts and squads see what you’d enjoy.`}
      onSubmit={submit}
    >
      <ChoiceChips
        legend="Your interests"
        name="interests"
        options={INTERESTS}
        value={draft.interests as (typeof INTERESTS)[number][]}
        max={MAX_INTERESTS}
        describedBy="interests-status"
        onChange={(interest) => {
          update({ interests: toggle(draft.interests, interest) })
          setError(null)
        }}
      />
      <div id="interests-status" className="mt-5 min-h-6" aria-live="polite">
        {error ? (
          <FieldError id="interests-error" message={error} />
        ) : (
          <p className="text-muted-foreground">
            {draft.interests.length} of {MAX_INTERESTS} chosen
          </p>
        )}
      </div>
    </StepForm>
  )
}

export function LanguagesStep({ draft, update, onNext }: StepProps) {
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const result = languagesSchema.safeParse(draft.languages)
    if (result.success) onNext()
    else setError(result.error.issues[0].message)
  }

  return (
    <StepForm
      title="Which languages do you speak?"
      description="Add every one you can chat in, and any you’re learning. Someone might be happy to practise with you."
      onSubmit={submit}
    >
      <LanguagePicker
        value={draft.languages}
        describedBy={error ? 'languages-error' : undefined}
        onChange={(languages) => {
          update({ languages })
          setError(null)
        }}
      />
      <div className="mt-4">
        <FieldError id="languages-error" message={error} />
      </div>
    </StepForm>
  )
}

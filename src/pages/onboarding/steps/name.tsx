import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { nameSchema } from '@/features/onboarding/schemas'

import { FieldError, StepForm } from '../step-form'

import type { StepProps } from './types'

export function NameStep({ draft, update, onNext }: StepProps) {
  const form = useForm({ resolver: zodResolver(nameSchema), defaultValues: { firstName: draft.firstName } })
  const error = form.formState.errors.firstName?.message

  const submit = form.handleSubmit(({ firstName }) => {
    update({ firstName })
    onNext()
  })

  return (
    <StepForm
      title="What’s your first name?"
      description="This is how you’ll appear to other members. We never show a last name."
      onSubmit={() => void submit()}
    >
      <div className="grid gap-2">
        <Label htmlFor="firstName">First name</Label>
        <Input
          id="firstName"
          autoComplete="given-name"
          autoCapitalize="words"
          data-autofocus=""
          className="h-14 text-lead"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'firstName-error' : undefined}
          {...form.register('firstName')}
        />
        <FieldError id="firstName-error" message={error} />
      </div>
    </StepForm>
  )
}

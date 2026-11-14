import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { phoneSchema } from '@/features/onboarding/schemas'

import { FieldError, StepForm } from '@/components/forms/step-form'

import type { StepProps } from './types'

export function PhoneStep({ draft, update, onNext }: StepProps) {
  const form = useForm({ resolver: zodResolver(phoneSchema), defaultValues: { phone: draft.phone } })
  const error = form.formState.errors.phone?.message

  const submit = form.handleSubmit(({ phone }) => {
    update({ phone })
    onNext()
  })

  return (
    <StepForm
      title="What’s your mobile number?"
      description="For booking updates, and so we can reach you if something goes wrong. It is never shown on your profile."
      onSubmit={() => void submit()}
    >
      <div className="grid gap-2">
        <Label htmlFor="phone">Mobile number</Label>
        <div className="flex gap-2">
          <span className="flex h-14 items-center rounded-xl border border-input bg-muted px-4 text-lead font-medium" aria-hidden="true">
            +91
          </span>
          <Input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="98450 12345"
            maxLength={12}
            data-autofocus=""
            className="h-14 text-lead tabular-nums"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'phone-error' : undefined}
            {...form.register('phone')}
          />
        </div>
        <FieldError id="phone-error" message={error} />
      </div>
    </StepForm>
  )
}

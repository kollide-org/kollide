import { ExternalLink } from 'lucide-react'
import { useState } from 'react'

import { useSession } from '@/app/providers/session-context'
import { Checkbox } from '@/components/ui/checkbox'
import { useCompleteOnboarding } from '@/features/onboarding/hooks'
import { consentSchema } from '@/features/onboarding/schemas'

import { StepForm } from '../step-form'

import type { StepProps } from './types'

const CONDUCT = [
  { rule: 'Be kind.', detail: 'Welcome the person who came alone. Most people did.' },
  { rule: 'Turn up when you said you would.', detail: 'If you can’t, cancel early so someone else gets the place.' },
  { rule: 'Respect a no.', detail: 'To a drink, a photo, a phone number or anything else.' },
  { rule: 'No pursuing.', detail: 'Kollide is for making friends. Do not use it to ask people out.' },
  { rule: 'No harassment or hate.', detail: 'Of any kind, towards anyone.' },
]

function ExternalPageLink({ to, children }: { to: string; children: string }) {
  return (
    <a href={to} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline underline-offset-4">
      {children}
      <ExternalLink className="size-3.5" aria-hidden="true" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  )
}

/** The last step: accept the code of conduct and the privacy notice, then create the profile. */
export function ConsentStep({ draft, update }: StepProps) {
  const { session } = useSession()
  const complete = useCompleteOnboarding(session!.user.id)
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const result = consentSchema.safeParse(draft)
    if (!result.success) {
      setError(result.error.issues[0].message)
      return
    }
    setError(null)
    // Once the profile exists, the onboarding page moves on to the welcome screen by itself.
    complete.mutate(draft)
  }

  return (
    <StepForm
      title="One promise before you’re in."
      description="Everyone on Kollide agrees to the same code of conduct. It’s what makes walking in easy."
      onSubmit={submit}
      submitLabel="Create my profile"
      pendingLabel="Creating your profile…"
      pending={complete.isPending}
      error={error ?? (complete.isError ? complete.error.message || 'That didn’t save. Please try again.' : null)}
    >
      <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-card">
        <p className="w-fit rounded-full border border-foreground/20 px-4 py-1.5 text-sm font-semibold">Kollide is not a dating app.</p>
        <ol className="mt-5 grid gap-4">
          {CONDUCT.map((item, index) => (
            <li key={item.rule} className="flex gap-4">
              <span aria-hidden="true" className="mt-0.5 text-sm font-semibold tracking-widest text-primary tabular-nums">
                {String(index + 1).padStart(2, '0')}
              </span>
              <p>
                <span className="font-semibold">{item.rule}</span> <span className="text-muted-foreground">{item.detail}</span>
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-5 text-sm text-muted-foreground">
          This is the short version. <ExternalPageLink to="/safety">Read the full code of conduct</ExternalPageLink>
        </p>
      </div>

      <div className="mt-7 grid gap-4">
        <label className="flex cursor-pointer items-start gap-3.5">
          <Checkbox
            checked={draft.acceptedConduct}
            onCheckedChange={(checked) => {
              update({ acceptedConduct: checked === true })
              setError(null)
            }}
            className="mt-0.5"
            data-autofocus=""
          />
          <span>I accept the code of conduct, and I understand Kollide is not a dating app.</span>
        </label>
        <label className="flex cursor-pointer items-start gap-3.5">
          <Checkbox
            checked={draft.acceptedPrivacy}
            onCheckedChange={(checked) => {
              update({ acceptedPrivacy: checked === true })
              setError(null)
            }}
            className="mt-0.5"
          />
          <span>
            I accept the <ExternalPageLink to="/privacy">privacy notice</ExternalPageLink>.
          </span>
        </label>
      </div>
    </StepForm>
  )
}

import { BadgeCheck, Camera, Clock } from 'lucide-react'
import { useRef, useState, type ChangeEvent } from 'react'

import { Button } from '@/components/ui/button'
import { squareThumbnail } from '@/lib/image'

import { StepForm } from '@/components/forms/step-form'

import type { StepProps } from './types'

const REASONS = [
  'Hosts see the verified badge on every request you send.',
  'Verified members are approved more often.',
  'Your selfie is only used for this check. It never appears on your profile.',
]

/** Optional. A selfie earns the verified badge once our team has checked it. */
export function SelfieStep({ draft, update, onNext }: StepProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const source = URL.createObjectURL(file)
    try {
      update({ selfie: await squareThumbnail(source, 480) })
      setError(null)
    } catch {
      setError('That photo could not be read. Try taking it again.')
    } finally {
      URL.revokeObjectURL(source)
    }
  }

  return (
    <StepForm
      title="Get the verified badge."
      description="Take a quick selfie and we’ll check it matches your photos. You can also do this later."
      onSubmit={onNext}
      submitLabel={draft.selfie ? 'Continue' : 'Continue without it'}
      error={error}
    >
      <input ref={inputRef} type="file" accept="image/*" capture="user" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(event) => void onFile(event)} />

      <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-card">
        {draft.selfie ? (
          <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
            <img src={draft.selfie} alt="Your selfie" className="size-28 rounded-full object-cover ring-4 ring-highlight-soft" />
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-warning-soft px-3 py-1 text-sm font-semibold text-warning-strong">
                <Clock className="size-4" aria-hidden="true" />
                Pending review
              </p>
              <p className="mt-3 text-muted-foreground">
                Your selfie is ready to send. Once our team has checked it, the verified badge appears on your profile.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                  Retake
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => update({ selfie: null })}>
                  Remove
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground">
              <BadgeCheck className="size-4.5" aria-hidden="true" />
              Verified
            </span>
            <ul className="mt-5 grid gap-3">
              {REASONS.map((reason) => (
                <li key={reason} className="flex gap-3 text-muted-foreground">
                  <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-highlight" />
                  {reason}
                </li>
              ))}
            </ul>
            <Button type="button" variant="soft" className="mt-6 w-full sm:w-auto" onClick={() => inputRef.current?.click()} data-autofocus="">
              <Camera aria-hidden="true" />
              Take a selfie
            </Button>
          </>
        )}
      </div>
    </StepForm>
  )
}

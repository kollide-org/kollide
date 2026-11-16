import { Check } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { PersonAvatar } from '@/components/people/person-avatar'
import { Button } from '@/components/ui/button'
import { useSubmitHostRating } from '@/features/reviews/queries'
import { cn } from '@/lib/utils'
import type { PersonPreview } from '@/services'

type Answer = boolean | null
const QUESTIONS = [
  ['asDescribed', 'Was the event as described?'],
  ['feltSafe', 'Did you feel safe?'],
  ['wellOrganised', 'Was it well organised?'],
] as const

/** Three yes-or-no questions about the host. They show on the host card as shares, never as stars. */
export function HostRating({ eventId, host, rated }: { eventId: string; host: PersonPreview; rated: boolean }) {
  const submit = useSubmitHostRating()
  const [answers, setAnswers] = useState<Record<(typeof QUESTIONS)[number][0], Answer>>({ asDescribed: null, feltSafe: null, wellOrganised: null })
  const [done, setDone] = useState(rated)
  const complete = Object.values(answers).every((value) => value !== null)

  const save = () =>
    submit.mutate(
      { eventId, asDescribed: answers.asDescribed!, feltSafe: answers.feltSafe!, wellOrganised: answers.wellOrganised! },
      {
        onSuccess: () => setDone(true),
        onError: (error) => toast.error('That didn’t save', { description: error.message }),
      },
    )

  return (
    <article aria-labelledby="host-rating-name" className={cn('rounded-3xl border bg-card p-5 shadow-card sm:p-6', done ? 'border-success/40' : 'border-border/70')}>
      <header className="flex items-center gap-4">
        <PersonAvatar person={host} className="size-14" />
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">Your host</p>
          <h3 id="host-rating-name" className="text-h4">
            {host.firstName}
          </h3>
        </div>
        {done ? (
          <span className="inline-flex size-10 items-center justify-center rounded-full bg-success text-on-status">
            <Check className="size-5" strokeWidth={2.5} aria-hidden="true" />
            <span className="sr-only">Rated</span>
          </span>
        ) : null}
      </header>

      {done ? (
        <p className="mt-4 text-sm text-muted-foreground">Saved. Thank you.</p>
      ) : (
        <>
          <ul className="mt-6 grid gap-3">
            {QUESTIONS.map(([key, question]) => (
              <li key={key}>
                <fieldset className="flex flex-col gap-3 rounded-2xl bg-background/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <legend className="sr-only">{question}</legend>
                  <span className="font-medium" aria-hidden="true">
                    {question}
                  </span>
                  <span className="grid grid-cols-2 gap-2 sm:w-44">
                    {([true, false] as const).map((value) => (
                      <label
                        key={String(value)}
                        className={cn(
                          'inline-flex h-11 cursor-pointer items-center justify-center rounded-xl border font-medium transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring',
                          answers[key] === value ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card hover:border-foreground/60',
                        )}
                      >
                        <input
                          type="radio"
                          name={`host-${key}`}
                          className="sr-only"
                          checked={answers[key] === value}
                          onChange={() => setAnswers((current) => ({ ...current, [key]: value }))}
                        />
                        {value ? 'Yes' : 'No'}
                      </label>
                    ))}
                  </span>
                </fieldset>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">Shown on {host.firstName}’s host card as shares, with no names.</p>
            <Button variant="soft" onClick={save} disabled={!complete || submit.isPending}>
              {submit.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </>
      )}
    </article>
  )
}

import { Plus, X } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { MAX_PROMPTS, MIN_PROMPTS, PROMPT_MAX_LENGTH, promptsSchema } from '@/features/onboarding/schemas'
import { PROFILE_PROMPTS } from '@/services/types/common'

import { FieldError, StepForm } from '@/components/forms/step-form'

import type { StepProps } from './types'

export function PromptsStep({ draft, update, onNext }: StepProps) {
  const [choosing, setChoosing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const prompts = draft.prompts
  const unused = PROFILE_PROMPTS.filter((option) => !prompts.some((prompt) => prompt.promptId === option.promptId))

  const setAnswer = (promptId: string, answer: string) => {
    update({ prompts: prompts.map((prompt) => (prompt.promptId === promptId ? { ...prompt, answer } : prompt)) })
    setError(null)
  }

  const submit = () => {
    const result = promptsSchema.safeParse(prompts)
    if (result.success) onNext()
    else setError(result.error.issues[0].message)
  }

  return (
    <StepForm
      title="Give people something to ask you about."
      description={`Choose ${MIN_PROMPTS} or ${MAX_PROMPTS} prompts and finish the sentence. A line or two is plenty.`}
      onSubmit={submit}
    >
      <ul className="grid gap-4">
        {prompts.map((prompt, index) => (
          <li key={prompt.promptId} className="rounded-2xl border border-border/70 bg-card p-5 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <label htmlFor={`prompt-${prompt.promptId}`} className="font-display text-h4">
                {prompt.question}
              </label>
              <button
                type="button"
                onClick={() => update({ prompts: prompts.filter((other) => other.promptId !== prompt.promptId) })}
                aria-label={`Remove the prompt “${prompt.question}”`}
                className="-mt-1.5 -mr-2 flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="size-4.5" aria-hidden="true" />
              </button>
            </div>
            <Textarea
              id={`prompt-${prompt.promptId}`}
              value={prompt.answer}
              maxLength={PROMPT_MAX_LENGTH}
              onChange={(event) => setAnswer(prompt.promptId, event.target.value)}
              placeholder="Your answer"
              data-autofocus={index === prompts.length - 1 && !prompt.answer ? '' : undefined}
              className="mt-3 min-h-24 bg-background/60"
              aria-describedby={`prompt-${prompt.promptId}-count`}
            />
            <p id={`prompt-${prompt.promptId}-count`} className="mt-1.5 text-right text-xs text-muted-foreground tabular-nums">
              {prompt.answer.length} of {PROMPT_MAX_LENGTH}
            </p>
          </li>
        ))}
      </ul>

      {prompts.length < MAX_PROMPTS ? (
        <Button
          type="button"
          variant="outline"
          className="mt-4 h-14 w-full justify-start border-dashed"
          onClick={() => setChoosing(true)}
          data-autofocus={prompts.length === 0 ? '' : undefined}
        >
          <Plus aria-hidden="true" />
          {prompts.length === 0 ? 'Choose your first prompt' : prompts.length < MIN_PROMPTS ? 'Choose another prompt' : 'Add a third prompt (optional)'}
        </Button>
      ) : null}

      <div className="mt-4">
        <FieldError id="prompts-error" message={error} />
      </div>

      <Sheet open={choosing} onOpenChange={setChoosing}>
        <SheetContent side="bottom" className="mx-auto max-h-[85dvh] max-w-xl rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>Choose a prompt</SheetTitle>
            <SheetDescription>Pick the one you’d most enjoy answering.</SheetDescription>
          </SheetHeader>
          <ul className="grid gap-2 overflow-y-auto px-4 pb-8">
            {unused.map((option) => (
              <li key={option.promptId}>
                <button
                  type="button"
                  onClick={() => {
                    update({ prompts: [...prompts, { ...option, answer: '' }] })
                    setChoosing(false)
                    setError(null)
                  }}
                  className="flex min-h-14 w-full items-center rounded-xl border border-border bg-card px-4 text-left font-display text-lead transition-colors hover:border-primary hover:bg-primary-soft"
                >
                  {option.question}
                </button>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </StepForm>
  )
}

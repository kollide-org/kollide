import { Check } from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/lib/utils'
import type { ProfilePrompt } from '@/services'
import { promptDefinition } from '@/services/types/prompts'

function Written({ prompt }: { prompt: ProfilePrompt }) {
  return (
    <blockquote className="rounded-2xl bg-background/70 p-5">
      <p className="text-sm font-medium text-muted-foreground">{prompt.question}</p>
      <p className="mt-1.5 font-display text-h4">{prompt.answer}</p>
    </blockquote>
  )
}

function ThisOrThat({ prompt, options }: { prompt: ProfilePrompt; options: readonly [string, string] }) {
  return (
    <div className="rounded-2xl bg-background/70 p-5">
      <p className="text-sm font-medium text-muted-foreground">This or that</p>
      <p className="sr-only">
        Picked {prompt.answer} over {options.find((option) => option !== prompt.answer)}
      </p>
      <div aria-hidden="true" className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        {options.map((option, index) => {
          const picked = option === prompt.answer
          return (
            <span key={option} className={cn('contents')}>
              {index === 1 ? <span className="text-sm font-semibold text-muted-foreground">or</span> : null}
              <span
                className={cn(
                  'flex min-h-14 items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-center font-display text-base leading-tight sm:text-lead',
                  picked ? 'bg-primary text-primary-foreground' : 'border border-dashed border-foreground/20 text-muted-foreground',
                )}
              >
                {picked ? <Check className="size-4 shrink-0" strokeWidth={2.5} /> : null}
                {option}
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Two truths and a lie. Anyone looking at the card taps the one they think is
 * false and finds out. On your own card, the lie is marked.
 */
function TwoTruths({ prompt, own }: { prompt: ProfilePrompt; own: boolean }) {
  const [guess, setGuess] = useState<number | null>(null)
  const statements = prompt.statements ?? []
  const revealed = own || guess !== null

  return (
    <div className="rounded-2xl bg-background/70 p-5">
      <p className="text-sm font-medium text-muted-foreground">Two truths and a lie</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{own ? 'People tap the one they think is the lie.' : 'Tap the one you think is the lie.'}</p>
      <ul className="mt-3 grid gap-2">
        {statements.map((statement, index) => {
          const isLie = index === prompt.lieIndex
          const guessed = guess === index
          return (
            <li key={index}>
              <button
                type="button"
                disabled={revealed}
                onClick={() => setGuess(index)}
                className={cn(
                  'flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-left font-medium transition-colors disabled:cursor-default',
                  !revealed && 'border-input hover:border-primary hover:bg-primary-soft',
                  revealed && isLie && 'border-primary bg-primary text-primary-foreground',
                  revealed && !isLie && guessed && 'border-foreground/30 bg-muted',
                  revealed && !isLie && !guessed && 'border-transparent text-muted-foreground',
                )}
              >
                <span>{statement}</span>
                {revealed && isLie ? <span className="shrink-0 text-xs font-semibold tracking-wide uppercase">The lie</span> : null}
                {revealed && !isLie && guessed ? <span className="shrink-0 text-xs font-semibold tracking-wide uppercase">True</span> : null}
              </button>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 min-h-6 text-sm font-semibold" aria-live="polite">
        {!own && guess !== null ? (guess === prompt.lieIndex ? 'You got it.' : 'Not quite. That one’s true.') : ''}
      </p>
    </div>
  )
}

/** One prompt on a profile card, drawn for its kind. */
export function PromptBlock({ prompt, own = false }: { prompt: ProfilePrompt; own?: boolean }) {
  const definition = promptDefinition(prompt.promptId)
  if (definition?.kind === 'this_or_that' && definition.options) return <ThisOrThat prompt={prompt} options={definition.options} />
  if (definition?.kind === 'two_truths') return <TwoTruths prompt={prompt} own={own} />
  return <Written prompt={prompt} />
}

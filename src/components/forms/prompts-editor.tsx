import { Plus, X } from 'lucide-react'
import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { ProfilePrompt } from '@/services'
import {
  MAX_PROMPTS,
  MIN_PROMPTS,
  PROFILE_PROMPTS,
  PROMPT_GROUP_LABELS,
  PROMPT_GROUPS,
  PROMPT_MAX_LENGTH,
  promptDefinition,
  STATEMENT_MAX_LENGTH,
  type PromptDefinition,
} from '@/services/types/prompts'

interface PromptsEditorProps {
  value: ProfilePrompt[]
  onChange: (value: ProfilePrompt[]) => void
}

function blank(definition: PromptDefinition): ProfilePrompt {
  const base = { promptId: definition.promptId, question: definition.question, answer: '' }
  return definition.kind === 'two_truths' ? { ...base, statements: ['', '', ''], lieIndex: undefined } : base
}

const KIND_HINTS = {
  text: 'Finish the sentence',
  this_or_that: 'Pick one',
  two_truths: 'People guess which is the lie',
} as const

function TextAnswer({ prompt, onChange }: { prompt: ProfilePrompt; onChange: (prompt: ProfilePrompt) => void }) {
  const id = `prompt-${prompt.promptId}`
  return (
    <>
      <Textarea
        id={id}
        value={prompt.answer}
        maxLength={PROMPT_MAX_LENGTH}
        onChange={(event) => onChange({ ...prompt, answer: event.target.value })}
        placeholder="Your answer"
        className="mt-3 min-h-24 bg-background/60"
        aria-label={prompt.question}
        aria-describedby={`${id}-count`}
      />
      <p id={`${id}-count`} className="mt-1.5 text-right text-xs text-muted-foreground tabular-nums">
        {prompt.answer.length} of {PROMPT_MAX_LENGTH}
      </p>
    </>
  )
}

function PickAnswer({ prompt, definition, onChange }: { prompt: ProfilePrompt; definition: PromptDefinition; onChange: (prompt: ProfilePrompt) => void }) {
  const name = useId()
  return (
    <fieldset className="mt-4 min-w-0">
      <legend className="sr-only">{prompt.question}</legend>
      <div className="grid grid-cols-2 gap-3">
        {definition.options?.map((option) => {
          const checked = prompt.answer === option
          return (
            <label
              key={option}
              className={cn(
                'relative flex min-h-20 cursor-pointer items-center justify-center rounded-2xl border-2 px-3 text-center font-display text-lead transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring',
                checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background/60 hover:border-foreground/50',
              )}
            >
              <input type="radio" name={name} value={option} checked={checked} onChange={() => onChange({ ...prompt, answer: option })} className="sr-only" />
              {option}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

function TwoTruthsAnswer({ prompt, onChange }: { prompt: ProfilePrompt; onChange: (prompt: ProfilePrompt) => void }) {
  const name = useId()
  const statements = prompt.statements ?? ['', '', '']
  const setStatement = (index: number, statement: string) =>
    onChange({ ...prompt, statements: statements.map((current, position) => (position === index ? statement : current)) })

  return (
    <fieldset className="mt-4 grid min-w-0 gap-3">
      <legend className="sr-only">Two truths and a lie: three statements, and which one is the lie</legend>
      {statements.map((statement, index) => {
        const isLie = prompt.lieIndex === index
        return (
          <div key={index} className={cn('rounded-xl border p-3 transition-colors', isLie ? 'border-primary bg-primary-soft/50' : 'border-input bg-background/60')}>
            <Input
              value={statement}
              maxLength={STATEMENT_MAX_LENGTH}
              onChange={(event) => setStatement(index, event.target.value)}
              placeholder={index === 0 ? 'I once…' : index === 1 ? 'I have…' : 'I can…'}
              aria-label={`Statement ${index + 1}`}
              className="border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
            />
            <label className="relative mt-1 inline-flex min-h-10 cursor-pointer items-center gap-2 px-1 text-sm font-semibold has-focus-visible:outline-2 has-focus-visible:outline-ring">
              <input
                type="radio"
                name={name}
                checked={isLie}
                onChange={() => onChange({ ...prompt, lieIndex: index })}
                className="size-4 accent-[var(--primary)]"
              />
              {isLie ? 'This one is the lie' : 'Make this the lie'}
            </label>
          </div>
        )
      })}
    </fieldset>
  )
}

/**
 * Choose two or three prompts and answer them. Written ones are finished in a
 * sentence, "this or that" is one tap, and "two truths and a lie" is three
 * short statements with the lie marked.
 */
export function PromptsEditor({ value, onChange }: PromptsEditorProps) {
  const [choosing, setChoosing] = useState(false)
  const used = new Set(value.map((prompt) => prompt.promptId))

  const replace = (next: ProfilePrompt) => onChange(value.map((prompt) => (prompt.promptId === next.promptId ? next : prompt)))
  const remove = (promptId: string) => onChange(value.filter((prompt) => prompt.promptId !== promptId))

  return (
    <>
      <ul className="grid gap-4">
        {value.map((prompt) => {
          const definition = promptDefinition(prompt.promptId)
          if (!definition) return null
          return (
            <li key={prompt.promptId} className="rounded-2xl border border-border/70 bg-card p-5 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-primary uppercase">{KIND_HINTS[definition.kind]}</p>
                  <p className="mt-1 font-display text-h4">{prompt.question}</p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(prompt.promptId)}
                  aria-label={`Remove the prompt “${prompt.question}”`}
                  className="-mt-1.5 -mr-2 flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <X className="size-4.5" aria-hidden="true" />
                </button>
              </div>
              {definition.kind === 'text' ? <TextAnswer prompt={prompt} onChange={replace} /> : null}
              {definition.kind === 'this_or_that' ? <PickAnswer prompt={prompt} definition={definition} onChange={replace} /> : null}
              {definition.kind === 'two_truths' ? <TwoTruthsAnswer prompt={prompt} onChange={replace} /> : null}
            </li>
          )
        })}
      </ul>

      {value.length < MAX_PROMPTS ? (
        <Button
          type="button"
          variant="outline"
          className="mt-4 h-14 w-full justify-start border-dashed"
          onClick={() => setChoosing(true)}
          data-autofocus={value.length === 0 ? '' : undefined}
        >
          <Plus aria-hidden="true" />
          {value.length === 0 ? 'Choose your first prompt' : value.length < MIN_PROMPTS ? 'Choose another prompt' : 'Add a third prompt (optional)'}
        </Button>
      ) : null}

      <Sheet open={choosing} onOpenChange={setChoosing}>
        <SheetContent side="bottom" className="mx-auto max-h-[85dvh] max-w-xl rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>Choose a prompt</SheetTitle>
            <SheetDescription>Pick the one you’d most enjoy answering. At least one should be written.</SheetDescription>
          </SheetHeader>
          <div className="grid gap-6 overflow-y-auto px-4 pb-8">
            {PROMPT_GROUPS.map((group) => {
              const options = PROFILE_PROMPTS.filter((prompt) => prompt.group === group && !used.has(prompt.promptId))
              if (options.length === 0) return null
              return (
                <section key={group} aria-labelledby={`prompt-group-${group}`}>
                  <h3 id={`prompt-group-${group}`} className="eyebrow mb-2 px-1 text-primary">
                    {PROMPT_GROUP_LABELS[group]}
                  </h3>
                  <ul className="grid gap-2">
                    {options.map((option) => (
                      <li key={option.promptId}>
                        <button
                          type="button"
                          onClick={() => {
                            onChange([...value, blank(option)])
                            setChoosing(false)
                          }}
                          className="flex min-h-14 w-full items-center rounded-xl border border-border bg-card px-4 py-2 text-left font-display text-lead transition-colors hover:border-primary hover:bg-primary-soft"
                        >
                          {option.question}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

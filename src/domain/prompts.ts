import type { ProfilePrompt } from '@/services/types/user'
import { MAX_PROMPTS, MIN_PROMPTS, PROMPT_MAX_LENGTH, promptDefinition, STATEMENT_MAX_LENGTH } from '@/services/types/prompts'

/** Why a set of prompts can't be saved, in words a member can act on, or `null` when it can. */
export function promptsProblem(prompts: readonly ProfilePrompt[]): string | null {
  if (prompts.length < MIN_PROMPTS) return `Answer at least ${MIN_PROMPTS} prompts.`
  if (prompts.length > MAX_PROMPTS) return `Choose up to ${MAX_PROMPTS} prompts.`
  if (new Set(prompts.map((prompt) => prompt.promptId)).size !== prompts.length) return 'Each prompt can be used once.'

  for (const prompt of prompts) {
    const definition = promptDefinition(prompt.promptId)
    if (!definition) return 'That prompt isn’t available any more. Choose another.'
    if (definition.kind === 'text') {
      const answer = prompt.answer.trim()
      if (!answer) return `Finish “${definition.question}”`
      if (answer.length > PROMPT_MAX_LENGTH) return `Keep each answer to ${PROMPT_MAX_LENGTH} characters.`
    }
    if (definition.kind === 'this_or_that' && !definition.options?.includes(prompt.answer)) {
      return `Pick one: ${definition.question}.`
    }
    if (definition.kind === 'two_truths') {
      const statements = prompt.statements ?? []
      if (statements.length !== 3 || statements.some((statement) => !statement.trim())) return 'Write all three statements for “Two truths and a lie”.'
      if (statements.some((statement) => statement.trim().length > STATEMENT_MAX_LENGTH)) {
        return `Keep each statement to ${STATEMENT_MAX_LENGTH} characters.`
      }
      if (prompt.lieIndex === undefined || prompt.lieIndex < 0 || prompt.lieIndex > 2) return 'Mark which statement is the lie.'
    }
  }

  // A profile of only quick picks says very little, so one prompt is always written.
  if (!prompts.some((prompt) => promptDefinition(prompt.promptId)?.kind === 'text')) return 'Include at least one written prompt.'
  return null
}

/** Trims what was typed, and keeps only the fields each kind uses. */
export function tidyPrompts(prompts: readonly ProfilePrompt[]): ProfilePrompt[] {
  return prompts.map((prompt) => {
    const definition = promptDefinition(prompt.promptId)
    const question = definition?.question ?? prompt.question
    if (definition?.kind === 'two_truths') {
      return { promptId: prompt.promptId, question, answer: '', statements: (prompt.statements ?? []).map((statement) => statement.trim()), lieIndex: prompt.lieIndex }
    }
    return { promptId: prompt.promptId, question, answer: prompt.answer.trim() }
  })
}

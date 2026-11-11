import type { Prompt } from '@/services'

export const PROMPT_SUGGESTIONS = [
  'A perfect Saturday in Bengaluru',
  'The best thing I ate recently',
  'I geek out about',
  'My go-to karaoke song',
  'A skill I want to learn',
  'Two truths and a lie',
]

/** Three slots. The first two need an answer; the third is optional. */
export function emptyPromptSlots(): Prompt[] {
  return PROMPT_SUGGESTIONS.slice(0, 3).map((prompt) => ({ prompt, answer: '' }))
}

/** Fills the slots from saved prompts. */
export function slotsFrom(saved: Prompt[]): Prompt[] {
  const slots = emptyPromptSlots()
  saved.slice(0, 3).forEach((prompt, index) => {
    slots[index] = prompt
  })
  return slots
}

/** Only the slots that have an answer. */
export function filledPrompts(slots: Prompt[]): Prompt[] {
  return slots
    .map((slot) => ({ prompt: slot.prompt, answer: slot.answer.trim() }))
    .filter((slot) => slot.answer.length > 0)
}


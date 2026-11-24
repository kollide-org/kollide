/**
 * The prompts a member can put on their profile. Two or three, at least one
 * of them written. Three kinds:
 *
 * - `text`: finish the sentence.
 * - `this_or_that`: pick one of two.
 * - `two_truths`: three statements, one of them false. Others guess which.
 */

export type PromptKind = 'text' | 'this_or_that' | 'two_truths'

export const PROMPT_GROUPS = ['bengaluru', 'roots', 'opinions', 'me', 'meeting', 'classics', 'this_or_that', 'games'] as const
export type PromptGroup = (typeof PROMPT_GROUPS)[number]

export const PROMPT_GROUP_LABELS: Record<PromptGroup, string> = {
  bengaluru: 'Bengaluru',
  roots: 'Roots',
  opinions: 'Opinions',
  me: 'About me',
  meeting: 'Meeting people',
  classics: 'The classics',
  this_or_that: 'This or that',
  games: 'Games',
}

export interface PromptDefinition {
  promptId: string
  question: string
  kind: PromptKind
  group: PromptGroup
  /** The two choices, for `this_or_that`. */
  options?: readonly [string, string]
}

const text = (group: PromptGroup, promptId: string, question: string): PromptDefinition => ({ promptId, question, kind: 'text', group })
const pick = (promptId: string, first: string, second: string): PromptDefinition => ({
  promptId,
  question: `${first} or ${second}`,
  kind: 'this_or_that',
  group: 'this_or_that',
  options: [first, second],
})

export const PROFILE_PROMPTS: readonly PromptDefinition[] = [
  text('bengaluru', 'cross-silk-board', 'A dish I’d cross Silk Board for…'),
  text('bengaluru', 'most-bengaluru-opinion', 'My most Bengaluru opinion is…'),
  text('bengaluru', 'auto-driver-advice', 'The best advice an auto driver ever gave me…'),
  text('bengaluru', 'darshini-order', 'My go-to darshini order, no menu needed…'),
  text('bengaluru', 'rs-500-evening', 'Plan me a perfect ₹500 evening in this city…'),

  text('roots', 'tradition-from-home', 'A tradition from home I carry to every city…'),
  text('roots', 'ajji-advice', 'Advice from my ajji / nani that I actually follow…'),
  text('roots', 'old-school', 'The old-school thing I still swear by…'),
  text('roots', 'festival', 'The festival I go all out for…'),

  text('opinions', 'hill-to-defend', 'A hill I’ll defend at every dinner table…'),
  text('opinions', 'chai-or-coffee-order', 'The chai or coffee order that says everything about me…'),
  text('opinions', 'most-overrated', 'Hot take: the most overrated thing in Bengaluru is…'),

  text('me', 'learning-badly', 'Something I’m learning badly, but happily…'),
  text('me', 'talk-for-hours', 'I can talk for hours, unprompted, about…'),
  text('me', 'hidden-talent', 'My hidden talent nobody asks about…'),
  text('me', 'cricket-moment', 'The cricket moment I’ll never get over…'),
  text('me', 'aux-hostage', 'The song I’ll hold the aux hostage for…'),

  text('meeting', 'stranger-conversation', 'The best conversation I’ve had with a stranger…'),
  text('meeting', 'green-flag', 'A green flag in a new friend…'),
  text('meeting', 'come-along-if', 'Come to an event with me if you also…'),

  text('classics', 'perfect-sunday', 'A perfect Sunday is…'),
  text('classics', 'ask-me-about', 'Ask me about…'),
  text('classics', 'find-me-at', 'You’ll find me at…'),
  text('classics', 'looking-for', 'I’m looking for people to…'),
  text('classics', 'best-of-bengaluru', 'The best thing about Bengaluru is…'),
  text('classics', 'say-yes-to', 'I will always say yes to…'),
  text('classics', 'new-in-town', 'Something I want to try in this city…'),

  pick('coffee-or-chai', 'Filter coffee', 'Cutting chai'),
  pick('nandi-or-brunch', 'Nandi Hills sunrise', 'Brunch till 4'),
  pick('mysore-pak-or-peda', 'Mysore Pak', 'Dharwad Peda'),
  pick('house-party-or-open-mic', 'House party', 'Open mic'),

  { promptId: 'two-truths', question: 'Two truths and a lie', kind: 'two_truths', group: 'games' },
]

export function promptDefinition(promptId: string): PromptDefinition | undefined {
  return PROFILE_PROMPTS.find((prompt) => prompt.promptId === promptId)
}

export const MIN_PROMPTS = 2
export const MAX_PROMPTS = 3
export const PROMPT_MAX_LENGTH = 160
export const STATEMENT_MAX_LENGTH = 100

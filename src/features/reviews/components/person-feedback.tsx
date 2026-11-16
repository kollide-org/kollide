import { Check, ChevronDown, Handshake, Lock } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import { useState } from 'react'
import { toast } from 'sonner'

import { ChoiceChips } from '@/components/forms/choice'
import { PersonAvatar } from '@/components/people/person-avatar'
import { VerifiedBadge } from '@/components/people/verified-badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PRIVATE_FEEDBACK_LABELS } from '@/features/reviews/labels'
import { useSubmitReview } from '@/features/reviews/queries'
import { spring } from '@/lib/motion'
import { cn } from '@/lib/utils'
import {
  MAX_TAGS_PER_REVIEW,
  POSITIVE_TAGS,
  PRIVATE_FEEDBACK_CATEGORIES,
  type PositiveTag,
  type PrivateFeedbackCategory,
  type ReviewablePerson,
} from '@/services/types'

/** One person you met: up to three tags, "meet again?", and an optional private note. */
export function PersonFeedback({ eventId, person, onReport }: { eventId: string; person: ReviewablePerson; onReport: (person: ReviewablePerson) => void }) {
  const submit = useSubmitReview()
  const [tags, setTags] = useState<PositiveTag[]>([])
  const [meetAgain, setMeetAgain] = useState(false)
  const [feltOff, setFeltOff] = useState(false)
  const [category, setCategory] = useState<PrivateFeedbackCategory | null>(null)
  const [note, setNote] = useState('')
  const [done, setDone] = useState(person.reviewed)
  const id = `person-${person.userId}`

  const toggleTag = (tag: PositiveTag) =>
    setTags((current) => (current.includes(tag) ? current.filter((value) => value !== tag) : [...current, tag]))

  const save = () =>
    submit.mutate(
      {
        eventId,
        subjectId: person.userId,
        tags,
        wantsToMeetAgain: meetAgain,
        // Sent whenever a category is chosen, even if the panel was closed again afterwards.
        privateFeedback: category ? { category, note: note.trim() || undefined } : undefined,
      },
      {
        onSuccess: ({ connected }) => {
          setDone(true)
          if (connected) {
            toast.success(`You and ${person.firstName} are connected`, { description: 'You both said yes. Find each other under Connections.' })
          }
        },
        onError: (error) => toast.error('That didn’t save', { description: error.message }),
      },
    )

  return (
    <m.article
      layout="position"
      aria-labelledby={`${id}-name`}
      className={cn(
        'overflow-hidden rounded-3xl border bg-card shadow-card transition-colors',
        done ? 'border-success/40' : 'border-border/70',
      )}
    >
      <header className="flex items-center gap-4 p-5 sm:px-6">
        <PersonAvatar person={person} className="size-14" />
        <div className="min-w-0 flex-1">
          <h3 id={`${id}-name`} className="flex items-center gap-1.5 text-h4">
            {person.firstName}
            {person.verified ? <VerifiedBadge /> : null}
          </h3>
          {done ? <p className="text-sm text-muted-foreground">Saved. Thank you.</p> : null}
        </div>
        {done ? (
          <m.span
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...spring.soft, bounce: 0.4 }}
            className="inline-flex size-10 items-center justify-center rounded-full bg-success text-on-status"
          >
            <Check className="size-5" strokeWidth={2.5} aria-hidden="true" />
          </m.span>
        ) : null}
      </header>

      <AnimatePresence initial={false}>
        {done ? null : (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            className="grid gap-6 border-t border-border px-5 pt-5 pb-6 sm:px-6"
          >
            <div className="grid gap-3">
              <p className="text-sm font-semibold" aria-hidden="true">
                What were they like? Choose up to {MAX_TAGS_PER_REVIEW}.
              </p>
              <ChoiceChips
                legend={`What was ${person.firstName} like? Choose up to ${MAX_TAGS_PER_REVIEW}.`}
                name={`${id}-tags`}
                options={POSITIVE_TAGS}
                value={tags}
                onChange={toggleTag}
                max={MAX_TAGS_PER_REVIEW}
              />
            </div>

            <button
              type="button"
              aria-pressed={meetAgain}
              onClick={() => setMeetAgain((value) => !value)}
              className={cn(
                'flex items-center gap-4 rounded-2xl border p-4 text-left transition-colors',
                meetAgain ? 'border-primary bg-primary-soft text-primary-soft-foreground' : 'border-input hover:border-foreground/50',
              )}
            >
              <m.span
                animate={meetAgain ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                transition={{ duration: 0.35 }}
                className={cn(
                  'inline-flex size-11 shrink-0 items-center justify-center rounded-full',
                  meetAgain ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                )}
              >
                <Handshake className="size-5" aria-hidden="true" />
              </m.span>
              <span>
                <span className="block font-semibold">I’d like to meet {person.firstName} again</span>
                <span className={cn('block text-sm', meetAgain ? 'text-primary-soft-foreground/90' : 'text-muted-foreground')}>
                  If they say the same, you’re connected. Nobody ever sees a no.
                </span>
              </span>
            </button>

            <div>
              <button
                type="button"
                aria-expanded={feltOff}
                aria-controls={`${id}-felt-off`}
                onClick={() => setFeltOff((value) => !value)}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                Something felt off?
                {category && !feltOff ? <span className="font-normal">· {PRIVATE_FEEDBACK_LABELS[category]}</span> : null}
                <ChevronDown className={cn('size-4 transition-transform', feltOff && 'rotate-180')} aria-hidden="true" />
              </button>
              {feltOff ? (
                <div id={`${id}-felt-off`} className="mt-4 grid gap-4 rounded-2xl bg-background/70 p-4">
                  <p className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    Private. {person.firstName} never sees it, and it only counts if several people say the same thing about
                    them, across more than one event.
                  </p>
                  <ChoiceChips
                    legend="What felt off?"
                    name={`${id}-category`}
                    options={PRIVATE_FEEDBACK_CATEGORIES.map((value) => PRIVATE_FEEDBACK_LABELS[value])}
                    value={category ? PRIVATE_FEEDBACK_LABELS[category] : null}
                    onChange={(label) =>
                      setCategory(PRIVATE_FEEDBACK_CATEGORIES.find((value) => PRIVATE_FEEDBACK_LABELS[value] === label) ?? null)
                    }
                  />
                  <div className="grid gap-2">
                    <Label htmlFor={`${id}-note`}>Anything to add? (optional)</Label>
                    <Textarea id={`${id}-note`} value={note} maxLength={300} onChange={(change) => setNote(change.target.value)} className="min-h-20" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Something more serious, like harassment?{' '}
                    <button type="button" onClick={() => onReport(person)} className="font-semibold text-destructive-strong underline-offset-4 hover:underline">
                      Report {person.firstName} to our safety team
                    </button>
                  </p>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">You can’t change this once it’s saved.</p>
              <Button variant="soft" onClick={save} disabled={submit.isPending || (!category && note.trim().length > 0)}>
                {submit.isPending ? 'Saving…' : `Save for ${person.firstName}`}
              </Button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </m.article>
  )
}

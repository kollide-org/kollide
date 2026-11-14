import { ArrowLeft, Check, Home, Lock, Plus, X } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import { useState, type ReactNode } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import type { z } from 'zod'

import { useSession } from '@/app/providers/session-context'
import { ChoiceCard, ChoiceChips } from '@/components/forms/choice'
import { FieldError, StepForm } from '@/components/forms/step-form'
import { AppLink } from '@/components/shared/app-link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  basicsSchema,
  costSchema,
  COVER_OPTIONS,
  coverForCategory,
  CREATE_STEPS,
  detailsSchema,
  EMPTY_EVENT_DRAFT,
  eventTimes,
  firstOpenStep,
  FIXED_RULE,
  guestsSchema,
  placeSchema,
  rulesSchema,
  SUGGESTED_RULES,
  toEventDraft,
  type CreateStepId,
  type EventFormDraft,
} from '@/features/events/create-schemas'
import { CATEGORY_LABELS, HOST_PRICING_LABELS } from '@/features/events/labels'
import { useCreateEvent } from '@/features/events/queries'
import { ageRangeLabel, formatDay, formatTimeRange, priceLabel } from '@/lib/format'
import { spring } from '@/lib/motion'
import { useLocalDraft } from '@/lib/use-local-draft'
import { cn } from '@/lib/utils'
import { HOUSE_PARTY_MAX_GUESTS, OVER_APPROVAL_RATIO } from '@/domain/bookings'
import type { Event, EventCategory } from '@/services'
import { AREAS, EVENT_CATEGORIES } from '@/services/types'

interface StepProps {
  draft: EventFormDraft
  update: (patch: Partial<EventFormDraft>) => void
  onNext: () => void
}

type Errors = Record<string, string | undefined>

/** Checks a step. Returns true if it passes, and otherwise records one message per field. */
function check(schema: z.ZodType, value: unknown, setErrors: (errors: Errors) => void): boolean {
  const result = schema.safeParse(value)
  if (result.success) {
    setErrors({})
    return true
  }
  const errors: Errors = {}
  for (const issue of result.error.issues) errors[String(issue.path[0] ?? 'form')] ??= issue.message
  setErrors(errors)
  return false
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <FieldError id={`${id}-error`} message={error} /> : hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

const described = (id: string, error?: string) => ({ 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? `${id}-error` : undefined })

function BasicsStep({ draft, update, onNext }: StepProps) {
  const [errors, setErrors] = useState<Errors>({})
  return (
    <StepForm
      title="What are you hosting?"
      description="Start with a name people will remember."
      onSubmit={() => check(basicsSchema, draft, setErrors) && onNext()}
    >
      <div className="grid gap-7">
        <Field id="title" label="Title" error={errors.title}>
          <Input id="title" value={draft.title} maxLength={60} data-autofocus="" placeholder="Carrom and chai" onChange={(event) => update({ title: event.target.value })} {...described('title', errors.title)} />
        </Field>
        <div className="grid gap-2">
          <p className="text-sm font-semibold">Kind of event</p>
          <ChoiceChips
            legend="Kind of event"
            name="category"
            options={EVENT_CATEGORIES.map((category) => CATEGORY_LABELS[category])}
            value={draft.category ? CATEGORY_LABELS[draft.category] : null}
            describedBy={errors.category ? 'category-error' : undefined}
            onChange={(label) => {
              const category = EVENT_CATEGORIES.find((option) => CATEGORY_LABELS[option] === label) as EventCategory
              // The cover follows the category until the host picks one themselves.
              const followsCategory = !draft.coverUrl || (draft.category !== null && draft.coverUrl === coverForCategory(draft.category))
              update({ category, coverUrl: followsCategory ? coverForCategory(category) : draft.coverUrl })
            }}
          />
          <FieldError id="category-error" message={errors.category} />
        </div>
        <Field id="summary" label="One-line summary" hint="Shown on the event card." error={errors.summary}>
          <Input id="summary" value={draft.summary} maxLength={120} placeholder="A relaxed evening of carrom, with chai and bajji." onChange={(event) => update({ summary: event.target.value })} {...described('summary', errors.summary)} />
        </Field>
      </div>
    </StepForm>
  )
}

function DetailsStep({ draft, update, onNext }: StepProps) {
  const [errors, setErrors] = useState<Errors>({})
  return (
    <StepForm
      title="Tell guests what to expect."
      description="Who it suits, what you’ll do, and anything to bring."
      onSubmit={() => check(detailsSchema, draft, setErrors) && onNext()}
    >
      <div className="grid gap-7">
        <Field id="description" label="Description" error={errors.description}>
          <Textarea id="description" value={draft.description} maxLength={800} data-autofocus="" className="min-h-40" onChange={(event) => update({ description: event.target.value })} {...described('description', errors.description)} />
        </Field>
        <fieldset>
          <legend className="text-sm font-semibold">Cover</legend>
          <div className="mt-3 grid grid-cols-4 gap-2.5">
            {COVER_OPTIONS.map((cover) => {
              const selected = draft.coverUrl === cover.url
              return (
                <label
                  key={cover.url}
                  className={cn(
                    'relative block aspect-[4/3] cursor-pointer overflow-hidden rounded-xl transition-transform duration-200 ease-out-soft has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring active:scale-[0.97]',
                    selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                  )}
                >
                  <input type="radio" name="cover" className="sr-only" checked={selected} onChange={() => update({ coverUrl: cover.url })} />
                  <img src={cover.url} alt={`${CATEGORY_LABELS[cover.category]} artwork`} loading="lazy" className="size-full object-cover" />
                  {selected ? (
                    <span className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                    </span>
                  ) : null}
                </label>
              )
            })}
          </div>
        </fieldset>
      </div>
    </StepForm>
  )
}

function PlaceStep({ draft, update, onNext }: StepProps) {
  const [errors, setErrors] = useState<Errors>({})
  const [today] = useState(() => new Date().toLocaleDateString('en-CA'))
  const times = eventTimes(draft)
  const pastMidnight = times ? times.endsAt.getDate() !== times.startsAt.getDate() : false

  return (
    <StepForm
      title="When and where?"
      description="Guests see the area straight away. The exact address is shared only once you approve them."
      onSubmit={() => check(placeSchema, draft, setErrors) && onNext()}
    >
      <div className="grid gap-7">
        <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr_1fr]">
          <Field id="date" label="Date" error={errors.date}>
            <Input id="date" type="date" min={today} value={draft.date} data-autofocus="" onChange={(event) => update({ date: event.target.value })} {...described('date', errors.date)} />
          </Field>
          <Field id="startTime" label="Starts" error={errors.startTime}>
            <Input id="startTime" type="time" value={draft.startTime} onChange={(event) => update({ startTime: event.target.value })} {...described('startTime', errors.startTime)} />
          </Field>
          <Field id="endTime" label="Ends" error={errors.endTime} hint={pastMidnight ? 'Ends the next day.' : undefined}>
            <Input id="endTime" type="time" value={draft.endTime} onChange={(event) => update({ endTime: event.target.value })} {...described('endTime', errors.endTime)} />
          </Field>
        </div>

        <div className="grid gap-2">
          <p className="text-sm font-semibold">Area</p>
          <ChoiceChips legend="Area" name="area" options={AREAS} value={draft.area} describedBy={errors.area ? 'area-error' : undefined} onChange={(area) => update({ area })} />
          <FieldError id="area-error" message={errors.area} />
        </div>

        <Field id="venueName" label="Venue name (optional)" hint="A café, studio or park. Leave it empty if you are hosting at home.">
          <Input id="venueName" value={draft.venueName} maxLength={60} onChange={(event) => update({ venueName: event.target.value })} />
        </Field>

        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Lock className="size-4" aria-hidden="true" />
            Private until you approve a guest
          </p>
          <div className="mt-4 grid gap-5">
            <Field id="exactAddress" label="Exact address" error={errors.exactAddress}>
              <Textarea id="exactAddress" value={draft.exactAddress} className="min-h-20 bg-background/60" onChange={(event) => update({ exactAddress: event.target.value })} {...described('exactAddress', errors.exactAddress)} />
            </Field>
            <Field id="directions" label="Directions (optional)" hint="Which gate, which floor, where to park.">
              <Input id="directions" value={draft.directions} maxLength={200} className="bg-background/60" onChange={(event) => update({ directions: event.target.value })} />
            </Field>
          </div>
        </div>
      </div>
    </StepForm>
  )
}

function GuestsStep({ draft, update, onNext }: StepProps) {
  const { session } = useSession()
  const [errors, setErrors] = useState<Errors>({})
  const isHouseParty = draft.category === 'house_party'
  const capacity = Number(draft.capacity)
  const canBeWomenOnly = session?.profile?.gender === 'woman'

  return (
    <StepForm
      title="Who is it for?"
      description="Small groups work best. People talk more when there are fewer of them."
      onSubmit={() => check(guestsSchema(draft.category), draft, setErrors) && onNext()}
    >
      <div className="grid gap-7">
        <Field
          id="capacity"
          label="Number of guests"
          error={errors.capacity}
          hint={
            capacity >= 2
              ? `You can approve up to ${Math.floor(capacity * (1 + OVER_APPROVAL_RATIO))} people, because a few usually can’t make it on the day.`
              : undefined
          }
        >
          <Input id="capacity" inputMode="numeric" pattern="[0-9]*" value={draft.capacity} data-autofocus="" className="w-32 text-lead tabular-nums" onChange={(event) => update({ capacity: event.target.value })} {...described('capacity', errors.capacity)} />
        </Field>

        {isHouseParty ? (
          <div className="flex gap-4 rounded-2xl bg-highlight-soft p-5 text-highlight-soft-foreground">
            <Home className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">House parties have a few fixed rules</p>
              <p className="mt-1">
                At most {HOUSE_PARTY_MAX_GUESTS} guests. You approve every guest. Your address is shared only after approval. Your
                house rules are shown before anyone asks to join.
              </p>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-4 sm:max-w-sm">
          <Field id="ageMin" label="Youngest age" error={errors.ageMin}>
            <Input id="ageMin" inputMode="numeric" pattern="[0-9]*" value={draft.ageMin} className="tabular-nums" onChange={(event) => update({ ageMin: event.target.value })} {...described('ageMin', errors.ageMin)} />
          </Field>
          <Field id="ageMax" label="Oldest age (optional)" error={errors.ageMax}>
            <Input id="ageMax" inputMode="numeric" pattern="[0-9]*" value={draft.ageMax} placeholder="Any" className="tabular-nums" onChange={(event) => update({ ageMax: event.target.value })} {...described('ageMax', errors.ageMax)} />
          </Field>
        </div>

        {canBeWomenOnly ? (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4">
            <div>
              <Label htmlFor="womenOnly" className="text-base font-medium">
                Women only
              </Label>
              <p className="mt-1 text-sm text-muted-foreground">Only women will be able to ask to join.</p>
            </div>
            <Switch id="womenOnly" checked={draft.womenOnly} onCheckedChange={(womenOnly) => update({ womenOnly })} />
          </div>
        ) : null}
      </div>
    </StepForm>
  )
}

function CostStep({ draft, update, onNext }: StepProps) {
  const [errors, setErrors] = useState<Errors>({})
  const modes = Object.keys(HOST_PRICING_LABELS) as (keyof typeof HOST_PRICING_LABELS)[]

  return (
    <StepForm
      title="What will it cost guests?"
      description="Community events are never ticketed. Say what, if anything, people should expect to pay on the day."
      onSubmit={() => check(costSchema, draft, setErrors) && onNext()}
    >
      <fieldset>
        <legend className="sr-only">Cost</legend>
        <div className="grid gap-3">
          {modes.map((mode, index) => (
            <ChoiceCard key={mode} name="pricingMode" value={mode} checked={draft.pricingMode === mode} autoFocus={index === 0} onChange={() => update({ pricingMode: mode })}>
              <span>
                {HOST_PRICING_LABELS[mode].label}
                <span className="block text-base font-normal text-muted-foreground">{HOST_PRICING_LABELS[mode].hint}</span>
              </span>
            </ChoiceCard>
          ))}
        </div>
      </fieldset>

      <div className="mt-7 grid gap-6">
        {draft.pricingMode === 'cost_split' ? (
          <Field id="amount" label="Roughly how much each, in rupees" error={errors.amount}>
            <div className="flex gap-2">
              <span className="flex h-12 items-center rounded-xl border border-input bg-muted px-4 font-medium" aria-hidden="true">
                ₹
              </span>
              <Input id="amount" inputMode="numeric" pattern="[0-9]*" value={draft.amount} className="w-36 tabular-nums" onChange={(event) => update({ amount: event.target.value })} {...described('amount', errors.amount)} />
            </div>
          </Field>
        ) : null}
        <Field id="pricingNote" label="A note about cost (optional)" hint="For example, “Bring one dish to share.”" error={errors.pricingNote}>
          <Input id="pricingNote" value={draft.pricingNote} maxLength={80} onChange={(event) => update({ pricingNote: event.target.value })} {...described('pricingNote', errors.pricingNote)} />
        </Field>
      </div>
    </StepForm>
  )
}

function RulesStep({ draft, update, onNext }: StepProps) {
  const [errors, setErrors] = useState<Errors>({})
  const [custom, setCustom] = useState('')
  const add = (rule: string) => {
    const text = rule.trim()
    if (text && !draft.houseRules.includes(text)) update({ houseRules: [...draft.houseRules, text] })
  }
  const suggestions = SUGGESTED_RULES.filter((rule) => !draft.houseRules.includes(rule))

  return (
    <StepForm
      title="Set the house rules."
      description="Guests see these before they ask to join, so there are no surprises on the night."
      onSubmit={() => check(rulesSchema, draft, setErrors) && onNext()}
      error={errors.houseRules}
    >
      <ul className="grid gap-2.5">
        {draft.houseRules.map((rule) => (
          <li key={rule} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card py-2 pr-2 pl-4">
            {rule}
            <button
              type="button"
              onClick={() => update({ houseRules: draft.houseRules.filter((other) => other !== rule) })}
              aria-label={`Remove the rule “${rule}”`}
              className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-4.5" aria-hidden="true" />
            </button>
          </li>
        ))}
        <li className="flex items-center gap-3 rounded-xl border border-dashed border-foreground/25 px-4 py-3.5 text-muted-foreground">
          <Lock className="size-4 shrink-0" aria-hidden="true" />
          <span>
            {FIXED_RULE} <span className="text-sm">(on every event)</span>
          </span>
        </li>
      </ul>

      <div className="mt-6 flex gap-2">
        <Input
          value={custom}
          maxLength={90}
          aria-label="Add your own rule"
          placeholder="Add your own rule"
          data-autofocus=""
          onChange={(event) => setCustom(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            add(custom)
            setCustom('')
          }}
        />
        <Button
          type="button"
          variant="secondary"
          className="h-12"
          onClick={() => {
            add(custom)
            setCustom('')
          }}
        >
          <Plus aria-hidden="true" />
          Add
        </Button>
      </div>

      {suggestions.length > 0 ? (
        <div className="mt-6">
          <p className="text-sm font-semibold">Common rules</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((rule) => (
              <li key={rule}>
                <button
                  type="button"
                  onClick={() => add(rule)}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-input bg-card px-4 text-left text-sm font-medium transition-colors hover:border-foreground/60"
                >
                  <Plus className="size-3.5 shrink-0" aria-hidden="true" />
                  {rule}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </StepForm>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 py-3.5 sm:grid-cols-[9rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  )
}

function ReviewStep({ draft, onCreated }: { draft: EventFormDraft; onCreated: (event: Event) => void }) {
  const create = useCreateEvent()
  const event = toEventDraft(draft)

  return (
    <StepForm
      title="Check it over."
      description="Our team looks at every new event before it goes live. That usually takes less than a day."
      onSubmit={() => create.mutate(event, { onSuccess: onCreated })}
      submitLabel="Send for approval"
      pendingLabel="Sending…"
      pending={create.isPending}
      error={create.isError ? create.error.message || 'That didn’t send. Please try again.' : null}
    >
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card">
        <img src={event.coverUrl} alt="" className="aspect-[16/8] w-full object-cover" />
        <div className="p-6">
          <p className="eyebrow text-primary">{CATEGORY_LABELS[event.category]}</p>
          <h2 className="mt-2 text-h3">{event.title}</h2>
          <p className="mt-1.5 text-muted-foreground">{event.summary}</p>
          <dl className="mt-4 divide-y divide-border border-t border-border">
            <Row label="When">
              {formatDay(event.startsAt)} · {formatTimeRange(event.startsAt, event.endsAt)}
            </Row>
            <Row label="Where">{event.venueName ? `${event.venueName}, ${event.area}` : `A home in ${event.area}`}</Row>
            <Row label="Private address">
              {event.exactAddress}
              {event.directions ? <span className="block font-normal text-muted-foreground">{event.directions}</span> : null}
            </Row>
            <Row label="Guests">
              {event.capacity} · ages {ageRangeLabel(event.ageRange)}
              {event.womenOnly ? ' · women only' : ''}
            </Row>
            <Row label="Cost">
              {priceLabel(event.pricing)}
              {event.pricing.note ? <span className="block font-normal text-muted-foreground">{event.pricing.note}</span> : null}
            </Row>
            <Row label="House rules">
              <ul className="grid gap-1 font-normal">
                {event.houseRules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </Row>
          </dl>
        </div>
      </div>
    </StepForm>
  )
}

function Sent({ event, onAnother }: { event: Event; onAnother: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
      <span className="inline-flex size-16 items-center justify-center rounded-full bg-success-soft text-success-strong">
        <Check className="size-7" strokeWidth={2} aria-hidden="true" />
      </span>
      <h1 className="mt-6 text-h1">Sent for approval.</h1>
      <p className="mt-4 max-w-md text-lead text-muted-foreground">
        “{event.title}” is with our team. We’ll let you know as soon as it’s live, usually within a day.
      </p>
      <div className="mt-9 flex flex-col gap-3 sm:flex-row">
        <Button asChild>
          <AppLink to="/app/host">Back to my events</AppLink>
        </Button>
        <Button variant="ghost" onClick={onAnother}>
          Create another
        </Button>
      </div>
    </div>
  )
}

const STEP_COMPONENTS = { basics: BasicsStep, details: DetailsStep, place: PlaceStep, guests: GuestsStep, cost: CostStep, rules: RulesStep } as const

/** Create an event, one step at a time. The form is saved as it is written. */
export function Component() {
  const { session } = useSession()
  const [params, setParams] = useSearchParams()
  const [draft, update, clear] = useLocalDraft<EventFormDraft>(`kollide:event-draft:${session!.user.id}`, EMPTY_EVENT_DRAFT)
  const [created, setCreated] = useState<Event | null>(null)
  const [direction, setDirection] = useState(1)

  const ids = CREATE_STEPS.map((step) => step.id)
  const requested = params.get('step') as CreateStepId | null
  const open = firstOpenStep(draft)

  if (created) {
    return (
      <div className="mx-auto flex min-h-[70dvh] max-w-xl flex-col">
        <title>Sent for approval · Kollide</title>
        <Sent
          event={created}
          onAnother={() => {
            setCreated(null)
            setParams({}, { replace: true })
          }}
        />
      </div>
    )
  }

  // An unknown step, or one whose earlier steps are unfinished, goes to where the host left off.
  if (!requested || !ids.includes(requested) || ids.indexOf(requested) > ids.indexOf(open)) {
    return <Navigate to={`?step=${open}`} replace />
  }

  const index = ids.indexOf(requested)
  const go = (target: number) => {
    setDirection(target > index ? 1 : -1)
    setParams({ step: ids[target] })
  }
  const Step = requested === 'review' ? null : STEP_COMPONENTS[requested]

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-13rem)] max-w-xl flex-col [--step-footer-offset:4rem] md:[--step-footer-offset:0px]">
      <title>Create an event · Kollide</title>
      <div className="flex h-12 items-center gap-3">
        {index > 0 ? (
          <Button variant="ghost" size="icon" className="-ml-2.5" onClick={() => go(index - 1)} aria-label="Back to the previous step">
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Button>
        ) : null}
        <div
          role="progressbar"
          aria-label="Create an event"
          aria-valuemin={1}
          aria-valuemax={ids.length}
          aria-valuenow={index + 1}
          aria-valuetext={`Step ${index + 1} of ${ids.length}`}
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/12"
        >
          <div className="h-full origin-left rounded-full bg-primary transition-transform duration-500 ease-out-soft" style={{ transform: `scaleX(${(index + 1) / ids.length})` }} />
        </div>
        <span className="w-10 text-right text-sm text-muted-foreground tabular-nums" aria-hidden="true">
          {index + 1} / {ids.length}
        </span>
        <Button asChild variant="ghost" size="sm" className="-mr-2">
          <AppLink to="/app/host">Close</AppLink>
        </Button>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={requested}
          className="flex flex-1 flex-col"
          initial={{ opacity: 0, x: 28 * direction }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 * direction }}
          transition={spring.snappy}
        >
          {Step ? (
            <Step draft={draft} update={update} onNext={() => go(index + 1)} />
          ) : (
            <ReviewStep
              draft={draft}
              onCreated={(event) => {
                clear()
                setCreated(event)
              }}
            />
          )}
        </m.div>
      </AnimatePresence>
    </div>
  )
}

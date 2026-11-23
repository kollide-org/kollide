import { Check } from 'lucide-react'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import { FieldError } from '@/components/forms/step-form'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useEvents } from '@/features/events/queries'
import { formatDay } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AdminHub, HubInput } from '@/services'

import { useSaveHub } from '../queries'

/**
 * Accent pairs for the "In season" pill and the button on the hub. The hub
 * sits on the dark ink background, so each accent is light enough to stand
 * out there, and each text colour reads on its accent at WCAG AA.
 */
const HUB_ACCENTS = [
  { name: 'Marigold', color: '#d9b26a', foreground: '#2a2224' },
  { name: 'Sage', color: '#7f9a7a', foreground: '#1f1719' },
  { name: 'Dusty rose', color: '#ba6e63', foreground: '#1f1719' },
  { name: 'Blush', color: '#e8b4b8', foreground: '#2a2224' },
  { name: 'Antique', color: '#f0e7d8', foreground: '#5a2333' },
  { name: 'Cherry', color: '#a63a50', foreground: '#fff8f0' },
] as const

const schema = z
  .object({
    title: z.string().trim().min(4, 'Give the hub a title of at least four characters.').max(60, 'Keep the title to 60 characters.'),
    subtitle: z.string().trim().min(8, 'Add a one-line subtitle.').max(110, 'Keep the subtitle to 110 characters.'),
    description: z.string().trim().max(500, 'Keep the description to 500 characters.'),
    startDate: z.string().min(1, 'Choose when it starts showing.'),
    endDate: z.string().min(1, 'Choose when it stops.'),
  })
  .refine((value) => value.endDate >= value.startDate, { message: 'It has to end on or after the day it starts.', path: ['endDate'] })

type Field = 'title' | 'subtitle' | 'description' | 'startDate' | 'endDate'

/** Dates are chosen in Bengaluru time: a hub runs from the start of its first day to the end of its last. */
function dayInBengaluru(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(iso))
}

function FormRow({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  )
}

interface HubEditorProps {
  /** `null` creates a new hub. */
  hub: AdminHub | null
  /** Artwork already in use across the site, offered as choices. */
  artwork: { url: string; alt: string }[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function HubEditor({ hub, artwork, open, onOpenChange }: HubEditorProps) {
  const id = useId()
  const save = useSaveHub()
  const events = useEvents()
  const [values, setValues] = useState({
    title: hub?.title ?? '',
    subtitle: hub?.subtitle ?? '',
    description: hub?.description ?? '',
    startDate: hub ? dayInBengaluru(hub.startsAt) : '',
    endDate: hub ? dayInBengaluru(hub.endsAt) : '',
  })
  const [art, setArt] = useState(hub?.artworkUrl ?? artwork[0]?.url ?? '')
  const [accent, setAccent] = useState(HUB_ACCENTS.find((option) => option.color === hub?.accentColor.toLowerCase()) ?? HUB_ACCENTS[0])
  const [selected, setSelected] = useState<string[]>(hub?.eventIds ?? [])
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})

  const field = (name: Field) => ({
    id: `${id}-${name}`,
    value: values[name],
    onChange: (change: { target: { value: string } }) => setValues((current) => ({ ...current, [name]: change.target.value })),
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `${id}-${name}-error` : undefined,
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const parsed = schema.safeParse(values)
    if (!parsed.success) {
      const next: Partial<Record<Field, string>> = {}
      for (const issue of parsed.error.issues) next[issue.path[0] as Field] ??= issue.message
      setErrors(next)
      document.getElementById(`${id}-${Object.keys(next)[0]}`)?.focus()
      return
    }
    setErrors({})
    // Events that are no longer listed (past ones) stay in the hub; only upcoming ones are chosen here.
    const upcoming = new Set(events.data?.map((item) => item.id))
    const kept = (hub?.eventIds ?? []).filter((eventId) => !upcoming.has(eventId))
    const chosenArt = artwork.find((option) => option.url === art)
    const input: HubInput = {
      title: parsed.data.title,
      subtitle: parsed.data.subtitle,
      description: parsed.data.description,
      artworkUrl: art,
      artworkAlt: chosenArt?.alt ?? '',
      accentColor: accent.color,
      accentForeground: accent.foreground,
      startsAt: new Date(`${parsed.data.startDate}T00:00:00+05:30`).toISOString(),
      endsAt: new Date(`${parsed.data.endDate}T23:59:00+05:30`).toISOString(),
      eventIds: [...kept, ...selected.filter((eventId) => upcoming.has(eventId))],
    }
    save.mutate(
      { hubId: hub?.id ?? null, input },
      {
        onSuccess: () => {
          toast.success(hub ? 'Hub saved' : 'Hub created', {
            description: hub?.active ? 'Home shows the changes now.' : 'Show it on Home when it’s ready.',
          })
          onOpenChange(false)
        },
        onError: (error) => toast.error('That didn’t save', { description: error.message }),
      },
    )
  }

  const toggleEvent = (eventId: string, on: boolean) =>
    setSelected((current) => (on ? [...current, eventId] : current.filter((value) => value !== eventId)))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-xl data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader className="border-b border-border px-6 py-5">
          <SheetTitle className="text-h3">{hub ? `Edit “${hub.title}”` : 'New hub'}</SheetTitle>
          <SheetDescription>A seasonal collection at the top of Home. Any theme works.</SheetDescription>
        </SheetHeader>

        <form id={`${id}-form`} noValidate onSubmit={submit} className="grid flex-1 content-start gap-6 overflow-y-auto px-6 py-6">
          <FormRow id={`${id}-title`} label="Title" error={errors.title}>
            <Input {...field('title')} maxLength={60} placeholder="Diwali in Bengaluru" />
          </FormRow>
          <FormRow id={`${id}-subtitle`} label="Subtitle" error={errors.subtitle}>
            <Input {...field('subtitle')} maxLength={110} placeholder="Lights, sweets and a few new friends" />
          </FormRow>
          <FormRow id={`${id}-description`} label="Description (optional)" error={errors.description}>
            <Textarea {...field('description')} maxLength={500} className="min-h-24" />
          </FormRow>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormRow id={`${id}-startDate`} label="Starts showing" error={errors.startDate}>
              <Input type="date" {...field('startDate')} />
            </FormRow>
            <FormRow id={`${id}-endDate`} label="Stops showing" error={errors.endDate}>
              <Input type="date" {...field('endDate')} />
            </FormRow>
          </div>

          <fieldset className="grid gap-3">
            <legend className="mb-3 text-sm font-medium">Artwork</legend>
            <div className="grid grid-cols-3 gap-3">
              {artwork.map((option) => (
                <label key={option.url} className="group relative cursor-pointer">
                  <input
                    type="radio"
                    name={`${id}-art`}
                    value={option.url}
                    checked={art === option.url}
                    onChange={() => setArt(option.url)}
                    className="peer sr-only"
                  />
                  <img
                    src={option.url}
                    alt={option.alt}
                    loading="lazy"
                    className="aspect-[4/3] w-full rounded-xl object-cover ring-offset-2 ring-offset-popover transition peer-checked:ring-2 peer-checked:ring-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
                  />
                  <span className="absolute top-2 right-2 hidden size-6 items-center justify-center rounded-full bg-primary text-primary-foreground peer-checked:inline-flex">
                    <Check className="size-4" aria-hidden="true" />
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-sm font-medium">Accent colour</legend>
            <div className="flex flex-wrap gap-2.5">
              {HUB_ACCENTS.map((option) => (
                <label
                  key={option.color}
                  className="relative inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-input pr-4 pl-1.5 text-sm font-medium has-checked:border-primary has-checked:bg-primary-soft has-focus-visible:ring-2 has-focus-visible:ring-ring"
                >
                  <input
                    type="radio"
                    name={`${id}-accent`}
                    checked={accent.color === option.color}
                    onChange={() => setAccent(option)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className="inline-flex size-7 items-center justify-center rounded-full text-xs font-semibold"
                    style={{ background: option.color, color: option.foreground }}
                  >
                    Aa
                  </span>
                  {option.name}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1 text-sm font-medium">Events in this hub</legend>
            <p className="mb-3 text-sm text-muted-foreground">{selected.length} chosen. Only upcoming, live events are listed.</p>
            {events.isPending ? (
              <Skeleton className="h-48 rounded-xl" />
            ) : (
              <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                {events.data?.map((event) => {
                  const checkboxId = `${id}-event-${event.id}`
                  const on = selected.includes(event.id)
                  return (
                    <li key={event.id} className={cn('flex items-center gap-3 px-4 py-3 transition-colors', on && 'bg-primary-soft/50')}>
                      <Checkbox id={checkboxId} checked={on} onCheckedChange={(state) => toggleEvent(event.id, state === true)} />
                      <Label htmlFor={checkboxId} className="block min-w-0 flex-1 cursor-pointer leading-snug font-normal">
                        <span className="block truncate font-medium">{event.title}</span>
                        <span className="block text-sm text-muted-foreground">
                          {formatDay(event.startsAt)} · {event.area}
                        </span>
                      </Label>
                    </li>
                  )
                })}
              </ul>
            )}
          </fieldset>
        </form>

        <SheetFooter className="flex-row justify-end gap-3 border-t border-border px-6 py-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form={`${id}-form`} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : hub ? 'Save hub' : 'Create hub'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

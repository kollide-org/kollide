import { UsersRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { ChoiceChips } from '@/components/forms/choice'
import { FieldError } from '@/components/forms/step-form'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useCreateSquad } from '@/features/squads/queries'
import { EMPTY_SQUAD_FORM, MEET_MINUTES, meetingTime, SQUAD_SIZES, squadFormSchema, type SquadForm } from '@/features/squads/schemas'
import { formatTime } from '@/lib/format'
import type { EventDetail } from '@/services'

type Errors = Partial<Record<keyof SquadForm, string>>

const minuteLabel = (minutes: number) => `${minutes} min before`
const sizeLabel = (size: number) => `${size} people`

interface StartSquadDialogProps {
  event: EventDetail
  /** Women can choose a women-only squad. On a women-only event every squad is. */
  canChooseWomenOnly: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Starts a squad for one event. The creator then approves each person who asks to join. */
export function StartSquadDialog({ event, canChooseWomenOnly, open, onOpenChange }: StartSquadDialogProps) {
  const navigate = useNavigate()
  const create = useCreateSquad()
  const [form, setForm] = useState<SquadForm>({ ...EMPTY_SQUAD_FORM, womenOnly: event.womenOnly })
  const [errors, setErrors] = useState<Errors>({})
  const update = (patch: Partial<SquadForm>) => setForm((current) => ({ ...current, ...patch }))

  const submit = (submitEvent: FormEvent) => {
    submitEvent.preventDefault()
    const parsed = squadFormSchema.safeParse(form)
    if (!parsed.success) {
      const next: Errors = {}
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof SquadForm] ??= issue.message
      setErrors(next)
      document.getElementById(`squad-${Object.keys(next)[0]}`)?.focus()
      return
    }
    setErrors({})
    const { name, place, minutesBefore, size, womenOnly } = parsed.data
    create.mutate(
      { eventId: event.id, name, meetingPoint: { place, minutesBefore }, size, womenOnly: womenOnly || event.womenOnly },
      {
        onSuccess: (squad) => {
          onOpenChange(false)
          toast.success('Your squad is open', { description: 'You’ll approve each person who asks to join.' })
          void navigate(`/app/squads/${squad.id}`, { viewTransition: true })
        },
        onError: (error) => toast.error('The squad didn’t start', { description: error.message }),
      },
    )
  }

  const described = (id: keyof SquadForm, hint?: boolean) => ({
    'aria-invalid': errors[id] ? true : undefined,
    'aria-describedby': errors[id] ? `squad-${id}-error` : hint ? `squad-${id}-hint` : undefined,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Start a squad</DialogTitle>
          <DialogDescription>
            Four to six people who meet somewhere public nearby, then walk in to {event.title} together.
          </DialogDescription>
        </DialogHeader>

        <form id="start-squad" noValidate onSubmit={submit} className="grid gap-6">
          <div className="grid gap-2">
            <Label htmlFor="squad-name">Squad name</Label>
            <Input
              id="squad-name"
              value={form.name}
              maxLength={40}
              placeholder="Early birds"
              onChange={(change) => update({ name: change.target.value })}
              {...described('name')}
            />
            <FieldError id="squad-name-error" message={errors.name} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="squad-place">Where you’ll meet</Label>
            <Input
              id="squad-place"
              value={form.place}
              maxLength={80}
              placeholder="A café near the venue"
              onChange={(change) => update({ place: change.target.value })}
              {...described('place', true)}
            />
            {errors.place ? (
              <FieldError id="squad-place-error" message={errors.place} />
            ) : (
              <p id="squad-place-hint" className="text-sm text-muted-foreground">
                A café, a metro exit or a shop front. Always somewhere public, never a home.
              </p>
            )}
          </div>

          <div className="grid gap-3">
            <p className="text-sm font-medium" aria-hidden="true">
              When you’ll meet
            </p>
            <ChoiceChips
              legend="When you’ll meet"
              name="squad-minutes"
              options={MEET_MINUTES.map(minuteLabel)}
              value={minuteLabel(form.minutesBefore)}
              onChange={(label) => update({ minutesBefore: MEET_MINUTES.find((minutes) => minuteLabel(minutes) === label) ?? 30 })}
              describedBy="squad-minutes-time"
            />
            <p id="squad-minutes-time" className="text-sm text-muted-foreground">
              That’s {formatTime(meetingTime(event.startsAt, form.minutesBefore).toISOString())}, for a{' '}
              {formatTime(event.startsAt)} start.
            </p>
          </div>

          <div className="grid gap-3">
            <p className="text-sm font-medium" aria-hidden="true">
              Squad size, including you
            </p>
            <ChoiceChips
              legend="Squad size, including you"
              name="squad-size"
              options={SQUAD_SIZES.map(sizeLabel)}
              value={sizeLabel(form.size)}
              onChange={(label) => update({ size: SQUAD_SIZES.find((size) => sizeLabel(size) === label) ?? 5 })}
            />
          </div>

          {event.womenOnly ? (
            <p className="flex items-center gap-2.5 rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">
              <UsersRound className="size-5 shrink-0" aria-hidden="true" />
              This is a women-only event, so its squads are women-only too.
            </p>
          ) : canChooseWomenOnly ? (
            <div className="flex items-start justify-between gap-4 rounded-2xl bg-background/70 p-4">
              <div>
                <Label htmlFor="squad-women-only">Women only</Label>
                <p id="squad-women-only-hint" className="mt-1 text-sm text-muted-foreground">
                  Only women can ask to join.
                </p>
              </div>
              <Switch
                id="squad-women-only"
                checked={form.womenOnly}
                onCheckedChange={(checked) => update({ womenOnly: checked })}
                aria-describedby="squad-women-only-hint"
              />
            </div>
          ) : null}
        </form>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="start-squad" disabled={create.isPending}>
            {create.isPending ? 'Starting…' : 'Start the squad'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

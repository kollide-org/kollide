import { Check, CircleSlash, Clock, Flag, ScanLine, UsersRound } from 'lucide-react'
import * as m from 'motion/react-m'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { PersonAvatar } from '@/components/people/person-avatar'
import { VerifiedBadge } from '@/components/people/verified-badge'
import { AppLink } from '@/components/shared/app-link'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { FieldError } from '@/components/forms/step-form'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { checkInOpensAt, isCheckInOpen } from '@/domain/bookings'
import { useAttendees, useCheckIn, useCheckInWithTicket, useCloseOut } from '@/features/bookings/queries'
import { formatDay, formatTime } from '@/lib/format'
import { spring } from '@/lib/motion'
import { useMotionAllowed } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import { SERVICE_MODE, type Attendee, type EventDetail } from '@/services'

/** A viewfinder with a line that sweeps down it. The scanning itself is simulated. */
function Viewfinder() {
  const motionAllowed = useMotionAllowed()
  return (
    <div className="relative mx-auto aspect-square w-full max-w-64 overflow-hidden rounded-3xl bg-brand-ink" aria-hidden="true">
      {(['top-4 left-4 border-t-2 border-l-2', 'top-4 right-4 border-t-2 border-r-2', 'bottom-4 left-4 border-b-2 border-l-2', 'right-4 bottom-4 border-r-2 border-b-2'] as const).map(
        (corner) => (
          <span key={corner} className={cn('absolute size-10 rounded-sm border-brand-antique/90', corner)} />
        ),
      )}
      <m.span
        className="absolute inset-x-8 top-8 h-0.5 rounded-full bg-primary shadow-[0_0_16px_2px_var(--primary)]"
        animate={motionAllowed ? { y: [0, 176, 0] } : undefined}
        transition={{ duration: 2.4, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
      />
    </div>
  )
}

function ScannerDialog({ eventId, attendees, open, onOpenChange }: { eventId: string; attendees: Attendee[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const scan = useCheckInWithTicket(eventId)
  const [code, setCode] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!code.trim()) return
    scan.mutate(code.trim(), {
      onSuccess: (checkIn) => {
        const name = attendees.find((attendee) => attendee.person.userId === checkIn.userId)?.person.firstName ?? 'They'
        toast.success(`${name} is checked in`)
        setCode('')
        scan.reset()
      },
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) scan.reset()
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Scan a ticket</DialogTitle>
          <DialogDescription>Point the camera at the QR code on a guest’s phone.</DialogDescription>
        </DialogHeader>
        <Viewfinder />
        <form onSubmit={submit} noValidate className="grid gap-3">
          <Label htmlFor="ticket-code">Or enter the code under the QR</Label>
          <Input
            id="ticket-code"
            value={code}
            onChange={(change) => setCode(change.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="KOLLIDE:…"
            aria-invalid={scan.isError || undefined}
            aria-describedby={scan.isError ? 'ticket-code-error' : 'ticket-code-hint'}
          />
          {scan.isError ? (
            <FieldError id="ticket-code-error" message={scan.error.message} />
          ) : (
            <p id="ticket-code-hint" className="text-sm text-muted-foreground">
              {SERVICE_MODE === 'mock'
                ? 'The camera is simulated in this version, so paste or type the code shown on the ticket.'
                : 'Use this if the camera can’t read the code.'}
            </p>
          )}
          <Button type="submit" disabled={scan.isPending || !code.trim()}>
            {scan.isPending ? 'Checking…' : 'Check in'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** The host's door list: tap to check people in, scan tickets, and close the event out. */
export function CheckInPanel({ event }: { event: EventDetail }) {
  const attendees = useAttendees(event.id)
  const checkIn = useCheckIn(event.id)
  const closeOut = useCloseOut(event.id)
  const [scanning, setScanning] = useState(false)
  const [closing, setClosing] = useState(false)
  const [openedAt] = useState(() => Date.now())
  const now = new Date(openedAt)

  const open = isCheckInOpen(event.startsAt, event.status, now)
  const started = new Date(event.startsAt).getTime() <= openedAt
  const closed = event.status === 'completed'

  if (attendees.isPending) {
    return (
      <div role="status" aria-label="Loading guests" className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-18 rounded-2xl" />
        ))}
      </div>
    )
  }
  if (attendees.isError) return <ErrorState onRetry={() => void attendees.refetch()} />
  if (attendees.data.length === 0) {
    return (
      <EmptyState
        icon={UsersRound}
        title="Nobody is going yet"
        description="People you accept appear here. On the day, this is where you check them in."
      />
    )
  }

  const list = attendees.data
  const here = list.filter((attendee) => attendee.checkIn)
  const notHere = list.filter((attendee) => !attendee.checkIn && attendee.booking.status !== 'no_show')

  const tap = (attendee: Attendee) =>
    checkIn.mutate(attendee.person.userId, {
      onError: (error) => toast.error(`${attendee.person.firstName} isn’t checked in`, { description: error.message }),
    })

  const confirmClose = () =>
    closeOut.mutate(undefined, {
      onSuccess: (result) => {
        setClosing(false)
        toast.success('The event is closed out', {
          description: `${result.attended} came${result.noShows ? `, ${result.noShows} missed it` : ''}. Feedback is open for everyone who came.`,
        })
      },
      onError: (error) => toast.error('That didn’t go through', { description: error.message }),
    })

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-card p-5 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="font-display text-h3" aria-live="polite">
            {here.length} of {list.length} {closed ? 'came' : 'here'}
          </p>
          <p className="text-sm text-muted-foreground">
            {closed
              ? 'This event is closed out. Feedback is open for everyone who came.'
              : open
                ? 'Tap a name as people arrive, or scan their ticket.'
                : `Check-in opens at ${formatTime(checkInOpensAt(event.startsAt).toISOString())} on ${formatDay(event.startsAt)}, two hours before the start.`}
          </p>
        </div>
        {open ? (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setScanning(true)}>
              <ScanLine aria-hidden="true" />
              Scan a ticket
            </Button>
            {started ? (
              <Button variant="outline" onClick={() => setClosing(true)}>
                <Flag aria-hidden="true" />
                Close out
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((attendee) => {
          const { booking, person, checkIn: arrived } = attendee
          const missed = booking.status === 'no_show'
          return (
            <li
              key={booking.id}
              className={cn(
                'flex items-center gap-3 rounded-2xl border p-3 shadow-card transition-colors',
                arrived ? 'border-success/40 bg-success-soft/60' : 'border-border/70 bg-card',
              )}
            >
              <AppLink to={`/app/people/${person.userId}`} className="flex min-w-0 flex-1 items-center gap-3.5 rounded-xl">
                <PersonAvatar person={person} className="size-12" />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <span className="truncate">{person.firstName}</span>
                    {person.verified ? <VerifiedBadge /> : null}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {arrived
                      ? `Here since ${formatTime(arrived.checkedInAt)}`
                      : missed
                        ? 'Didn’t make it'
                        : booking.reconfirmedAt
                          ? 'Still coming'
                          : booking.promotedAt
                            ? 'Moved up from the waitlist'
                            : 'Accepted'}
                  </span>
                </span>
              </AppLink>
              {arrived ? (
                <m.span
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ ...spring.soft, bounce: 0.4 }}
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-success text-on-status"
                >
                  <Check className="size-5" strokeWidth={2.5} aria-hidden="true" />
                  <span className="sr-only">Checked in</span>
                </m.span>
              ) : missed ? (
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <CircleSlash className="size-5" aria-hidden="true" />
                  <span className="sr-only">Missed</span>
                </span>
              ) : open ? (
                <Button variant="soft" size="sm" onClick={() => tap(attendee)} aria-label={`Check in ${person.firstName}`}>
                  Check in
                </Button>
              ) : (
                <Clock className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
            </li>
          )
        })}
      </ul>

      <ScannerDialog eventId={event.id} attendees={list} open={scanning} onOpenChange={setScanning} />

      <Dialog open={closing} onOpenChange={setClosing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close out {event.title}?</DialogTitle>
            <DialogDescription>
              {notHere.length === 0
                ? 'Everyone with a place is checked in. Closing out opens feedback for all of them.'
                : `${notHere.length === 1 ? 'This person isn’t' : `These ${notHere.length} people aren’t`} checked in, so they will be marked as having missed it. That counts against their reliability.`}
            </DialogDescription>
          </DialogHeader>
          {notHere.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {notHere.map(({ person }) => (
                <li key={person.userId} className="inline-flex items-center gap-2 rounded-full border border-border bg-card py-1 pr-3.5 pl-1">
                  <PersonAvatar person={person} className="size-7" />
                  <span className="text-sm font-medium">{person.firstName}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-sm text-muted-foreground">You can’t check anyone in after this.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setClosing(false)}>
              Not yet
            </Button>
            <Button onClick={confirmClose} disabled={closeOut.isPending}>
              {closeOut.isPending ? 'Closing out…' : 'Close out the event'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

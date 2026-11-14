import { ArrowRight, ArrowUpRight, CalendarDays, Check, Clock, Hourglass, Send, Ticket, UsersRound } from 'lucide-react'
import { LayoutGroup } from 'motion/react'
import * as m from 'motion/react-m'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { useSession } from '@/app/providers/session-context'
import { AppLink } from '@/components/shared/app-link'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatDay, formatTimeRange, priceLabel, spotsLabel } from '@/lib/format'
import { spring } from '@/lib/motion'
import { shareOrCopy } from '@/lib/share'
import type { EventDetail } from '@/services'

import { useCancelBooking, useRequestToJoin } from '../queries'

const NOTE_MAX = 200

function Note({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground">{children}</p>
}

function StatusPill({ tone, icon, children }: { tone: 'success' | 'warning' | 'neutral'; icon: ReactNode; children: ReactNode }) {
  const tones = {
    success: 'bg-success-soft text-success-strong',
    warning: 'bg-warning-soft text-warning-strong',
    neutral: 'bg-secondary text-secondary-foreground',
  }
  return (
    <p className={`inline-flex h-11 w-fit items-center gap-2 rounded-full px-5 font-semibold ${tones[tone]}`}>
      {icon}
      {children}
    </p>
  )
}

/** The dialog for a request: an optional note, and a reminder of the house rules. */
function RequestDialog({
  event,
  open,
  onOpenChange,
  onSend,
}: {
  event: EventDetail
  open: boolean
  onOpenChange: (open: boolean) => void
  onSend: (note: string) => void
}) {
  const [note, setNote] = useState('')
  const hostName = event.host?.firstName ?? 'The host'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ask to join</DialogTitle>
          <DialogDescription>
            {hostName} will see your profile card and how often you turn up, then reply. The address is shared once you’re
            approved.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="request-note">Add a note (optional)</Label>
          <Textarea
            id="request-note"
            value={note}
            maxLength={NOTE_MAX}
            onChange={(change) => setNote(change.target.value)}
            placeholder={`Say hello to ${hostName}`}
            className="min-h-24"
            aria-describedby="request-note-count"
          />
          <p id="request-note-count" className="text-right text-xs text-muted-foreground tabular-nums">
            {note.length} of {NOTE_MAX}
          </p>
        </div>

        {event.houseRules.length > 0 ? (
          <div className="rounded-xl bg-background/70 p-4">
            <p className="text-sm font-semibold">By asking, you agree to the house rules</p>
            <ul className="mt-2 grid gap-1.5 text-sm text-muted-foreground">
              {event.houseRules.slice(0, 3).map((rule) => (
                <li key={rule} className="flex gap-2">
                  <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-highlight" />
                  {rule}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSend(note.trim())}>
            <Send aria-hidden="true" />
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The action for an event. What it offers depends on the kind of event, on
 * who is looking, and on where their booking stands.
 */
export function EventAction({ event, appPath }: { event: EventDetail; appPath: string }) {
  const { session, role } = useSession()
  const [asking, setAsking] = useState(false)
  const request = useRequestToJoin(event.slug)
  const cancel = useCancelBooking(event.slug)

  const booking = event.viewer.booking
  const status = booking?.status ?? null
  const [openedAt] = useState(() => Date.now())
  const finished = event.status === 'completed' || new Date(event.endsAt).getTime() < openedAt
  const hasPlace = status === 'approved' || status === 'confirmed' || status === 'paid'

  const send = (note: string) => {
    setAsking(false)
    request.mutate(
      { eventId: event.id, note: note || undefined },
      { onError: (error) => toast.error('Your request didn’t send', { description: error.message }) },
    )
  }

  const withdraw = () => {
    if (!booking) return
    cancel.mutate(booking.id, {
      onError: (error) => toast.error('That didn’t go through', { description: error.message }),
    })
  }

  const share = async () => {
    const outcome = await shareOrCopy({
      title: event.title,
      text: `${hasPlace ? 'I’m going to' : 'Have a look at'} “${event.title}” on ${formatDay(event.startsAt)}, ${formatTimeRange(event.startsAt, event.endsAt)}, in ${event.area}.`,
      url: `${window.location.origin}/events/${event.slug}`,
    })
    if (outcome === 'copied') toast.success('Copied', { description: 'Paste it into a message to someone you trust.' })
    if (outcome === 'unavailable') toast.error('Sharing isn’t available in this browser')
  }

  let action: ReactNode

  if (event.status === 'cancelled') {
    action = <Note>This event was cancelled.</Note>
  } else if (event.status === 'pending_review') {
    action = <StatusPill tone="warning" icon={<Hourglass className="size-4.5" aria-hidden="true" />}>Waiting for approval</StatusPill>
  } else if (finished) {
    action = <Note>This event has finished.</Note>
  } else if (event.viewer.isHost) {
    action = (
      <>
        <StatusPill tone="neutral" icon={<UsersRound className="size-4.5" aria-hidden="true" />}>You’re hosting this</StatusPill>
        <Button asChild variant="outline" className="w-full">
          <AppLink to="/app/host">Open the host dashboard</AppLink>
        </Button>
      </>
    )
  } else if (role === 'visitor') {
    action = (
      <>
        <Button asChild size="lg" className="w-full">
          <AppLink to="/sign-in" state={{ from: appPath }}>
            {event.type === 'partner' ? 'Join Kollide to go with a squad' : event.type === 'kollide' ? 'Join Kollide to book' : 'Join Kollide to ask'}
            <ArrowRight aria-hidden="true" />
          </AppLink>
        </Button>
        <Note>It’s free to join, and it takes about five minutes.</Note>
      </>
    )
  } else if (status === 'requested') {
    action = (
      <>
        <m.p
          layoutId="event-cta"
          style={{ borderRadius: 999 }}
          transition={spring.soft}
          className="inline-flex h-11 w-fit items-center gap-2 bg-success-soft px-5 font-semibold text-success-strong"
        >
          <m.span layout="position" className="inline-flex items-center gap-2">
            <Check className="size-4.5" strokeWidth={2.5} aria-hidden="true" />
            Request sent
          </m.span>
        </m.p>
        <Note>{event.host?.firstName ?? 'The host'} usually replies within a day. We’ll let you know.</Note>
        <Button variant="ghost" size="sm" className="-ml-3 w-fit" onClick={withdraw} disabled={cancel.isPending || booking?.id === 'pending'}>
          Withdraw my request
        </Button>
      </>
    )
  } else if (status === 'waitlisted') {
    action = (
      <>
        <StatusPill tone="warning" icon={<Clock className="size-4.5" aria-hidden="true" />}>
          On the waitlist{booking?.waitlistPosition ? ` · number ${booking.waitlistPosition}` : ''}
        </StatusPill>
        <Note>If someone drops out, the next person on the list gets the place. We’ll tell you straight away.</Note>
        <Button variant="ghost" size="sm" className="-ml-3 w-fit" onClick={withdraw} disabled={cancel.isPending}>
          Leave the waitlist
        </Button>
      </>
    )
  } else if (status === 'approved' || status === 'confirmed') {
    action = (
      <>
        <StatusPill tone="success" icon={<Check className="size-4.5" strokeWidth={2.5} aria-hidden="true" />}>You’re in</StatusPill>
        <Note>The address and directions are on this page now.</Note>
      </>
    )
  } else if (status === 'paid') {
    action = (
      <>
        <StatusPill tone="success" icon={<Check className="size-4.5" strokeWidth={2.5} aria-hidden="true" />}>You’re booked</StatusPill>
        <Note>The address and directions are on this page now.</Note>
      </>
    )
  } else if (status === 'declined') {
    action = (
      <>
        <StatusPill tone="neutral" icon={<UsersRound className="size-4.5" aria-hidden="true" />}>This one’s full</StatusPill>
        <Note>The host couldn’t fit everyone in this time. There are similar events below.</Note>
      </>
    )
  } else if (event.type === 'partner') {
    action = (
      <>
        <Button asChild size="lg" className="w-full">
          <a href={event.partner?.ticketUrl} target="_blank" rel="noreferrer noopener">
            <Ticket aria-hidden="true" />
            Get tickets
            <ArrowUpRight aria-hidden="true" />
            <span className="sr-only">(opens {event.partner?.name}’s site in a new tab)</span>
          </a>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <a href="#squads">
            <UsersRound aria-hidden="true" />
            Join a squad
          </a>
        </Button>
        <Note>Tickets are sold by {event.partner?.name}. Join a squad here so you have people to go with.</Note>
      </>
    )
  } else if (event.womenOnly && session?.profile?.gender !== 'woman') {
    action = <Note>This event is for women only.</Note>
  } else if (session?.user.status === 'on_hold') {
    action = <Note>Your account is on hold while we look into a report, so you can’t send new requests for now.</Note>
  } else if (event.type === 'kollide') {
    action =
      event.spotsLeft > 0 || status === 'pending_payment' ? (
        <>
          <Button asChild size="lg" className="w-full">
            <AppLink to={`${appPath}/book`}>
              {status === 'pending_payment' ? 'Finish booking' : 'Book'}
              <ArrowRight aria-hidden="true" />
            </AppLink>
          </Button>
          <Note>Full refund up to 72 hours before. After that, you get Kollide credit.</Note>
        </>
      ) : (
        <>
          <StatusPill tone="neutral" icon={<UsersRound className="size-4.5" aria-hidden="true" />}>This one’s full</StatusPill>
          <Note>Every place is taken. There are similar events below.</Note>
        </>
      )
  } else {
    action = (
      <>
        <m.button
          type="button"
          layoutId="event-cta"
          style={{ borderRadius: 16 }}
          transition={spring.soft}
          whileTap={{ scale: 0.98 }}
          onClick={() => setAsking(true)}
          className="inline-flex h-13 w-full items-center justify-center bg-primary px-7 font-medium text-primary-foreground shadow-card outline-none transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <m.span layout="position" className="inline-flex items-center gap-2.5">
            Request to join
            <ArrowRight className="size-[1.125em]" aria-hidden="true" />
          </m.span>
        </m.button>
        <Note>
          {event.spotsLeft > 0
            ? 'The host approves each guest. You’ll see the address once you’re in.'
            : 'Every place is taken right now. The host can add you to the waitlist.'}
        </Note>
      </>
    )
  }

  return (
    <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-lift sm:p-7">
      <p className="font-display text-h2">{priceLabel(event.pricing)}</p>
      {event.pricing.note ? <p className="mt-1 text-sm text-muted-foreground">{event.pricing.note}</p> : null}

      <dl className="mt-5 grid gap-2.5 border-y border-border py-5">
        <div className="flex items-center gap-3">
          <dt>
            <CalendarDays className="size-5 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Date</span>
          </dt>
          <dd className="font-medium">{formatDay(event.startsAt)}</dd>
        </div>
        <div className="flex items-center gap-3">
          <dt>
            <Clock className="size-5 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Time</span>
          </dt>
          <dd className="font-medium">{formatTimeRange(event.startsAt, event.endsAt)}</dd>
        </div>
        {event.type === 'partner' ? null : (
          <div className="flex items-center gap-3">
            <dt>
              <UsersRound className="size-5 text-muted-foreground" aria-hidden="true" />
              <span className="sr-only">Places</span>
            </dt>
            <dd className="font-medium">
              {/* After a gentle decline, the count of open places would only sting. */}
              {status === 'declined' ? `${event.capacity} places` : `${event.capacity} places · ${spotsLabel(event.spotsLeft).toLowerCase()}`}
            </dd>
          </div>
        )}
      </dl>

      <LayoutGroup id={`cta-${event.id}`}>
        <div className="mt-5 grid gap-3" aria-live="polite">
          {action}
        </div>
      </LayoutGroup>

      {role !== 'visitor' && !finished && event.status === 'published' ? (
        <Button variant="ghost" className="mt-3 w-full" onClick={() => void share()}>
          <Send aria-hidden="true" />
          {hasPlace ? 'Share my plan' : 'Share this event'}
        </Button>
      ) : null}

      <RequestDialog event={event} open={asking} onOpenChange={setAsking} onSend={send} />
    </div>
  )
}

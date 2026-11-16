import { ArrowLeft, ArrowRight, Check, Clock, Quote, X } from 'lucide-react'
import { AnimatePresence, type Variants } from 'motion/react'
import * as m from 'motion/react-m'
import { useRef, useState, type KeyboardEvent } from 'react'
import { toast } from 'sonner'

import { PersonAvatar } from '@/components/people/person-avatar'
import { ReliabilityChip } from '@/components/people/reliability-chip'
import { Button } from '@/components/ui/button'
import { useDecideRequest } from '@/features/bookings/queries'
import { ProfileCard } from '@/features/profile/components/profile-card'
import { formatAgo } from '@/lib/format'
import { spring } from '@/lib/motion'
import { useMediaQuery, useMotionAllowed } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import type { HostCapacity, JoinRequest, RequestDecision } from '@/services'

/** Why the current card is leaving, so it can leave in a direction that matches. */
type Exit = 'next' | 'previous' | RequestDecision

const cardVariants: Variants = {
  enter: (exit: Exit) => ({ opacity: 0, scale: 0.97, x: exit === 'previous' ? -40 : 40 }),
  shown: { opacity: 1, scale: 1, x: 0, y: 0, transition: spring.gentle },
  leave: (exit: Exit) => {
    const fast = { duration: 0.18, ease: 'easeIn' } as const
    if (exit === 'approve') return { opacity: 0, x: 90, scale: 0.96, transition: fast }
    if (exit === 'decline') return { opacity: 0, x: -90, scale: 0.96, transition: fast }
    if (exit === 'waitlist') return { opacity: 0, y: 40, scale: 0.96, transition: fast }
    return { opacity: 0, x: exit === 'previous' ? 40 : -40, transition: fast }
  },
}

const fadeVariants: Variants = {
  enter: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.15 } },
  leave: { opacity: 0, transition: { duration: 0.1 } },
}

interface RequestDeckProps {
  eventId: string
  requests: JoinRequest[]
  capacity: HostCapacity | undefined
  /** The waitlist has no "Waitlist" button, and shows each person's place in line. */
  mode: 'requests' | 'waitlist'
}

/**
 * The host's request inbox: one profile card at a time, with accept, waitlist
 * and decline. On a phone the host swipes between people. Swiping only moves
 * through the list: a decision always takes a button press, so nobody is
 * declined by a slip of the thumb.
 */
export function RequestDeck({ eventId, requests, capacity, mode }: RequestDeckProps) {
  const wide = useMediaQuery('(min-width: 1024px)')
  const xl = useMediaQuery('(min-width: 1280px)')
  const motionAllowed = useMotionAllowed()
  const decide = useDecideRequest(eventId)
  const deckRef = useRef<HTMLDivElement>(null)

  const [selectedId, setSelectedId] = useState<string | null>(requests[0]?.booking.id ?? null)
  const [lastIndex, setLastIndex] = useState(0)
  const [exit, setExit] = useState<Exit>('next')

  // When the selected card leaves the list, the one that took its place is shown.
  let index = requests.findIndex((request) => request.booking.id === selectedId)
  if (index === -1 && requests.length > 0) {
    index = Math.min(lastIndex, requests.length - 1)
    setSelectedId(requests[index].booking.id)
  } else if (index !== -1 && index !== lastIndex) {
    setLastIndex(index)
  }
  const current = index === -1 ? null : requests[index]

  const bringIntoView = () => {
    const top = deckRef.current?.getBoundingClientRect().top ?? 0
    if (top < 72) window.scrollTo({ top: window.scrollY + top - 96, behavior: motionAllowed ? 'smooth' : 'auto' })
  }

  const go = (step: 1 | -1) => {
    const next = requests[index + step]
    if (!next) return
    setExit(step === 1 ? 'next' : 'previous')
    setSelectedId(next.booking.id)
    bringIntoView()
  }

  const atLimit = capacity ? capacity.approved >= capacity.approvalLimit : false

  const onDecide = (decision: RequestDecision) => {
    if (!current) return
    const name = current.requester.firstName
    setExit(decision)
    decide.mutate(
      { bookingId: current.booking.id, decision },
      {
        onSuccess: () => {
          if (decision === 'approve') toast.success(`${name} is in`, { description: 'They can see the address now.' })
          if (decision === 'waitlist') toast(`${name} is on the waitlist`, { description: 'If a place opens, they get it automatically.' })
          if (decision === 'decline')
            toast(`You let ${name} know`, { description: 'They’ll hear that this one is full, with a few similar events.' })
        },
        onError: (error) => toast.error('That didn’t go through', { description: error.message }),
      },
    )
    bringIntoView()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.target instanceof HTMLElement && event.target.closest('input, textarea, [role="tab"]')) return
    if (event.key === 'ArrowRight') go(1)
    if (event.key === 'ArrowLeft') go(-1)
  }

  if (!current) return null
  const { booking, requester } = current

  const note = (
    <p className="text-sm text-muted-foreground">
      {atLimit
        ? `You’ve accepted ${capacity?.approvalLimit}, the most this event allows. Waitlist the rest, and they’ll move up if someone cancels.`
        : `Accepting shares the address with ${requester.firstName}. Declining is worded kindly, with similar events.`}
    </p>
  )
  const accept = (
    <Button
      key="approve"
      onClick={() => onDecide('approve')}
      disabled={decide.isPending || atLimit}
      size={xl ? 'lg' : 'default'}
      className="col-span-2"
    >
      <Check aria-hidden="true" />
      Accept {requester.firstName}
    </Button>
  )
  const waitlist =
    mode === 'requests' ? (
      <Button key="waitlist" variant="outline" onClick={() => onDecide('waitlist')} disabled={decide.isPending}>
        <Clock aria-hidden="true" />
        Waitlist
      </Button>
    ) : null
  const decline = (
    <Button
      key="decline"
      variant="ghost"
      onClick={() => onDecide('decline')}
      disabled={decide.isPending}
      className={mode === 'waitlist' ? 'col-span-2' : undefined}
    >
      <X aria-hidden="true" />
      Decline
    </Button>
  )
  // The main answer comes first and widest. The order on screen is the order for a keyboard too.
  const decision = (
    <>
      <div className="grid grid-cols-2 gap-2">
        {accept}
        {waitlist}
        {decline}
      </div>
      {/* On a phone the reminder is hidden to save room, but the reason Accept is off is always shown. */}
      <div className={xl ? undefined : cn('mt-3', !atLimit && 'hidden sm:block')}>{note}</div>
    </>
  )

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,18rem)_minmax(0,36rem)] lg:items-start xl:grid-cols-[17rem_minmax(0,34rem)_minmax(15rem,1fr)] xl:gap-10">
      {wide ? (
        <nav aria-label={mode === 'waitlist' ? 'Waitlist' : 'Requests'} className="sticky top-24">
          <ul className="grid gap-1.5">
            {requests.map((request, position) => {
              const active = request.booking.id === current.booking.id
              return (
                <li key={request.booking.id}>
                  <button
                    type="button"
                    aria-current={active ? 'true' : undefined}
                    onClick={() => {
                      setExit(position < index ? 'previous' : 'next')
                      setSelectedId(request.booking.id)
                    }}
                    className={cn(
                      'relative flex w-full items-center gap-3.5 rounded-2xl p-3 text-left transition-colors',
                      active ? 'text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    {active ? (
                      <m.span
                        layoutId={`deck-active-${mode}`}
                        transition={spring.soft}
                        className="absolute inset-0 rounded-2xl border border-border/70 bg-card shadow-card"
                        aria-hidden="true"
                      />
                    ) : null}
                    <span className="relative flex min-w-0 items-center gap-3.5">
                      {mode === 'waitlist' ? (
                        <span className="w-5 shrink-0 text-center font-display text-h4 text-muted-foreground" aria-hidden="true">
                          {request.booking.waitlistPosition ?? position + 1}
                        </span>
                      ) : null}
                      <PersonAvatar person={{ firstName: request.requester.firstName, photoUrl: request.requester.photos[0]?.url ?? null }} className="size-12" />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-foreground">
                          {request.requester.firstName}, {request.requester.age}
                        </span>
                        <span className="block truncate text-sm">
                          {request.requester.area} · {formatAgo(request.booking.createdAt)}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
      ) : null}

      <div ref={deckRef} onKeyDown={onKeyDown} className="min-w-0">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            <span className="font-semibold text-foreground">{index + 1}</span> of {requests.length}
            {mode === 'waitlist' ? ' on the waitlist' : ' waiting'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous person">
              <ArrowLeft aria-hidden="true" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => go(1)} disabled={index === requests.length - 1} aria-label="Next person">
              <ArrowRight aria-hidden="true" />
            </Button>
          </div>
        </div>

        <AnimatePresence mode="wait" custom={exit} initial={false}>
          <m.div
            key={booking.id}
            custom={exit}
            variants={motionAllowed ? cardVariants : fadeVariants}
            initial="enter"
            animate="shown"
            exit="leave"
            drag={wide ? false : 'x'}
            dragSnapToOrigin
            dragElastic={0.45}
            dragDirectionLock
            onDragEnd={(_event, info) => {
              if (info.offset.x < -70 || info.velocity.x < -500) go(1)
              else if (info.offset.x > 70 || info.velocity.x > 500) go(-1)
            }}
            style={{ touchAction: 'pan-y' }}
            className="grid gap-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              {mode === 'waitlist' && booking.waitlistPosition ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-3 py-1 text-sm font-semibold text-warning-strong">
                  <Clock className="size-4" aria-hidden="true" />
                  Number {booking.waitlistPosition} on the waitlist
                </span>
              ) : null}
              <ReliabilityChip reputation={requester.reputation} size="sm" />
              <span className="text-sm text-muted-foreground">Asked {formatAgo(booking.createdAt)}</span>
            </div>

            {booking.note ? (
              <figure className="relative rounded-3xl bg-primary-soft px-6 pt-5 pb-6 text-primary-soft-foreground">
                <Quote className="absolute top-4 right-5 size-7 opacity-25" aria-hidden="true" />
                <figcaption className="text-sm font-semibold">{requester.firstName}’s note</figcaption>
                <blockquote className="mt-1.5 font-display text-h4 text-balance">{booking.note}</blockquote>
              </figure>
            ) : null}

            <ProfileCard card={requester} />
          </m.div>
        </AnimatePresence>

        {xl ? null : (
          /* The tab bar sits below this on a phone, so the bar is lifted clear of it. */
          <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 -mx-5 mt-6 border-t border-border bg-background/92 px-5 pt-4 pb-4 backdrop-blur-xl sm:mx-0 sm:rounded-3xl sm:border sm:border-border/70 sm:bg-card/95 sm:px-5 sm:shadow-lift md:bottom-6">
            {decision}
          </div>
        )}
      </div>

      {xl ? (
        <aside aria-label="Your answer" className="sticky top-24 grid gap-5 rounded-3xl border border-border/70 bg-card p-6 shadow-card">
          <div>
            <p className="eyebrow text-muted-foreground">Your answer</p>
            <p className="mt-2 font-display text-h3">{requester.firstName}</p>
            <p className="text-sm text-muted-foreground">
              {requester.reputation.eventsAttended} {requester.reputation.eventsAttended === 1 ? 'event' : 'events'} attended
              {requester.reputation.reliability
                ? ` · shows up ${requester.reputation.reliability.showedUp} of ${requester.reputation.reliability.outOf}`
                : ''}
            </p>
          </div>
          {decision}
        </aside>
      ) : null}
    </div>
  )
}

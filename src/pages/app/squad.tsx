import { ArrowLeft, Check, Clock, MapPin, Plus, Send, ShieldCheck, UsersRound, X } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { useSession } from '@/app/providers/session-context'
import { PersonAvatar } from '@/components/people/person-avatar'
import { SquadRing } from '@/components/people/squad-ring'
import { VerifiedBadge } from '@/components/people/verified-badge'
import { AppLink } from '@/components/shared/app-link'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ProfileDialog } from '@/features/profile/components/profile-dialog'
import { useDecideSquadRequest, useLeaveSquad, useRequestSquad, useSquad } from '@/features/squads/queries'
import { meetingTime } from '@/features/squads/schemas'
import { formatDay, formatEventDate, formatTime } from '@/lib/format'
import { shareOrCopy } from '@/lib/share'
import { useMediaQuery } from '@/lib/use-media-query'
import { isServiceError, type PersonPreview, type SquadWithMembers } from '@/services'

const step = (index: number) => ({ '--i': index }) as CSSProperties

function Panel({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 rounded-3xl border border-border/70 bg-card p-6 shadow-card">{children}</div>
}

function Pill({ tone, icon, children }: { tone: 'success' | 'soft' | 'neutral'; icon: ReactNode; children: ReactNode }) {
  const tones = {
    success: 'bg-success-soft text-success-strong',
    soft: 'bg-primary-soft text-primary-soft-foreground',
    neutral: 'bg-secondary text-secondary-foreground',
  }
  return <p className={`inline-flex h-11 w-fit items-center gap-2 rounded-full px-5 font-semibold ${tones[tone]}`}>{icon}{children}</p>
}

/** What the viewer can do here, which depends on where they stand with this squad. */
function SquadAction({ squad, onLeave }: { squad: SquadWithMembers; onLeave: () => void }) {
  const { session } = useSession()
  const ask = useRequestSquad()
  const [openedAt] = useState(() => Date.now())
  const creator = squad.members[0]?.firstName ?? 'The creator'
  const passed = new Date(squad.event.startsAt).getTime() <= openedAt
  const isWoman = session?.profile?.gender === 'woman'

  const send = () =>
    ask.mutate(squad.id, {
      onSuccess: () => toast.success('Request sent', { description: `${creator} sees your profile card, then answers.` }),
      onError: (error) => toast.error('Your request didn’t send', { description: error.message }),
    })

  const note = (text: string) => <p className="text-sm text-muted-foreground">{text}</p>

  if (passed) return <Panel>{note('This squad’s event has passed.')}</Panel>

  if (squad.viewerIsCreator) {
    return (
      <Panel>
        <Pill tone="success" icon={<Check className="size-4.5" aria-hidden="true" />}>You started this squad</Pill>
        {note(
          squad.pendingRequests.length > 0
            ? `${squad.pendingRequests.length} ${squad.pendingRequests.length === 1 ? 'person is' : 'people are'} waiting for your answer.`
            : 'When someone asks to join, they appear here for you to approve.',
        )}
        <Button variant="ghost" className="w-fit px-0 text-muted-foreground hover:bg-transparent hover:text-foreground" onClick={onLeave}>
          Leave the squad
        </Button>
      </Panel>
    )
  }

  if (squad.viewerStatus === 'approved') {
    return (
      <Panel>
        <Pill tone="success" icon={<Check className="size-4.5" aria-hidden="true" />}>You’re in</Pill>
        {note(`Meet the others at ${squad.meetingPoint.place}, ${squad.meetingPoint.minutesBefore} minutes before it starts.`)}
        <Button variant="ghost" className="w-fit px-0 text-muted-foreground hover:bg-transparent hover:text-foreground" onClick={onLeave}>
          Leave the squad
        </Button>
      </Panel>
    )
  }

  if (squad.viewerStatus === 'requested') {
    return (
      <Panel>
        <Pill tone="soft" icon={<Clock className="size-4.5" aria-hidden="true" />}>Request sent</Pill>
        {note(`${creator} will answer soon. You can see where it stands here.`)}
        <Button variant="ghost" className="w-fit px-0 text-muted-foreground hover:bg-transparent hover:text-foreground" onClick={onLeave}>
          Withdraw my request
        </Button>
      </Panel>
    )
  }

  if (squad.womenOnly && !isWoman) return <Panel>{note('This squad is for women only.')}</Panel>
  if (squad.spotsLeft === 0) {
    return (
      <Panel>
        {note('This squad is full. Other squads for the same event may still have room.')}
        <Button asChild variant="outline" className="w-fit">
          <AppLink to={`/app/events/${squad.event.slug}#squads`}>See other squads</AppLink>
        </Button>
      </Panel>
    )
  }

  return (
    <Panel>
      {squad.viewerStatus === 'declined'
        ? note(`${creator} isn’t adding anyone just now. You’re welcome to ask again later, or start your own squad for this event.`)
        : note(`${creator} sees your profile card and how often you turn up, then approves each person.`)}
      <Button size="lg" onClick={send} disabled={ask.isPending}>
        <Plus aria-hidden="true" />
        {squad.viewerStatus === 'declined' ? 'Ask again' : 'Ask to join'}
      </Button>
    </Panel>
  )
}

/** People waiting for the creator's answer. Each opens as a profile card. */
function Requests({ squad }: { squad: SquadWithMembers }) {
  const [viewing, setViewing] = useState<PersonPreview | null>(null)
  const decide = useDecideSquadRequest(squad.id)
  const full = squad.spotsLeft === 0

  const answer = (person: PersonPreview, decision: 'approve' | 'decline') =>
    decide.mutate(
      { userId: person.userId, decision },
      {
        onSuccess: () => {
          setViewing(null)
          if (decision === 'approve') toast.success(`${person.firstName} is in the squad`)
          else toast(`You let ${person.firstName} know`, { description: 'They can still go to the event, or join another squad.' })
        },
        onError: (error) => toast.error('That didn’t go through', { description: error.message }),
      },
    )

  return (
    <section aria-labelledby="requests-heading" className="border-t border-border pt-9">
      <h2 id="requests-heading" className="text-h3">
        Asking to join
      </h2>
      <p className="mt-2 text-muted-foreground">Open each person’s card before you answer.</p>
      <ul className="mt-5 grid gap-3">
        {squad.pendingRequests.map((person) => (
          <li key={person.userId}>
            <button
              type="button"
              onClick={() => setViewing(person)}
              className="flex w-full items-center gap-4 rounded-2xl border border-border/70 bg-card p-3.5 text-left shadow-card transition-[transform,box-shadow] duration-300 ease-out-soft hover:-translate-y-0.5 hover:shadow-lift"
            >
              <PersonAvatar person={person} className="size-12" />
              <span className="flex min-w-0 flex-1 items-center gap-1.5 font-semibold">
                <span className="truncate">{person.firstName}</span>
                {person.verified ? <VerifiedBadge /> : null}
              </span>
              <span className="text-sm font-semibold text-primary">See profile</span>
            </button>
          </li>
        ))}
      </ul>
      <ProfileDialog
        userId={viewing?.userId ?? null}
        firstName={viewing?.firstName ?? ''}
        onOpenChange={(open) => !open && setViewing(null)}
        actions={
          viewing ? (
            <>
              <Button variant="ghost" onClick={() => answer(viewing, 'decline')} disabled={decide.isPending}>
                <X aria-hidden="true" />
                Decline
              </Button>
              <Button className="flex-1" onClick={() => answer(viewing, 'approve')} disabled={decide.isPending || full}>
                <Check aria-hidden="true" />
                {full ? 'Your squad is full' : `Add ${viewing.firstName}`}
              </Button>
            </>
          ) : null
        }
      />
    </section>
  )
}

function Loading() {
  return (
    <div role="status" aria-label="Loading the squad" className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid gap-5">
        <Skeleton className="size-24 rounded-full" />
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-24 w-full rounded-3xl" />
      </div>
      <Skeleton className="h-48 rounded-3xl" />
    </div>
  )
}

/** One squad: who is in it, where they meet, and what the viewer can do. Nothing here is a conversation. */
export function Component() {
  const { squadId = '' } = useParams()
  const navigate = useNavigate()
  const { data: squad, isPending, isError, error, refetch } = useSquad(squadId)
  const leave = useLeaveSquad()
  const [leaving, setLeaving] = useState(false)
  // The action is rendered once: beside the content on wide screens, near the top on small ones.
  const wide = useMediaQuery('(min-width: 1024px)')

  const back = (
    <AppLink to="/app/squads" className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground">
      <ArrowLeft className="size-4" aria-hidden="true" />
      Squads
    </AppLink>
  )

  if (isPending) return <>{back}<Loading /></>
  if (isError) {
    return (
      <>
        {back}
        {isServiceError(error, 'not_found') ? (
          <EmptyState
            className="mt-8"
            icon={UsersRound}
            headingLevel="h1"
            title="This squad has closed"
            description="Everyone left, or the link is old. There are other squads forming."
          />
        ) : (
          <ErrorState className="mt-8" headingLevel="h1" onRetry={() => void refetch()} />
        )}
      </>
    )
  }

  const meetAt = meetingTime(squad.event.startsAt, squad.meetingPoint.minutesBefore)
  const openPlaces = Math.max(0, squad.size - squad.members.length)
  const inSquad = squad.viewerStatus === 'approved'
  const heir = squad.viewerIsCreator ? squad.members[1] : undefined

  const sharePlan = async () => {
    const outcome = await shareOrCopy({
      title: squad.event.title,
      text: `My plan: ${squad.event.title}, ${formatEventDate(squad.event.startsAt)}. I’m meeting my Kollide squad at ${squad.meetingPoint.place} at ${formatTime(meetAt.toISOString())}.`,
      url: `${window.location.origin}/events/${squad.event.slug}`,
    })
    if (outcome === 'copied') toast.success('Copied', { description: 'Paste it into a message to someone you trust.' })
    if (outcome === 'unavailable') toast.error('Sharing isn’t available in this browser')
  }

  const confirmLeave = () =>
    leave.mutate(squad.id, {
      onSuccess: () => {
        setLeaving(false)
        toast(squad.viewerStatus === 'requested' ? 'Request withdrawn' : `You left ${squad.name}`)
        void navigate('/app/squads', { viewTransition: true })
      },
      onError: (leaveError) => toast.error('That didn’t go through', { description: leaveError.message }),
    })

  return (
    <article>
      <title>{`${squad.name} · Kollide`}</title>
      {back}

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-10">
          <header className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <SquadRing filled={squad.members.length} size={squad.size} pulse={openPlaces > 0} className="rise-in size-24 [&>span:last-child]:text-sm" />
            <div className="min-w-0">
              <p className="eyebrow rise-in text-primary" style={step(1)}>
                Squad · {formatDay(squad.event.startsAt)}
              </p>
              <h1 className="rise-in mt-2 text-h1" style={step(2)}>
                {squad.name}
              </h1>
              {squad.womenOnly ? (
                <Badge variant="outline" className="rise-in mt-3" style={step(3)}>
                  Women only
                </Badge>
              ) : null}
            </div>
          </header>

          <AppLink
            to={`/app/events/${squad.event.slug}`}
            className="rise-in group flex items-center gap-4 rounded-3xl border border-border/70 bg-card p-3 shadow-card transition-[transform,box-shadow] duration-300 ease-out-soft hover:-translate-y-0.5 hover:shadow-lift"
            style={step(3)}
          >
            <img src={squad.event.coverUrl} alt="" className="size-20 shrink-0 rounded-2xl object-cover" />
            <span className="min-w-0">
              <span className="block text-sm text-muted-foreground">Going to</span>
              <span className="block truncate font-display text-h4">{squad.event.title}</span>
              <span className="block text-sm text-muted-foreground">
                {formatEventDate(squad.event.startsAt)} · {squad.event.area}
              </span>
            </span>
          </AppLink>

          {wide ? null : <SquadAction squad={squad} onLeave={() => setLeaving(true)} />}

          <section aria-labelledby="meet-heading" className="rise-in grid gap-4 rounded-3xl bg-highlight-soft p-6 text-highlight-soft-foreground sm:grid-cols-[auto_1fr] sm:items-center sm:gap-6" style={step(4)}>
            <span className="inline-flex size-14 items-center justify-center rounded-full bg-card text-primary shadow-card">
              <MapPin className="size-6" aria-hidden="true" />
            </span>
            <div>
              <h2 id="meet-heading" className="font-sans text-sm font-semibold">
                Where you meet
              </h2>
              <p className="mt-1 font-display text-h3">{squad.meetingPoint.place}</p>
              <p className="mt-1">
                {formatTime(meetAt.toISOString())}, {squad.meetingPoint.minutesBefore} minutes before the start. Then you walk in
                together.
              </p>
            </div>
          </section>

          <section aria-labelledby="members-heading" className="border-t border-border pt-9">
            <h2 id="members-heading" className="text-h3">
              Who’s in
            </h2>
            <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {squad.members.map((person, index) => (
                <li key={person.userId}>
                  <AppLink
                    to={`/app/people/${person.userId}`}
                    className="flex h-full flex-col items-center gap-3 rounded-2xl border border-border/70 bg-card p-5 text-center shadow-card transition-[transform,box-shadow] duration-300 ease-out-soft hover:-translate-y-0.5 hover:shadow-lift"
                  >
                    <PersonAvatar person={person} className="size-16" />
                    <span>
                      <span className="flex items-center justify-center gap-1.5 font-semibold">
                        {person.firstName}
                        {person.verified ? <VerifiedBadge /> : null}
                      </span>
                      {index === 0 ? <span className="text-sm text-muted-foreground">Started the squad</span> : null}
                    </span>
                  </AppLink>
                </li>
              ))}
              {Array.from({ length: openPlaces }, (_, index) => (
                <li
                  key={`open-${index}`}
                  className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-foreground/20 p-5 text-center text-muted-foreground"
                >
                  <span className="inline-flex size-16 items-center justify-center rounded-full border border-dashed border-foreground/25">
                    <Plus className="size-5" aria-hidden="true" />
                  </span>
                  <span className="text-sm">Open place</span>
                </li>
              ))}
            </ul>
          </section>

          {squad.viewerIsCreator && squad.pendingRequests.length > 0 ? <Requests squad={squad} /> : null}
        </div>

        <aside className="grid content-start gap-4 lg:sticky lg:top-24 lg:self-start">
          {wide ? <SquadAction squad={squad} onLeave={() => setLeaving(true)} /> : null}
          <div className="grid gap-3 rounded-3xl border border-border/70 p-6">
            <p className="flex items-start gap-3 text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              Meet only at the public place above. Before you head out, tell someone you trust where you’ll be.
            </p>
            {inSquad ? (
              <Button variant="outline" onClick={() => void sharePlan()}>
                <Send aria-hidden="true" />
                Share my plan
              </Button>
            ) : null}
          </div>
        </aside>
      </div>

      <Dialog open={leaving} onOpenChange={setLeaving}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{squad.viewerStatus === 'requested' ? 'Withdraw your request?' : `Leave ${squad.name}?`}</DialogTitle>
            <DialogDescription>
              {squad.viewerStatus === 'requested'
                ? 'You can ask again later if there’s still room.'
                : squad.viewerIsCreator
                  ? heir
                    ? `${heir.firstName} will look after the squad and answer new requests.`
                    : 'Nobody else has joined yet, so the squad closes.'
                  : 'Your place opens up for someone else. You keep your place at the event.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLeaving(false)}>
              Stay
            </Button>
            <Button variant="destructive" onClick={confirmLeave} disabled={leave.isPending}>
              {squad.viewerStatus === 'requested' ? 'Withdraw' : 'Leave'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  )
}

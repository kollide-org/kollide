import { BadgeCheck, Camera, Clock, EyeOff, Lightbulb, LogOut, PauseCircle } from 'lucide-react'
import { useRef, useState, type ChangeEvent, type ReactNode } from 'react'

import { useSession } from '@/app/providers/session-context'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useSubmitSelfie } from '@/features/onboarding/hooks'
import { ProfileCard } from '@/features/profile/components/profile-card'
import { AppealDialog } from '@/features/profile/components/appeal-dialog'
import { useMyAppeals, useMyTips, useProfileCard } from '@/features/profile/queries'
import type { ProfileCard as ProfileCardData } from '@/services'

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-6 shadow-card">
      <h2 className="text-h4">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Verification({ card }: { card: ProfileCardData }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const submit = useSubmitSelfie(card.userId)
  const status = submit.isPending ? 'pending' : card.verification.status

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const hasFile = Boolean(event.target.files?.[0])
    event.target.value = ''
    // The selfie itself is only for the check, so the mock service does not need the image.
    if (hasFile) submit.mutate()
  }

  if (status === 'verified') {
    return (
      <Panel title="Verification">
        <p className="inline-flex items-center gap-2 rounded-full bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground">
          <BadgeCheck className="size-4.5" aria-hidden="true" />
          Verified
        </p>
        <p className="mt-3 text-muted-foreground">Hosts see this badge on every request you send.</p>
      </Panel>
    )
  }

  if (status === 'pending') {
    return (
      <Panel title="Verification">
        <p className="inline-flex items-center gap-2 rounded-full bg-warning-soft px-3.5 py-1.5 text-sm font-semibold text-warning-strong">
          <Clock className="size-4" aria-hidden="true" />
          Pending review
        </p>
        <p className="mt-3 text-muted-foreground">
          Your selfie is with our team. The verified badge appears on your profile as soon as it’s checked.
        </p>
      </Panel>
    )
  }

  return (
    <Panel title="Get verified">
      <p className="text-muted-foreground">
        {status === 'rejected'
          ? 'We couldn’t match your last selfie to your photos. Try again in good light, facing the camera.'
          : 'Take a quick selfie and we’ll check it matches your photos. Verified members are approved more often.'}
      </p>
      <input ref={inputRef} type="file" accept="image/*" capture="user" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onFile} />
      <Button variant="soft" className="mt-5" onClick={() => inputRef.current?.click()}>
        <Camera aria-hidden="true" />
        Take a selfie
      </Button>
      {submit.isError ? (
        <p role="alert" className="mt-3 text-sm text-destructive-strong">
          That didn’t send. Please try again.
        </p>
      ) : null}
    </Panel>
  )
}

/** "Shows up: X of Y", explained. It is worked out from check-ins, never typed in. */
function Reliability({ card }: { card: ProfileCardData }) {
  const { reliability, eventsAttended } = card.reputation
  return (
    <Panel title="Showing up">
      {reliability ? (
        <p className="font-display text-h2">
          {reliability.showedUp} of {reliability.outOf}
        </p>
      ) : (
        <p className="font-display text-h3">New to Kollide</p>
      )}
      <p className="mt-2 text-muted-foreground">
        {reliability
          ? `You came to ${reliability.showedUp} of the ${reliability.outOf} events you had a place at. `
          : `Your score appears once you’ve been to a few events. You’ve been to ${eventsAttended} so far. `}
        Giving up a place in advance never counts against you.
      </p>
    </Panel>
  )
}

/** Gentle, anonymous tips. Only you see them, and you can ask us to look again. */
function Tips() {
  const tips = useMyTips()
  const [appealing, setAppealing] = useState<string | null>(null)
  if (!tips.data || tips.data.length === 0) return null
  return (
    <Panel title="Something to try">
      <ul className="grid gap-4">
        {tips.data.map((tip) => (
          <li key={tip.category} className="rounded-2xl bg-highlight-soft p-4 text-highlight-soft-foreground">
            <p className="flex items-start gap-2.5">
              <Lightbulb className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              {tip.message}
            </p>
            {tip.appeal?.status === 'under_review' ? (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-sm font-semibold text-foreground">
                <Clock className="size-4" aria-hidden="true" />
                Under review
              </p>
            ) : (
              <Button variant="link" className="mt-2 h-auto text-highlight-soft-foreground underline" onClick={() => setAppealing(tip.category)}>
                Doesn’t sound right? Ask us to look again
              </Button>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
        <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        Only you see this. It appears when several people said the same thing, at more than one event, and never says who.
      </p>
      {appealing ? <AppealDialog about="tip" reference={appealing} open onOpenChange={(open) => !open && setAppealing(null)} /> : null}
    </Panel>
  )
}

/** Shown while a safety report about you is being looked at. */
function OnHold() {
  const appeals = useMyAppeals()
  const [appealing, setAppealing] = useState(false)
  const pending = appeals.data?.find((appeal) => appeal.about === 'suspension' && appeal.status === 'under_review')
  return (
    <section className="rounded-2xl border border-warning/50 bg-warning-soft p-6 text-warning-strong">
      <h2 className="flex items-center gap-2 font-sans text-base font-semibold">
        <PauseCircle className="size-5" aria-hidden="true" />
        Your account is on hold
      </h2>
      <p className="mt-2">
        Our safety team is looking into a report. Until they finish, you can’t send new requests, but plans you already have stay
        as they are.
      </p>
      {pending ? (
        <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-sm font-semibold text-foreground">
          <Clock className="size-4" aria-hidden="true" />
          Your appeal is under review
        </p>
      ) : (
        <Button variant="outline" className="mt-4 border-warning-strong/40 text-warning-strong" onClick={() => setAppealing(true)}>
          Tell us your side
        </Button>
      )}
      {appealing ? <AppealDialog about="suspension" reference="on_hold" open onOpenChange={setAppealing} /> : null}
    </section>
  )
}

/** Your own profile: the card as others see it, and the details only you can see. */
export function Component() {
  const { session, signOut } = useSession()
  const userId = session!.user.id
  const { data: card, isPending, isError, refetch } = useProfileCard(userId)

  return (
    <>
      <title>Your profile · Kollide</title>
      <PageHeader eyebrow="Profile" title="How others see you" description="This is the card hosts and squads see when you ask to join." />

      <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-14">
        {isPending ? (
          <Skeleton className="aspect-[4/7] w-full rounded-3xl" />
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : (
          <ProfileCard card={card} own />
        )}

        <div className="grid gap-5 lg:sticky lg:top-28">
          {session?.user.status === 'on_hold' || card?.onHold ? <OnHold /> : null}
          {card ? <Reliability card={card} /> : <Skeleton className="h-36 rounded-2xl" />}
          <Tips />
          {card ? <Verification card={card} /> : <Skeleton className="h-44 rounded-2xl" />}

          <Panel title="Only you can see this">
            <dl className="grid gap-3">
              <div>
                <dt className="text-sm text-muted-foreground">Email</dt>
                <dd className="font-medium break-all">{session?.user.email}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Mobile number</dt>
                <dd className="font-medium">{session?.user.phone ?? 'Not added'}</dd>
              </div>
            </dl>
            <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
              <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Your last name, phone number, email and date of birth are never shown to other members.
            </p>
          </Panel>

          <Button variant="ghost" className="justify-self-start" onClick={() => void signOut()}>
            <LogOut aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </div>
    </>
  )
}

import { BadgeCheck, Camera, Clock, EyeOff, LogOut } from 'lucide-react'
import { useRef, type ChangeEvent, type ReactNode } from 'react'

import { useSession } from '@/app/providers/session-context'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useSubmitSelfie } from '@/features/onboarding/hooks'
import { ProfileCard } from '@/features/profile/components/profile-card'
import { useProfileCard } from '@/features/profile/queries'
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

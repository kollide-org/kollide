import { ArrowRight } from 'lucide-react'
import type { CSSProperties } from 'react'

import { useSession } from '@/app/providers/session-context'
import { AppLink } from '@/components/shared/app-link'
import { ErrorState } from '@/components/shared/error-state'
import { Wordmark } from '@/components/shared/wordmark'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ProfileCard } from '@/features/profile/components/profile-card'
import { useProfileCard } from '@/features/profile/queries'

const step = (index: number) => ({ '--i': index }) as CSSProperties

/** Shown once, straight after the profile is created. */
export function Welcome() {
  const { session } = useSession()
  const userId = session!.user.id
  const { data: card, isPending, isError, refetch } = useProfileCard(userId)
  const pendingVerification = session?.profile?.verification.status === 'pending'

  return (
    <div className="paper min-h-dvh">
      <title>Welcome · Kollide</title>
      <header className="container-page flex h-16 items-center md:h-20">
        <Wordmark to="/app" />
      </header>
      <main id="main" className="container-page grid items-start gap-12 pt-6 pb-24 lg:grid-cols-[1fr_24rem] lg:gap-20 lg:pt-14">
        <div className="lg:sticky lg:top-24">
          <p className="rise-in eyebrow text-primary" style={step(0)}>
            Your profile is live
          </p>
          <h1 className="rise-in mt-4 text-h1 md:text-display" style={step(1)}>
            You’re in, {session?.profile?.firstName}.
          </h1>
          <p className="rise-in mt-6 max-w-lg text-lead text-muted-foreground" style={step(3)}>
            This is how hosts and squads will see you. You’ll show as new to Kollide until you’ve been to a few events,
            so there’s no score to worry about yet.
          </p>
          {pendingVerification ? (
            <p className="rise-in mt-4 max-w-lg text-muted-foreground" style={step(4)}>
              Your selfie is with our team. The verified badge appears as soon as it’s checked.
            </p>
          ) : null}
          <div className="rise-in mt-9 flex flex-wrap items-center gap-x-6 gap-y-3" style={step(5)}>
            <Button asChild size="lg">
              <AppLink to="/app">
                Find something to do
                <ArrowRight aria-hidden="true" />
              </AppLink>
            </Button>
            <Button asChild variant="link">
              <AppLink to="/app/profile">View my profile</AppLink>
            </Button>
          </div>
        </div>

        <div className="rise-in mx-auto w-full max-w-sm" style={step(4)}>
          {isPending ? (
            <Skeleton className="aspect-[4/7] w-full rounded-3xl" />
          ) : isError ? (
            <ErrorState onRetry={() => void refetch()} />
          ) : (
            <ProfileCard card={card} own />
          )}
        </div>
      </main>
    </div>
  )
}

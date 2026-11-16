import { ArrowLeft, Flag, UserRound } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { useSession } from '@/app/providers/session-context'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ProfileCard } from '@/features/profile/components/profile-card'
import { useProfileCard } from '@/features/profile/queries'
import { isServiceError } from '@/services'

const ReportDialog = lazy(() =>
  import('@/features/safety/components/report-dialog').then((module) => ({ default: module.ReportDialog })),
)

/** Another member's profile card. */
export function Component() {
  const { userId = '' } = useParams()
  const navigate = useNavigate()
  const { data: card, isPending, isError, error, refetch } = useProfileCard(userId)
  const [reporting, setReporting] = useState(false)
  const { session } = useSession()

  return (
    <div className="mx-auto max-w-md">
      <title>{card ? `${card.firstName} · Kollide` : 'Profile · Kollide'}</title>
      <Button variant="ghost" className="-ml-3 mb-4" onClick={() => navigate(-1)}>
        <ArrowLeft aria-hidden="true" />
        Back
      </Button>
      {isPending ? (
        <Skeleton className="aspect-[4/7] w-full rounded-3xl" />
      ) : isError ? (
        isServiceError(error, 'not_found') ? (
          <EmptyState
            icon={UserRound}
            headingLevel="h1"
            title="This profile isn’t available"
            description="The member may have left Kollide, or the link may be old."
          />
        ) : (
          <ErrorState headingLevel="h1" onRetry={() => void refetch()} />
        )
      ) : (
        <>
          <h1 className="sr-only">{card.firstName}’s profile</h1>
          <ProfileCard card={card} />
          {card.userId !== session?.user.id ? (
            <Button variant="ghost" size="sm" className="mt-4 text-muted-foreground" onClick={() => setReporting(true)}>
              <Flag aria-hidden="true" />
              Report {card.firstName}
            </Button>
          ) : null}
          {reporting ? (
            <Suspense fallback={null}>
              <ReportDialog subject={{ type: 'user', id: card.userId, name: card.firstName }} open onOpenChange={setReporting} />
            </Suspense>
          ) : null}
        </>
      )}
    </div>
  )
}

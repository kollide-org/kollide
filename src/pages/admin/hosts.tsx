import { Check, Quote, UserCheck } from 'lucide-react'
import { toast } from 'sonner'

import { PersonAvatar } from '@/components/people/person-avatar'
import { ReliabilityChip } from '@/components/people/reliability-chip'
import { VerifiedBadge } from '@/components/people/verified-badge'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { QueueItem, QueueList, QueueSkeleton } from '@/features/admin/components/queue'
import { useDecideHost, useHostApplications } from '@/features/admin/queries'
import { formatAgo } from '@/lib/format'
import type { HostApplication } from '@/services'

function ApplicationCard({ item }: { item: HostApplication }) {
  const { host, applicant, reputation } = item
  const decide = useDecideHost()

  const act = (decision: 'approve' | 'decline') =>
    decide.mutate(
      { userId: host.userId, decision },
      {
        onSuccess: () =>
          decision === 'approve'
            ? toast.success(`${applicant.firstName} can now host`, { description: 'They’ve been told, and can create their first event.' })
            : toast.success('Application closed', { description: `${applicant.firstName} has been told they can apply again later.` }),
        onError: (error) => toast.error('That didn’t go through', { description: error.message }),
      },
    )

  return (
    <QueueItem className="p-6 sm:p-7">
      <div className="flex flex-wrap items-start gap-4">
        <PersonAvatar person={applicant} className="size-14" />
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-center gap-2 text-h3">
            {applicant.firstName}
            {applicant.verified ? <VerifiedBadge /> : <Badge variant="warning" size="sm">Not verified yet</Badge>}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Applied {formatAgo(host.appliedAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ReliabilityChip reputation={reputation} size="sm" />
          <Badge variant="secondary" size="sm">
            {reputation.eventsAttended} {reputation.eventsAttended === 1 ? 'event' : 'events'} attended
          </Badge>
        </div>
      </div>

      <figure className="mt-6 rounded-xl bg-background/70 p-5">
        <Quote className="size-5 text-primary/60" aria-hidden="true" />
        <blockquote className="mt-2 text-pretty">{host.about}</blockquote>
        <figcaption className="sr-only">Why {applicant.firstName} wants to host</figcaption>
      </figure>

      {reputation.topTags.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-sm text-muted-foreground">What guests say most</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {reputation.topTags.map((tag) => (
              <li key={tag.tag}>
                <Badge variant="soft">
                  {tag.tag} · {tag.count}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-5">
        <Button onClick={() => act('approve')} disabled={decide.isPending}>
          <Check aria-hidden="true" />
          Approve as a host
        </Button>
        <Button variant="outline" onClick={() => act('decline')} disabled={decide.isPending}>
          Not just yet
        </Button>
      </div>
    </QueueItem>
  )
}

/** Admin: members who have asked to host. Hosting is invite-only, so each one is read by a person. */
export function Component() {
  const { data: items, isPending, isError, refetch } = useHostApplications()

  return (
    <>
      <title>Host approvals · Kollide admin</title>
      <PageHeader
        eyebrow="Admin"
        title="Host approvals"
        description="Members who have asked to host. Look for people who show up, and who others enjoyed meeting."
      />

      <div className="mt-10">
        {isPending ? (
          <QueueSkeleton label="Loading applications" rows={2} className="h-72" />
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : items.length === 0 ? (
          <EmptyState icon={UserCheck} title="No one waiting" description="Every application has an answer. New ones appear here as members apply to host." />
        ) : (
          <QueueList>
            {items.map((item) => (
              <ApplicationCard key={item.host.userId} item={item} />
            ))}
          </QueueList>
        )}
      </div>
    </>
  )
}

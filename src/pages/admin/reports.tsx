import { ArrowUpRight, Flag, MessageSquareQuote, Network, PauseCircle, Scale, Search, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { AvatarStack } from '@/components/people/avatar-stack'
import { PersonAvatar } from '@/components/people/person-avatar'
import { AppLink } from '@/components/shared/app-link'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NoteDialog } from '@/features/admin/components/note-dialog'
import { QueueItem, QueueList, QueueSkeleton } from '@/features/admin/components/queue'
import { ViewTabs } from '@/features/admin/components/view-tabs'
import { useAppeals, useDecideAppeal, useReports, useReviewPatterns, useUpdateReport } from '@/features/admin/queries'
import { PRIVATE_FEEDBACK_LABELS, SAFETY_REPORT_LABELS } from '@/features/reviews/labels'
import { formatAgo } from '@/lib/format'
import type { AppealQueueItem, PrivateFeedbackCategory, ReportQueueItem, SafetyReportStatus } from '@/services'

const REPORT_STATUS: Record<SafetyReportStatus, { label: string; variant: 'destructive' | 'warning' | 'success' | 'secondary' }> = {
  open: { label: 'New', variant: 'destructive' },
  reviewing: { label: 'Being looked at', variant: 'warning' },
  resolved: { label: 'Resolved', variant: 'success' },
  dismissed: { label: 'Closed, no action', variant: 'secondary' },
}

const SUBJECT_STATUS = { on_hold: 'On hold while open', suspended: 'Account suspended', banned: 'Account banned' } as const

const isOpen = (status: SafetyReportStatus) => status === 'open' || status === 'reviewing'

function ReportCard({ item }: { item: ReportQueueItem }) {
  const { report, reporter, subjectPerson, subjectEventTitle, otherReportsAboutSubject } = item
  const update = useUpdateReport()
  const [closing, setClosing] = useState<'resolved' | 'dismissed' | null>(null)
  const status = REPORT_STATUS[report.status]
  const subjectName = subjectPerson?.firstName ?? subjectEventTitle ?? 'this event'

  const change = (next: SafetyReportStatus, resolution?: string) =>
    update.mutate(
      { reportId: report.id, status: next, resolution },
      {
        onSuccess: () => {
          setClosing(null)
          if (next === 'reviewing') toast.success('Marked as being looked at')
          else
            toast.success(next === 'resolved' ? 'Report resolved' : 'Report closed', {
              description: subjectPerson ? `If no other report is open, ${subjectPerson.firstName}’s hold has lifted.` : undefined,
            })
        },
        onError: (error) => toast.error('That didn’t save', { description: error.message }),
      },
    )

  return (
    <QueueItem className="p-6 sm:p-7">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={status.variant} size="sm">
          {status.label}
        </Badge>
        <Badge variant="outline" size="sm">
          {SAFETY_REPORT_LABELS[report.category]}
        </Badge>
        {item.subjectStatus && item.subjectStatus !== 'active' && isOpen(report.status) ? (
          <Badge variant="warning" size="sm">
            <PauseCircle aria-hidden="true" />
            {SUBJECT_STATUS[item.subjectStatus]}
          </Badge>
        ) : null}
        <span className="text-sm text-muted-foreground">{formatAgo(report.createdAt)}</span>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        {subjectPerson ? <PersonAvatar person={subjectPerson} className="size-12" /> : null}
        <div className="min-w-0 flex-1">
          <h2 className="text-h3">{subjectPerson ? `About ${subjectPerson.firstName}` : `About “${subjectEventTitle ?? 'an event'}”`}</h2>
          {subjectPerson && subjectEventTitle ? <p className="text-sm text-muted-foreground">At {subjectEventTitle}</p> : null}
        </div>
      </div>

      <figure className="mt-5 rounded-xl bg-background/70 p-5">
        <blockquote className="text-pretty">{report.details}</blockquote>
        <figcaption className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <PersonAvatar person={reporter} className="size-6" />
          Reported by {reporter.firstName}
        </figcaption>
      </figure>

      {otherReportsAboutSubject > 0 ? (
        <p className="mt-4 flex items-center gap-2 text-sm font-medium text-warning-strong">
          <Flag className="size-4" aria-hidden="true" />
          {otherReportsAboutSubject} other {otherReportsAboutSubject === 1 ? 'report names' : 'reports name'} {subjectName}
        </p>
      ) : null}

      {report.resolution ? (
        <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-semibold text-foreground">How it was handled: </span>
            {report.resolution}
          </span>
        </p>
      ) : null}

      {isOpen(report.status) ? (
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-5">
          {report.status === 'open' ? (
            <Button onClick={() => change('reviewing')} disabled={update.isPending}>
              <Search aria-hidden="true" />
              Start looking into it
            </Button>
          ) : (
            <Button onClick={() => setClosing('resolved')} disabled={update.isPending}>
              Resolve
            </Button>
          )}
          {report.status === 'open' ? (
            <Button variant="outline" onClick={() => setClosing('resolved')} disabled={update.isPending}>
              Resolve
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => setClosing('dismissed')} disabled={update.isPending}>
            Close with no action
          </Button>
          {subjectPerson ? (
            <AppLink
              to={`/admin/users?q=${encodeURIComponent(subjectPerson.firstName)}`}
              className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              {subjectPerson.firstName}’s account
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </AppLink>
          ) : null}
        </div>
      ) : null}

      <NoteDialog
        open={closing !== null}
        onOpenChange={(open) => !open && setClosing(null)}
        title={closing === 'resolved' ? 'Resolve this report' : 'Close with no action'}
        description={
          subjectPerson
            ? `When no other report about ${subjectPerson.firstName} is open, their hold lifts automatically.`
            : 'The report leaves the open queue.'
        }
        label="How it was handled"
        hint="For the team’s records. The member who reported it isn’t shown this note."
        confirmLabel={closing === 'resolved' ? 'Resolve' : 'Close report'}
        pending={update.isPending}
        onConfirm={(note) => closing && change(closing, note)}
      />
    </QueueItem>
  )
}

function ReportsQueue() {
  const { data: items, isPending, isError, refetch } = useReports()
  const [showClosed, setShowClosed] = useState(false)
  if (isPending) return <QueueSkeleton label="Loading reports" rows={2} className="h-72" />
  if (isError) return <ErrorState onRetry={() => void refetch()} />

  const open = items.filter((item) => isOpen(item.report.status))
  const closed = items.filter((item) => !isOpen(item.report.status))

  return (
    <div className="grid gap-10">
      {open.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Nothing open" description="Every report has been handled. New ones arrive here the moment a member sends one." />
      ) : (
        <QueueList>
          {open.map((item) => (
            <ReportCard key={item.report.id} item={item} />
          ))}
        </QueueList>
      )}

      {closed.length > 0 ? (
        <section aria-labelledby="closed-heading">
          <div className="flex items-center justify-between gap-4">
            <h2 id="closed-heading" className="font-sans text-base font-semibold">
              Handled ({closed.length})
            </h2>
            <Button variant="ghost" size="sm" aria-expanded={showClosed} aria-controls="closed-reports" onClick={() => setShowClosed((value) => !value)}>
              {showClosed ? 'Hide' : 'Show'}
            </Button>
          </div>
          {showClosed ? (
            <div id="closed-reports" className="mt-5">
              <QueueList>
                {closed.map((item) => (
                  <ReportCard key={item.report.id} item={item} />
                ))}
              </QueueList>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

const ACCOUNT_LABELS: Record<string, string> = { on_hold: 'An account hold', suspended: 'A suspension', banned: 'A closed account' }

function AppealCard({ item }: { item: AppealQueueItem }) {
  const { appeal, person } = item
  const decide = useDecideAppeal()
  const about =
    appeal.about === 'tip'
      ? `A tip: “${PRIVATE_FEEDBACK_LABELS[appeal.reference as PrivateFeedbackCategory] ?? appeal.reference}”`
      : (ACCOUNT_LABELS[appeal.reference] ?? 'An account decision')

  const act = (decision: 'upheld' | 'overturned') =>
    decide.mutate(
      { appealId: appeal.id, decision },
      {
        onSuccess: () =>
          toast.success(decision === 'overturned' ? 'Decision reversed' : 'Decision kept', {
            description: `${person.firstName} has been told.`,
          }),
        onError: (error) => toast.error('That didn’t go through', { description: error.message }),
      },
    )

  return (
    <QueueItem className="p-6 sm:p-7">
      <div className="flex flex-wrap items-center gap-4">
        <PersonAvatar person={person} className="size-12" />
        <div className="min-w-0 flex-1">
          <h2 className="text-h3">{person.firstName}</h2>
          <p className="text-sm text-muted-foreground">
            {about} · {formatAgo(appeal.createdAt)}
          </p>
        </div>
        {appeal.status === 'under_review' ? (
          <Badge variant="warning">Under review</Badge>
        ) : (
          <Badge variant={appeal.status === 'overturned' ? 'success' : 'secondary'}>
            {appeal.status === 'overturned' ? 'Reversed' : 'Decision kept'}
          </Badge>
        )}
      </div>
      <figure className="mt-5 rounded-xl bg-background/70 p-5">
        <MessageSquareQuote className="size-5 text-primary/60" aria-hidden="true" />
        <blockquote className="mt-2 text-pretty">{appeal.message}</blockquote>
        <figcaption className="sr-only">{person.firstName}’s side</figcaption>
      </figure>
      {appeal.status === 'under_review' ? (
        <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-5">
          <Button onClick={() => act('overturned')} disabled={decide.isPending}>
            Reverse the decision
          </Button>
          <Button variant="outline" onClick={() => act('upheld')} disabled={decide.isPending}>
            Keep the decision
          </Button>
        </div>
      ) : null}
    </QueueItem>
  )
}

function AppealsQueue() {
  const { data: items, isPending, isError, refetch } = useAppeals()
  if (isPending) return <QueueSkeleton label="Loading appeals" rows={2} className="h-56" />
  if (isError) return <ErrorState onRetry={() => void refetch()} />
  if (items.length === 0) {
    return <EmptyState icon={Scale} title="No appeals" description="When a member disputes a tip or a hold, their side of the story arrives here." />
  }
  return (
    <QueueList>
      {items.map((item) => (
        <AppealCard key={item.appeal.id} item={item} />
      ))}
    </QueueList>
  )
}

function Patterns() {
  const { data: flags, isPending, isError, refetch } = useReviewPatterns()
  if (isPending) return <QueueSkeleton label="Loading review patterns" rows={1} className="h-40" />
  if (isError) return <ErrorState onRetry={() => void refetch()} />
  return (
    <div className="grid gap-5">
      <p className="max-w-2xl text-muted-foreground">
        Small groups whose members only ever review each other. It can be a close group of friends, or people trading praise. Nothing
        happens automatically, and their reviews still count until someone on the team has looked.
      </p>
      {flags.length === 0 ? (
        <EmptyState icon={Network} title="No patterns found" description="Reviews are coming from a healthy mix of people." />
      ) : (
        <QueueList>
          {flags.map((flag) => (
            <QueueItem key={flag.people.map((person) => person.userId).join('-')} className="flex flex-wrap items-center gap-5 p-6">
              <AvatarStack people={flag.people} max={6} />
              <div className="min-w-0 flex-1">
                <h2 className="font-sans text-base font-semibold">{flag.people.map((person) => person.firstName).join(', ')}</h2>
                <p className="text-sm text-muted-foreground">
                  {flag.reviewsBetweenThem} reviews between them, across {flag.eventIds.length} {flag.eventIds.length === 1 ? 'event' : 'events'}
                </p>
              </div>
            </QueueItem>
          ))}
        </QueueList>
      )}
    </div>
  )
}

/** Admin: safety reports, appeals and review patterns. Everything that needs a person's judgement. */
export function Component() {
  const reports = useReports()
  const appeals = useAppeals()
  const openReports = reports.data?.filter((item) => isOpen(item.report.status)).length
  const openAppeals = appeals.data?.filter((item) => item.appeal.status === 'under_review').length

  return (
    <>
      <title>Reports · Kollide admin</title>
      <PageHeader
        eyebrow="Admin"
        title="Reports"
        description="Anyone named in an open report is on hold: they keep their plans but can’t send new requests."
      />
      <div className="mt-10">
        <ViewTabs
          label="Reports"
          tabs={[
            { value: 'reports', label: 'Safety reports', count: openReports },
            { value: 'appeals', label: 'Appeals', count: openAppeals },
            { value: 'patterns', label: 'Review patterns' },
          ]}
        >
          {(view) => (view === 'reports' ? <ReportsQueue /> : view === 'appeals' ? <AppealsQueue /> : <Patterns />)}
        </ViewTabs>
      </div>
    </>
  )
}

import { useQuery } from '@tanstack/react-query'

import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatWhen } from '@/lib/format'
import { services } from '@/services'

function every(minutes: number): string {
  if (minutes >= 1440) return 'every day'
  if (minutes >= 60) return `every ${minutes / 60} hour${minutes === 60 ? '' : 's'}`
  return minutes === 1 ? 'every minute' : `every ${minutes} minutes`
}

/** The last run of every scheduled job, so you can see when one has stopped, and today's emails against the daily cap. */
export function Component() {
  const jobs = useQuery({ queryKey: ['job-health'], queryFn: () => services.admin.jobHealth(), refetchInterval: 30_000 })
  const usage = useQuery({ queryKey: ['email-usage'], queryFn: () => services.admin.emailUsage(), refetchInterval: 30_000 })
  const near = usage.data ? usage.data.sentToday >= usage.data.warnAt : false

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Admin" title="Jobs" description="Each scheduled job should keep running. “Late” means it has not run for twice its interval." />

      {usage.data ? (
        <Card>
          <CardContent className="grid gap-1 pt-6" data-testid="email-usage">
            <h2 className="text-h3">Emails today</h2>
            <p className={near ? 'text-lg text-warning-strong' : 'text-lg'}>
              <strong>{usage.data.sentToday}</strong> of {usage.data.dailyCap} sent <span className="text-sm text-muted-foreground">(we stop at {usage.data.dailyCap}; Brevo allows 300 a day)</span>{near ? ' (nearly at the limit: the rest go out after midnight UTC)' : ''}
            </p>
            <p className="text-sm text-muted-foreground">{usage.data.queued} waiting · {usage.data.failed24h} failed in the last 24 hours. The cap resets at 00:00 UTC.</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {jobs.data?.map((job) => (
          <Card key={job.job}>
            <CardContent className="grid gap-2 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-h3">{job.job}</h2>
                <div className="flex items-center gap-2">
                  {job.late ? <Badge variant="destructive">Late</Badge> : null}
                  <Badge variant={job.lastStatus === 'error' ? 'destructive' : job.lastStatus === 'warning' ? 'warning' : 'soft'}>{job.lastStatus ?? 'never run'}</Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {job.lastFinishedAt ? `Last run ${formatWhen(job.lastFinishedAt)}` : 'Never run'} · should run {every(job.everyMinutes)} · {job.runCount} runs · {job.errorCount} errors
              </p>
              {job.lastError ? <p role="alert" className="text-sm text-destructive-strong">{job.lastError}</p> : null}
              {job.lastDetail ? <pre className="overflow-x-auto rounded-xl bg-secondary p-3 text-xs">{JSON.stringify(job.lastDetail, null, 2)}</pre> : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

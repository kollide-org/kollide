import { useQuery } from '@tanstack/react-query'

import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatWhen } from '@/lib/format'
import { services } from '@/services'

/** The last run of every scheduled job, so you can see when one has stopped. */
export function Component() {
  const runs = useQuery({ queryKey: ['job-runs'], queryFn: () => services.admin.jobRuns(), refetchInterval: 30_000 })
  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Admin" title="Jobs" description="Emails every minute, reconfirmations every 15 minutes, reminders every 30." />
      {runs.data?.length === 0 ? <p className="text-muted-foreground">No job has run yet.</p> : null}
      <div className="grid gap-3">
        {runs.data?.map((run) => (
          <Card key={run.job}>
            <CardContent className="grid gap-2 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-h3">{run.job}</h2>
                <Badge variant={run.lastStatus === 'error' ? 'default' : 'soft'}>{run.lastStatus ?? 'never run'}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {run.lastFinishedAt ? `Last run ${formatWhen(run.lastFinishedAt)}` : 'Never run'} · {run.runCount} runs · {run.errorCount} errors
              </p>
              {run.lastError ? <p role="alert" className="text-sm text-destructive-strong">{run.lastError}</p> : null}
              {run.lastDetail ? <pre className="overflow-x-auto rounded-xl bg-secondary p-3 text-xs">{JSON.stringify(run.lastDetail, null, 2)}</pre> : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

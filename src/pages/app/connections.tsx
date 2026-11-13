import { Handshake } from 'lucide-react'

import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { ReportDialog } from '@/components/shared/report-dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useConnections } from '@/hooks/use-after-event'
import { formatDate } from '@/lib/format'
import { mediaUrl } from '@/lib/media'

/** People you both said "meet again" to. Only a first name and a photo: nothing else is shared. */
export function Component() {
  const connections = useConnections()
  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow="Meet again"
        title="Connections"
        description="When you and someone you met both tap “Meet again”, they appear here. We only tell someone if the feeling is mutual."
      />
      {connections.isPending ? <Skeleton className="h-32 w-full" /> : null}
      {connections.data?.length === 0 ? (
        <EmptyState icon={Handshake} title="No connections yet" description="After your next event, tap “Meet again” on the people you would like to see again." />
      ) : null}
      <ul className="grid gap-4">
        {connections.data?.map((c) => (
          <li key={c.userId}>
            <Card className="ph-no-capture">
              <CardContent className="flex flex-wrap items-center gap-4 pt-6">
                <div className="size-16 shrink-0 overflow-hidden rounded-2xl bg-secondary">
                  {c.photoKey ? <img src={mediaUrl(c.photoKey)} alt="" className="size-full object-cover" /> : null}
                </div>
                <div className="grid flex-1 gap-0.5">
                  <p className="text-lg font-medium">{c.firstName ?? 'Member'}</p>
                  <p className="text-sm text-muted-foreground">You met at {c.eventTitle} · {formatDate(c.connectedAt)}</p>
                </div>
                <ReportDialog subject="user" subjectId={c.userId} />
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}

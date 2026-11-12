import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppConfig } from '@/hooks/use-app-config'

/** Read-only in v1. There is deliberately no switch here: payments are turned on by milestone P1, not from this page. */
export function Component() {
  const config = useAppConfig()
  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Admin" title="App settings" description="What the app is currently set to. Nothing on this page can be changed." />
      {config.isPending ? <Skeleton className="h-24 w-full" /> : null}
      {config.data ? (
        <Card>
          <CardContent className="grid gap-4 pt-6">
            <p data-testid="payments-status" className="text-lg">
              {config.data.paymentsEnabled ? 'Payments: on' : 'Payments: off — enabled in milestone P1'}
            </p>
            <p className="text-sm text-muted-foreground">Notice version: {config.data.noticeVersion}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

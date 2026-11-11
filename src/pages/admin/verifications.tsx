import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { errorMessage, services } from '@/services'

/** Minimal selfie review: look at the selfie, approve or reject. The selfie is deleted either way. */
export function Component() {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)
  const pending = useQuery({ queryKey: ['pending-verifications'], queryFn: () => services.admin.listPendingVerifications() })

  async function view(id: string) {
    try {
      const url = await services.admin.getSelfieUrl(id)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (caught) {
      toast.error(errorMessage(caught))
    }
  }

  async function review(id: string, approved: boolean) {
    setBusy(id)
    try {
      await services.admin.reviewVerification(id, approved)
      toast.success(approved ? 'Approved. The selfie was deleted.' : 'Rejected. The selfie was deleted.')
      await queryClient.invalidateQueries({ queryKey: ['pending-verifications'] })
    } catch (caught) {
      toast.error(errorMessage(caught))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="grid gap-8">
      <PageHeader eyebrow="Admin" title="Verifications" description="Selfies waiting for review. Links work for 5 minutes." />
      {pending.data?.length === 0 ? <p className="text-muted-foreground">Nothing is waiting for review.</p> : null}
      <div className="grid gap-4">
        {pending.data?.map((item) => (
          <Card key={item.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
              <div>
                <p className="font-medium">{item.firstName ?? 'New member'}</p>
                <p className="text-sm text-muted-foreground">Sent {new Date(item.createdAt).toLocaleString()}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void view(item.id)}>
                  View selfie
                </Button>
                <Button disabled={busy === item.id} onClick={() => void review(item.id, true)}>
                  Approve
                </Button>
                <Button variant="destructive" disabled={busy === item.id} onClick={() => void review(item.id, false)}>
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

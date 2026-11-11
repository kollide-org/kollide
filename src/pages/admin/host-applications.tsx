import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/format'
import { errorMessage, services } from '@/services'

export function Component() {
  const queryClient = useQueryClient()
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const list = useQuery({ queryKey: ['host-applications'], queryFn: () => services.admin.listHostApplications() })

  async function review(id: string, approved: boolean) {
    setBusy(id)
    try {
      await services.admin.reviewHostApplication(id, approved, notes[id])
      toast.success(approved ? 'Approved. They are now a host.' : 'Rejected.')
      await queryClient.invalidateQueries({ queryKey: ['host-applications'] })
    } catch (caught) {
      toast.error(errorMessage(caught))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="grid gap-8">
      <PageHeader eyebrow="Admin" title="Host approvals" description="People who asked to host events." />
      {list.data?.length === 0 ? <p className="text-muted-foreground">No applications are waiting.</p> : null}
      <div className="grid gap-4">
        {list.data?.map((item) => (
          <Card key={item.id}>
            <CardContent className="grid gap-3 pt-6">
              <div>
                <p className="font-medium">{item.firstName ?? 'Member'}</p>
                <p className="text-sm text-muted-foreground">Applied {formatDate(item.createdAt)}</p>
              </div>
              <p className="whitespace-pre-line">{item.message}</p>
              <Input aria-label={`Note for ${item.firstName ?? 'applicant'}`} placeholder="Note (optional)" value={notes[item.id] ?? ''} onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })} />
              <div className="flex gap-2">
                <Button disabled={busy === item.id} onClick={() => void review(item.id, true)}>Approve</Button>
                <Button variant="destructive" disabled={busy === item.id} onClick={() => void review(item.id, false)}>Reject</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

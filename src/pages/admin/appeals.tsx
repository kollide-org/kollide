import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import { AppLink } from '@/components/shared/app-link'
import { PageHeader } from '@/components/shared/page-header'
import { UserStatusBadge } from '@/components/shared/user-status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatWhen } from '@/lib/format'
import { errorMessage, services, type AppealRow } from '@/services'

/** Appeals from people on hold or with a note about them. The target is an answer within 48 hours. */
export function Component() {
  const [status, setStatus] = useState<'open' | 'upheld' | 'overturned'>('open')
  const appeals = useQuery({ queryKey: ['admin-appeals', status], queryFn: () => services.admin.listAppeals(status) })
  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Admin" title="Appeals" description="Accepting an appeal removes the note, or brings the account back to active and closes the reports that held it." />
      <div role="group" aria-label="Filter" className="flex gap-2">
        {(['open', 'upheld', 'overturned'] as const).map((s) => (
          <Button key={s} size="sm" variant={status === s ? 'default' : 'outline'} aria-pressed={status === s} onClick={() => setStatus(s)}>
            {s === 'open' ? 'Waiting' : s === 'upheld' ? 'Kept' : 'Accepted'}
          </Button>
        ))}
      </div>
      {appeals.data?.length === 0 ? <p className="text-muted-foreground">Nothing here.</p> : null}
      <div className="grid gap-3">{appeals.data?.map((a) => <AppealCard key={a.id} appeal={a} />)}</div>
    </div>
  )
}

function AppealCard({ appeal }: { appeal: AppealRow }) {
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function decide(decision: 'upheld' | 'overturned') {
    setBusy(true)
    try {
      await services.admin.resolveAppeal(appeal.id, decision, note.trim() || undefined)
      toast.success(decision === 'overturned' ? 'Appeal accepted.' : 'Decision kept.')
      await Promise.all(['admin-appeals', 'admin-users', 'admin-user', 'admin-reports'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })))
    } catch (caught) {
      toast.error(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card data-testid="appeal-card">
      <CardContent className="grid gap-3 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-h3">{appeal.firstName ?? 'Member'} <span className="text-sm font-normal text-muted-foreground">· {appeal.kind === 'tip' ? 'a community note' : 'account on hold'}</span></h2>
          <div className="flex items-center gap-2">
            <UserStatusBadge status={appeal.userStatus} />
            {appeal.status === 'open' ? <Badge variant={appeal.overdue ? 'destructive' : 'soft'}>{appeal.overdue ? 'Overdue' : 'Answer by'} {formatWhen(appeal.dueAt)}</Badge> : <Badge variant="soft">{appeal.status}</Badge>}
          </div>
        </div>
        {appeal.tipMessage ? <p className="rounded-xl bg-secondary p-3 text-sm">The note: {appeal.tipMessage}</p> : null}
        <p className="whitespace-pre-line">{appeal.message}</p>
        <AppLink to={`/admin/users?user=${appeal.userId}`} className="text-sm text-primary underline underline-offset-4">Open profile</AppLink>
        {appeal.status === 'open' ? (
          <div className="grid gap-2">
            <Label htmlFor={`appeal-note-${appeal.id}`}>Answer (shown to them, optional)</Label>
            <Textarea id={`appeal-note-${appeal.id}`} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className="min-h-16" />
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} onClick={() => void decide('overturned')}>Accept the appeal</Button>
              <Button variant="outline" disabled={busy} onClick={() => void decide('upheld')}>Keep the decision</Button>
            </div>
          </div>
        ) : appeal.adminNote ? <p className="text-sm">Our answer: {appeal.adminNote}</p> : null}
      </CardContent>
    </Card>
  )
}

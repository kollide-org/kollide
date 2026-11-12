import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import { AppLink } from '@/components/shared/app-link'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatWhen } from '@/lib/format'
import { errorMessage, services, type FlagRow } from '@/services'

const WHAT: Record<FlagRow['kind'], string> = {
  no_checkins: 'An event ended with seats but nobody was checked in. Nobody was marked a no-show.',
  collusion: 'Nearly all of this person’s tags come from the same few people.',
  retaliation: 'Private feedback about this person came from someone they reported.',
  low_host_score: 'This host’s average rating is below the bar.',
  repeat_event_group: 'Three or more people at one event all want to meet again. Consider a repeat event.',
}

/** Things the nightly checks noticed. Nothing here changes anyone's account by itself. */
export function Component() {
  const [status, setStatus] = useState<'open' | 'reviewed' | 'dismissed'>('open')
  const flags = useQuery({ queryKey: ['admin-flags', status], queryFn: () => services.admin.listFlags(status) })
  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Admin" title="Flags" description="For your judgement. Reviewing or dismissing a flag only records that you looked." />
      <div role="group" aria-label="Filter" className="flex gap-2">
        {(['open', 'reviewed', 'dismissed'] as const).map((s) => (
          <Button key={s} size="sm" variant={status === s ? 'default' : 'outline'} aria-pressed={status === s} onClick={() => setStatus(s)}>{s}</Button>
        ))}
      </div>
      {flags.data?.length === 0 ? <p className="text-muted-foreground">Nothing here.</p> : null}
      <div className="grid gap-3">{flags.data?.map((f) => <FlagCard key={f.id} flag={f} />)}</div>
    </div>
  )
}

function FlagCard({ flag }: { flag: FlagRow }) {
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function resolve(status: 'reviewed' | 'dismissed') {
    setBusy(true)
    try {
      await services.admin.resolveFlag(flag.id, status, note.trim() || undefined)
      toast.success('Recorded.')
      await queryClient.invalidateQueries({ queryKey: ['admin-flags'] })
    } catch (caught) {
      toast.error(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card data-testid="flag-card">
      <CardContent className="grid gap-3 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-h3">{flag.kind.replaceAll('_', ' ')}</h2>
          <Badge variant="soft">{flag.status}</Badge>
        </div>
        <p>{WHAT[flag.kind]}</p>
        <p className="text-sm text-muted-foreground">
          {flag.subjectFirstName ? `About ${flag.subjectFirstName} · ` : ''}{flag.eventTitle ? `${flag.eventTitle} · ` : ''}{formatWhen(flag.createdAt)}
        </p>
        {Object.keys(flag.details).length > 0 ? <pre className="overflow-x-auto rounded-xl bg-secondary p-3 text-xs">{JSON.stringify(flag.details, null, 2)}</pre> : null}
        <div className="flex flex-wrap gap-3 text-sm">
          {flag.subjectUserId ? <AppLink to={`/admin/users?user=${flag.subjectUserId}`} className="text-primary underline underline-offset-4">Open profile</AppLink> : null}
          {flag.kind === 'no_checkins' && flag.eventId ? <AppLink to={`/app/host/events/${flag.eventId}/checkin`} className="text-primary underline underline-offset-4">Open check-in (count attendance)</AppLink> : null}
        </div>
        {flag.status === 'open' ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid gap-1">
              <Label htmlFor={`flag-note-${flag.id}`}>Note (optional)</Label>
              <Input id={`flag-note-${flag.id}`} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className="w-72" />
            </div>
            <Button size="sm" disabled={busy} onClick={() => void resolve('reviewed')}>Mark reviewed</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void resolve('dismissed')}>Dismiss</Button>
          </div>
        ) : flag.resolutionNote ? <p className="text-sm">Note: {flag.resolutionNote}</p> : null}
      </CardContent>
    </Card>
  )
}

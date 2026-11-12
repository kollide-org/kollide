import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import { useSession } from '@/app/providers/session-context'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useMyAppeals, useMyTips } from '@/hooks/use-after-event'
import { formatDate, formatWhen } from '@/lib/format'
import { errorMessage, services } from '@/services'

const STATUS: Record<string, string> = { open: 'We are looking at it', upheld: 'Decision kept', overturned: 'Accepted' }

/** Appeal a note about you, or an account that is on hold. We aim to answer within 48 hours. */
export function Component() {
  const { profile } = useSession()
  const queryClient = useQueryClient()
  const tips = useMyTips()
  const appeals = useMyAppeals()
  const [open, setOpen] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const onHold = profile?.status !== undefined && profile.status !== 'active' && profile.status !== null
  const hasOpenStatusAppeal = appeals.data?.some((a) => a.kind === 'account_status' && a.status === 'open') ?? false

  async function send(kind: 'tip' | 'account_status', tipId?: string) {
    setBusy(true)
    try {
      await services.safety.createAppeal(kind, message.trim(), tipId)
      toast.success('We got your appeal. We aim to reply within 48 hours.')
      setOpen(null)
      setMessage('')
      await Promise.all(['my-appeals', 'my-tips'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })))
    } catch (caught) {
      toast.error(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  const form = (kind: 'tip' | 'account_status', tipId?: string) => (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <Label htmlFor={`appeal-${tipId ?? kind}`}>Tell us what we should know</Label>
        <Textarea id={`appeal-${tipId ?? kind}`} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button disabled={busy || message.trim().length === 0} onClick={() => void send(kind, tipId)}>Send appeal</Button>
        <Button variant="ghost" onClick={() => setOpen(null)}>Cancel</Button>
      </div>
    </div>
  )

  return (
    <div className="grid gap-8">
      <PageHeader eyebrow="Fairness" title="Appeals" description="If something looks wrong, tell us. A person on our team reads every appeal, usually within 48 hours." />

      {onHold ? (
        <Card>
          <CardContent className="grid gap-3 pt-6">
            <h2 className="text-h3">Your account is on hold</h2>
            <p className="text-muted-foreground">We are looking into something. You cannot join or host events until it is sorted out. If you think this is a mistake, appeal below.</p>
            {hasOpenStatusAppeal ? <Badge variant="soft">Your appeal is with our team</Badge> : open === 'account_status' ? form('account_status') : (
              <div><Button onClick={() => { setOpen('account_status'); setMessage('') }}>Appeal this</Button></div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {tips.data && tips.data.length > 0 ? (
        <section aria-label="Notes about you" className="grid gap-4">
          <h2 className="text-h2">Notes from the community</h2>
          <p className="text-muted-foreground">These notes are anonymous and meant kindly. Only you can see them.</p>
          {tips.data.map((tip) => (
            <Card key={tip.id}>
              <CardContent className="grid gap-3 pt-6">
                <p>{tip.message}</p>
                <p className="text-sm text-muted-foreground">{formatDate(tip.createdAt)}</p>
                {appeals.data?.some((a) => a.tipId === tip.id && a.status === 'open') ? (
                  <Badge variant="soft">Your appeal is with our team</Badge>
                ) : open === tip.id ? form('tip', tip.id) : (
                  <div><Button variant="outline" size="sm" onClick={() => { setOpen(tip.id); setMessage('') }}>I disagree</Button></div>
                )}
              </CardContent>
            </Card>
          ))}
        </section>
      ) : null}

      {!onHold && (tips.data?.length ?? 0) === 0 ? <p className="text-muted-foreground">There is nothing to appeal right now.</p> : null}

      {appeals.data && appeals.data.length > 0 ? (
        <section aria-label="Your appeals" className="grid gap-4">
          <h2 className="text-h2">Your appeals</h2>
          {appeals.data.map((a) => (
            <Card key={a.id}>
              <CardContent className="grid gap-2 pt-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{a.kind === 'tip' ? 'A note about you' : 'Account on hold'}</p>
                  <Badge variant={a.status === 'overturned' ? 'success' : 'soft'}>{STATUS[a.status] ?? a.status}</Badge>
                </div>
                <p className="text-muted-foreground">{a.message}</p>
                {a.status === 'open' ? <p className="text-sm text-muted-foreground">We aim to reply by {formatWhen(a.dueAt)}.</p> : null}
                {a.adminNote ? <p className="rounded-xl bg-secondary p-3 text-sm">From our team: {a.adminNote}</p> : null}
              </CardContent>
            </Card>
          ))}
        </section>
      ) : null}
    </div>
  )
}

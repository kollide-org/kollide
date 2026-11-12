import { useQueryClient } from '@tanstack/react-query'
import { Camera, CameraOff, CheckCircle2, CircleAlert } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router'
import { toast } from 'sonner'

import { useSession } from '@/app/providers/session-context'
import { AppLink } from '@/components/shared/app-link'
import { PageHeader } from '@/components/shared/page-header'
import { QrScanner } from '@/components/shared/qr-scanner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useHostCheckinList } from '@/hooks/use-after-event'
import { useEvent } from '@/hooks/use-events'
import { mediaUrl } from '@/lib/media'
import { errorMessage, services, tokenFromQr } from '@/services'

/** The host's door screen: scan a guest's QR ticket, or tick their name off the list. Opens 2 hours before the start. */
export function Component() {
  const { id = '' } = useParams()
  const { role } = useSession()
  const queryClient = useQueryClient()
  const event = useEvent(id)
  const list = useHostCheckinList(id)
  const [scanning, setScanning] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [last, setLast] = useState<{ ok: boolean; text: string } | null>(null)

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['host-checkin', id] })
  const rows = list.data ?? []
  const inCount = rows.filter((r) => r.checkedIn).length

  async function onScan(text: string) {
    const token = tokenFromQr(text)
    if (!token) {
      setLast({ ok: false, text: 'That is not a Kollide ticket.' })
      return
    }
    try {
      const result = await services.checkin.checkIn(token)
      setLast({ ok: true, text: `${result.firstName ?? 'Guest'} is checked in.` })
      await refresh()
    } catch (caught) {
      setLast({ ok: false, text: errorMessage(caught) })
    }
  }

  async function tick(bookingId: string) {
    setBusy(bookingId)
    try {
      const result = await services.checkin.checkInManual(bookingId)
      toast.success(`${result.firstName ?? 'Guest'} is checked in.`)
      await refresh()
    } catch (caught) {
      toast.error(errorMessage(caught))
    } finally {
      setBusy(null)
    }
  }

  async function finishNow() {
    try {
      const result = await services.checkin.finaliseNow(id)
      toast.success(result === 'finalised' ? 'Attendance counted. Feedback is now open.' : `Not counted yet (${result}).`)
      await Promise.all(['host-checkin', 'my-reputation', 'feedback-tasks'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })))
    } catch (caught) {
      toast.error(errorMessage(caught))
    }
  }

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow="At the door"
        title={event.data ? `Check-in: ${event.data.title}` : 'Check-in'}
        description="Scan each guest’s QR ticket, or tick their name off below. Check-in is open from 2 hours before the start until 4 hours after it."
        action={<AppLink to="/app/host" className="text-primary underline underline-offset-4">Back to your events</AppLink>}
      />

      <section aria-label="Scanner" className="grid max-w-sm gap-3">
        <Button variant={scanning ? 'outline' : 'default'} onClick={() => { setScanning((s) => !s); setLast(null) }}>
          {scanning ? <><CameraOff /> Stop scanning</> : <><Camera /> Scan QR tickets</>}
        </Button>
        {scanning ? <QrScanner onScan={(text) => void onScan(text)} /> : null}
        <div aria-live="polite" className="min-h-6">
          {last ? (
            <p className={`flex items-center gap-2 ${last.ok ? 'text-success-strong' : 'text-destructive-strong'}`}>
              {last.ok ? <CheckCircle2 aria-hidden className="size-5" /> : <CircleAlert aria-hidden className="size-5" />} {last.text}
            </p>
          ) : null}
        </div>
      </section>

      <section aria-label="Guest list" className="grid gap-4">
        <h2 className="text-h2">{inCount} of {rows.length} checked in</h2>
        {rows.length === 0 && !list.isPending ? <p className="text-muted-foreground">Nobody holds a place yet.</p> : null}
        {list.isError ? <p role="alert" className="text-destructive-strong">{errorMessage(list.error)}</p> : null}
        {rows.map((row) => (
          <Card key={row.bookingId}>
            <CardContent className="flex flex-wrap items-center gap-4 pt-6">
              <div className="size-14 shrink-0 overflow-hidden rounded-2xl bg-secondary">
                {row.photoKey ? <img src={mediaUrl(row.photoKey)} alt="" className="size-full object-cover" /> : null}
              </div>
              <div className="grid flex-1 gap-0.5">
                <p className="text-lg font-medium">{row.firstName ?? 'Member'}</p>
                {row.squadName ? <p className="text-sm text-muted-foreground">Squad: {row.squadName}</p> : null}
              </div>
              {row.checkedIn ? (
                <Badge variant="success"><CheckCircle2 /> In{row.method === 'qr' ? ' (QR)' : ''}</Badge>
              ) : (
                <Button size="sm" disabled={busy === row.bookingId} onClick={() => void tick(row.bookingId)}>Check in</Button>
              )}
            </CardContent>
          </Card>
        ))}
      </section>

      {role === 'admin' ? (
        <section aria-label="Admin tools" className="grid max-w-xl gap-2 rounded-2xl border border-border p-5">
          <h2 className="text-h3">Admin: count attendance now</h2>
          <p className="text-sm text-muted-foreground">Normally this happens 2 hours after the event ends. For testing and staging: the event must have ended. People who were not checked in become no-shows.</p>
          <div><Button variant="outline" onClick={() => void finishNow()}>Count attendance now</Button></div>
        </section>
      ) : null}
    </div>
  )
}

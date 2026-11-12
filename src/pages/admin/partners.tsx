import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatWhen } from '@/lib/format'
import { errorMessage, services, type PartnerEvent } from '@/services'

/** Partner events: the ticket link and referral code we send people to, and how many people we sent. */
export function Component() {
  const events = useQuery({ queryKey: ['admin-partners'], queryFn: () => services.admin.listPartnerEvents() })
  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Admin"
        title="Partner links"
        description="People who tap “Get tickets” go through our link, which adds the referral code. The counts are only numbers: nothing about who clicked is kept."
      />
      {events.data?.length === 0 ? <p className="text-muted-foreground">No partner events yet. Create one from Host, with the type “partner”.</p> : null}
      <div className="grid gap-3">{events.data?.map((e) => <PartnerCard key={e.eventId} event={e} />)}</div>
    </div>
  )
}

function PartnerCard({ event }: { event: PartnerEvent }) {
  const queryClient = useQueryClient()
  const [url, setUrl] = useState(event.partnerUrl ?? '')
  const [code, setCode] = useState(event.referralCode ?? '')
  const [busy, setBusy] = useState(false)
  const changed = url.trim() !== (event.partnerUrl ?? '') || code.trim() !== (event.referralCode ?? '')

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await services.admin.setPartnerLink(event.eventId, url.trim(), code.trim() || undefined)
      toast.success('Link saved. It is in the audit log.')
      await queryClient.invalidateQueries({ queryKey: ['admin-partners'] })
    } catch (caught) {
      toast.error(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card data-testid="partner-card">
      <CardContent className="grid gap-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-h3">{event.title}</h2>
            <p className="text-sm text-muted-foreground">{formatWhen(event.startsAt)} · host {event.hostFirstName ?? 'unknown'}</p>
          </div>
          <Badge variant="soft">{event.status}</Badge>
        </div>
        <p className="text-sm" data-testid="partner-clicks">
          Clicks: <strong>{event.clicks7d}</strong> in the last 7 days · <strong>{event.clicks30d}</strong> in 30 days · <strong>{event.clicksTotal}</strong> in total
        </p>
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
          <div className="grid gap-1">
            <Label htmlFor={`url-${event.eventId}`}>Ticket link (https)</Label>
            <Input id={`url-${event.eventId}`} value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor={`code-${event.eventId}`}>Referral code</Label>
            <Input id={`code-${event.eventId}`} maxLength={40} value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <Button type="submit" disabled={busy || !changed || url.trim().length < 9}>Save</Button>
        </form>
      </CardContent>
    </Card>
  )
}

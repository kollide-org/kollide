import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import { AppLink } from '@/components/shared/app-link'
import { NativeSelect } from '@/components/shared/native-select'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatWhen } from '@/lib/format'
import { errorMessage, services } from '@/services'

export function Component() {
  const queryClient = useQueryClient()
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const pending = useQuery({ queryKey: ['admin-events', 'pending_review'], queryFn: () => services.admin.listEvents('pending_review') })
  const published = useQuery({ queryKey: ['admin-events', 'published'], queryFn: () => services.admin.listEvents('published') })

  async function run(id: string, action: () => Promise<void>, done: string) {
    setBusy(id)
    try {
      await action()
      toast.success(done)
      await queryClient.invalidateQueries({ queryKey: ['admin-events'] })
      await queryClient.invalidateQueries({ queryKey: ['events'] })
    } catch (caught) {
      toast.error(errorMessage(caught))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="grid gap-10">
      <PageHeader eyebrow="Admin" title="Events" />
      <section aria-label="Waiting for review" className="grid gap-4">
        <h2 className="text-h2">Waiting for review</h2>
        {pending.data?.length === 0 ? <p className="text-muted-foreground">Nothing is waiting for review.</p> : null}
        {pending.data?.map((event) => (
          <Card key={event.id}>
            <CardContent className="grid gap-3 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{event.title}</p>
                  <p className="text-sm text-muted-foreground">{formatWhen(event.startsAt)} · host {event.hostFirstName ?? 'unknown'}</p>
                </div>
                <Badge>{event.type}</Badge>
              </div>
              <Input aria-label={`Note for ${event.title}`} placeholder="Note to the host (needed to reject)" value={notes[event.id] ?? ''} onChange={(e) => setNotes({ ...notes, [event.id]: e.target.value })} />
              <div className="flex gap-2">
                <Button disabled={busy === event.id} onClick={() => void run(event.id, () => services.admin.approveEvent(event.id, notes[event.id]), 'Approved and published.')}>Approve</Button>
                <Button variant="destructive" disabled={busy === event.id || !notes[event.id]?.trim()} onClick={() => void run(event.id, () => services.admin.rejectEvent(event.id, notes[event.id]!), 'Sent back to the host.')}>Reject</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section aria-label="Published" className="grid gap-4">
        <h2 className="text-h2">Published</h2>
        {published.data?.length === 0 ? <p className="text-muted-foreground">No published events.</p> : null}
        {published.data?.map((event) => (
          <Card key={event.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
              <div>
                <AppLink to={`/app/events/${event.id}`} className="font-medium underline-offset-4 hover:underline">{event.title}</AppLink>
                <p className="text-sm text-muted-foreground">{formatWhen(event.startsAt)} · host {event.hostFirstName ?? 'unknown'}</p>
              </div>
              <div className="flex items-center gap-2">
                {event.featuredPosition ? (
                  <>
                    <Badge variant="soft">Featured in slot {event.featuredPosition}</Badge>
                    <Button variant="outline" size="sm" disabled={busy === event.id} onClick={() => void run(event.id, () => services.admin.unfeatureEvent(event.id), 'Removed from featured.')}>Unfeature</Button>
                  </>
                ) : (
                  <FeatureControl disabled={busy === event.id} title={event.title} onFeature={(position) => void run(event.id, () => services.admin.featureEvent(event.id, position), 'Featured on the home page.')} />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  )
}

function FeatureControl({ title, disabled, onFeature }: { title: string; disabled: boolean; onFeature: (position: number) => void }) {
  const [position, setPosition] = useState('1')
  return (
    <>
      <NativeSelect aria-label={`Slot for ${title}`} className="h-9 w-24" value={position} onChange={(e) => setPosition(e.target.value)}>
        {[1, 2, 3, 4, 5, 6].map((n) => (<option key={n} value={n}>Slot {n}</option>))}
      </NativeSelect>
      <Button size="sm" disabled={disabled} onClick={() => onFeature(Number(position))}>Feature</Button>
    </>
  )
}

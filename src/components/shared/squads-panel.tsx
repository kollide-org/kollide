import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useEventSquads } from '@/hooks/use-bookings'
import { errorMessage, services } from '@/services'

/** Small groups (4 to 6) going to the event together. The person who starts a squad approves who joins. */
export function SquadsPanel({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient()
  const squads = useEventSquads(eventId)
  const [point, setPoint] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)

  const inASquad = squads.data?.some((s) => s.myStatus === 'requested' || s.myStatus === 'approved') ?? false

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true)
    try {
      await action()
      toast.success(done)
      await Promise.all(['event-squads', 'my-squads', 'my-booking', 'my-bookings', 'notifications', 'notifications-unread'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })))
    } catch (caught) {
      toast.error(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  async function create(event: FormEvent) {
    event.preventDefault()
    await run(() => services.squads.create(eventId, point.trim(), name.trim() || undefined), 'Squad started.')
    setOpen(false)
    setPoint('')
    setName('')
  }

  return (
    <section aria-label="Squads" className="grid gap-3 rounded-2xl border border-border p-5">
      <h2 className="text-h3">Go with a squad</h2>
      <p className="text-sm text-muted-foreground">A squad is 4 to 6 people who meet before the event and walk in together.</p>
      {squads.data?.length === 0 ? <p className="text-muted-foreground">No squads yet. Be the first to start one.</p> : null}
      <ul className="grid gap-2">
        {squads.data?.map((squad) => (
          <li key={squad.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary p-3">
            <span>
              <strong>{squad.name ?? `${squad.creatorFirstName ?? 'A member'}’s squad`}</strong>{' '}
              <span className="text-sm text-muted-foreground">
                {squad.memberCount} of 6 · {squad.complete ? 'ready' : 'forming (needs 4)'}
              </span>
            </span>
            {squad.myStatus === 'approved' ? <span className="text-sm">You are in</span> : null}
            {squad.myStatus === 'requested' ? <span className="text-sm">Request sent</span> : null}
            {!squad.myStatus && !inASquad && squad.spotsLeft > 0 ? (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => services.squads.requestToJoin(squad.id), 'Request sent to the squad.')}>
                Ask to join
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {!inASquad ? (
        open ? (
          <form onSubmit={create} className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="squad-point">Where does the squad meet?</Label>
              <Input id="squad-point" required maxLength={200} placeholder="The cafe by Gate 2, 5 pm" value={point} onChange={(e) => setPoint(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="squad-name">Squad name (optional)</Label>
              <Input id="squad-name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy || point.trim().length < 3}>Start squad</Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </form>
        ) : (
          <div><Button variant="outline" onClick={() => setOpen(true)}>Start a squad</Button></div>
        )
      ) : null}
    </section>
  )
}

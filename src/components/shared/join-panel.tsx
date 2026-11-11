import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import { AppLink } from '@/components/shared/app-link'
import { Button } from '@/components/ui/button'
import { useAppConfig } from '@/hooks/use-app-config'
import { useMyBooking } from '@/hooks/use-bookings'
import { errorMessage, services, type EventCard } from '@/services'

/**
 * The Request to join (or Join) area of an event page. Nothing is charged by Kollide in v1, and nothing for a paid
 * event is shown while payments are off.
 */
export function JoinPanel({ event, isHost, isAdmin, userId }: { event: EventCard; isHost: boolean; isAdmin: boolean; userId: string }) {
  const queryClient = useQueryClient()
  const config = useAppConfig()
  const booking = useMyBooking(event.id, !isHost)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    await Promise.all(
      [['my-booking', event.id], ['event', event.id], ['event-address', event.id], ['events'], ['my-bookings'], ['notifications'], ['notifications-unread'], ['event-squads', event.id]].map((key) =>
        queryClient.invalidateQueries({ queryKey: key }),
      ),
    )
  }

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      await refresh()
    } catch (caught) {
      const message = errorMessage(caught)
      setError(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  // The Book button stays hidden while payments are off: paid events cannot be joined yet.
  if (event.pricingMode === 'paid' && !(config.data?.paymentsEnabled ?? false)) return null
  void userId

  if (isHost || isAdmin) {
    return (
      <div className="grid gap-2">
        <Button asChild>
          <AppLink to={`/app/host/events/${event.id}/inbox`}>Manage requests</AppLink>
        </Button>
        {isHost ? <p className="text-sm text-muted-foreground">You are hosting this event.</p> : null}
      </div>
    )
  }

  const current = booking.data
  const cancel = () => current && run(() => services.bookings.cancel(current.bookingId))

  return (
    <div className="grid gap-3" aria-label="Your place">
      {!current ? (
        <Button size="lg" disabled={busy || booking.isPending} onClick={() => run(() => services.bookings.requestToJoin(event.id))}>
          {event.approvalMode === 'instant' ? 'Join' : 'Request to join'}
        </Button>
      ) : null}
      {current?.status === 'requested' ? (
        <>
          <p role="status" className="rounded-xl bg-secondary p-3">Your request is with the host. We will email you.</p>
          <Button variant="outline" disabled={busy} onClick={() => void cancel()}>Cancel my request</Button>
        </>
      ) : null}
      {current?.status === 'approved' || current?.status === 'confirmed' ? (
        <>
          <p role="status" className="rounded-xl bg-primary-soft p-3 text-primary-soft-foreground">
            {current.status === 'confirmed' ? 'You are confirmed.' : 'You are in!'} The exact address is shown above.
          </p>
          <Button variant="outline" disabled={busy} onClick={() => void cancel()}>Cancel my place</Button>
        </>
      ) : null}
      {current?.status === 'waitlisted' ? (
        <>
          <p role="status" className="rounded-xl bg-secondary p-3">
            You are on the waitlist{current.waitlistPosition ? ` (number ${current.waitlistPosition})` : ''}. We will email you if a place opens up.
          </p>
          <Button variant="outline" disabled={busy} onClick={() => void cancel()}>Leave the waitlist</Button>
        </>
      ) : null}
      {current?.status === 'declined' ? (
        <p role="status" className="rounded-xl bg-secondary p-3">
          This one is not going to work out this time. There are plenty more events waiting for you.
        </p>
      ) : null}
      {error ? <p role="alert" className="text-sm text-destructive-strong">{error}</p> : null}
    </div>
  )
}

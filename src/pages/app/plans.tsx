import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import { AppLink } from '@/components/shared/app-link'
import { CheckinTicket } from '@/components/shared/checkin-ticket'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useMyBookings } from '@/hooks/use-bookings'
import { formatWhen } from '@/lib/format'
import { errorMessage, services, type BookingStatus } from '@/services'

const LABEL: Partial<Record<BookingStatus, string>> = {
  requested: 'Request sent', approved: 'You are in', confirmed: 'Confirmed', waitlisted: 'Waitlisted', declined: 'Not this time',
  attended: 'Attended', no_show: 'Missed', cancelled: 'Cancelled',
}

export function Component() {
  const queryClient = useQueryClient()
  const bookings = useMyBookings()
  const [now] = useState(() => Date.now())
  const live = (status: BookingStatus) => ['requested', 'approved', 'confirmed', 'waitlisted'].includes(status)
  const upcoming = bookings.data?.filter((b) => live(b.status) && new Date(b.endsAt).getTime() > now) ?? []
  const past = bookings.data?.filter((b) => !live(b.status) || new Date(b.endsAt).getTime() <= now) ?? []

  async function cancel(id: string) {
    try {
      await services.bookings.cancel(id)
      toast.success('Cancelled.')
      await Promise.all(['my-bookings', 'my-booking', 'events', 'event'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })))
    } catch (caught) {
      toast.error(errorMessage(caught))
    }
  }

  const row = (b: NonNullable<typeof bookings.data>[number], canCancel: boolean) => (
    <Card key={b.bookingId}>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
        <div>
          <AppLink to={`/app/events/${b.eventId}`} className="text-h3 underline-offset-4 hover:underline">{b.eventTitle}</AppLink>
          <p className="text-sm text-muted-foreground">{formatWhen(b.startsAt)} · {b.areaName}</p>
          {b.status === 'cancelled' && b.cancelReason === 'no_reconfirm' ? <p className="text-sm">Your seat was released because we did not hear back.</p> : null}
          {b.status === 'cancelled' && b.cancelReason === 'event_cancelled' ? <p className="text-sm">This event was cancelled.</p> : null}
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="soft">{LABEL[b.status] ?? b.status}{b.status === 'waitlisted' && b.waitlistPosition ? ` #${b.waitlistPosition}` : ''}</Badge>
          {(b.status === 'approved' || b.status === 'confirmed') && b.eventStatus === 'published' ? <CheckinTicket bookingId={b.bookingId} eventTitle={b.eventTitle} /> : null}
          {b.status === 'attended' ? (
            <Button asChild variant="soft" size="sm"><AppLink to={`/app/events/${b.eventId}/feedback`}>Share feedback</AppLink></Button>
          ) : null}
          {canCancel ? <Button variant="outline" size="sm" onClick={() => void cancel(b.bookingId)}>Cancel</Button> : null}
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="grid gap-8">
      <PageHeader eyebrow="Your events" title="My plans" />
      <section aria-label="Upcoming" className="grid gap-4">
        <h2 className="text-h2">Upcoming</h2>
        {upcoming.length === 0 ? <p className="text-muted-foreground">Nothing planned yet. <AppLink to="/app" className="text-primary underline underline-offset-4">Find an event</AppLink>.</p> : null}
        {upcoming.map((b) => row(b, true))}
      </section>
      {past.length ? (
        <section aria-label="Past and cancelled" className="grid gap-4">
          <h2 className="text-h2">Past and cancelled</h2>
          {past.map((b) => row(b, false))}
        </section>
      ) : null}
    </div>
  )
}

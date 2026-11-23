import { Sun } from 'lucide-react'
import * as m from 'motion/react-m'
import { useEffect, useState } from 'react'

import { QrCode } from '@/components/tickets/qr-code'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import { useTicket } from '@/features/bookings/queries'
import { formatDay, formatTime } from '@/lib/format'
import { spring } from '@/lib/motion'
import { useMotionAllowed } from '@/lib/use-media-query'

interface TicketDialogProps {
  bookingId: string
  event: { title: string; startsAt: string; area: string }
  open: boolean
  onOpenChange: (open: boolean) => void
}

const clock = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })

/** A clock that ticks every second, as ticket apps show, so a screenshot is easy to spot. */
function LiveClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  return (
    <p className="mt-1.5 inline-flex items-center gap-2 text-sm text-muted-foreground">
      <span className="live-dot size-2 rounded-full bg-success" aria-hidden="true" />
      <span>
        Live ticket · <span className="tabular-nums">{clock.format(now).toLowerCase()}</span>
      </span>
    </p>
  )
}

/** The member's ticket: a QR code the host scans at the door. */
export function TicketDialog({ bookingId, event, open, onOpenChange }: TicketDialogProps) {
  const ticket = useTicket(bookingId, open)
  const motionAllowed = useMotionAllowed()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-sm">
        <m.div
          initial={motionAllowed ? { opacity: 0, y: 16, scale: 0.97 } : { opacity: 0 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={spring.gentle}
        >
          <m.div
            initial={{ y: 0 }}
            animate={{ y: -3 }}
            transition={{ ...spring.soft, delay: 0.4 }}
            className="relative overflow-hidden bg-primary px-6 pt-7 pb-8 text-primary-foreground"
          >
            <span
              aria-hidden="true"
              className="ticket-sheen absolute inset-y-0 left-0 w-1/3 bg-linear-to-r from-transparent via-white/20 to-transparent"
            />
            <p className="eyebrow relative opacity-85">Your ticket</p>
            <DialogTitle className="relative mt-2 font-display text-h3 text-primary-foreground">{event.title}</DialogTitle>
            <DialogDescription className="relative mt-1 text-primary-foreground/90">
              {formatDay(event.startsAt)} at {formatTime(event.startsAt)} · {event.area}
            </DialogDescription>
          </m.div>

          {/* The perforation between the stub and the code. */}
          <div className="relative h-0 border-t-2 border-dashed border-border" aria-hidden="true">
            <span className="absolute -top-3 -left-3 size-6 rounded-full bg-brand-ink/45" />
            <span className="absolute -top-3 -right-3 size-6 rounded-full bg-brand-ink/45" />
          </div>

          <m.div
            initial={{ y: 0 }}
            animate={{ y: 3 }}
            transition={{ ...spring.soft, delay: 0.4 }}
            className="flex flex-col items-center px-6 pt-7 pb-7 text-center"
          >
            {ticket.isPending ? (
              <div role="status" aria-label="Loading your ticket">
                <Skeleton className="size-56 rounded-2xl" />
              </div>
            ) : ticket.isError ? (
              <ErrorState onRetry={() => void ticket.refetch()} />
            ) : (
              <>
                <div className="rounded-2xl bg-white p-3 shadow-card">
                  <QrCode value={ticket.data.code} label={`Ticket code for ${ticket.data.holderFirstName}`} className="size-52" />
                </div>
                <p className="mt-5 font-display text-h4">{ticket.data.holderFirstName}</p>
                <LiveClock />
                <p className="mt-1 font-mono text-xs break-all text-muted-foreground">{ticket.data.code}</p>
              </>
            )}
            <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Sun className="size-4 shrink-0" aria-hidden="true" />
              Turn your screen brightness up at the door.
            </p>
          </m.div>
        </m.div>
      </DialogContent>
    </Dialog>
  )
}

import { useQuery } from '@tanstack/react-query'
import { QrCode } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { errorMessage, services } from '@/services'

/** The attendee's QR ticket. The host scans it at the door; the same screen works offline once opened. */
export function CheckinTicket({ bookingId, eventTitle }: { bookingId: string; eventTitle: string }) {
  const [open, setOpen] = useState(false)
  const token = useQuery({ queryKey: ['checkin-token', bookingId], queryFn: () => services.checkin.myToken(bookingId), enabled: open, staleTime: Infinity })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="soft" size="sm"><QrCode /> Show my ticket</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{eventTitle}</DialogTitle>
          <DialogDescription>Show this to the host when you arrive. Please do not share a screenshot of it.</DialogDescription>
        </DialogHeader>
        <div className="grid place-items-center py-2">
          {token.isError ? (
            <p role="alert" className="text-destructive-strong">{errorMessage(token.error)}</p>
          ) : token.data ? (
            // Always black on white, even in dark mode: scanners need the contrast.
            <div className="rounded-2xl bg-white p-4"><QRCodeSVG value={token.data} size={224} level="M" bgColor="#ffffff" fgColor="#000000" title="Check-in ticket" /></div>
          ) : (
            <p className="text-muted-foreground">Getting your ticket…</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

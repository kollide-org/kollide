import { useQueryClient } from '@tanstack/react-query'
import { BadgeCheck } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router'
import { toast } from 'sonner'

import { useSession } from '@/app/providers/session-context'
import { AppLink } from '@/components/shared/app-link'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useHostInbox } from '@/hooks/use-bookings'
import { useEvent } from '@/hooks/use-events'
import { useReferenceData } from '@/hooks/use-reference-data'
import { mediaUrl } from '@/lib/media'
import { errorMessage, services, type HostDecision, type InboxItem } from '@/services'

const STATUS_LABEL: Record<string, string> = { requested: 'Waiting for you', waitlisted: 'Waitlisted', approved: 'Approved', confirmed: 'Confirmed' }

/** Everyone who asked to come. Shows profile cards: never a phone number, date of birth or gender. */
export function Component() {
  const { id = '' } = useParams()
  const { role } = useSession()
  const queryClient = useQueryClient()
  const inbox = useHostInbox(id)
  const event = useEvent(id)
  const reference = useReferenceData()
  const [busy, setBusy] = useState<string | null>(null)

  async function decide(item: InboxItem, decision: HostDecision) {
    setBusy(item.bookingId)
    try {
      await services.bookings.decide(item.bookingId, decision)
      toast.success(decision === 'approve' ? 'Approved.' : decision === 'waitlist' ? 'Added to the waitlist.' : 'Declined, gently.')
      await Promise.all(['host-inbox', 'event', 'events', 'notifications-unread'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })))
    } catch (caught) {
      toast.error(errorMessage(caught))
    } finally {
      setBusy(null)
    }
  }

  async function sendReconfirmation(item: InboxItem) {
    setBusy(item.bookingId)
    try {
      await services.bookings.sendReconfirmationNow(item.bookingId)
      toast.success('“Still coming?” email queued.')
    } catch (caught) {
      toast.error(errorMessage(caught))
    } finally {
      setBusy(null)
    }
  }

  const label = (items: { id: number; label: string }[] | undefined, itemId: number) => items?.find((x) => x.id === itemId)?.label ?? ''

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow="Hosting"
        title={event.data ? `Requests: ${event.data.title}` : 'Requests'}
        description={event.data && event.data.spotsLeft !== null ? `${event.data.spotsLeft} of ${event.data.capacity} spots left` : undefined}
        action={<AppLink to="/app/host" className="text-primary underline underline-offset-4">Back to your events</AppLink>}
      />
      {inbox.data?.length === 0 ? <p className="text-muted-foreground">Nobody has asked yet.</p> : null}
      <div className="grid gap-4">
        {inbox.data?.map((item) => (
          <Card key={item.bookingId}>
            <CardContent className="grid gap-4 pt-6">
              <div className="flex flex-wrap items-start gap-4">
                <div className="size-20 shrink-0 overflow-hidden rounded-2xl bg-secondary">
                  {item.photoKeys[0] ? <img src={mediaUrl(item.photoKeys[0])} alt="" className="size-full object-cover" /> : null}
                </div>
                <div className="grid flex-1 gap-1">
                  <p className="flex items-center gap-1.5 text-lg font-medium">
                    {item.firstName ?? 'Member'}{item.age ? `, ${item.age}` : ''}
                    {item.isVerified ? <BadgeCheck aria-label="Verified" className="size-5 text-primary" /> : null}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {label(reference.data?.areas, item.areaId ?? -1)} · Shows up {item.showsUpAttended} of {item.showsUpTotal} (counted once events have been attended) · {item.eventsInCommon} events in common
                  </p>
                  {item.squadName ? <p className="text-sm">Squad: {item.squadName}</p> : null}
                </div>
                <Badge variant="soft">{STATUS_LABEL[item.status] ?? item.status}</Badge>
              </div>
              {item.prompts.map((prompt) => (
                <div key={prompt.prompt}>
                  <p className="eyebrow text-primary">{prompt.prompt}</p>
                  <p>{prompt.answer}</p>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                {item.interestIds.map((interest) => (
                  <Badge key={interest}>{label(reference.data?.interests, interest)}</Badge>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {item.status === 'requested' || item.status === 'waitlisted' ? (
                  <>
                    <Button disabled={busy === item.bookingId} onClick={() => void decide(item, 'approve')}>Approve</Button>
                    {item.status === 'requested' ? (
                      <Button variant="outline" disabled={busy === item.bookingId} onClick={() => void decide(item, 'waitlist')}>Waitlist</Button>
                    ) : null}
                    <Button variant="outline" disabled={busy === item.bookingId} onClick={() => void decide(item, 'decline')}>Decline</Button>
                  </>
                ) : null}
                {role === 'admin' && item.status === 'approved' ? (
                  <Button variant="ghost" size="sm" disabled={busy === item.bookingId} onClick={() => void sendReconfirmation(item)}>
                    Send “Still coming?” now (test)
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

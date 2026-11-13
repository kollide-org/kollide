import { useParams } from 'react-router'

import { AppLink } from '@/components/shared/app-link'
import { CalendarX } from 'lucide-react'

import { EmptyState } from '@/components/shared/empty-state'
import { EventCardView } from '@/components/shared/event-card'
import { Skeleton } from '@/components/ui/skeleton'
import { useHub } from '@/hooks/use-events'
import { mediaUrl } from '@/lib/media'

export function Component() {
  const { slug = '' } = useParams()
  const hub = useHub(slug)

  if (hub.isPending) return <Skeleton className="h-64 w-full" />
  if (!hub.data) {
    return (
      <EmptyState
        icon={CalendarX}
        title="We couldn’t find that hub"
        description="It may have ended."
        action={<AppLink to="/app" className="text-primary underline underline-offset-4">Back to what’s on</AppLink>}
      />
    )
  }
  const { hub: h, events } = hub.data
  return (
    <div className="grid gap-8">
      <header
        className="relative grid min-h-40 content-end gap-2 overflow-hidden rounded-2xl p-6 text-white"
        style={{ background: h.artKey ? `center / cover url(${mediaUrl(h.artKey)})` : h.accentColor }}
      >
        <span className="absolute inset-0 bg-black/35" aria-hidden />
        <h1 className="relative text-h1">{h.title}</h1>
        {h.subtitle ? <p className="relative text-lead">{h.subtitle}</p> : null}
      </header>
      {events.length === 0 ? <p className="text-muted-foreground">No upcoming events in this hub yet.</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => (
          <EventCardView key={event.id} event={event} hub={h.slug} />
        ))}
      </div>
    </div>
  )
}

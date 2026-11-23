import { Eye, EyeOff, Layers, Pencil, Plus } from 'lucide-react'
import { useMemo, useState, type CSSProperties } from 'react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { HubEditor } from '@/features/admin/components/hub-editor'
import { QueueItem, QueueList, QueueSkeleton } from '@/features/admin/components/queue'
import { useHubs, useSetActiveHub } from '@/features/admin/queries'
import { useEvents } from '@/features/events/queries'
import { formatDay } from '@/lib/format'
import type { AdminHub } from '@/services'

/** Chosen for Home is not the same as on Home: a chosen hub shows only between its dates. */
function ShowingBadge({ hub }: { hub: AdminHub }) {
  const [now] = useState(() => new Date())
  if (!hub.active) {
    return (
      <Badge variant="secondary" size="sm">
        Not showing
      </Badge>
    )
  }
  if (now < new Date(hub.startsAt)) {
    return (
      <Badge variant="highlight-soft" size="sm">
        Shows on Home from {formatDay(hub.startsAt)}
      </Badge>
    )
  }
  if (now > new Date(hub.endsAt)) {
    return (
      <Badge variant="warning" size="sm">
        Chosen, but its dates have passed
      </Badge>
    )
  }
  return (
    <Badge variant="success" size="sm">
      <Eye aria-hidden="true" />
      Showing on Home
    </Badge>
  )
}

function HubCard({ hub, onEdit }: { hub: AdminHub; onEdit: () => void }) {
  const setActive = useSetActiveHub()
  const accent = { '--hub-accent': hub.accentColor, '--hub-accent-foreground': hub.accentForeground } as CSSProperties
  const count = hub.eventIds.length

  const toggle = () =>
    setActive.mutate(hub.active ? null : hub.id, {
      onSuccess: () =>
        toast.success(hub.active ? 'Taken off Home' : 'Chosen for Home', {
          description: hub.active ? 'Home shows no hub until you choose one.' : `“${hub.title}” replaces any other hub, between its dates.`,
        }),
      onError: (error) => toast.error('That didn’t save', { description: error.message }),
    })

  return (
    <QueueItem className="overflow-hidden">
      <div style={accent} className="grid sm:grid-cols-[15rem_1fr]">
        <div className="relative isolate aspect-[16/9] overflow-hidden bg-brand-ink sm:aspect-auto">
          <img src={hub.artworkUrl} alt="" loading="lazy" className="absolute inset-0 -z-10 size-full object-cover opacity-75" />
          <span className="absolute bottom-4 left-4 inline-flex h-7 items-center rounded-full bg-hub-accent px-3 text-sm font-semibold text-hub-accent-foreground">
            In season
          </span>
        </div>
        <div className="p-6">
          <div className="flex flex-wrap items-center gap-2">
            <ShowingBadge hub={hub} />
            <span className="text-sm text-muted-foreground">
              {formatDay(hub.startsAt)} to {formatDay(hub.endsAt)}
            </span>
          </div>
          <h2 className="mt-3 text-h3">{hub.title}</h2>
          <p className="mt-1 text-muted-foreground">{hub.subtitle}</p>
          <p className="mt-3 text-sm font-medium">
            {count} {count === 1 ? 'event' : 'events'}
          </p>
          <div className="mt-5 flex flex-wrap gap-3 border-t border-border pt-5">
            <Button variant="outline" onClick={toggle} disabled={setActive.isPending}>
              {hub.active ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              {hub.active ? 'Take off Home' : 'Choose for Home'}
            </Button>
            <Button variant="ghost" onClick={onEdit}>
              <Pencil aria-hidden="true" />
              Edit
            </Button>
          </div>
        </div>
      </div>
    </QueueItem>
  )
}

/** Admin: seasonal hubs. Only one shows on Home at a time. */
export function Component() {
  const { data: hubs, isPending, isError, refetch } = useHubs()
  const events = useEvents()
  // `hub: null` is a new hub. The last one stays mounted while the sheet slides away.
  const [editor, setEditor] = useState<{ hub: AdminHub | null; open: boolean; key: number } | null>(null)
  const openEditor = (hub: AdminHub | null) => setEditor((current) => ({ hub, open: true, key: (current?.key ?? 0) + 1 }))

  const artwork = useMemo(() => {
    const options = new Map<string, string>()
    for (const hub of hubs ?? []) options.set(hub.artworkUrl, hub.artworkAlt)
    for (const event of events.data ?? []) if (options.size < 9) options.set(event.coverUrl, event.coverAlt)
    return [...options].map(([url, alt]) => ({ url, alt }))
  }, [hubs, events.data])

  return (
    <>
      <title>Hubs · Kollide admin</title>
      <PageHeader
        eyebrow="Admin"
        title="Hubs"
        description="Seasonal collections at the top of Home, like New Year’s Eve or a long weekend. One shows at a time."
        action={
          <Button onClick={() => openEditor(null)} disabled={isPending}>
            <Plus aria-hidden="true" />
            New hub
          </Button>
        }
      />

      <div className="mt-10">
        {isPending ? (
          <QueueSkeleton label="Loading hubs" rows={2} className="h-56" />
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : hubs.length === 0 ? (
          <EmptyState icon={Layers} title="No hubs yet" description="Make the first one for the next long weekend or festival. It can hold any events you choose." />
        ) : (
          <QueueList>
            {hubs.map((hub) => (
              <HubCard key={hub.id} hub={hub} onEdit={() => openEditor(hub)} />
            ))}
          </QueueList>
        )}
      </div>

      {editor ? (
        <HubEditor
          key={editor.key}
          hub={editor.hub}
          artwork={artwork}
          open={editor.open}
          onOpenChange={(open) => setEditor((current) => (current ? { ...current, open } : current))}
        />
      ) : null}
    </>
  )
}

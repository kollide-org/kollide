import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/shared/page-header'
import { PhotoSlot } from '@/components/shared/photo-slot'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { uploadImage } from '@/lib/upload-image'
import { errorMessage, services, type AdminHub } from '@/services'

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export function Component() {
  const queryClient = useQueryClient()
  const hubs = useQuery({ queryKey: ['admin-hubs'], queryFn: () => services.admin.listHubs() })
  const published = useQuery({ queryKey: ['admin-events', 'published'], queryFn: () => services.admin.listEvents('published') })
  const [editing, setEditing] = useState<AdminHub | 'new' | null>(null)

  return (
    <div className="grid gap-8">
      <PageHeader eyebrow="Admin" title="Hubs" description="Seasonal collections of events." action={<Button onClick={() => setEditing('new')}>New hub</Button>} />
      {editing ? (
        <HubForm
          key={editing === 'new' ? 'new' : editing.id}
          hub={editing === 'new' ? null : editing}
          events={published.data ?? []}
          onDone={async () => {
            setEditing(null)
            await queryClient.invalidateQueries({ queryKey: ['admin-hubs'] })
            await queryClient.invalidateQueries({ queryKey: ['hubs'] })
          }}
        />
      ) : null}
      <div className="grid gap-4">
        {hubs.data?.map((hub) => (
          <Card key={hub.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
              <div>
                <p className="font-medium">{hub.title}</p>
                <p className="text-sm text-muted-foreground">{hub.published ? 'Published' : 'Hidden'} · {hub.eventIds.length} events · /{hub.slug}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(hub)}>Edit</Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    if (!window.confirm(`Delete “${hub.title}”?`)) return
                    try {
                      await services.admin.deleteHub(hub.id)
                      await queryClient.invalidateQueries({ queryKey: ['admin-hubs'] })
                      await queryClient.invalidateQueries({ queryKey: ['hubs'] })
                    } catch (caught) {
                      toast.error(errorMessage(caught))
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function HubForm({ hub, events, onDone }: { hub: AdminHub | null; events: { id: string; title: string }[]; onDone: () => Promise<void> }) {
  const [title, setTitle] = useState(hub?.title ?? '')
  const [slug, setSlug] = useState(hub?.slug ?? '')
  const [subtitle, setSubtitle] = useState(hub?.subtitle ?? '')
  const [accent, setAccent] = useState(hub?.accentColor ?? '#F2A93B')
  const [startsOn, setStartsOn] = useState(hub?.startsOn ?? '')
  const [endsOn, setEndsOn] = useState(hub?.endsOn ?? '')
  const [sortOrder, setSortOrder] = useState(hub?.sortOrder ?? 0)
  const [published, setPublished] = useState(hub?.published ?? false)
  const [eventIds, setEventIds] = useState<string[]>(hub?.eventIds ?? [])
  const [artKey, setArtKey] = useState<string | null>(hub?.artKey ?? null)
  const [newArt, setNewArt] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const [artBusy, setArtBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pickArt(file: File) {
    setArtBusy(true)
    try {
      const key = await uploadImage(file, 'hub_art')
      setNewArt(key)
      setArtKey(key)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setArtBusy(false)
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const id = await services.admin.saveHub({
        id: hub?.id, slug: slug || slugify(title), title, subtitle, accentColor: accent,
        startsOn: startsOn || null, endsOn: endsOn || null, sortOrder, published, artKey: newArt,
      })
      await services.admin.setHubEvents(id, eventIds)
      toast.success('Hub saved.')
      await onDone()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  const toggle = (id: string) => setEventIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))

  return (
    <form onSubmit={save} className="grid gap-4 rounded-2xl border border-border p-5">
      <h2 className="text-h3">{hub ? 'Edit hub' : 'New hub'}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2"><Label htmlFor="hub-title">Title</Label><Input id="hub-title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="grid gap-2"><Label htmlFor="hub-slug">Address (slug)</Label><Input id="hub-slug" placeholder={slugify(title)} value={slug} onChange={(e) => setSlug(e.target.value)} /></div>
        <div className="grid gap-2 sm:col-span-2"><Label htmlFor="hub-sub">Subtitle</Label><Input id="hub-sub" maxLength={160} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} /></div>
        <div className="grid gap-2"><Label htmlFor="hub-accent">Accent colour</Label><Input id="hub-accent" type="color" value={accent} onChange={(e) => setAccent(e.target.value)} /></div>
        <div className="grid gap-2"><Label htmlFor="hub-order">Order</Label><Input id="hub-order" type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} /></div>
        <div className="grid gap-2"><Label htmlFor="hub-start">Starts</Label><Input id="hub-start" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} /></div>
        <div className="grid gap-2"><Label htmlFor="hub-end">Ends</Label><Input id="hub-end" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} /></div>
      </div>
      <label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={published} onChange={(e) => setPublished(e.target.checked)} /> Published</label>
      <div className="grid max-w-xs gap-2">
        <span className="text-sm font-medium">Art</span>
        <PhotoSlot index={1} photoKey={artKey} busy={artBusy} onFile={(file) => void pickArt(file)} />
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Events (shown in the order you tick them)</legend>
        {events.length === 0 ? <p className="text-sm text-muted-foreground">No published events yet.</p> : null}
        {events.map((item) => (
          <label key={item.id} className="flex items-center gap-2">
            <input type="checkbox" className="size-4" checked={eventIds.includes(item.id)} onChange={() => toggle(item.id)} />
            {item.title}
          </label>
        ))}
      </fieldset>
      {error ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive-soft/50 px-4 py-3 text-destructive-strong">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || title.trim().length < 3}>Save hub</Button>
        <Button type="button" variant="ghost" onClick={() => void onDone()}>Cancel</Button>
      </div>
    </form>
  )
}

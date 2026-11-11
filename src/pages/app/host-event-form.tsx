import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { useSession } from '@/app/providers/session-context'
import { NativeSelect } from '@/components/shared/native-select'
import { PageHeader } from '@/components/shared/page-header'
import { PhotoSlot } from '@/components/shared/photo-slot'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAppConfig } from '@/hooks/use-app-config'
import { useReferenceData } from '@/hooks/use-reference-data'
import { PRICE_OPTIONS, toLocalInput } from '@/lib/format'
import { uploadImage } from '@/lib/upload-image'
import { errorMessage, services, type EventForEdit, type EventInput, type EventType, type PricingMode } from '@/services'

const EMPTY: EventInput = {
  type: 'community', title: '', description: '', categoryId: null, areaId: null, startsAt: '', endsAt: '', capacity: 10,
  womenOnly: false, minAge: 18, maxAge: null, houseRules: '', pricingMode: 'free', priceLabel: '', houseParty: false,
  address: '', directionsNote: '', hostNotes: '', partnerUrl: '', referralCode: '',
}

// Once an event is published only these can change.
const OPEN_AFTER_PUBLISH = new Set(['description', 'houseRules', 'address', 'directionsNote', 'hostNotes'])

/** Create and edit an event. Pricing is text only: no money moves through Kollide. */
export function Component() {
  const { id } = useParams()
  const existing = useQuery({ queryKey: ['event-edit', id], queryFn: () => services.events.getForEdit(id!), enabled: Boolean(id) })
  if (id && existing.isPending) return <p role="status">Loading…</p>
  // Keyed by event so the form starts from the saved values.
  return <EventForm key={id ?? 'new'} id={id} loaded={existing.data ?? null} />
}

function EventForm({ id, loaded }: { id: string | undefined; loaded: EventForEdit | null }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { role } = useSession()
  const reference = useReferenceData()
  const config = useAppConfig()

  const [form, setForm] = useState<EventInput>(() =>
    loaded ? { ...loaded, startsAt: toLocalInput(loaded.startsAt), endsAt: toLocalInput(loaded.endsAt) } : EMPTY,
  )
  const [busy, setBusy] = useState(false)
  const [coverBusy, setCoverBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const status = loaded?.status ?? 'draft'
  const fieldLocked = (name: string) => status === 'pending_review' || status === 'completed' || status === 'cancelled' || (status === 'published' && !OPEN_AFTER_PUBLISH.has(name))
  const set = <K extends keyof EventInput>(key: K, value: EventInput[K]) => setForm((current) => ({ ...current, [key]: value }))
  const paymentsEnabled = config.data?.paymentsEnabled ?? false
  const isAdmin = role === 'admin'
  const pricingMode: PricingMode = form.pricingMode
  const needsLabel = pricingMode === 'pay_at_venue' || pricingMode === 'cost_split'

  function payload(): EventInput {
    return {
      ...form,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : '',
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : '',
      capacity: form.type === 'partner' && !form.capacity ? null : form.capacity,
    }
  }

  async function save(): Promise<string | null> {
    setError(null)
    try {
      if (id) {
        await services.events.update(id, payload())
        await queryClient.invalidateQueries({ queryKey: ['event-edit', id] })
        return id
      }
      return await services.events.create(payload())
    } catch (caught) {
      setError(errorMessage(caught))
      return null
    }
  }

  async function saveDraft(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    const savedId = await save()
    setBusy(false)
    if (!savedId) return
    await queryClient.invalidateQueries({ queryKey: ['my-events'] })
    toast.success('Saved.')
    if (!id) await navigate(`/app/host/events/${savedId}`, { replace: true })
  }

  async function submitForReview() {
    setBusy(true)
    const savedId = await save()
    if (savedId) {
      try {
        await services.events.submit(savedId)
        await queryClient.invalidateQueries({ queryKey: ['my-events'] })
        toast.success('Sent for review.')
        await navigate('/app/host', { replace: true })
      } catch (caught) {
        setError(errorMessage(caught))
        if (!id) await navigate(`/app/host/events/${savedId}`, { replace: true })
      }
    }
    setBusy(false)
  }

  async function cancelEvent() {
    if (!id || !window.confirm('Cancel this event? This cannot be undone.')) return
    try {
      await services.events.cancel(id, 'Cancelled by the host')
      await queryClient.invalidateQueries({ queryKey: ['my-events'] })
      await navigate('/app/host', { replace: true })
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  async function pickCover(file: File) {
    if (!id) return
    setCoverBusy(true)
    setError(null)
    try {
      const key = await uploadImage(file, 'event_cover', { eventId: id })
      await services.events.setCover(id, key)
      await queryClient.invalidateQueries({ queryKey: ['event-edit', id] })
      toast.success('Cover saved.')
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setCoverBusy(false)
    }
  }

  const types: EventType[] = isAdmin ? ['community', 'kollide', 'partner'] : ['community']

  return (
    <form onSubmit={saveDraft} className="grid max-w-2xl gap-6">
      <PageHeader eyebrow="Hosting" title={id ? 'Edit event' : 'New event'} />
      {status !== 'draft' && loaded ? (
        <p role="status" className="rounded-xl bg-secondary p-4">
          {status === 'pending_review' ? 'This event is waiting for review and cannot be changed.' : null}
          {status === 'published' ? 'This event is published. You can still change the description, house rules and address.' : null}
          {status === 'cancelled' || status === 'completed' ? `This event is ${status}.` : null}
        </p>
      ) : null}
      {loaded?.reviewNote && status === 'draft' ? <p className="rounded-xl bg-secondary p-4">Note from our team: {loaded.reviewNote}</p> : null}

      {isAdmin && !id ? (
        <Field label="Type" id="type">
          <NativeSelect id="type" value={form.type} onChange={(e) => set('type', e.target.value as EventType)}>
            {types.map((t) => (<option key={t} value={t}>{t}</option>))}
          </NativeSelect>
        </Field>
      ) : null}

      <Field label="Title" id="title">
        <Input id="title" maxLength={120} value={form.title} disabled={fieldLocked('title')} onChange={(e) => set('title', e.target.value)} />
      </Field>
      <Field label="Description" id="description">
        <Textarea id="description" rows={4} maxLength={2000} value={form.description} disabled={fieldLocked('description')} onChange={(e) => set('description', e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Area" id="area">
          <NativeSelect id="area" value={form.areaId ?? ''} disabled={fieldLocked('area')} onChange={(e) => set('areaId', e.target.value ? Number(e.target.value) : null)}>
            <option value="">Choose…</option>
            {reference.data?.areas.map((a) => (<option key={a.id} value={a.id}>{a.label}</option>))}
          </NativeSelect>
        </Field>
        <Field label="Category" id="category">
          <NativeSelect id="category" value={form.categoryId ?? ''} disabled={fieldLocked('category')} onChange={(e) => set('categoryId', e.target.value ? Number(e.target.value) : null)}>
            <option value="">Choose…</option>
            {reference.data?.categories.map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}
          </NativeSelect>
        </Field>
        <Field label="Starts" id="starts">
          <Input id="starts" type="datetime-local" value={form.startsAt} disabled={fieldLocked('startsAt')} onChange={(e) => set('startsAt', e.target.value)} />
        </Field>
        <Field label="Ends" id="ends">
          <Input id="ends" type="datetime-local" value={form.endsAt} disabled={fieldLocked('endsAt')} onChange={(e) => set('endsAt', e.target.value)} />
        </Field>
        <Field label={form.houseParty ? 'Guests (up to 25)' : 'Capacity'} id="capacity">
          <Input id="capacity" type="number" min={2} max={form.houseParty ? 25 : 500} value={form.capacity ?? ''} disabled={fieldLocked('capacity')} onChange={(e) => set('capacity', e.target.value ? Number(e.target.value) : null)} />
        </Field>
        <Field label="Minimum age" id="min-age">
          <Input id="min-age" type="number" min={18} max={99} value={form.minAge} disabled={fieldLocked('minAge')} onChange={(e) => set('minAge', Number(e.target.value))} />
        </Field>
      </div>
      <div className="grid gap-3">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.womenOnly} disabled={fieldLocked('womenOnly')} onChange={(e) => set('womenOnly', e.target.checked)} className="size-4" /> Women only
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.houseParty} disabled={fieldLocked('houseParty')} onChange={(e) => set('houseParty', e.target.checked)} className="size-4" />
          House party (max 25 guests, you approve every guest)
        </label>
      </div>

      <fieldset className="grid gap-3">
        <legend className="mb-1 font-medium">Price</legend>
        <p className="text-sm text-muted-foreground">Kollide does not take payments. Tell people what to expect; they pay at the venue or split the cost on the night.</p>
        <NativeSelect aria-label="Price type" value={pricingMode} disabled={fieldLocked('pricingMode')} onChange={(e) => set('pricingMode', e.target.value as PricingMode)}>
          {PRICE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
          {/* Paid appears only when payments are switched on (P1) */}
          {paymentsEnabled && form.type === 'kollide' ? <option value="paid">Paid through Kollide</option> : null}
        </NativeSelect>
        {needsLabel ? (
          <Field label="What people will see (for example “₹300 at the venue”)" id="price-label">
            <Input id="price-label" maxLength={80} value={form.priceLabel} disabled={fieldLocked('priceLabel')} onChange={(e) => set('priceLabel', e.target.value)} />
          </Field>
        ) : null}
      </fieldset>

      <Field label="House rules" id="rules">
        <Textarea id="rules" rows={3} maxLength={1000} value={form.houseRules} disabled={fieldLocked('houseRules')} onChange={(e) => set('houseRules', e.target.value)} />
      </Field>

      {form.type !== 'partner' ? (
        <fieldset className="grid gap-3 rounded-2xl border border-border p-4">
          <legend className="px-1 font-medium">Exact address (only you, our team and approved guests see it)</legend>
          <Field label="Address" id="address">
            <Input id="address" maxLength={300} value={form.address} disabled={fieldLocked('address')} onChange={(e) => set('address', e.target.value)} />
          </Field>
          <Field label="Directions for guests" id="directions">
            <Input id="directions" maxLength={500} value={form.directionsNote} disabled={fieldLocked('directionsNote')} onChange={(e) => set('directionsNote', e.target.value)} />
          </Field>
          <Field label="Notes for yourself" id="notes">
            <Input id="notes" maxLength={1000} value={form.hostNotes} disabled={fieldLocked('hostNotes')} onChange={(e) => set('hostNotes', e.target.value)} />
          </Field>
        </fieldset>
      ) : (
        <fieldset className="grid gap-3 rounded-2xl border border-border p-4">
          <legend className="px-1 font-medium">Partner link</legend>
          <Field label="Ticket link (https)" id="partner-url">
            <Input id="partner-url" type="url" value={form.partnerUrl ?? ''} disabled={fieldLocked('partnerUrl')} onChange={(e) => set('partnerUrl', e.target.value)} />
          </Field>
          <Field label="Referral code" id="ref">
            <Input id="ref" maxLength={40} value={form.referralCode ?? ''} disabled={fieldLocked('referralCode')} onChange={(e) => set('referralCode', e.target.value)} />
          </Field>
        </fieldset>
      )}

      {id ? (
        <section aria-label="Cover" className="grid max-w-xs gap-2">
          <h2 className="font-medium">Cover photo</h2>
          <PhotoSlot index={1} photoKey={loaded?.coverKey ?? null} busy={coverBusy} onFile={(file) => void pickCover(file)} />
          <p className="text-sm text-muted-foreground">A cover is needed before you can submit.</p>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">Save the draft first, then add a cover photo.</p>
      )}

      {error ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive-soft/50 px-4 py-3 text-destructive-strong">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        {status === 'draft' || status === 'published' ? (
          <Button type="submit" variant="outline" disabled={busy}>Save</Button>
        ) : null}
        {status === 'draft' ? (
          <Button type="button" disabled={busy} onClick={() => void submitForReview()}>Submit for review</Button>
        ) : null}
        {id && (status === 'draft' || status === 'pending_review' || status === 'published') ? (
          <Button type="button" variant="destructive" disabled={busy} onClick={() => void cancelEvent()}>Cancel event</Button>
        ) : null}
      </div>
    </form>
  )
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

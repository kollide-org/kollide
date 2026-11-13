import { useEffect, useRef, useState } from 'react'

import { useSession } from '@/app/providers/session-context'
import { AppLink } from '@/components/shared/app-link'
import { EventCardView } from '@/components/shared/event-card'
import { NativeSelect } from '@/components/shared/native-select'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAppConfig } from '@/hooks/use-app-config'
import { useEventSearch, useFeaturedEvents, useHubs } from '@/hooks/use-events'
import { useReferenceData } from '@/hooks/use-reference-data'
import { track } from '@/lib/analytics'
import { PRICE_OPTIONS } from '@/lib/format'
import { mediaUrl } from '@/lib/media'
import { readPreference, writePreference } from '@/lib/preferences'
import type { EventFilters, PricingMode } from '@/services'

const FILTERS_KEY = 'kollide:filters'
interface SavedFilters { area?: string; category?: string; pricing?: string; womenOnly?: boolean; groupSize?: string }

/** The filters used last, when the person allows Preferences (otherwise they only last until the page is reloaded). */
function readSavedFilters(): SavedFilters {
  try {
    const parsed = JSON.parse(readPreference(FILTERS_KEY) ?? '{}') as SavedFilters
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

/** The feed: featured events, seasonal hubs, and every upcoming event with filters. */
export function Component() {
  const { role } = useSession()
  const reference = useReferenceData()
  const config = useAppConfig()
  const featured = useFeaturedEvents()
  const hubs = useHubs()

  const [saved] = useState(readSavedFilters)
  const [area, setArea] = useState(saved.area ?? '')
  const [category, setCategory] = useState(saved.category ?? '')
  const [pricing, setPricing] = useState(saved.pricing ?? '')
  const [womenOnly, setWomenOnly] = useState(saved.womenOnly === true)
  const [groupSize, setGroupSize] = useState(saved.groupSize ?? '')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const filters: EventFilters = {
    areaIds: area ? [Number(area)] : undefined,
    categoryIds: category ? [Number(category)] : undefined,
    pricing: pricing ? [pricing as PricingMode] : undefined,
    womenOnly: womenOnly || undefined,
    groupSize: groupSize ? Number(groupSize) : undefined,
    from: from ? new Date(`${from}T00:00:00+05:30`).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59+05:30`).toISOString() : undefined,
  }
  const events = useEventSearch(filters)
  const hasFilters = Object.values(filters).some((value) => value !== undefined)
  const paymentsEnabled = config.data?.paymentsEnabled ?? false

  // Remember the last filters (the browser only keeps them with Preferences consent).
  useEffect(() => {
    const empty = !area && !category && !pricing && !womenOnly && !groupSize
    writePreference(FILTERS_KEY, empty ? null : JSON.stringify({ area, category, pricing, womenOnly, groupSize }))
  }, [area, category, pricing, womenOnly, groupSize])

  // Interest events: which filters people use, and that a filtered search ran. No values that identify anyone.
  const activeKeys = Object.entries(filters).filter(([, value]) => value !== undefined).map(([key]) => key)
  const filterSignature = activeKeys.join(',') + JSON.stringify(filters)
  const lastFilters = useRef<string | null>(null)
  useEffect(() => {
    if (lastFilters.current !== null && lastFilters.current !== filterSignature && activeKeys.length > 0) {
      track('filter_applied', { filters: activeKeys, active_count: activeKeys.length })
    }
    lastFilters.current = filterSignature
  }, [filterSignature]) // eslint-disable-line react-hooks/exhaustive-deps
  const lastSearch = useRef<string | null>(null)
  useEffect(() => {
    if (!events.data || events.isFetching || activeKeys.length === 0 || lastSearch.current === filterSignature) return
    lastSearch.current = filterSignature
    track('search_performed', { active_count: activeKeys.length, result_count: events.data.length })
  }, [events.data, events.isFetching]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="grid gap-10">
      <PageHeader
        eyebrow="Bengaluru"
        title="What’s on"
        description="Find an event, then join with a small group of verified people."
        action={
          role === 'host' || role === 'admin' ? (
            <Button asChild>
              <AppLink to="/app/host">Host an event</AppLink>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <AppLink to="/app/become-host">Become a host</AppLink>
            </Button>
          )
        }
      />

      {!hasFilters && featured.data?.length ? (
        <section aria-label="Featured" className="grid gap-4">
          <h2 className="text-h2">Featured</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {featured.data.map((event) => (
              <EventCardView key={event.id} event={event} />
            ))}
          </div>
        </section>
      ) : null}

      {!hasFilters && hubs.data?.length ? (
        <section aria-label="Hubs" className="grid gap-4">
          <h2 className="text-h2">Seasonal hubs</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {hubs.data.map((hub) => (
              <AppLink
                key={hub.id}
                to={`/app/hubs/${hub.slug}`}
                className="relative grid min-h-32 content-end gap-1 overflow-hidden rounded-2xl p-5 text-white outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                style={{ background: hub.artKey ? `center / cover url(${mediaUrl(hub.artKey)})` : hub.accentColor }}
              >
                <span className="absolute inset-0 bg-black/35" aria-hidden />
                <span className="relative text-h3">{hub.title}</span>
                {hub.subtitle ? <span className="relative text-sm">{hub.subtitle}</span> : null}
                <span className="relative text-sm">{hub.eventCount} events</span>
              </AppLink>
            ))}
          </div>
        </section>
      ) : null}

      <section aria-label="All events" className="grid gap-5">
        <h2 className="text-h2">All events</h2>
        <form className="grid gap-3 rounded-2xl border border-border p-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(event) => event.preventDefault()}>
          <div className="grid gap-1.5">
            <Label htmlFor="f-area">Area</Label>
            <NativeSelect id="f-area" value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="">Any area</option>
              {reference.data?.areas.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="f-category">Category</Label>
            <NativeSelect id="f-category" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Any category</option>
              {reference.data?.categories.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="f-price">Price</Label>
            <NativeSelect id="f-price" value={pricing} onChange={(e) => setPricing(e.target.value)}>
              <option value="">Any price</option>
              {PRICE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
              {/* Paid events only exist when payments are switched on (P1). */}
              {paymentsEnabled ? <option value="paid">Paid</option> : null}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="f-group">Group size</Label>
            <NativeSelect id="f-group" value={groupSize} onChange={(e) => setGroupSize(e.target.value)}>
              <option value="">Any size</option>
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n} people</option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="f-from">From</Label>
            <Input id="f-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="f-to">To</Label>
            <Input id="f-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 self-end pb-2">
            <input type="checkbox" checked={womenOnly} onChange={(e) => setWomenOnly(e.target.checked)} className="size-4" />
            Women-only events
          </label>
          {hasFilters ? (
            <Button
              type="button"
              variant="ghost"
              className="self-end"
              onClick={() => {
                setArea(''); setCategory(''); setPricing(''); setWomenOnly(false); setGroupSize(''); setFrom(''); setTo('')
              }}
            >
              Clear filters
            </Button>
          ) : null}
        </form>

        {events.isPending ? <p role="status">Loading events…</p> : null}
        {events.data?.length === 0 ? <p className="text-muted-foreground">No events match. Try fewer filters.</p> : null}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.data?.map((event) => (
            <EventCardView key={event.id} event={event} />
          ))}
        </div>
      </section>
    </div>
  )
}

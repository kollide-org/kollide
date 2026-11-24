import { Check, MapPin, Plus, Search } from 'lucide-react'
import { useId, useMemo, useState } from 'react'

import { ChoiceChips } from '@/components/forms/choice'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  AREA_MAX_LENGTH,
  areaKey,
  CITIES,
  findLocality,
  localitiesOf,
  ZONE_LABELS,
  ZONES,
  type CityId,
  type Zone,
} from '@/services/types/places'

export interface AreaChoice {
  city: CityId
  /** The locality, listed or typed. Empty until one is chosen. */
  area: string
  /** Looked up for a listed locality, chosen by the person for a typed one. */
  zone: Zone | null
}

interface AreaPickerProps {
  value: AreaChoice
  onChange: (value: AreaChoice) => void
  /** Words for the search box, such as "Your area" or "Area". */
  label: string
  /** Explains, under the search box, that this is a locality and never an address. */
  hint?: string
  describedBy?: string
  invalid?: boolean
}

/**
 * Choose a city, then a locality in it. Search the list, narrow it to a part
 * of the city, or type an area that is not listed and say which part of the
 * city it is in.
 */
export function AreaPicker({ value, onChange, label, hint, describedBy, invalid }: AreaPickerProps) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [zoneFilter, setZoneFilter] = useState<Zone | null>(null)
  const localities = localitiesOf(value.city)
  const listed = value.area ? findLocality(value.city, value.area) : null
  const typed = Boolean(value.area) && !listed

  const matches = useMemo(() => {
    const key = areaKey(query)
    return localities
      .filter((locality) => !zoneFilter || locality.zone === zoneFilter)
      .filter((locality) => !key || areaKey(locality.name).includes(key) || locality.aka?.some((name) => areaKey(name).includes(key)))
      .slice()
      .sort((a, b) => {
        // Names that start with what was typed come first.
        const aStarts = Number(areaKey(a.name).startsWith(key))
        const bStarts = Number(areaKey(b.name).startsWith(key))
        return bStarts - aStarts || a.name.localeCompare(b.name)
      })
  }, [localities, query, zoneFilter])

  const exact = query.trim() ? findLocality(value.city, query) : null
  const canUseTyped = query.trim().length > 0 && !exact
  const usingTyped = typed && areaKey(value.area) === areaKey(query)

  const choose = (area: string, zone: Zone | null) => onChange({ ...value, area, zone })

  return (
    <div className="grid min-w-0 grid-cols-1 gap-7">
      {/* A fieldset is as wide as its content unless told otherwise, and this row scrolls. */}
      <fieldset className="min-w-0">
        <legend className="mb-3 text-sm font-semibold">City</legend>
        <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {CITIES.map((city) => {
            const checked = value.city === city.id
            return (
              <label
                key={city.id}
                className={cn(
                  'relative inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 font-medium whitespace-nowrap transition-colors select-none has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring',
                  checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card',
                  city.open ? 'cursor-pointer' : 'cursor-not-allowed border-dashed text-muted-foreground',
                )}
              >
                <input
                  type="radio"
                  name={`${id}-city`}
                  value={city.id}
                  checked={checked}
                  disabled={!city.open}
                  onChange={() => onChange({ city: city.id, area: '', zone: null })}
                  className="sr-only"
                />
                {city.name}
                {city.open ? null : <span className="text-xs font-semibold">Coming soon</span>}
              </label>
            )
          })}
        </div>
      </fieldset>

      <div className="grid min-w-0 gap-3">
        <Label htmlFor={`${id}-search`}>{label}</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id={`${id}-search`}
            type="search"
            value={query}
            maxLength={AREA_MAX_LENGTH}
            onChange={(change) => setQuery(change.target.value)}
            placeholder={`Search ${localities.length} areas, or type yours`}
            autoComplete="off"
            className="pl-11"
            aria-describedby={[hint ? `${id}-hint` : null, `${id}-count`, describedBy].filter(Boolean).join(' ')}
            aria-invalid={invalid ? true : undefined}
            data-autofocus=""
          />
        </div>
        {hint ? (
          <p id={`${id}-hint`} className="text-sm text-muted-foreground">
            {hint}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2" role="group" aria-label="Show one part of the city">
          {[null, ...ZONES].map((zone) => (
            <button
              key={zone ?? 'all'}
              type="button"
              aria-pressed={zoneFilter === zone}
              onClick={() => setZoneFilter(zone)}
              className={cn(
                'inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium transition-colors',
                zoneFilter === zone ? 'border-foreground bg-foreground text-background' : 'border-input hover:border-foreground/60',
              )}
            >
              {zone ? ZONE_LABELS[zone] : 'All'}
            </button>
          ))}
        </div>

        <p id={`${id}-count`} className="sr-only" aria-live="polite">
          {matches.length} {matches.length === 1 ? 'area' : 'areas'} shown
        </p>

        <fieldset className="min-w-0 rounded-2xl border border-border bg-card">
          <legend className="sr-only">{label}</legend>
          <ul className="max-h-72 divide-y divide-border/70 overflow-y-auto overscroll-contain">
            {canUseTyped ? (
              <li>
                <button
                  type="button"
                  aria-pressed={usingTyped}
                  onClick={() => choose(query.trim().replace(/\s+/g, ' '), usingTyped ? value.zone : null)}
                  className={cn(
                    'flex min-h-13 w-full items-center gap-3 px-4 py-2 text-left font-medium text-primary',
                    usingTyped ? 'bg-primary-soft' : 'hover:bg-primary-soft',
                  )}
                >
                  {usingTyped ? <Check className="size-4.5 shrink-0" aria-hidden="true" /> : <Plus className="size-4.5 shrink-0" aria-hidden="true" />}
                  <span>
                    {usingTyped ? `“${value.area}” is your area` : `Use “${query.trim()}”`}
                    <span className="block text-sm font-normal text-muted-foreground">
                      {usingTyped ? 'Added, as it isn’t on our list yet.' : 'Not listed? Add it as your area.'}
                    </span>
                  </span>
                </button>
              </li>
            ) : null}
            {matches.map((locality) => {
              const checked = listed?.name === locality.name
              return (
                <li key={locality.name}>
                  <label
                    className={cn(
                      'relative flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2 transition-colors has-focus-visible:bg-accent',
                      checked ? 'bg-primary-soft text-primary-soft-foreground' : 'hover:bg-accent',
                    )}
                  >
                    <input
                      type="radio"
                      name={`${id}-area`}
                      value={locality.name}
                      checked={checked}
                      onChange={() => choose(locality.name, locality.zone)}
                      className="sr-only"
                    />
                    <MapPin className={cn('size-4.5 shrink-0', checked ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
                    <span className="flex-1 font-medium">{locality.name}</span>
                    <span className="text-sm text-muted-foreground">{ZONE_LABELS[locality.zone]}</span>
                    {checked ? <Check className="size-4.5 text-primary" aria-hidden="true" /> : null}
                  </label>
                </li>
              )
            })}
            {matches.length === 0 && !canUseTyped ? <li className="px-4 py-6 text-center text-muted-foreground">No areas in this part of the city yet.</li> : null}
          </ul>
        </fieldset>
      </div>

      {typed ? (
        <div className="grid gap-3 rounded-2xl border border-primary/40 bg-primary-soft/40 p-5">
          <p className="font-semibold">
            Which part of the city is <span className="text-primary">{value.area}</span> in?
          </p>
          <p className="-mt-2 text-sm text-muted-foreground">It helps people nearby find you. Pick the closest.</p>
          <ChoiceChips
            legend={`Part of the city for ${value.area}`}
            name={`${id}-zone`}
            options={ZONES.map((zone) => ZONE_LABELS[zone])}
            value={value.zone ? ZONE_LABELS[value.zone] : null}
            onChange={(label) => onChange({ ...value, zone: ZONES.find((zone) => ZONE_LABELS[zone] === label) ?? null })}
          />
        </div>
      ) : null}

      {value.area ? (
        <p className="flex items-center gap-2 text-sm" aria-live="polite">
          <Check className="size-4 text-primary" aria-hidden="true" />
          <span>
            Your area: <span className="font-semibold">{value.area}</span>
            {value.zone ? `, ${ZONE_LABELS[value.zone]} ${CITIES.find((city) => city.id === value.city)?.name}` : ''}
          </span>
        </p>
      ) : null}
    </div>
  )
}

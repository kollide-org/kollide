import { SlidersHorizontal, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { DateFilter, EventFilters, GroupSizeFilter, PriceFilter } from '@/services'
import { AREAS, EVENT_CATEGORIES } from '@/services/types'

import { countFilters, toggleInList } from '../filters'
import { CATEGORY_LABELS, DATE_LABELS, GROUP_SIZE_LABELS } from '../labels'

interface EventFiltersProps {
  filters: EventFilters
  onChange: (filters: EventFilters) => void
  /** How many events match right now. `null` while loading. */
  resultCount: number | null
}

function ToggleChip({ pressed, onPress, children }: { pressed: boolean; onPress: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onPress}
      className={cn(
        'inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-[background-color,border-color,color,transform] duration-200 ease-out-soft active:scale-[0.97]',
        pressed ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card text-foreground hover:border-foreground/60',
      )}
    >
      {children}
    </button>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold">{title}</legend>
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
    </fieldset>
  )
}

const QUICK_DATES: DateFilter[] = ['today', 'this_week', 'this_weekend']
const ALL_DATES: DateFilter[] = ['today', 'this_week', 'this_weekend', 'this_month']
const PRICES: { value: PriceFilter; label: string }[] = [
  { value: 'free', label: 'Free' },
  { value: 'paid', label: 'Paid' },
]
const SIZES: GroupSizeFilter[] = ['small', 'medium', 'large']

/**
 * The filter bar above the event feed: the most-used filters as one-tap
 * chips, and a sheet with all of them. Every change applies straight away.
 */
export function EventFilterBar({ filters, onChange, resultCount }: EventFiltersProps) {
  const [open, setOpen] = useState(false)
  const active = countFilters(filters)
  const set = (patch: Partial<EventFilters>) => {
    const next = { ...filters, ...patch }
    for (const key of Object.keys(next) as (keyof EventFilters)[]) if (next[key] === undefined) delete next[key]
    onChange(next)
  }
  const toggleValue = <K extends 'date' | 'price' | 'groupSize'>(key: K, value: NonNullable<EventFilters[K]>) =>
    set({ [key]: filters[key] === value ? undefined : value } as Partial<EventFilters>)

  return (
    <>
      <div role="group" aria-label="Filter events" className="flex items-center gap-2 overflow-x-auto py-1 [scrollbar-width:none]">
        <Button variant="outline" size="sm" className="h-10 shrink-0 rounded-full bg-card px-4" onClick={() => setOpen(true)}>
          <SlidersHorizontal aria-hidden="true" />
          Filters
          {active > 0 ? (
            <span className="ml-0.5 inline-flex size-5 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {active}
              <span className="sr-only"> active</span>
            </span>
          ) : null}
        </Button>
        <span aria-hidden="true" className="mx-1 h-6 w-px shrink-0 bg-border" />
        {QUICK_DATES.map((date) => (
          <ToggleChip key={date} pressed={filters.date === date} onPress={() => toggleValue('date', date)}>
            {DATE_LABELS[date]}
          </ToggleChip>
        ))}
        <ToggleChip pressed={filters.price === 'free'} onPress={() => toggleValue('price', 'free')}>
          Free
        </ToggleChip>
        <ToggleChip pressed={Boolean(filters.womenOnly)} onPress={() => set({ womenOnly: filters.womenOnly ? undefined : true })}>
          Women only
        </ToggleChip>
        {active > 0 ? (
          <Button variant="ghost" size="sm" className="h-10 shrink-0 rounded-full" onClick={() => onChange({})}>
            <X aria-hidden="true" />
            Clear all
          </Button>
        ) : null}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[min(26rem,100vw)] gap-0">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>Narrow down what’s on.</SheetDescription>
          </SheetHeader>

          <div className="grid flex-1 content-start gap-8 overflow-y-auto px-6 pt-2 pb-8">
            <Group title="When">
              {ALL_DATES.map((date) => (
                <ToggleChip key={date} pressed={filters.date === date} onPress={() => toggleValue('date', date)}>
                  {DATE_LABELS[date]}
                </ToggleChip>
              ))}
            </Group>

            <Group title="Area">
              {AREAS.map((area) => (
                <ToggleChip key={area} pressed={Boolean(filters.areas?.includes(area))} onPress={() => set({ areas: toggleInList(filters.areas, area) })}>
                  {area}
                </ToggleChip>
              ))}
            </Group>

            <Group title="Kind of event">
              {EVENT_CATEGORIES.map((category) => (
                <ToggleChip
                  key={category}
                  pressed={Boolean(filters.categories?.includes(category))}
                  onPress={() => set({ categories: toggleInList(filters.categories, category) })}
                >
                  {CATEGORY_LABELS[category]}
                </ToggleChip>
              ))}
            </Group>

            <Group title="Cost">
              {PRICES.map((price) => (
                <ToggleChip key={price.value} pressed={filters.price === price.value} onPress={() => toggleValue('price', price.value)}>
                  {price.label}
                </ToggleChip>
              ))}
            </Group>

            <Group title="Group size">
              {SIZES.map((size) => (
                <ToggleChip key={size} pressed={filters.groupSize === size} onPress={() => toggleValue('groupSize', size)}>
                  {GROUP_SIZE_LABELS[size]}
                </ToggleChip>
              ))}
            </Group>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3.5">
              <Label htmlFor="filter-women" className="text-base font-medium">
                Women-only events
              </Label>
              <Switch id="filter-women" checked={Boolean(filters.womenOnly)} onCheckedChange={(checked) => set({ womenOnly: checked ? true : undefined })} />
            </div>
          </div>

          <SheetFooter className="flex-row gap-3 border-t border-border p-4">
            <Button variant="ghost" onClick={() => onChange({})} disabled={active === 0}>
              Clear all
            </Button>
            <Button className="flex-1" onClick={() => setOpen(false)}>
              {resultCount === null ? 'Show events' : `Show ${resultCount} ${resultCount === 1 ? 'event' : 'events'}`}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}

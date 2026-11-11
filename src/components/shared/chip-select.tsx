import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'

interface Item {
  id: number
  label: string
}

interface ChipSelectProps {
  label: string
  items: Item[]
  selected: number[]
  onChange: (selected: number[]) => void
  max: number
}

/** Pick several options from a list. Each chip is a real button, so it works with a keyboard. */
export function ChipSelect({ label, items, selected, onChange, max }: ChipSelectProps) {
  const toggle = (id: number) => {
    if (selected.includes(id)) onChange(selected.filter((value) => value !== id))
    else if (selected.length < max) onChange([...selected, id])
  }

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">
        {label} <span className="font-normal text-muted-foreground">(pick up to {max})</span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const on = selected.includes(item.id)
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(item.id)}
              className={cn(
                'inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                on
                  ? 'border-primary bg-primary-soft text-primary-soft-foreground'
                  : 'border-foreground/25 hover:bg-accent',
              )}
            >
              {on ? <Check className="size-4" aria-hidden /> : null}
              {item.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

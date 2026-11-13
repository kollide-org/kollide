import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface ChoiceChipsProps<T extends string> {
  legend: string
  name: string
  options: readonly T[]
  /** One value for a single choice, a list for several. */
  value: T | readonly T[] | null
  onChange: (value: T) => void
  /** Stops further picks once this many are chosen. */
  max?: number
  describedBy?: string
}

/**
 * A set of pill-shaped choices. Each pill is a real radio button or checkbox,
 * so it works with a keyboard and a screen reader without extra wiring.
 */
export function ChoiceChips<T extends string>({ legend, name, options, value, onChange, max, describedBy }: ChoiceChipsProps<T>) {
  const multiple = Array.isArray(value)
  const selected = (option: T) => (multiple ? (value as readonly T[]).includes(option) : value === option)
  const full = multiple && max !== undefined && (value as readonly T[]).length >= max

  return (
    <fieldset aria-describedby={describedBy}>
      <legend className="sr-only">{legend}</legend>
      <div className="flex flex-wrap gap-2.5">
        {options.map((option, index) => {
          const checked = selected(option)
          return (
            <label
              key={option}
              className={cn(
                'inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-4 font-medium transition-[background-color,border-color,color,transform] duration-200 ease-out-soft select-none has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring active:scale-[0.97]',
                checked
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-card text-foreground hover:border-foreground/60',
                !checked && full && 'cursor-not-allowed opacity-45 hover:border-input',
              )}
            >
              <input
                type={multiple ? 'checkbox' : 'radio'}
                name={name}
                value={option}
                checked={checked}
                disabled={!checked && full}
                onChange={() => onChange(option)}
                className="sr-only"
                data-autofocus={index === 0 ? '' : undefined}
              />
              {checked && multiple ? <Check className="size-4" strokeWidth={2.5} aria-hidden="true" /> : null}
              {option}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

interface ChoiceCardProps {
  name: string
  value: string
  checked: boolean
  onChange: () => void
  autoFocus?: boolean
  children: ReactNode
}

/** A full-width radio option, for short lists where each choice deserves its own row. */
export function ChoiceCard({ name, value, checked, onChange, autoFocus, children }: ChoiceCardProps) {
  return (
    <label
      className={cn(
        'flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-xl border px-5 text-lead font-medium transition-[background-color,border-color,transform] duration-200 ease-out-soft select-none has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring active:scale-[0.99]',
        checked ? 'border-primary bg-primary-soft text-primary-soft-foreground' : 'border-input bg-card hover:border-foreground/60',
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="sr-only"
        data-autofocus={autoFocus ? '' : undefined}
      />
      {children}
      <span
        aria-hidden="true"
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors',
          checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
        )}
      >
        {checked ? <Check className="size-3.5" strokeWidth={3} /> : null}
      </span>
    </label>
  )
}

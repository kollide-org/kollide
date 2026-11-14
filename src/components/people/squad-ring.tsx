import { cn } from '@/lib/utils'

interface SquadRingProps {
  filled: number
  size: number
  /** A soft pulse around the ring, for a squad that is still forming. */
  pulse?: boolean
  className?: string
}

/** "3 of 6", drawn as a ring. */
export function SquadRing({ filled, size, pulse = false, className }: SquadRingProps) {
  const radius = 26
  const circumference = 2 * Math.PI * radius

  return (
    <div className={cn('relative size-16 shrink-0', className)}>
      {pulse ? <span className="absolute inset-0 animate-ring-pulse rounded-full border-2 border-highlight" /> : null}
      <svg viewBox="0 0 64 64" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="32" cy="32" r={radius} fill="none" strokeWidth="5" className="stroke-muted" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${(filled / size) * circumference} ${circumference}`}
          className="stroke-highlight"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[0.6875rem] leading-none font-semibold">
        {filled} of {size}
      </span>
    </div>
  )
}

import { cn } from '@/lib/utils'
import type { HostCapacity } from '@/services'

/**
 * How full an event is, from the host's side. The bar runs to the approval
 * limit. The part past the capacity line is the allowance for people who
 * don't turn up, so it is drawn lighter.
 */
export function CapacityMeter({ capacity, className }: { capacity: HostCapacity; className?: string }) {
  const { approved, approvalLimit, capacity: places, requested, waitlisted } = capacity
  const filled = Math.min(approved, approvalLimit) / approvalLimit
  const line = places / approvalLimit
  const left = Math.max(0, approvalLimit - approved)
  const over = approved > places

  return (
    <section
      aria-labelledby="capacity-heading"
      className={cn(
        'grid gap-5 rounded-3xl border border-border/70 bg-card p-5 shadow-card sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-10',
        className,
      )}
    >
      <div>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
          <h2 id="capacity-heading" className="text-h4">
            {approved} of {places} places taken
          </h2>
          <p className="text-sm text-muted-foreground">{left === 0 ? 'No more room to accept' : `You can accept ${left} more`}</p>
        </div>

        <div className="relative mt-5 h-3 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          {/* The allowance past capacity. */}
          <div
            className="absolute inset-y-0 right-0 bg-[repeating-linear-gradient(135deg,transparent_0_5px,color-mix(in_oklch,var(--highlight),transparent_70%)_5px_7px)]"
            style={{ left: `${line * 100}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-primary transition-transform duration-700 ease-out-soft"
            style={{ transform: `scaleX(${filled})` }}
          />
          <div className="absolute inset-y-0 w-0.5 bg-foreground/60" style={{ left: `${line * 100}%` }} />
        </div>
        <div className="relative mt-2 h-5 text-xs text-muted-foreground" aria-hidden="true">
          <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${line * 100}%` }}>
            {places}
          </span>
          <span className="absolute right-0">{approvalLimit}</span>
        </div>

        <p className="mt-2 text-sm text-muted-foreground">
          {over ? `You’re ${approved - places} over, which is fine: a few people usually don’t make it. ` : null}
          You can accept up to {approvalLimit}, 30% more than the places, because some people don’t turn up.
        </p>
      </div>

      <ul className="grid grid-cols-3 gap-3 border-t border-border pt-5 text-center lg:min-w-72 lg:border-t-0 lg:border-l lg:py-2 lg:pl-10">
        {[
          ['Going', approved],
          ['Requests', requested],
          ['Waitlist', waitlisted],
        ].map(([label, value]) => (
          <li key={label}>
            <span className="block font-display text-h3">{value}</span>
            <span className="text-sm text-muted-foreground">{label}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

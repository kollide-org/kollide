import { BadgeCheck, CalendarClock, CircleSlash, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'
import type { RefundKind } from '@/services'

type Rule = 'full' | 'credit' | 'no_show' | 'cancelled_by_kollide'

const RULES: { id: Rule; icon: ReactNode; title: string; body: string }[] = [
  {
    id: 'full',
    icon: <Wallet className="size-5" aria-hidden="true" />,
    title: 'More than 72 hours before: a full refund',
    body: 'Your money goes back to the UPI account or card you paid with. Any Kollide credit you used comes back as credit.',
  },
  {
    id: 'credit',
    icon: <CalendarClock className="size-5" aria-hidden="true" />,
    title: 'Inside 72 hours: the full amount as credit',
    body: 'Kollide credit never expires, and it is used automatically on your next paid booking.',
  },
  {
    id: 'no_show',
    icon: <CircleSlash className="size-5" aria-hidden="true" />,
    title: 'Missed without cancelling: no refund',
    body: 'Your place was held for you, and someone on the waitlist could have had it.',
  },
  {
    id: 'cancelled_by_kollide',
    icon: <BadgeCheck className="size-5" aria-hidden="true" />,
    title: 'If Kollide cancels: a full refund, automatically',
    body: 'You don’t need to ask. Everything you paid comes back to you.',
  },
]

interface RefundRulesProps {
  /** The rule that applies right now, which is drawn forward. */
  current?: RefundKind | 'none'
  className?: string
}

/** The four refund rules, as plain sentences. */
export function RefundRules({ current, className }: RefundRulesProps) {
  return (
    <ul className={cn('grid gap-3', className)}>
      {RULES.map((rule) => {
        const applies = current === rule.id
        return (
          <li
            key={rule.id}
            className={cn(
              'flex gap-4 rounded-2xl border p-4 transition-colors sm:p-5',
              applies ? 'border-primary/40 bg-primary-soft text-primary-soft-foreground' : 'border-border/70 bg-card',
            )}
          >
            <span
              className={cn(
                'inline-flex size-10 shrink-0 items-center justify-center rounded-full',
                applies ? 'bg-card text-primary' : 'bg-highlight-soft text-highlight-soft-foreground',
              )}
            >
              {rule.icon}
            </span>
            <span>
              <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-semibold">
                {rule.title}
                {applies ? (
                  <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">Applies now</span>
                ) : null}
              </span>
              <span className={cn('mt-1 block text-sm', applies ? 'text-primary-soft-foreground/90' : 'text-muted-foreground')}>
                {rule.body}
              </span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

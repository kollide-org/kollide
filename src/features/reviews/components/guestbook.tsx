import * as m from 'motion/react-m'
import { useEffect, useState } from 'react'

import { useSession } from '@/app/providers/session-context'
import { PersonAvatar } from '@/components/people/person-avatar'
import { VerifiedBadge } from '@/components/people/verified-badge'
import { AppLink } from '@/components/shared/app-link'
import { formatAgo } from '@/lib/format'
import { readJson, writeJson } from '@/lib/storage'
import type { ConnectionWithPerson } from '@/services'

const SEEN_KEY = 'kollide:guestbook-seen-at'
/** A slow, even pace, like a pen moving across the page. */
const WRITE = [0.45, 0, 0.25, 1] as const

export interface GuestbookEntry extends ConnectionWithPerson {
  eventTitles: string[]
}

/**
 * Connections, as a guestbook. A new connection is written in: both first
 * names appear left to right at a writing pace, then an underline is drawn
 * beneath. Entries you have already seen are simply there.
 */
export function Guestbook({ entries }: { entries: GuestbookEntry[] }) {
  const { session } = useSession()
  const myName = session?.profile?.firstName ?? 'You'
  const [seenAt] = useState(() => readJson<number>(SEEN_KEY, 0))
  useEffect(() => {
    writeJson(SEEN_KEY, Date.now())
  }, [])

  // New entries are written one after another, never all at once.
  const order = new Map(
    entries.filter((entry) => new Date(entry.createdAt).getTime() > seenAt).map((entry, index) => [entry.id, index] as const),
  )
  return (
    <ol className="divide-y divide-border overflow-hidden rounded-3xl border border-border/70 bg-card shadow-card">
      {entries.map((entry) => {
        const position = order.get(entry.id)
        const isNew = position !== undefined
        const delay = isNew ? 0.2 + Math.min(position, 5) * 0.55 : 0
        return (
          <li key={entry.id}>
            <AppLink
              to={`/app/people/${entry.person.userId}`}
              className="group flex items-center gap-5 px-5 py-6 transition-colors hover:bg-background/50 sm:px-8"
            >
              <div className="min-w-0 flex-1">
                <p className="relative inline-block max-w-full pb-1.5">
                  <m.span
                    className="block truncate font-display text-h3"
                    initial={isNew ? { clipPath: 'inset(0 100% 0 0)' } : false}
                    animate={{ clipPath: 'inset(0 0% 0 0)' }}
                    transition={{ duration: 1, ease: WRITE, delay }}
                  >
                    {myName} &amp; {entry.person.firstName}
                  </m.span>
                  <m.span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-px origin-left bg-primary/60"
                    initial={isNew ? { scaleX: 0 } : false}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.6, ease: WRITE, delay: delay + 0.85 }}
                  />
                </p>
                <m.p
                  className="mt-2 text-sm text-muted-foreground"
                  initial={isNew ? { opacity: 0 } : false}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, delay: delay + 1.1 }}
                >
                  {entry.eventTitles.length > 1 ? `Met at ${entry.eventTitles.length} events` : `Met at ${entry.eventTitles[0]}`} ·
                  connected {formatAgo(entry.createdAt)}
                </m.p>
              </div>
              <span className="flex shrink-0 items-center gap-1.5">
                <PersonAvatar person={entry.person} className="size-12 transition-transform duration-300 ease-out-soft group-hover:scale-105" />
                {entry.person.verified ? <VerifiedBadge /> : null}
              </span>
            </AppLink>
          </li>
        )
      })}
    </ol>
  )
}

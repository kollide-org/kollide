import * as m from 'motion/react-m'
import { useState } from 'react'

import { useSession } from '@/app/providers/session-context'
import { PersonAvatar } from '@/components/people/person-avatar'
import { VerifiedBadge } from '@/components/people/verified-badge'
import { AppLink } from '@/components/shared/app-link'
import { spring } from '@/lib/motion'
import { onceStore } from '@/lib/storage'
import { cn } from '@/lib/utils'
import type { PersonPreview } from '@/services'

const seated = onceStore('kollide:seated')
/** Place cards are set down by hand, so none sits perfectly straight. */
const TILT = [-1.6, 1.1, -0.6, 1.5, -1.2, 0.7, -0.9, 1.3]

function PlaceCard({ person, isYou, index }: { person: PersonPreview; isYou: boolean; index: number }) {
  return (
    <AppLink
      to={`/app/people/${person.userId}`}
      className={cn(
        'group relative flex flex-col items-center rounded-xl border bg-card px-3 pt-3 pb-4 text-center shadow-card transition-[box-shadow,transform] duration-300 ease-out-soft hover:-translate-y-0.5 hover:shadow-lift',
        isYou ? 'border-primary/50' : 'border-border/70',
      )}
    >
      {/* The fold of a tent card. */}
      <span className="absolute inset-x-3 top-[2.35rem] border-t border-dashed border-foreground/12" aria-hidden="true" />
      <PersonAvatar person={person} className="relative size-11 ring-4 ring-card" />
      <span className="mt-2 flex items-center justify-center gap-1 font-display text-h4 leading-tight">
        <span className="truncate">{person.firstName}</span>
        {person.verified ? <VerifiedBadge /> : null}
      </span>
      <span className={cn('eyebrow mt-1 text-[0.625rem]', isYou ? 'text-primary' : 'text-muted-foreground')}>
        {isYou ? 'Your place' : `Guest ${index + 1}`}
      </span>
    </AppLink>
  )
}

/**
 * "Who's going", as name place cards on a table. The first time you see an
 * event after you're in, the others are already seated and your card is set
 * down among them.
 */
export function PlaceCards({ eventId, people }: { eventId: string; people: PersonPreview[] }) {
  const { session } = useSession()
  const viewerId = session?.user.id
  const profile = session?.profile
  // Read once, so the moment isn't cut short when it is marked as seen.
  const [firstTime] = useState(() => !seated.seen(eventId))

  const others = people.filter((person) => person.userId !== viewerId)
  const you: PersonPreview | null =
    people.find((person) => person.userId === viewerId) ??
    (viewerId && profile
      ? { userId: viewerId, firstName: profile.firstName, photoUrl: profile.photos[0]?.url ?? null, verified: false }
      : null)
  const all = you ? [...others, you] : others

  return (
    <ul className="grid grid-cols-2 gap-3 xs:grid-cols-3 sm:grid-cols-4">
      {all.map((person, index) => {
        const isYou = person.userId === viewerId
        const tilt = TILT[index % TILT.length]
        return (
          <m.li
            key={person.userId}
            className="relative"
            initial={
              isYou && firstTime
                ? { opacity: 0, y: -40, rotate: tilt - 9, scale: 1.06 }
                : { opacity: 0, y: 10, rotate: tilt }
            }
            whileInView={{ opacity: 1, y: 0, rotate: tilt, scale: 1 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={
              isYou && firstTime
                ? { ...spring.soft, bounce: 0.32, visualDuration: 0.5, delay: 0.35 + others.length * 0.05 }
                : { ...spring.gentle, delay: index * 0.05 }
            }
            onAnimationComplete={isYou && firstTime ? () => seated.markSeen(eventId) : undefined}
          >
            {isYou && firstTime ? (
              // The shadow of the card landing on the table.
              <m.span
                aria-hidden="true"
                className="absolute inset-x-4 -bottom-1 h-4 rounded-full bg-brand-ink/25 blur-md"
                initial={{ opacity: 0, scale: 0.5 }}
                whileInView={{ opacity: [0, 0.6, 0.25], scale: [0.5, 1.1, 1] }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.8, delay: 0.45 + others.length * 0.05 }}
              />
            ) : null}
            <PlaceCard person={person} isYou={isYou} index={index} />
          </m.li>
        )
      })}
    </ul>
  )
}

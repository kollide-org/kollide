import { MailOpen } from 'lucide-react'
import * as m from 'motion/react-m'
import { useState, type ReactNode } from 'react'

import { onceStore } from '@/lib/storage'

const revealed = onceStore('kollide:address-revealed')

interface InvitationRevealProps {
  eventId: string
  eventTitle: string
  /** The address, on the back of the card. */
  children: ReactNode
}

/**
 * The address is private until you're in. The first time you see it, it
 * arrives as an invitation card that turns over to show the address on the
 * back. Every visit after that, the address is simply there.
 */
export function InvitationReveal({ eventId, eventTitle, children }: InvitationRevealProps) {
  // Read once, so the card doesn't vanish the moment it is marked as seen.
  const [firstTime] = useState(() => !revealed.seen(eventId))

  if (!firstTime) return <>{children}</>

  return (
    <div className="[perspective:1400px]">
      <m.div
        className="grid [transform-style:preserve-3d] [&>*]:[grid-area:1/1]"
        initial={{ rotateY: 0 }}
        // It turns over once the card is properly on screen, not while it is still below the fold.
        whileInView={{ rotateY: 180 }}
        viewport={{ once: true, amount: 0.7 }}
        transition={{ type: 'spring', visualDuration: 0.9, bounce: 0.18, delay: 0.55 }}
        onAnimationComplete={() => revealed.markSeen(eventId)}
      >
        {/* The front: an invitation. */}
        <div
          className="flex flex-col items-center justify-center rounded-2xl bg-primary p-1.5 text-primary-foreground [backface-visibility:hidden]"
          aria-hidden="true"
        >
          <div className="flex size-full flex-col items-center justify-center rounded-xl border border-primary-foreground/35 px-6 py-5 text-center">
            <p className="eyebrow opacity-85">You’re invited</p>
            <p className="mt-2 font-display text-h4 text-balance">{eventTitle}</p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm opacity-85">
              <MailOpen className="size-4" aria-hidden="true" />
              The address is inside
            </p>
          </div>
        </div>
        {/* The back: the address itself. */}
        <div className="[transform:rotateY(180deg)] [backface-visibility:hidden]">{children}</div>
      </m.div>
    </div>
  )
}

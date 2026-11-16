import { X } from 'lucide-react'
import * as m from 'motion/react-m'
import type { ReactNode } from 'react'

import { ErrorState } from '@/components/shared/error-state'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ProfileCard } from '@/features/profile/components/profile-card'
import { useProfileCard } from '@/features/profile/queries'
import { spring } from '@/lib/motion'
import { useMotionAllowed } from '@/lib/use-media-query'

interface ProfileDialogProps {
  userId: string | null
  firstName: string
  onOpenChange: (open: boolean) => void
  /** Buttons that sit under the card, such as approve and decline. */
  actions?: ReactNode
}

/** A person's full profile card, opened over the page. */
export function ProfileDialog({ userId, firstName, onOpenChange, actions }: ProfileDialogProps) {
  const card = useProfileCard(userId ?? '', Boolean(userId))
  const motionAllowed = useMotionAllowed()

  return (
    <Dialog open={Boolean(userId)} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-h-[92dvh] gap-0 overflow-y-auto p-2.5 sm:max-w-md">
        <DialogClose asChild>
          <Button
            variant="secondary"
            size="icon-sm"
            className="absolute top-5 right-5 z-10 rounded-full bg-card/85 shadow-card backdrop-blur-md"
          >
            <X aria-hidden="true" />
            <span className="sr-only">Close</span>
          </Button>
        </DialogClose>
        <DialogTitle className="sr-only">{firstName}’s profile</DialogTitle>
        <DialogDescription className="sr-only">
          Their photos, prompts, interests and how often they turn up.
        </DialogDescription>
        <m.div
          initial={motionAllowed ? { opacity: 0, scale: 0.96, y: 12 } : { opacity: 0 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={spring.gentle}
        >
          {card.isPending ? (
            <div role="status" aria-label={`Loading ${firstName}’s profile`} className="grid gap-4">
              <Skeleton className="aspect-[4/5] w-full rounded-2xl" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-20 w-full rounded-2xl" />
            </div>
          ) : card.isError ? (
            <ErrorState onRetry={() => void card.refetch()} />
          ) : (
            <div className="[&>article]:border-0 [&>article]:shadow-none">
              <ProfileCard card={card.data} />
            </div>
          )}
        </m.div>
        {actions ? (
          <div className="sticky -bottom-2.5 -mx-2.5 mt-2 flex items-center gap-2 border-t border-border bg-popover/95 px-4 pt-4 pb-4 backdrop-blur-xl">
            {actions}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

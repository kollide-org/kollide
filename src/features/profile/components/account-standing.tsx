import { Clock, PauseCircle, ShieldOff } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { useMyAppeals } from '@/features/profile/queries'
import type { AccountStatus } from '@/services'

import { AppealDialog } from './appeal-dialog'

const COPY = {
  on_hold: {
    icon: PauseCircle,
    title: 'Your account is on hold',
    body: 'Our safety team is looking into a report. Until they finish, you can’t send new requests, but plans you already have stay as they are.',
  },
  suspended: {
    icon: ShieldOff,
    title: 'Your account is suspended',
    body: 'You can still sign in and see your account, but you can’t book, request or join anything for now. We’ve sent you the reason.',
  },
} as const

/**
 * Shown while an account is on hold or suspended, with a way to tell us your
 * side. Renders nothing for an account in good standing.
 */
export function AccountStanding({ status }: { status: AccountStatus }) {
  const appeals = useMyAppeals(status === 'on_hold' || status === 'suspended')
  const [appealing, setAppealing] = useState(false)
  if (status !== 'on_hold' && status !== 'suspended') return null

  const { icon: Icon, title, body } = COPY[status]
  const pending = appeals.data?.find((appeal) => appeal.about === 'suspension' && appeal.reference === status && appeal.status === 'under_review')

  return (
    <section className="rounded-2xl border border-warning/50 bg-warning-soft p-6 text-warning-strong">
      <h2 className="flex items-center gap-2 font-sans text-base font-semibold">
        <Icon className="size-5" aria-hidden="true" />
        {title}
      </h2>
      <p className="mt-2">{body}</p>
      {pending ? (
        <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-sm font-semibold text-foreground">
          <Clock className="size-4" aria-hidden="true" />
          Your appeal is under review
        </p>
      ) : (
        <Button variant="outline" className="mt-4 border-warning-strong/40 text-warning-strong" onClick={() => setAppealing(true)}>
          Tell us your side
        </Button>
      )}
      {appealing ? <AppealDialog about="suspension" reference={status} open onOpenChange={setAppealing} /> : null}
    </section>
  )
}

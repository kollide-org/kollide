import { PersonAvatar } from '@/components/people/person-avatar'
import { VerifiedBadge } from '@/components/people/verified-badge'
import { AppLink } from '@/components/shared/app-link'
import { percent } from '@/lib/format'
import type { HostSummary } from '@/services'

const QUESTIONS = [
  { key: 'asDescribed', label: 'Event as described' },
  { key: 'feltSafe', label: 'Felt safe' },
  { key: 'wellOrganised', label: 'Well organised' },
] as const

/**
 * The host, with how past guests rated their events. Hosts are rated on three
 * yes-or-no questions, never with stars.
 */
export function HostCard({ host, profileHref }: { host: HostSummary; profileHref?: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-card">
      <div className="flex items-center gap-4">
        <PersonAvatar person={host} className="size-16" />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-display text-h4">
            {profileHref ? (
              <AppLink to={profileHref} className="rounded-sm underline-offset-4 hover:underline">
                {host.firstName}
              </AppLink>
            ) : (
              host.firstName
            )}
            {host.verified ? <VerifiedBadge className="text-base" /> : null}
          </p>
          <p className="text-sm text-muted-foreground">
            {host.eventsHosted} {host.eventsHosted === 1 ? 'event' : 'events'} hosted
          </p>
        </div>
      </div>

      {host.rating ? (
        <>
          <ul className="mt-6 grid gap-4">
            {QUESTIONS.map((question) => {
              const share = host.rating![question.key]
              return (
                <li key={question.key}>
                  <p className="flex items-baseline justify-between gap-3">
                    <span>{question.label}</span>
                    <span className="font-semibold tabular-nums">{percent(share)}</span>
                  </p>
                  <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full origin-left rounded-full bg-highlight" style={{ transform: `scaleX(${share})` }} />
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">
            From {host.rating.ratings} {host.rating.ratings === 1 ? 'guest' : 'guests'} who checked in.
          </p>
        </>
      ) : (
        <p className="mt-5 text-muted-foreground">This is one of {host.firstName}’s first events on Kollide, so there are no ratings yet.</p>
      )}
    </div>
  )
}

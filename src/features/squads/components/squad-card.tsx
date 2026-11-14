import { MapPin } from 'lucide-react'

import { AvatarStack } from '@/components/people/avatar-stack'
import { SquadRing } from '@/components/people/squad-ring'
import { AppLink } from '@/components/shared/app-link'
import { Badge } from '@/components/ui/badge'
import { formatDay } from '@/lib/format'
import type { SquadWithMembers } from '@/services'

/** A squad that still has room: who is in it, what it is for, and where it meets. */
export function SquadCard({ squad }: { squad: SquadWithMembers }) {
  return (
    <article className="group relative flex h-full flex-col gap-5 rounded-2xl border border-border/70 bg-card p-5 shadow-card transition-[transform,box-shadow] duration-500 ease-out-soft focus-within:shadow-lift hover:-translate-y-1 hover:shadow-lift">
      <div className="flex items-center gap-4">
        <SquadRing filled={squad.members.length} size={squad.size} pulse className="[&>span:last-child]:text-xs" />
        <div className="min-w-0">
          <h3 className="truncate text-h4">
            <AppLink
              to="/app/squads"
              className="outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
            >
              {squad.name}
            </AppLink>
          </h3>
          <p className="truncate text-sm text-muted-foreground">
            {squad.event.title} · {formatDay(squad.event.startsAt)}
          </p>
        </div>
      </div>

      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        Meet {squad.meetingPoint.minutesBefore} min before at {squad.meetingPoint.place}
      </p>

      <div className="mt-auto flex items-center justify-between gap-3">
        <AvatarStack people={squad.members} max={5} />
        <div className="flex flex-wrap justify-end gap-2">
          {squad.womenOnly ? (
            <Badge variant="outline" size="sm">
              Women only
            </Badge>
          ) : null}
          {squad.viewerStatus === 'approved' ? (
            <Badge variant="success" size="sm">
              You’re in
            </Badge>
          ) : squad.viewerStatus === 'requested' ? (
            <Badge variant="soft" size="sm">
              Request sent
            </Badge>
          ) : (
            <Badge variant="highlight-soft" size="sm">
              {squad.spotsLeft} {squad.spotsLeft === 1 ? 'place' : 'places'} left
            </Badge>
          )}
        </div>
      </div>
    </article>
  )
}

import { ArrowUpRight, Handshake, Sparkles } from 'lucide-react'
import * as m from 'motion/react-m'

import { useSession } from '@/app/providers/session-context'
import { AvatarStack } from '@/components/people/avatar-stack'
import { PersonAvatar } from '@/components/people/person-avatar'
import { VerifiedBadge } from '@/components/people/verified-badge'
import { AppLink } from '@/components/shared/app-link'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useConnections, useRepeatSuggestions } from '@/features/reviews/queries'
import { formatAgo } from '@/lib/format'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { hasRole } from '@/services/types/role'
import type { ConnectionWithPerson, RepeatSuggestion } from '@/services'

/** Three or more people who all said yes to each other: a nudge, never a group chat. */
function Repeat({ suggestion, isHost }: { suggestion: RepeatSuggestion; isHost: boolean }) {
  const names = suggestion.people.map((person) => person.firstName)
  const listed = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0]
  return (
    <section
      aria-labelledby={`repeat-${suggestion.eventId}`}
      className="relative overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground shadow-lift sm:p-8"
    >
      <span className="absolute -top-20 -right-16 size-64 rounded-full bg-highlight/50 mix-blend-soft-light" aria-hidden="true" />
      <div className="relative grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div>
          <p className="eyebrow flex items-center gap-2 opacity-85">
            <Sparkles className="size-4" aria-hidden="true" />
            Worth doing again
          </p>
          <h2 id={`repeat-${suggestion.eventId}`} className="mt-3 text-h2">
            You, {listed} all said yes.
          </h2>
          <p className="mt-2 max-w-xl opacity-90">
            After {suggestion.eventTitle}, every one of you wanted to meet the others again. That doesn’t happen often.
          </p>
          <AvatarStack people={suggestion.people} max={5} className="mt-5" />
        </div>
        <div className="grid gap-2 sm:min-w-52">
          {isHost ? (
            <Button asChild size="lg" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90">
              <AppLink to="/app/host/new">Host a repeat</AppLink>
            </Button>
          ) : (
            <Button asChild size="lg" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90">
              <AppLink to="/app">Find the next one</AppLink>
            </Button>
          )}
          <p className="text-sm opacity-85">
            {isHost ? 'They’ll see it in the feed like any event.' : 'Start a squad for it, and they’ll see it under Squads forming.'}
          </p>
        </div>
      </div>
    </section>
  )
}

/** "Meet again": people who said yes to each other after an event. There are no messages here, by design. */
export function Component() {
  const { role } = useSession()
  const connections = useConnections()
  const repeats = useRepeatSuggestions()
  // Two people can connect at more than one event. Each person is listed once, newest first.
  const byPerson = new Map<string, ConnectionWithPerson[]>()
  for (const connection of connections.data ?? []) {
    byPerson.set(connection.person.userId, [...(byPerson.get(connection.person.userId) ?? []), connection])
  }
  const people = [...byPerson.values()].map((group) => ({
    ...group[0],
    eventTitles: [...new Set(group.map((connection) => connection.eventTitle))],
  }))

  return (
    <>
      <title>Connections · Kollide</title>
      <PageHeader
        eyebrow="Connections"
        title="People worth seeing again."
        description="When you and someone you met both say yes after an event, they appear here. Look out for each other at the next one."
      />

      <div className="mt-12 grid gap-12">
        {repeats.data?.map((suggestion) => (
          <Repeat key={suggestion.eventId} suggestion={suggestion} isHost={hasRole(role, 'host')} />
        ))}

        <section aria-labelledby="connections-heading">
          <h2 id="connections-heading" className="text-h3">
            Your connections
          </h2>
          <div className="mt-5">
            {connections.isPending ? (
              <div role="status" aria-label="Loading your connections" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2].map((index) => (
                  <Skeleton key={index} className="h-24 rounded-3xl" />
                ))}
              </div>
            ) : connections.isError ? (
              <ErrorState onRetry={() => void connections.refetch()} />
            ) : people.length === 0 ? (
              <EmptyState
                icon={Handshake}
                title="No connections yet"
                description="After an event, say yes to the people you’d like to see again. If they say yes too, they’ll appear here."
                action={
                  <AppLink to="/app" className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline">
                    Find an event
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                  </AppLink>
                }
              />
            ) : (
              <m.ul variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {people.map((connection) => (
                  <m.li key={connection.id} variants={staggerItem}>
                    <AppLink
                      to={`/app/people/${connection.person.userId}`}
                      className="flex items-center gap-4 rounded-3xl border border-border/70 bg-card p-4 shadow-card transition-[transform,box-shadow] duration-300 ease-out-soft hover:-translate-y-0.5 hover:shadow-lift"
                    >
                      <PersonAvatar person={connection.person} className="size-16" />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-h4">
                          <span className="truncate">{connection.person.firstName}</span>
                          {connection.person.verified ? <VerifiedBadge /> : null}
                        </span>
                        <span className="block truncate text-sm text-muted-foreground">
                          {connection.eventTitles.length > 1
                            ? `Met at ${connection.eventTitles.length} events`
                            : `Met at ${connection.eventTitles[0]}`}
                        </span>
                        <span className="block text-sm text-muted-foreground">Connected {formatAgo(connection.createdAt)}</span>
                      </span>
                    </AppLink>
                  </m.li>
                ))}
              </m.ul>
            )}
          </div>
        </section>
      </div>
    </>
  )
}

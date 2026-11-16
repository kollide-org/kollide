import { UsersRound } from 'lucide-react'
import * as m from 'motion/react-m'
import { useSearchParams } from 'react-router'

import { AppLink } from '@/components/shared/app-link'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { SquadCard } from '@/features/squads/components/squad-card'
import { useMySquads, useSquadsForming } from '@/features/squads/queries'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { cn } from '@/lib/utils'
import type { SquadWithMembers } from '@/services'

function SquadGrid({ squads, label }: { squads: SquadWithMembers[]; label: string }) {
  return (
    <m.ul
      aria-label={label}
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      {squads.map((squad) => (
        <m.li key={squad.id} variants={staggerItem}>
          <SquadCard squad={squad} />
        </m.li>
      ))}
    </m.ul>
  )
}

function GridSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} className="h-52 rounded-2xl" />
      ))}
    </div>
  )
}

/** The member's squads, then squads with room for one more. */
export function Component() {
  const [params, setParams] = useSearchParams()
  const womenOnly = params.get('women') === '1'
  const mine = useMySquads()
  const forming = useSquadsForming()

  const mineIds = new Set(mine.data?.map((squad) => squad.id))
  const open = (forming.data ?? []).filter((squad) => !mineIds.has(squad.id) && (!womenOnly || squad.womenOnly))

  const toggleWomenOnly = () =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (womenOnly) next.delete('women')
        else next.set('women', '1')
        return next
      },
      { replace: true, preventScrollReset: true },
    )

  return (
    <>
      <title>Squads · Kollide</title>
      <PageHeader
        eyebrow="Squads"
        title="Walk in together."
        description="Four to six people going to the same event, who meet somewhere public nearby first. Whoever starts a squad approves each person who asks."
      />

      <section aria-labelledby="mine-heading" className="mt-14">
        <h2 id="mine-heading" className="text-h3">
          Your squads
        </h2>
        <div className="mt-5">
          {mine.isPending ? (
            <GridSkeleton label="Loading your squads" />
          ) : mine.isError ? (
            <ErrorState onRetry={() => void mine.refetch()} />
          ) : mine.data.length === 0 ? (
            <EmptyState
              icon={UsersRound}
              title="You’re not in a squad yet"
              description="Ask to join one below, or open an event you’re going to and start your own."
            />
          ) : (
            <SquadGrid squads={mine.data} label="Your squads" />
          )}
        </div>
      </section>

      <section aria-labelledby="forming-heading" className="mt-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="forming-heading" className="text-h3">
            Squads forming
          </h2>
          <button
            type="button"
            aria-pressed={womenOnly}
            onClick={toggleWomenOnly}
            className={cn(
              'inline-flex min-h-11 items-center rounded-full border px-4 font-medium transition-colors',
              womenOnly
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-card text-foreground hover:border-foreground/60',
            )}
          >
            Women only
          </button>
        </div>
        <div className="mt-5">
          {forming.isPending ? (
            <GridSkeleton label="Loading squads forming" />
          ) : forming.isError ? (
            <ErrorState onRetry={() => void forming.refetch()} />
          ) : open.length === 0 ? (
            <EmptyState
              icon={UsersRound}
              title={womenOnly ? 'No women-only squads are forming' : 'No other squads are forming right now'}
              description="Squads appear as people start them. Starting one for an event you’re going to takes a minute."
              action={
                <AppLink to="/app" className="font-semibold text-primary underline-offset-4 hover:underline">
                  Find an event
                </AppLink>
              }
            />
          ) : (
            <SquadGrid squads={open} label="Squads forming" />
          )}
        </div>
      </section>
    </>
  )
}

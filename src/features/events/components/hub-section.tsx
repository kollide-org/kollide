import { ArrowRight } from 'lucide-react'
import type { CSSProperties } from 'react'

import { AppLink } from '@/components/shared/app-link'
import type { HubWithEvents } from '@/services'

import { EventCard } from './event-card'

/**
 * A seasonal hub. It takes any theme: a title, artwork, an accent colour and
 * a list of events. Nothing in here knows what the season is.
 */
export function HubSection({ hub, seeAllHref }: { hub: HubWithEvents; seeAllHref: string }) {
  const accent = { '--hub-accent': hub.accentColor, '--hub-accent-foreground': hub.accentForeground } as CSSProperties
  const count = hub.events.length

  return (
    <section
      style={accent}
      aria-labelledby={`hub-${hub.id}`}
      className="relative isolate overflow-hidden rounded-[2rem] bg-brand-ink text-brand-antique shadow-lift"
    >
      <img src={hub.artworkUrl} alt="" fetchPriority="high" decoding="async" className="absolute inset-0 -z-10 size-full object-cover opacity-75" />
      <div className="absolute inset-0 -z-10 bg-linear-to-t from-brand-ink via-brand-ink/70 to-brand-ink/10" />

      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6 px-6 pt-8 sm:px-10 sm:pt-12">
        <div>
          <p className="inline-flex h-7 items-center rounded-full bg-hub-accent px-3 text-sm font-semibold text-hub-accent-foreground">
            In season
          </p>
          <h2 id={`hub-${hub.id}`} className="mt-5 max-w-2xl text-h1">
            {hub.title}
          </h2>
          <p className="mt-3 max-w-xl text-lead text-brand-antique/85">{hub.subtitle}</p>
        </div>
        <AppLink
          to={seeAllHref}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-hub-accent px-5 font-medium text-hub-accent-foreground transition-transform duration-200 ease-out-soft hover:-translate-y-0.5 focus-visible:outline-brand-antique active:scale-[0.98]"
        >
          See all {count} {count === 1 ? 'event' : 'events'}
          <ArrowRight className="size-4.5" aria-hidden="true" />
        </AppLink>
      </div>

      {/* Focusable, so the row can be scrolled with the arrow keys. */}
      <div
        role="region"
        aria-label={`Events in ${hub.title}`}
        tabIndex={0}
        className="mt-8 snap-x scroll-px-6 overflow-x-auto px-6 pb-8 [scrollbar-width:none] focus-visible:outline-offset-[-4px] focus-visible:outline-brand-antique sm:scroll-px-10 sm:px-10 sm:pb-10"
      >
        <ul className="flex w-max gap-4">
          {hub.events.map((event, index) => (
            <li key={event.id} className="w-[76vw] max-w-[17rem] shrink-0 snap-start text-foreground">
              <EventCard event={event} priority={index < 2} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

import { BadgeCheck } from 'lucide-react'
import { useInView } from 'motion/react'
import * as m from 'motion/react-m'
import { useRef, type ReactNode } from 'react'

import { Stagger, StaggerItem } from '@/components/motion/stagger'
import { spring } from '@/lib/motion'
import { useCountUp } from '@/lib/use-count-up'
import { cn } from '@/lib/utils'
import { POSITIVE_TAGS } from '@/services/types/review'

import { SquadRing } from '@/components/people/squad-ring'

const avatar = (id: string) => `/assets/avatars/${id}-1.svg`

function Tile({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <StaggerItem className={cn('relative flex min-h-80 flex-col overflow-hidden rounded-3xl p-7 sm:p-9', className)}>
      {children}
    </StaggerItem>
  )
}

function TileText({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('mt-auto pt-8', className)}>
      <h3 className="text-h3">{title}</h3>
      <p className="mt-2 max-w-md opacity-85">{children}</p>
    </div>
  )
}

function ReliabilityFigure() {
  const ref = useRef<HTMLParagraphElement>(null)
  const inView = useInView(ref, { once: true, margin: '-15% 0px' })
  const showedUp = useCountUp(11, inView)

  return (
    <p ref={ref} className="font-display text-display leading-none">
      <span className="sr-only">11 of 12</span>
      <span aria-hidden="true">
        <span className="tabular-nums">{showedUp}</span>
        <span className="text-h2 opacity-80"> of 12</span>
      </span>
    </p>
  )
}

/** What makes Kollide different: the people around the event, not the listings. */
export function Difference() {
  return (
    <section className="container-page py-24 md:py-36">
      <p className="eyebrow text-primary">The people around the event</p>
      <h2 className="mt-4 max-w-3xl text-h2 md:text-h1">Anyone can list an event. We vouch for who’s coming.</h2>

      <Stagger inView className="mt-12 grid gap-5 lg:grid-cols-12">
        <Tile className="border border-border/70 bg-card shadow-card lg:col-span-7">
          <div aria-hidden="true" className="flex items-center gap-4">
            <div className="flex -space-x-4">
              {['u02', 'u19', 'u18'].map((id) => (
                <img key={id} src={avatar(id)} alt="" loading="lazy" className="size-16 rounded-full ring-4 ring-card sm:size-20" />
              ))}
            </div>
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground">
              <BadgeCheck className="size-4.5" />
              Verified
            </span>
          </div>
          <blockquote
            aria-hidden="true"
            className="absolute top-9 right-9 hidden w-64 rotate-2 rounded-2xl bg-background p-5 shadow-card xl:block"
          >
            <p className="text-sm text-muted-foreground">Ask me about…</p>
            <p className="mt-1 font-display text-lead leading-snug">The year I tried every biryani in Frazer Town and kept a spreadsheet.</p>
          </blockquote>
          <TileText title="Real people, checked">
            Every member builds a profile with photos, prompts and interests. A selfie check earns the verified badge,
            so hosts know who is asking before they say yes.
          </TileText>
        </Tile>

        <Tile className="bg-primary text-primary-foreground lg:col-span-5">
          <p className="eyebrow">Shows up</p>
          <div className="mt-3">
            <ReliabilityFigure />
          </div>
          <TileText title="A score nobody can edit">
            Reliability is counted from check-ins at the door. It rewards the people who turn up when they said they would.
          </TileText>
        </Tile>

        <Tile className="bg-highlight-soft text-highlight-soft-foreground lg:col-span-5">
          <ul aria-label="The tags members can give each other" className="flex flex-wrap gap-2">
            {POSITIVE_TAGS.map((tag) => (
              <li key={tag} className="inline-flex h-9 items-center rounded-full bg-card px-4 text-sm font-semibold text-card-foreground shadow-card">
                {tag}
              </li>
            ))}
          </ul>
          <TileText title="Kind by design">
            Praise is public, as simple tags. Anything else stays private, and only counts once several people across
            different events have said the same thing.
          </TileText>
        </Tile>

        <Tile className="border border-border/70 bg-card shadow-card lg:col-span-7">
          <div aria-hidden="true" className="flex items-center gap-5">
            <SquadRing filled={4} size={6} pulse className="size-20 [&>span:last-child]:text-sm" />
            <div className="flex -space-x-3.5">
              {['u06', 'u28', 'u17', 'u25'].map((id, index) => (
                <m.img
                  key={id}
                  src={avatar(id)}
                  alt=""
                  loading="lazy"
                  className="size-14 rounded-full ring-4 ring-card sm:size-16"
                  initial={{ opacity: 0, x: 26 * (index + 1) }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-15% 0px' }}
                  transition={{ ...spring.gentle, delay: 0.15 + index * 0.08 }}
                />
              ))}
            </div>
          </div>
          <TileText title="A squad, then a circle">
            Go as a group of four to six. Afterwards, tell us who you’d like to see again. When it’s mutual, you’re
            connected, and three or more is a reason to plan the next one.
          </TileText>
        </Tile>
      </Stagger>
    </section>
  )
}

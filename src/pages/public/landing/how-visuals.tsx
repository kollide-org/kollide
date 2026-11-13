import { BadgeCheck, Check, MapPin } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { SquadRing } from './squad-ring'

/**
 * Four small product scenes, one for each step of "How it works".
 * They are illustrations built from the real interface pieces, with fixed
 * example content. They are decorative: the step text carries the meaning.
 */

const avatar = (id: string) => `/assets/avatars/${id}-1.svg`
const cover = (slug: string) => `/assets/covers/${slug}.svg`

function Frame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-[1.75rem] border border-border/70 bg-card p-5 text-card-foreground shadow-overlay sm:p-6', className)}>
      {children}
    </div>
  )
}

function Chip({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex h-8 items-center rounded-full px-3.5 text-sm font-medium',
        active ? 'bg-primary text-primary-foreground' : 'border border-foreground/20 text-foreground',
      )}
    >
      {children}
    </span>
  )
}

const FEED = [
  { slug: 'board-games-and-filter-coffee', title: 'Board games and filter coffee', meta: 'Sat · Indiranagar', price: 'Pay at venue' },
  { slug: 'cubbon-park-walk-and-breakfast', title: 'Cubbon Park walk and breakfast', meta: 'Sun · Cubbon Park', price: 'Free' },
  { slug: 'supper-club-coastal-karnataka', title: 'Supper club: coastal Karnataka', meta: 'Fri · Indiranagar', price: '₹1,800' },
]

export function FindScene() {
  return (
    <Frame>
      <p className="font-display text-h4">This week in Bengaluru</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Chip active>This week</Chip>
        <Chip>Free</Chip>
        <Chip>Women only</Chip>
      </div>
      <ul className="mt-5 grid gap-3">
        {FEED.map((event) => (
          <li key={event.slug} className="flex items-center gap-3.5 rounded-2xl bg-background/70 p-2.5">
            <img src={cover(event.slug)} alt="" loading="lazy" className="size-16 shrink-0 rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{event.title}</p>
              <p className="text-sm text-muted-foreground">{event.meta}</p>
            </div>
            <span className="hidden shrink-0 text-sm font-medium text-muted-foreground sm:block">{event.price}</span>
          </li>
        ))}
      </ul>
    </Frame>
  )
}

export function AskScene() {
  return (
    <Frame>
      <div className="flex items-center gap-4">
        <img src={avatar('u02')} alt="" loading="lazy" className="size-16 rounded-full" />
        <div>
          <p className="flex items-center gap-1.5 font-display text-h4">
            Ananya, 29
            <BadgeCheck className="size-5 text-primary" />
          </p>
          <p className="text-sm text-muted-foreground">Indiranagar</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="inline-flex h-7 items-center rounded-full bg-highlight px-3 text-sm font-semibold text-highlight-foreground">
          Shows up: 11 of 12
        </span>
        <span className="inline-flex h-7 items-center rounded-full bg-secondary px-3 text-sm font-medium">Welcoming</span>
        <span className="inline-flex h-7 items-center rounded-full bg-secondary px-3 text-sm font-medium">Good listener</span>
      </div>
      <blockquote className="mt-5 border-l-2 border-highlight pl-3.5">
        <p className="text-sm text-muted-foreground">A perfect Sunday is…</p>
        <p className="mt-0.5">Filter coffee, a slow walk through Cubbon Park, and no plans after 4 pm.</p>
      </blockquote>
      <div className="mt-6 grid grid-cols-[1fr_1fr_1.4fr] gap-2">
        <span className="flex h-11 items-center justify-center rounded-xl border border-foreground/20 text-sm font-medium">Waitlist</span>
        <span className="flex h-11 items-center justify-center rounded-xl border border-foreground/20 text-sm font-medium">Decline</span>
        <span className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
          <Check className="size-4" strokeWidth={2.5} />
          Accept
        </span>
      </div>
    </Frame>
  )
}

export function SquadScene() {
  return (
    <Frame className="text-center">
      <SquadRing filled={4} size={6} pulse className="mx-auto size-32 [&>span:last-child]:text-lead" />
      <p className="mt-5 font-display text-h4">Midnight on the roof</p>
      <p className="text-sm text-muted-foreground">Squad for the rooftop countdown</p>
      <div className="mt-5 flex justify-center -space-x-2.5">
        {['u06', 'u28', 'u02', 'u19'].map((id) => (
          <img key={id} src={avatar(id)} alt="" loading="lazy" className="size-11 rounded-full ring-[3px] ring-card" />
        ))}
        {[0, 1].map((slot) => (
          <span key={slot} className="size-11 rounded-full border-2 border-dashed border-foreground/25 bg-card ring-[3px] ring-card" />
        ))}
      </div>
      <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-background/70 px-4 py-2.5 text-sm">
        <MapPin className="size-4 text-primary" />
        Meet 30 min before at Koshy’s
      </p>
    </Frame>
  )
}

export function MeetAgainScene() {
  return (
    <Frame className="text-center">
      <div className="relative mx-auto flex w-fit items-center">
        <img src={avatar('u02')} alt="" loading="lazy" className="size-24 rounded-full ring-4 ring-card" />
        <img src={avatar('u19')} alt="" loading="lazy" className="-ml-7 size-24 rounded-full ring-4 ring-card" />
        <span className="absolute -bottom-1 left-1/2 inline-flex size-9 -translate-x-1/2 items-center justify-center rounded-full bg-success text-on-status ring-4 ring-card">
          <Check className="size-4.5" strokeWidth={3} />
        </span>
      </div>
      <p className="mt-6 font-display text-h4">You and Lakshmi both said yes</p>
      <p className="text-sm text-muted-foreground">You’re connected. Go to something together.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {['Great conversation', 'Welcoming', 'Good listener'].map((tag) => (
          <span key={tag} className="inline-flex h-7 items-center rounded-full bg-secondary px-3 text-sm font-medium">
            {tag}
          </span>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl bg-primary-soft p-3 pl-4 text-left text-primary-soft-foreground">
        <p className="text-sm font-medium">Three of you want a repeat.</p>
        <span className="inline-flex h-9 shrink-0 items-center rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground">
          Plan it
        </span>
      </div>
    </Frame>
  )
}

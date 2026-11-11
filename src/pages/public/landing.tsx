import { ArrowRight, BadgeCheck, MapPin, ShieldCheck, UsersRound } from 'lucide-react'
import * as m from 'motion/react-m'
import type { CSSProperties } from 'react'

import { AppLink } from '@/components/shared/app-link'
import { Stagger, StaggerItem } from '@/components/motion/stagger'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { spring } from '@/lib/motion'

const PILLARS = [
  {
    icon: BadgeCheck,
    title: 'People you can check',
    body: 'Every profile shows a verified badge and how often that person turns up. Hosts see who is asking before they say yes.',
  },
  {
    icon: UsersRound,
    title: 'Go as a small squad',
    body: 'Join four to six people heading to the same event. Meet at a café half an hour before, then walk in together.',
  },
  {
    icon: ShieldCheck,
    title: 'Built to feel safe',
    body: 'Women-only events and squads, addresses shared only after approval, and a report option on every profile and event.',
  },
]

/** Sets the position of an element in a CSS `rise-in` sequence. */
const stagger = (index: number) => ({ '--i': index }) as CSSProperties

const meet = { type: 'spring', visualDuration: 0.9, bounce: 0.12 } as const

/**
 * The foundation version of the landing page. It proves the theme, type and
 * motion. The hero video, scroll moments and event preview arrive in milestone 3.
 */
export function Component() {
  return (
    <>
      <title>Kollide · Social events in Bengaluru</title>

      <section className="grain relative -mt-16 overflow-hidden pt-16 md:-mt-20 md:pt-20">
        <div className="container-page grid items-center gap-12 pt-12 pb-20 md:pt-20 md:pb-28 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
          <div>
            <Badge variant="highlight-soft" className="rise-in" style={stagger(0)}>
              <MapPin aria-hidden="true" />
              Bengaluru
            </Badge>
            <h1 className="rise-in mt-6 text-display" style={stagger(1)}>
              Never walk in <span className="text-primary">alone.</span>
            </h1>
            <p className="rise-in mt-6 max-w-xl text-lead text-muted-foreground" style={stagger(2)}>
              Kollide is where Bengaluru goes out together. Find an event, join a small squad of verified people, and
              turn one good evening into a regular thing.
            </p>
            <div className="rise-in mt-9 flex flex-wrap items-center gap-x-6 gap-y-3" style={stagger(3)}>
              <Button asChild size="lg">
                <AppLink to="/sign-in">
                  Join Kollide
                  <ArrowRight aria-hidden="true" />
                </AppLink>
              </Button>
              <Button asChild variant="link">
                <AppLink to="/how-it-works">See how it works</AppLink>
              </Button>
            </div>
            <p className="rise-in mt-8 text-sm text-muted-foreground" style={stagger(4)}>
              Not a dating app. For people aged 18 and over.
            </p>
          </div>

          <div aria-hidden="true" className="relative mx-auto aspect-[5/4] w-full max-w-136">
            <m.div
              className="absolute top-[8%] left-0 aspect-square w-[62%] rounded-full bg-brand-cherry"
              initial={{ x: '-22%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={meet}
            />
            <m.div
              className="absolute top-[8%] right-0 aspect-square w-[62%] rounded-full bg-brand-dusty mix-blend-multiply dark:mix-blend-normal dark:opacity-90"
              initial={{ x: '22%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={meet}
            />
            <m.div
              className="absolute top-[4%] right-[4%] rounded-full bg-card px-4 py-2 text-sm font-semibold shadow-lift"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring.gentle, delay: 0.7 }}
            >
              <span className="inline-flex items-center gap-1.5">
                <BadgeCheck className="size-4 text-primary" />
                Verified
              </span>
            </m.div>
            <m.div
              className="absolute bottom-[14%] left-[2%] rounded-full bg-highlight px-4 py-2 text-sm font-semibold text-highlight-foreground shadow-lift"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring.gentle, delay: 0.85 }}
            >
              Shows up: 11 of 12
            </m.div>
            <m.div
              className="absolute right-[10%] bottom-[2%] rounded-full bg-card px-4 py-2 text-sm font-semibold shadow-lift"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring.gentle, delay: 1 }}
            >
              Squad forming · 3 of 6
            </m.div>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-card/60">
        <div className="container-page py-16 md:py-24">
          <p className="eyebrow text-primary">Why Kollide</p>
          <h2 className="mt-3 max-w-2xl text-h2">The event is easy to find. The people to go with are not.</h2>
          <Stagger inView className="mt-10 grid gap-5 md:grid-cols-3">
            {PILLARS.map((pillar) => (
              <StaggerItem key={pillar.title} className="rounded-xl border border-border/70 bg-card p-6 shadow-card md:p-7">
                <span className="inline-flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
                  <pillar.icon className="size-6" strokeWidth={1.6} aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-h4">{pillar.title}</h3>
                <p className="mt-2 text-muted-foreground">{pillar.body}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>
    </>
  )
}

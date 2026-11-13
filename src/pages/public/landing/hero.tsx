import { ArrowRight, BadgeCheck, Check, MapPin } from 'lucide-react'
import { useScroll, useTransform } from 'motion/react'
import * as m from 'motion/react-m'
import { useRef, type CSSProperties } from 'react'

import { AppLink } from '@/components/shared/app-link'
import { Button } from '@/components/ui/button'

import { SquadRing } from './squad-ring'

const step = (index: number) => ({ '--i': index }) as CSSProperties

const PROMISES = ['Verified people', 'Small groups', 'Not a dating app']

/**
 * The first screen. Two circles drift towards each other and overlap, which
 * is the whole idea of Kollide: people meeting around an event.
 * Everything here appears with CSS, so nothing waits for JavaScript to paint.
 */
export function Hero() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  // As the page scrolls, the layers part slightly, which gives the stage depth.
  const circlesY = useTransform(scrollYProgress, [0, 1], [0, 90])
  const cardY = useTransform(scrollYProgress, [0, 1], [0, -50])
  const chipsY = useTransform(scrollYProgress, [0, 1], [0, -120])

  return (
    <section ref={ref} className="relative -mt-16 overflow-hidden pt-16 md:-mt-20 md:pt-20">
      <div className="container-page grid items-center gap-x-8 gap-y-14 pt-10 pb-20 md:pt-16 lg:min-h-[min(54rem,calc(100dvh-5rem))] lg:grid-cols-[1.05fr_0.95fr] lg:pb-24">
        <div>
          <p className="rise-in eyebrow inline-flex items-center gap-2 text-primary" style={step(0)}>
            <MapPin className="size-4" aria-hidden="true" />
            Social events in Bengaluru
          </p>

          <h1 className="mt-6 text-display">
            <span className="-mb-[0.12em] block overflow-hidden pb-[0.12em]">
              <span className="line-reveal" style={step(1)}>
                Never walk
              </span>
            </span>
            <span className="-mb-[0.12em] block overflow-hidden pb-[0.12em]">
              <span className="line-reveal" style={step(2)}>
                in <span className="text-primary">alone.</span>
              </span>
            </span>
          </h1>

          <p className="rise-in mt-7 max-w-xl text-lead text-muted-foreground" style={step(0)}>
            There is plenty to do in this city. Kollide finds you the people to do it with: a small squad of verified
            members for every event, so you arrive with company and leave with friends.
          </p>

          <div className="rise-in mt-9 flex flex-wrap items-center gap-x-6 gap-y-3" style={step(7)}>
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

          <ul className="rise-in mt-12 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground" style={step(9)}>
            {PROMISES.map((promise) => (
              <li key={promise} className="flex items-center gap-2.5">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-highlight" />
                {promise}
              </li>
            ))}
          </ul>
        </div>

        {/* The stage is decoration. Its content is described by the text beside it. */}
        <div aria-hidden="true" className="relative mx-auto aspect-square w-full max-w-88 sm:max-w-md lg:max-w-136">
          <m.div style={{ y: circlesY }} className="absolute inset-0">
            <div className="rise-in absolute top-[4%] left-0 size-[64%]" style={step(3)}>
              <div className="size-full animate-drift-a rounded-full bg-brand-cherry" />
            </div>
            <div className="rise-in absolute right-0 bottom-[2%] size-[60%]" style={step(4)}>
              <div className="size-full animate-drift-b rounded-full bg-brand-dusty mix-blend-multiply dark:opacity-85 dark:mix-blend-normal" />
            </div>
            <div className="rise-in absolute top-[30%] left-[14%] size-[84%] rounded-full border border-foreground/15" style={step(6)} />
          </m.div>

          <m.div style={{ y: cardY }} className="absolute top-[17%] left-[9%] w-[58%]">
            <div className="rise-in" style={step(8)}>
              <div className="animate-float">
                <div className="-rotate-[5deg] rounded-2xl bg-card p-2 text-card-foreground shadow-overlay">
                  <div className="aspect-[4/3] overflow-hidden rounded-xl">
                    <img src="/assets/covers/board-games-and-filter-coffee.svg" alt="" className="size-full object-cover" />
                  </div>
                  <div className="px-2 pt-3 pb-2">
                    <p className="text-xs text-muted-foreground">Indiranagar · 5:00 pm</p>
                    <p className="mt-1 font-display text-lead leading-tight">Board games and filter coffee</p>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex -space-x-2">
                        {['u17-1', 'u18-1', 'u28-1'].map((avatar) => (
                          <img key={avatar} src={`/assets/avatars/${avatar}.svg`} alt="" className="size-7 rounded-full ring-2 ring-card" />
                        ))}
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">3 spots left</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </m.div>

          <m.div style={{ y: chipsY }} className="absolute inset-0">
            <div className="rise-in absolute top-[7%] right-[1%]" style={step(10)}>
              <div className="flex animate-float-slow items-center gap-3 rounded-2xl bg-card py-2.5 pr-4 pl-2.5 text-card-foreground shadow-lift">
                <SquadRing filled={3} size={6} pulse className="size-12" />
                <div className="leading-tight">
                  <p className="text-sm font-semibold">Squad forming</p>
                  <p className="text-xs text-muted-foreground">Meet 30 min before</p>
                </div>
              </div>
            </div>

            <div className="rise-in absolute -bottom-[4%] left-0 sm:bottom-[9%] sm:left-[-3%]" style={step(11)}>
              <div className="animate-float rounded-full bg-highlight px-4 py-2 text-sm font-semibold text-highlight-foreground shadow-lift">
                Shows up: 11 of 12
              </div>
            </div>

            <div className="rise-in absolute right-[3%] bottom-[13%]" style={step(12)}>
              <div className="flex animate-float-slow items-center gap-2 rounded-full bg-card py-2 pr-4 pl-2 text-sm font-semibold text-card-foreground shadow-lift">
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-success text-on-status">
                  <Check className="size-4" strokeWidth={3} />
                </span>
                You’re in
              </div>
            </div>

            <div className="rise-in absolute top-[46%] right-0 hidden sm:block" style={step(13)}>
              <div className="flex animate-float items-center gap-1.5 rounded-full bg-card px-3.5 py-2 text-sm font-semibold text-card-foreground shadow-lift">
                <BadgeCheck className="size-4 text-primary" />
                Verified
              </div>
            </div>
          </m.div>
        </div>
      </div>
    </section>
  )
}

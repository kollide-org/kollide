import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import { useRef, useState } from 'react'

import { Stagger, StaggerItem } from '@/components/motion/stagger'
import { spring } from '@/lib/motion'
import { getSmoothScroll } from '@/lib/smooth-scroll'
import { useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'

import { HOW_STEPS } from './how-steps'
import { useScrollMoment } from './use-scroll-moment'

const number = (index: number) => String(index + 1).padStart(2, '0')

function Heading() {
  return (
    <>
      <p className="eyebrow text-primary">How it works</p>
      <h2 className="mt-4 text-h2">From “maybe” to “see you there”, in four steps.</h2>
    </>
  )
}

/** A soft pair of circles behind each scene, echoing the hero. */
function Backdrop() {
  return (
    <div aria-hidden="true" className="absolute inset-0 -z-10">
      <div className="absolute -top-[8%] -right-[10%] size-[58%] rounded-full bg-highlight-soft" />
      <div className="absolute -bottom-[10%] -left-[12%] size-[66%] rounded-full bg-primary-soft" />
    </div>
  )
}

/**
 * Scroll moment two, on large screens. The section pins while four steps
 * play through: the list advances on the left and the scene changes on the right.
 */
function PinnedSteps() {
  const ref = useRef<HTMLElement>(null)
  const fillRef = useRef<HTMLSpanElement>(null)
  const [active, setActive] = useState(0)

  useScrollMoment(ref, ({ ScrollTrigger }, element) => {
    ScrollTrigger.create({
      trigger: element,
      start: 'top 80px',
      end: 'bottom bottom',
      onUpdate: (self) => {
        if (fillRef.current) fillRef.current.style.transform = `scaleY(${self.progress})`
        const next = Math.min(HOW_STEPS.length - 1, Math.floor(self.progress * HOW_STEPS.length))
        setActive((current) => (current === next ? current : next))
      },
    })
  })

  // Lets a step be chosen directly, by keyboard or pointer.
  const goTo = (index: number) => {
    const element = ref.current
    if (!element) return
    const travel = element.offsetHeight - element.firstElementChild!.clientHeight
    const top = element.getBoundingClientRect().top + window.scrollY + travel * ((index + 0.5) / HOW_STEPS.length)
    const lenis = getSmoothScroll()
    if (lenis) lenis.scrollTo(top)
    else window.scrollTo({ top, behavior: 'smooth' })
  }

  const Scene = HOW_STEPS[active].Scene

  return (
    <section ref={ref} className="relative h-[340vh] border-t border-border bg-card/50">
      {/* Pinned just below the site header, which is 5rem tall at this size. */}
      <div className="sticky top-20 flex h-[calc(100dvh-5rem)] items-center overflow-hidden">
        <div className="container-page grid grid-cols-[1fr_1fr] items-center gap-16 xl:gap-24">
          <div>
            <Heading />
            <div className="relative mt-8 pl-8">
              <span aria-hidden="true" className="absolute top-1 bottom-1 left-0 w-0.5 rounded-full bg-foreground/12">
                <span ref={fillRef} className="absolute inset-0 origin-top bg-primary" style={{ transform: 'scaleY(0)' }} />
              </span>
              <ol className="grid gap-6">
                {HOW_STEPS.map((step, index) => {
                  const isActive = index === active
                  return (
                    <li key={step.title}>
                      <button
                        type="button"
                        onClick={() => goTo(index)}
                        aria-current={isActive ? 'step' : undefined}
                        className={cn(
                          'group block w-full rounded-lg text-left transition-[color,transform] duration-500 ease-out-soft',
                          isActive ? 'translate-x-1.5 text-foreground' : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <span className={cn('text-sm font-semibold tracking-widest', isActive && 'text-primary')}>
                          {number(index)}
                        </span>
                        <span className="mt-1 block font-display text-h4">{step.title}</span>
                        <span className="mt-1.5 block max-w-md text-muted-foreground">{step.body}</span>
                      </button>
                    </li>
                  )
                })}
              </ol>
            </div>
          </div>

          <div aria-hidden="true" className="relative mx-auto w-full max-w-lg py-10">
            <Backdrop />
            <AnimatePresence mode="wait" initial={false}>
              <m.div
                key={active}
                initial={{ opacity: 0, y: 28, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.98 }}
                transition={spring.gentle}
              >
                <Scene />
              </m.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}

/** The same four steps as a simple list, for small screens and reduced motion. */
function StackedSteps() {
  return (
    <section className="border-t border-border bg-card/50">
      <div className="container-page py-20 md:py-28">
        <Heading />
        <Stagger inView className="mt-12 grid gap-14 md:grid-cols-2 md:gap-x-10 md:gap-y-16">
          {HOW_STEPS.map((step, index) => (
            <StaggerItem key={step.title} className="min-w-0">
              <div aria-hidden="true" className="relative isolate overflow-hidden rounded-[2rem] px-3 py-7 sm:px-7">
                <Backdrop />
                <step.Scene />
              </div>
              <p className="mt-7 text-sm font-semibold tracking-widest text-primary">{number(index)}</p>
              <h3 className="mt-1 text-h4">{step.title}</h3>
              <p className="mt-2 text-muted-foreground">{step.body}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  )
}

export function HowItWorks() {
  const pinned = useMediaQuery('(min-width: 1024px) and (min-height: 780px) and (prefers-reduced-motion: no-preference)')
  return pinned ? <PinnedSteps /> : <StackedSteps />
}

import { ArrowRight } from 'lucide-react'
import { useScroll, useTransform } from 'motion/react'
import * as m from 'motion/react-m'
import { useRef } from 'react'

import { AppLink } from '@/components/shared/app-link'
import { Button } from '@/components/ui/button'
import { useMotionAllowed } from '@/lib/use-media-query'

/**
 * The last screen. The wordmark writes itself as the section scrolls into
 * view: the "k" is already there, and "ollide" slides out from behind it,
 * the same gesture as the loader.
 */
export function Closing() {
  const ref = useRef<HTMLElement>(null)
  const motionAllowed = useMotionAllowed()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'center center'] })
  const restX = useTransform(scrollYProgress, [0.25, 0.95], ['-104%', '0%'])
  const restOpacity = useTransform(scrollYProgress, [0.25, 0.6], [0, 1])

  return (
    <section ref={ref} className="relative overflow-hidden">
      <div className="container-page flex flex-col items-center py-24 text-center md:py-36">
        <p aria-hidden="true" className="flex font-display text-[5.5rem] leading-none tracking-[-0.02em] text-primary sm:text-[9rem]">
          <span>k</span>
          <span className="-mb-[0.14em] inline-block overflow-hidden pb-[0.14em]">
            <m.span className="inline-block" style={motionAllowed ? { x: restX, opacity: restOpacity } : undefined}>
              ollide
            </m.span>
          </span>
        </p>
        <h2 className="mt-12 max-w-4xl text-h1 md:text-display">Your people are already out tonight.</h2>
        <p className="mt-6 max-w-xl text-lead text-muted-foreground">
          Make a profile, pick an evening, and walk in with a squad. It takes about five minutes.
        </p>
        <Button asChild size="lg" className="mt-10">
          <AppLink to="/sign-in">
            Join Kollide
            <ArrowRight aria-hidden="true" />
          </AppLink>
        </Button>
        <p className="mt-6 text-sm text-muted-foreground">Free to join. For people aged 18 and over.</p>
      </div>
    </section>
  )
}

import { ArrowRight } from 'lucide-react'
import { useScroll, useTransform } from 'motion/react'
import * as m from 'motion/react-m'
import { useRef } from 'react'

import { AppLink } from '@/components/shared/app-link'
import { Button } from '@/components/ui/button'

/**
 * The last screen. The two circles from the hero finally meet as the section
 * scrolls into view, which is the promise of the name.
 */
export function Closing() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end end'] })
  const leftX = useTransform(scrollYProgress, [0, 1], ['-70%', '-22%'])
  const rightX = useTransform(scrollYProgress, [0, 1], ['70%', '22%'])

  return (
    <section ref={ref} className="relative overflow-hidden">
      <div className="container-page flex flex-col items-center py-24 text-center md:py-36">
        <div aria-hidden="true" className="relative flex h-40 w-full items-center justify-center sm:h-56">
          <m.div style={{ x: leftX }} className="absolute size-36 rounded-full bg-brand-cherry sm:size-52" />
          <m.div
            style={{ x: rightX }}
            className="absolute size-36 rounded-full bg-brand-dusty mix-blend-multiply sm:size-52 dark:opacity-85 dark:mix-blend-normal"
          />
        </div>
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

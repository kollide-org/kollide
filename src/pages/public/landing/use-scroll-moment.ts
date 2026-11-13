import { useEffect, type RefObject } from 'react'

import { loadGsap, type GsapKit } from '@/lib/gsap'
import { onSmoothScrollChange } from '@/lib/smooth-scroll'
import { useMotionAllowed } from '@/lib/use-media-query'

/**
 * Sets up a GSAP ScrollTrigger animation scoped to one element, and cleans it
 * up again. GSAP is loaded on the first scroll.
 * Nothing runs for people who have asked for reduced motion: they get the
 * finished, static layout.
 */
export function useScrollMoment(
  ref: RefObject<HTMLElement | null>,
  setup: (kit: GsapKit, element: HTMLElement) => void,
  enabled = true,
): void {
  const motionAllowed = useMotionAllowed()

  useEffect(() => {
    const element = ref.current
    if (!element || !motionAllowed || !enabled) return

    let cancelled = false
    let cleanup = () => {}

    // Scroll-driven animation is only needed once someone scrolls, so GSAP is
    // fetched on the first scroll and never competes with the first paint.
    const start = () => {
      window.removeEventListener('scroll', start)
      void loadGsap().then((kit) => {
        if (cancelled) return
        const context = kit.gsap.context(() => setup(kit, element), element)
        // Keep ScrollTrigger in step with Lenis, so scrubbed animations never lag a frame.
        let detach = () => {}
        const unsubscribe = onSmoothScrollChange((lenis) => {
          detach()
          detach = lenis ? lenis.on('scroll', kit.ScrollTrigger.update) : () => {}
        })
        // Sections above may still be arriving. Re-measure whenever the page changes height.
        let frame = 0
        const resize = new ResizeObserver(() => {
          cancelAnimationFrame(frame)
          frame = requestAnimationFrame(() => kit.ScrollTrigger.refresh())
        })
        resize.observe(document.body)
        cleanup = () => {
          cancelAnimationFrame(frame)
          resize.disconnect()
          unsubscribe()
          detach()
          context.revert()
        }
      })
    }
    if (window.scrollY > 0) start()
    else window.addEventListener('scroll', start, { once: true, passive: true })

    return () => {
      cancelled = true
      window.removeEventListener('scroll', start)
      cleanup()
    }
    // `setup` is expected to be stable for the life of the component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, motionAllowed, enabled])
}

import { useEffect } from 'react'

import { setSmoothScroll } from '@/lib/smooth-scroll'

/**
 * Lenis smooth scrolling for the landing page. Every other page, public or
 * in the app, keeps native scrolling.
 *
 * Lenis loads after first paint, leaves touch scrolling native, and switches
 * its smoothing off by itself when the system asks for reduced motion.
 */
export function SmoothScroll() {
  useEffect(() => {
    let cancelled = false
    let stop = () => {}

    const start = async () => {
      const { default: Lenis } = await import('lenis')
      if (cancelled) return
      const lenis = new Lenis({ autoRaf: true, anchors: true, lerp: 0.09, wheelMultiplier: 0.9 })
      setSmoothScroll(lenis)
      stop = () => {
        setSmoothScroll(null)
        lenis.destroy()
      }
    }

    const idle = window.requestIdleCallback ?? ((callback: () => void) => window.setTimeout(callback, 200))
    const cancelIdle = window.cancelIdleCallback ?? window.clearTimeout
    const handle = idle(() => void start())

    return () => {
      cancelled = true
      cancelIdle(handle)
      stop()
    }
  }, [])

  return null
}

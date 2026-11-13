import { useEffect, useState } from 'react'

/**
 * Mounts a long page a section at a time, each in its own idle moment, so the
 * page stays responsive while it is built. Returns how many sections to render.
 * Pass `immediate` to mount everything at once.
 */
export function useStagedMount(total: number, immediate = false): number {
  const [count, setCount] = useState(() => (immediate || window.scrollY > 0 ? total : 1))

  useEffect(() => {
    if (count >= total) return
    // If the visitor starts scrolling, stop staging and show everything.
    const showAll = () => setCount(total)
    window.addEventListener('scroll', showAll, { once: true, passive: true })

    const idle = window.requestIdleCallback ?? ((callback: () => void) => window.setTimeout(callback, 80))
    const cancelIdle = window.cancelIdleCallback ?? window.clearTimeout
    const handle = idle(() => setCount((current) => Math.min(total, current + 1)), { timeout: 600 })

    return () => {
      window.removeEventListener('scroll', showAll)
      cancelIdle(handle)
    }
  }, [count, total])

  return count
}

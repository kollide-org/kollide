import { lazy, Suspense, useEffect, useState } from 'react'
import { useLocation } from 'react-router'

import { Hero } from './hero'

const BelowFold = lazy(() => import('./below-fold'))

/**
 * Where the visitor was on this page, by history entry. The router restores
 * scroll positions itself, but it does so before the lower sections exist,
 * so the landing page remembers its own and returns to it once they do.
 */
const scrollByEntry = new Map<string, number>()

/** Holds the page open while the rest loads, so the footer does not jump. */
function Placeholder() {
  return <div aria-hidden="true" className="min-h-[200vh]" />
}

/**
 * The landing page. It tells one story from top to bottom: you arrive alone,
 * you find a squad, and by the last screen the two circles have met.
 *
 * Only the hero is in the first bundle. Everything below it is fetched once
 * the hero has painted, so the first screen is never held up by the rest.
 */
export function Component() {
  const { key } = useLocation()
  const [restoreScrollTo] = useState(() => scrollByEntry.get(key) ?? 0)
  const [heroPainted, setHeroPainted] = useState(restoreScrollTo > 0)

  useEffect(() => {
    const remember = () => scrollByEntry.set(key, window.scrollY)
    window.addEventListener('scroll', remember, { passive: true })
    return () => window.removeEventListener('scroll', remember)
  }, [key])

  useEffect(() => {
    if (heroPainted) return
    const idle = window.requestIdleCallback ?? ((callback: () => void) => window.setTimeout(callback, 60))
    const cancelIdle = window.cancelIdleCallback ?? window.clearTimeout
    const handle = idle(() => setHeroPainted(true), { timeout: 400 })
    return () => cancelIdle(handle)
  }, [heroPainted])

  return (
    <>
      <title>Kollide · Social events in Bengaluru</title>
      <Hero />
      {heroPainted ? (
        <Suspense fallback={<Placeholder />}>
          <BelowFold restoreScrollTo={restoreScrollTo} />
        </Suspense>
      ) : (
        <Placeholder />
      )}
    </>
  )
}

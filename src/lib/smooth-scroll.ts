import type Lenis from 'lenis'

/**
 * The page's Lenis instance, while smooth scrolling is running.
 * Scroll-driven animations subscribe to it so they update in the same frame.
 */
let current: Lenis | null = null
const listeners = new Set<(lenis: Lenis | null) => void>()

export function setSmoothScroll(lenis: Lenis | null): void {
  current = lenis
  for (const listener of listeners) listener(lenis)
}

export function getSmoothScroll(): Lenis | null {
  return current
}

/** Calls back now, and again whenever smooth scrolling starts or stops. */
export function onSmoothScrollChange(listener: (lenis: Lenis | null) => void): () => void {
  listeners.add(listener)
  listener(current)
  return () => listeners.delete(listener)
}

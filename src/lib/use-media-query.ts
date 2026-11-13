import { useSyncExternalStore } from 'react'

/** True while the media query matches. Updates live. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** True unless the person has asked their system for less motion. */
export function useMotionAllowed(): boolean {
  return useMediaQuery('(prefers-reduced-motion: no-preference)')
}

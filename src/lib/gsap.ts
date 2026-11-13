import type { gsap as Gsap } from 'gsap'
import type { ScrollTrigger as ScrollTriggerPlugin } from 'gsap/ScrollTrigger'

export interface GsapKit {
  gsap: typeof Gsap
  ScrollTrigger: typeof ScrollTriggerPlugin
}

let kit: Promise<GsapKit> | null = null

/**
 * GSAP and ScrollTrigger, loaded on demand and registered once.
 * They are used for the two scroll moments on the landing page and nowhere else,
 * so they never weigh on the first paint or on the app.
 */
export function loadGsap(): Promise<GsapKit> {
  kit ??= Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(([core, plugin]) => {
    core.gsap.registerPlugin(plugin.ScrollTrigger)
    return { gsap: core.gsap, ScrollTrigger: plugin.ScrollTrigger }
  })
  return kit
}

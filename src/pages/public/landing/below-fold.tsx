import { useEffect } from 'react'

import { useStagedMount } from '@/lib/use-staged-mount'

import { Closing } from './closing'
import { Difference } from './difference'
import { EventsPreview } from './events-preview'
import { HowItWorks } from './how-it-works'
import { Manifesto } from './manifesto'
import { Safety } from './safety'

/** Everything below the first screen, in reading order. */
const SECTIONS = [Manifesto, HowItWorks, Difference, EventsPreview, Safety, Closing]

/**
 * The rest of the landing page. It is loaded after the hero has painted, and
 * its sections are mounted one at a time so the page stays responsive.
 */
export default function BelowFold({ restoreScrollTo }: { restoreScrollTo: number }) {
  const mounted = useStagedMount(SECTIONS.length, restoreScrollTo > 0)

  // Coming back to this page: return to where the visitor was, now that the content exists.
  useEffect(() => {
    if (restoreScrollTo > 0) window.scrollTo(0, restoreScrollTo)
  }, [restoreScrollTo])

  return (
    <>
      {SECTIONS.slice(0, mounted).map((Section, index) => (
        // The list never reorders, so the position is a stable key.
        <Section key={index} />
      ))}
      {/* Holds the page open until the last section is in, so the footer does not jump. */}
      {mounted < SECTIONS.length ? <div aria-hidden="true" className="min-h-[200vh]" /> : null}
    </>
  )
}

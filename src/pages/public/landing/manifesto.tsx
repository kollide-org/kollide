import { useRef } from 'react'

import { cn } from '@/lib/utils'

import { useScrollMoment } from './use-scroll-moment'

/** The statement, in phrases. Emphasised phrases are set in cherry rose. */
const STATEMENT: { text: string; emphasis?: boolean }[] = [
  { text: 'Bengaluru has a thousand things to do tonight.' },
  { text: 'The hard part was never finding one.' },
  { text: 'It’s walking in alone.', emphasis: true },
  { text: 'So Kollide starts with the people:' },
  { text: 'verified, reliable, and glad you came.', emphasis: true },
]

/**
 * Scroll moment one. The statement starts faint and each word comes into
 * focus as it is read, tied to the scroll position.
 */
export function Manifesto() {
  const ref = useRef<HTMLElement>(null)

  useScrollMoment(ref, ({ gsap }, element) => {
    gsap.fromTo(
      element.querySelectorAll('[data-word]'),
      { opacity: 0.16 },
      {
        opacity: 1,
        ease: 'none',
        stagger: 0.12,
        scrollTrigger: { trigger: element, start: 'top 72%', end: 'bottom 62%', scrub: 0.6 },
      },
    )
  })

  return (
    <section ref={ref} className="container-page py-24 md:py-40">
      <p className="eyebrow text-primary">Why Kollide</p>
      <p className="mt-8 max-w-5xl font-display text-h2 md:text-h1">
        {STATEMENT.map((phrase) => (
          <span key={phrase.text} className={cn(phrase.emphasis && 'text-primary')}>
            {phrase.text.split(' ').map((word, index) => (
              <span key={index} data-word>
                {word}{' '}
              </span>
            ))}
          </span>
        ))}
      </p>
    </section>
  )
}

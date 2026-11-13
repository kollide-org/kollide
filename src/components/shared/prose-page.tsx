import type { CSSProperties, ReactNode } from 'react'

import { cn } from '@/lib/utils'

export interface ProseSection {
  id: string
  title: string
  body: ReactNode
}

interface ProsePageProps {
  eyebrow: string
  title: string
  lead: string
  /** A short notice above the content, such as a draft warning. */
  notice?: ReactNode
  sections: ProseSection[]
}

const step = (index: number) => ({ '--i': index }) as CSSProperties

/**
 * The layout for the long-form public pages: a large heading, a list of
 * sections that stays in view on wide screens, and a readable column of text.
 */
export function ProsePage({ eyebrow, title, lead, notice, sections }: ProsePageProps) {
  return (
    <article className="container-page pt-12 pb-24 md:pt-20 md:pb-32">
      <title>{`${title} · Kollide`}</title>
      <header className="max-w-4xl">
        <p className="rise-in eyebrow text-primary" style={step(0)}>
          {eyebrow}
        </p>
        <h1 className="rise-in mt-4 text-h1 md:text-display" style={step(1)}>
          {title}
        </h1>
        <p className="rise-in mt-6 max-w-2xl text-lead text-muted-foreground" style={step(3)}>
          {lead}
        </p>
      </header>

      <div className="mt-14 grid gap-x-16 gap-y-10 border-t border-border pt-12 md:mt-20 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label="On this page" className="hidden lg:block">
          <ol className="sticky top-28 grid gap-1">
            {sections.map((section, index) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="flex min-h-10 items-baseline gap-3 rounded-md py-1.5 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span className="text-xs font-semibold tracking-widest text-primary tabular-nums">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="max-w-2xl">
          {notice ? (
            <p className="mb-12 rounded-xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground">{notice}</p>
          ) : null}
          {sections.map((section, index) => (
            <section
              key={section.id}
              id={section.id}
              aria-labelledby={`${section.id}-title`}
              className={cn('scroll-mt-28', index > 0 && 'mt-16 border-t border-border pt-14')}
            >
              <h2 id={`${section.id}-title`} className="text-h2">
                {section.title}
              </h2>
              <div className="prose-kollide mt-5">{section.body}</div>
            </section>
          ))}
        </div>
      </div>
    </article>
  )
}

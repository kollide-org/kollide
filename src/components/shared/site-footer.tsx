import { useConsent } from '@/app/providers/consent-context'

import { AppLink } from './app-link'
import { Wordmark } from './wordmark'

const YEAR = new Date().getFullYear()

const FOOTER_LINKS = [
  { to: '/how-it-works', label: 'How it works' },
  { to: '/safety', label: 'Safety and code of conduct' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/terms', label: 'Terms' },
]

export function SiteFooter() {
  const { openSettings } = useConsent()
  return (
    <footer className="border-t border-border bg-secondary/50">
      <div className="container-page grid gap-12 py-14 md:grid-cols-[1.4fr_1fr] md:py-20">
        <div>
          <Wordmark to={null} className="text-[2.5rem]" />
          <p className="mt-5 max-w-md text-muted-foreground">
            Social events in Bengaluru, with people you can trust around them. Find something to do, and go with a
            small group.
          </p>
          <p className="mt-6 inline-flex rounded-full border border-foreground/20 px-4 py-2 text-sm font-semibold">
            Kollide is not a dating app.
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className="grid gap-1">
            {FOOTER_LINKS.map((link) => (
              <li key={link.to}>
                <AppLink
                  to={link.to}
                  className="inline-flex min-h-11 items-center rounded-md text-foreground underline-offset-4 hover:text-primary hover:underline"
                >
                  {link.label}
                </AppLink>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={openSettings}
                className="inline-flex min-h-11 items-center rounded-md text-foreground underline-offset-4 hover:text-primary hover:underline"
              >
                Cookie settings
              </button>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-border">
        <p className="container-page py-6 text-sm text-muted-foreground">
          © {YEAR} Kollide. Made in Bengaluru. For people aged 18 and over.
        </p>
      </div>
    </footer>
  )
}

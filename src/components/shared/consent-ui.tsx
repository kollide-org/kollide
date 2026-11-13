import { useState } from 'react'

import { useConsent } from '@/app/providers/consent-context'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import type { ConsentChoice } from '@/lib/consent/cookie'

const CATEGORIES: { key: keyof ConsentChoice; title: string; body: string }[] = [
  { key: 'preferences', title: 'Preferences', body: 'Remember your theme and the filters you used last on this device.' },
  { key: 'analytics', title: 'Analytics', body: 'Helps us see which events people look at and where the app is confusing. Uses PostHog in the EU and may record anonymised sessions with typed text hidden.' },
  { key: 'marketing', title: 'Marketing', body: 'Lets us measure our ads with Meta and Google. Off unless you turn it on.' },
]

/** The first-visit banner and the settings dialog (the footer's “Cookie settings” reopens it). Accept all and Reject all look the same. */
export function ConsentUi() {
  const consent = useConsent()
  return (
    <>
      {consent.bannerVisible ? <Banner /> : null}
      <SettingsDialog />
    </>
  )
}

function Banner() {
  const { acceptAll, rejectAll, openSettings } = useConsent()
  return (
    <section
      aria-label="Cookie choices"
      data-testid="consent-banner"
      className="fixed inset-x-3 bottom-3 z-90 mx-auto grid max-w-3xl gap-4 rounded-2xl border border-border bg-card p-5 shadow-lift sm:p-6"
    >
      <div className="grid gap-1">
        <h2 className="text-h3">Your choice about cookies</h2>
        <p className="text-muted-foreground">
          We always use the cookies that keep you signed in and safe. With your permission we also remember your settings, count how the app is used, and measure
          our ads. You can change this any time from “Cookie settings” in the footer.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button onClick={rejectAll}>Reject all</Button>
        <Button onClick={acceptAll}>Accept all</Button>
        <Button variant="outline" onClick={openSettings}>Customise</Button>
      </div>
    </section>
  )
}

function SettingsDialog() {
  const { settingsOpen, closeSettings, choice, save, acceptAll, rejectAll } = useConsent()
  return (
    <Dialog open={settingsOpen} onOpenChange={(open) => (open ? undefined : closeSettings())}>
      <DialogContent aria-describedby="cookie-settings-help">
        {/* a fresh form each time the dialog opens, starting from the current choice */}
        {settingsOpen ? <Form key={String(Boolean(choice))} initial={choice} save={save} acceptAll={acceptAll} rejectAll={rejectAll} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function Form({ initial, save, acceptAll, rejectAll }: { initial: ConsentChoice | null; save: (c: ConsentChoice) => void; acceptAll: () => void; rejectAll: () => void }) {
  const [draft, setDraft] = useState<ConsentChoice>(initial ?? { preferences: false, analytics: false, marketing: false })
  return (
    <>
      <DialogHeader>
        <DialogTitle>Cookie settings</DialogTitle>
        <DialogDescription id="cookie-settings-help">Choose what you are happy with. You can change it again at any time.</DialogDescription>
      </DialogHeader>
      <ul className="grid gap-4">
        <li className="flex items-start justify-between gap-4">
          <div>
            <p className="font-medium">Essential</p>
            <p className="text-sm text-muted-foreground">Keeps you signed in and the site secure, and remembers this choice. Always on.</p>
          </div>
          <Switch checked disabled aria-label="Essential cookies (always on)" />
        </li>
        {CATEGORIES.map((c) => (
          <li key={c.key} className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium" id={`consent-${c.key}`}>{c.title}</p>
              <p className="text-sm text-muted-foreground">{c.body}</p>
            </div>
            <Switch checked={draft[c.key]} onCheckedChange={(checked) => setDraft({ ...draft, [c.key]: checked })} aria-labelledby={`consent-${c.key}`} />
          </li>
        ))}
      </ul>
      <DialogFooter className="gap-2 sm:justify-start">
        <Button onClick={() => save(draft)}>Save choices</Button>
        <Button variant="outline" onClick={rejectAll}>Reject all</Button>
        <Button variant="outline" onClick={acceptAll}>Accept all</Button>
      </DialogFooter>
    </>
  )
}

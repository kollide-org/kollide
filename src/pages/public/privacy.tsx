import { Cookie } from 'lucide-react'

import { useConsent } from '@/app/providers/consent-context'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'

const PURPOSES: { name: string; what: string; data: string; choice: string }[] = [
  {
    name: 'Running Kollide',
    what: 'Signing you in, showing events, handling requests and squads, check-in, feedback, reputation (“shows up 3 of 4”), safety reports and appeals, emails about your bookings.',
    data: 'Name, date of birth (we only show your age), phone, email, photos, the events you join or host, tags and ratings, reports.',
    choice: 'Needed to provide the service. Always on.',
  },
  {
    name: 'Preferences',
    what: 'Remembering your theme (light, dark) and the filters you used last, on this device.',
    data: 'Two small values in your browser. They never leave your device.',
    choice: 'Only with your permission. Without it they last until you reload the page.',
  },
  {
    name: 'Analytics',
    what: 'Understanding which events people look at, which filters they use and where the app is confusing, so we can improve it. Also anonymised session recordings (everything you type is hidden, and profile cards, phone numbers, dates of birth and addresses are never recorded) for a share of sessions.',
    data: 'Pages and buttons used, event categories viewed, the steps of your journey (joined, approved, checked in, gave feedback), tied to a random user id: never your name, email or phone. Processed by PostHog in the EU.',
    choice: 'Only with your permission. Turning it off stops collection immediately.',
  },
  {
    name: 'Marketing',
    what: 'Measuring whether our adverts on Meta and Google work.',
    data: 'The pixels set their own cookies and tell Meta or Google that you visited. Not loaded until you agree, and not used at all until we run adverts.',
    choice: 'Only with your permission. Turning it off removes the cookies and reloads the page.',
  },
]

const STORAGE: { name: string; purpose: string; kept: string }[] = [
  { name: 'Sign-in session (sb-…-auth-token)', purpose: 'Essential: keeps you signed in', kept: 'Until you sign out' },
  { name: 'kollide_consent', purpose: 'Essential: remembers this choice and links it to your account', kept: '6 months' },
  { name: 'kollide:theme, kollide:filters', purpose: 'Preferences', kept: 'Until you withdraw or clear your browser' },
  { name: 'ph_… (PostHog)', purpose: 'Analytics', kept: 'Removed when you withdraw' },
  { name: '_fbp, _ga, _gcl_… (Meta, Google)', purpose: 'Marketing', kept: 'Removed when you withdraw' },
]

/** The privacy notice. Version v1; the cookie banner asks again whenever the notice version changes. */
export function Component() {
  const { openSettings } = useConsent()
  return (
    <div className="container-page py-12 md:py-20">
      <title>Privacy · Kollide</title>
      <PageHeader eyebrow="Your data" title="Privacy" description="What Kollide collects, why, who sees it, and what you can choose. Written to be read." />
      <div className="mt-10 grid max-w-3xl gap-10">
        <section aria-labelledby="who" className="grid gap-3">
          <h2 id="who" className="text-h2">Who we are</h2>
          <p>
            Kollide is a social events platform for Bengaluru. People find an event, then host it or join it with a small group of verified people. It is not a
            dating app, and it is for people aged 18 and over.
          </p>
        </section>

        <section aria-labelledby="purposes" className="grid gap-4">
          <h2 id="purposes" className="text-h2">What we use your data for</h2>
          <p>Each purpose is separate. Only the first is needed to use Kollide. You decide on the other three in the cookie banner, and can change your mind at any time.</p>
          <ul className="grid gap-4">
            {PURPOSES.map((p) => (
              <li key={p.name} className="grid gap-1 rounded-2xl border border-border p-5">
                <h3 className="text-h3">{p.name}</h3>
                <p>{p.what}</p>
                <p className="text-sm text-muted-foreground"><strong>Data:</strong> {p.data}</p>
                <p className="text-sm text-muted-foreground"><strong>Your choice:</strong> {p.choice}</p>
              </li>
            ))}
          </ul>
          <div>
            <Button variant="outline" onClick={openSettings}><Cookie /> Cookie settings</Button>
          </div>
        </section>

        <section aria-labelledby="storage" className="grid gap-3">
          <h2 id="storage" className="text-h2">Cookies and browser storage</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border"><th className="py-2 pr-4">Name</th><th className="py-2 pr-4">What for</th><th className="py-2">How long</th></tr>
              </thead>
              <tbody>
                {STORAGE.map((row) => (
                  <tr key={row.name} className="border-b border-border/60 align-top">
                    <td className="py-2 pr-4">{row.name}</td><td className="py-2 pr-4">{row.purpose}</td><td className="py-2">{row.kept}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="private" className="grid gap-3">
          <h2 id="private" className="text-h2">What stays private</h2>
          <ul className="grid list-disc gap-2 pl-6">
            <li>Your phone number, date of birth, last name and exact address are never shown to other members. Your date of birth is only used to work out your age.</li>
            <li>Your selfie is used once, to check you are you, and is deleted after review.</li>
            <li>Private feedback (“something felt off”) can never be read by the person it is about, and nobody sees who wrote it, not even our admins.</li>
            <li>The exact address of an event is shown only to the host, our admins and people who have a place.</li>
            <li>Analytics and recordings never include your email, name or phone number.</li>
          </ul>
        </section>

        <section aria-labelledby="who-else" className="grid gap-3">
          <h2 id="who-else" className="text-h2">Who handles data for us</h2>
          <ul className="grid list-disc gap-2 pl-6">
            <li>Supabase (database and sign-in, Mumbai) and Cloudflare (hosting, images and the server that sends email and analytics events).</li>
            <li>Resend (sign-in codes) and Brevo (every other email).</li>
            <li>PostHog, EU Cloud: only if you allow Analytics.</li>
            <li>Meta and Google: only if you allow Marketing, and only when we run adverts.</li>
          </ul>
          <p>We do not sell your data.</p>
        </section>

        <section aria-labelledby="rights" className="grid gap-3">
          <h2 id="rights" className="text-h2">Your choices and rights</h2>
          <ul className="grid list-disc gap-2 pl-6">
            <li>Download everything we hold about you, or delete your account, from Settings. Deleting removes your personal data and keeps only what the law or our safety records need, without your name.</li>
            <li>Withdraw cookie permissions from “Cookie settings” in the footer or in Settings. It takes effect straight away.</li>
            <li>If we change this notice in a way that matters, we will ask for your choice again.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}

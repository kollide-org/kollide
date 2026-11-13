import { ArrowRight, Flag, Lock, MapPinOff, Send, ShieldCheck, UsersRound } from 'lucide-react'

import { Stagger, StaggerItem } from '@/components/motion/stagger'
import { AppLink } from '@/components/shared/app-link'

const COMMITMENTS = [
  { icon: ShieldCheck, title: '18 and over, always', body: 'Age is checked at sign-up. Nobody younger can join.' },
  { icon: MapPinOff, title: 'Addresses stay private', body: 'You see the area. The exact address appears only once you’re approved or booked.' },
  { icon: UsersRound, title: 'Women-only events and squads', body: 'A filter finds them, and only women can join them.' },
  { icon: Send, title: 'Share my plan', body: 'Send the details of where you’re going to someone you trust, in one tap.' },
  { icon: Flag, title: 'Report anything, anywhere', body: 'Every profile and event has a report option. Reports go to a person, not a queue of bots.' },
  { icon: Lock, title: 'House parties, with limits', body: 'Capped at 25 guests, host approval always on, and house rules shown up front.' },
]

/** Safety, stated plainly. This section stays dark in both themes. */
export function Safety() {
  return (
    <section className="container-page py-24 md:py-36">
      <div className="relative isolate overflow-hidden rounded-[2rem] bg-brand-ink px-6 py-14 text-brand-antique sm:px-12 md:py-20 lg:px-16">
        <div aria-hidden="true" className="absolute -top-52 -right-40 -z-10 size-80 rounded-full bg-brand-cherry opacity-45 lg:-top-64 lg:-right-48 lg:size-112" />
        <div aria-hidden="true" className="absolute -top-36 right-20 -z-10 hidden size-64 rounded-full bg-brand-dusty opacity-30 mix-blend-screen lg:block" />

        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <p className="eyebrow text-brand-antique/75">Trust and safety</p>
            <h2 className="mt-4 text-h2 md:text-h1">Safe by design. Women first.</h2>
            <p className="mt-5 max-w-md text-lead text-brand-antique/80">
              Meeting new people should feel easy. So the careful parts are built in, not left to you.
            </p>
            <p className="mt-8 inline-flex rounded-full border border-brand-antique/30 px-4 py-2 text-sm font-semibold">
              Kollide is not a dating app.
            </p>
            <p className="mt-8">
              <AppLink
                to="/safety"
                className="inline-flex items-center gap-2 rounded-sm font-semibold underline decoration-brand-antique/40 underline-offset-4 transition-colors hover:decoration-brand-antique focus-visible:outline-brand-antique"
              >
                Read the code of conduct
                <ArrowRight className="size-4.5" aria-hidden="true" />
              </AppLink>
            </p>
          </div>

          <Stagger inView className="grid gap-x-10 gap-y-9 sm:grid-cols-2">
            {COMMITMENTS.map((commitment) => (
              <StaggerItem key={commitment.title} className="border-t border-brand-antique/20 pt-6">
                <commitment.icon className="size-6 text-brand-antique" strokeWidth={1.5} aria-hidden="true" />
                <h3 className="mt-4 text-h4">{commitment.title}</h3>
                <p className="mt-1.5 text-brand-antique/75">{commitment.body}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </div>
    </section>
  )
}

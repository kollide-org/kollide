import { AppLink } from '@/components/shared/app-link'
import { ProsePage, type ProseSection } from '@/components/shared/prose-page'

const EVENT_KINDS = [
  {
    name: 'Community events',
    line: 'Game nights, walks, house parties.',
    detail: 'Hosted by members. You ask to join, the host looks at your profile and says yes. Each one is marked free, pay at venue, or cost-split.',
  },
  {
    name: 'Kollide events',
    line: 'Supper clubs and long tables.',
    detail: 'Run by our team. You book and pay in the app, and your place is confirmed straight away.',
  },
  {
    name: 'Partner events',
    line: 'Gigs, comedy, rooftops.',
    detail: 'Run by venues. You buy the ticket on the venue’s own site, then join a squad here so you have people to go with.',
  },
]

const SECTIONS: ProseSection[] = [
  {
    id: 'the-idea',
    title: 'The idea',
    body: (
      <>
        <p>
          Most people who stay in on a Friday are not short of things to do. They are short of someone to go with. They
          are new to the city, or their friends have moved, or they would simply rather not walk in alone.
        </p>
        <p>
          Kollide is a social events platform for Bengaluru built around that problem. Every event comes with a small
          group of <strong>verified, reliable people</strong>, so you arrive with company.
        </p>
        <p>
          <strong>Kollide is not a dating app.</strong> People come here to make friends and to find a regular group.
        </p>
      </>
    ),
  },
  {
    id: 'three-kinds',
    title: 'Three kinds of events',
    body: (
      <div className="grid gap-4">
        {EVENT_KINDS.map((kind) => (
          <div key={kind.name} className="rounded-2xl border border-border/70 bg-card p-6 shadow-card">
            <h3 className="font-display text-h4">{kind.name}</h3>
            <p className="mt-0.5 font-medium text-primary">{kind.line}</p>
            <p className="mt-2 text-muted-foreground">{kind.detail}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'joining',
    title: 'Joining an event',
    body: (
      <>
        <ol>
          <li>
            <strong>Make a profile.</strong> Three photos, a few prompts, your interests and your area of Bengaluru. An
            optional selfie check earns the verified badge.
          </li>
          <li>
            <strong>Ask to join, or book.</strong> For community events you send a request. For Kollide events you book
            and pay.
          </li>
          <li>
            <strong>Get the address.</strong> Listings show the area only. The exact address appears once you are
            approved or have paid.
          </li>
          <li>
            <strong>Say you are still coming.</strong> The day before a free event we ask you to confirm. If you can’t
            make it, your place goes to the next person on the waitlist.
          </li>
          <li>
            <strong>Check in.</strong> Show your QR ticket at the door, or the host ticks you off the list.
          </li>
        </ol>
        <p>
          If an event is full, we say so kindly and suggest similar ones. Hosts can approve a few more people than
          there are places, because some guests do not turn up.
        </p>
      </>
    ),
  },
  {
    id: 'squads',
    title: 'Squads',
    body: (
      <>
        <p>
          A squad is a group of <strong>four to six people</strong> going to the same event together. You can start one
          or ask to join one, for any event. They matter most at partner events, where the room is big and you may know
          nobody.
        </p>
        <p>
          Each squad has a meeting point, such as a café near the venue half an hour before. The person who started the
          squad approves each request. Squads can be women-only.
        </p>
      </>
    ),
  },
  {
    id: 'reputation',
    title: 'Reputation',
    body: (
      <>
        <p>What others can see about you is always positive or factual.</p>
        <ul>
          <li>
            <strong>Shows up.</strong> “Shows up: 11 of 12” is counted from check-ins. Cancelling in advance is not held
            against you. Not turning up is.
          </li>
          <li>
            <strong>Tags.</strong> After an event, people who checked in can give each other up to three tags, such as
            “Welcoming” or “Good listener”. Your three most common tags appear on your profile.
          </li>
          <li>
            <strong>New to Kollide.</strong> New members show this badge instead of a score. Nobody starts with a low
            one.
          </li>
        </ul>
        <p>
          There are no star ratings and no written reviews of people. If something felt off, you can say so privately.
          It reaches the person only as a gentle, anonymous tip, and only once several people at different events have
          said the same thing. Read more on the <AppLink to="/safety">safety page</AppLink>.
        </p>
      </>
    ),
  },
  {
    id: 'meet-again',
    title: 'Meet again',
    body: (
      <>
        <p>
          After each event we ask who you would like to see again. Nobody is told who you picked. When two people pick
          each other, they become a connection. When three or more all pick each other, we suggest planning a repeat.
        </p>
        <p>That is how one evening turns into a regular group.</p>
      </>
    ),
  },
  {
    id: 'hosting',
    title: 'Hosting',
    body: (
      <>
        <p>
          Hosts are members we have approved. A host creates an event, sets the house rules, and decides who joins.
          Every new event is checked by our team before it goes live.
        </p>
        <ul>
          <li>House parties are capped at 25 guests, and approval is always on.</li>
          <li>Hosts are rated too, on three questions: was it as described, did it feel safe, was it well organised.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'money',
    title: 'Paying and refunds',
    body: (
      <>
        <p>Community events are free, pay at venue, or cost-split on the night. For Kollide’s own paid events:</p>
        <ul>
          <li>
            <strong>More than 72 hours before:</strong> a full refund.
          </li>
          <li>
            <strong>Inside 72 hours:</strong> the full amount as Kollide credit.
          </li>
          <li>
            <strong>If you do not turn up:</strong> no refund.
          </li>
          <li>
            <strong>If Kollide cancels:</strong> an automatic full refund.
          </li>
        </ul>
      </>
    ),
  },
]

export function Component() {
  return (
    <ProsePage
      eyebrow="How it works"
      title="An evening out, with people worth meeting."
      lead="Kollide helps you find something to do in Bengaluru and a small group to do it with. Here is how the whole thing works, from your first request to your regular table."
      sections={SECTIONS}
    />
  )
}

import { AppLink } from '@/components/shared/app-link'
import { ProsePage, type ProseSection } from '@/components/shared/prose-page'

const SECTIONS: ProseSection[] = [
  {
    id: 'who-can-join',
    title: 'Who can join',
    body: (
      <ul>
        <li>You must be 18 or over.</li>
        <li>Kollide is for people in Bengaluru. Version 1 lists events in this city only.</li>
        <li>You need one account, in your own name, with real photos of you.</li>
      </ul>
    ),
  },
  {
    id: 'your-account',
    title: 'Your account',
    body: (
      <>
        <p>
          Keep your sign-in details to yourself, and keep your profile honest and up to date. You are responsible for
          what happens under your account.
        </p>
        <p>
          By joining you accept the <AppLink to="/safety">code of conduct</AppLink>. <strong>Kollide is not a dating
          app</strong>, and using it as one is a breach of these terms.
        </p>
      </>
    ),
  },
  {
    id: 'events',
    title: 'Events and hosts',
    body: (
      <>
        <ul>
          <li>
            <strong>Community events</strong> are run by members we have approved as hosts. The host decides who joins
            and is responsible for the event.
          </li>
          <li>
            <strong>Partner events</strong> are run by venues. Tickets are bought on the venue’s own site, under the
            venue’s own terms.
          </li>
          <li>
            <strong>Kollide events</strong> are run by us.
          </li>
        </ul>
        <p>
          We check new hosts and review every event before it is listed. We cannot promise how any individual will
          behave, so please use your own judgement, as you would anywhere.
        </p>
      </>
    ),
  },
  {
    id: 'bookings',
    title: 'Bookings and turning up',
    body: (
      <ul>
        <li>A request is not a booking until the host approves it.</li>
        <li>We ask you to confirm you are still coming the day before a free event.</li>
        <li>If you cannot come, cancel as early as you can. Your place goes to the next person waiting.</li>
        <li>Check-ins are recorded, and are used to work out your “Shows up” figure.</li>
      </ul>
    ),
  },
  {
    id: 'payments',
    title: 'Payments and refunds',
    body: (
      <>
        <p>For events paid for through Kollide:</p>
        <ul>
          <li>a full refund if you cancel more than 72 hours before the event;</li>
          <li>the full amount as Kollide credit if you cancel inside 72 hours;</li>
          <li>no refund if you do not turn up;</li>
          <li>an automatic full refund if Kollide cancels the event.</li>
        </ul>
        <p>Cost-split and pay-at-venue amounts are settled between guests, the host and the venue on the day.</p>
      </>
    ),
  },
  {
    id: 'holds-and-removal',
    title: 'Holds, suspension and removal',
    body: (
      <>
        <p>
          If a safety report is made about you, your account is put on hold while we look into it. We may warn, suspend
          or remove a member who breaks the code of conduct.
        </p>
        <p>You can appeal a hold, a suspension or a feedback tip from your settings. A person reviews every appeal.</p>
      </>
    ),
  },
  {
    id: 'changes',
    title: 'Changes',
    body: <p>If these terms change in a way that matters, we will tell you before the change takes effect.</p>,
  },
]

export function Component() {
  return (
    <ProsePage
      eyebrow="Terms"
      title="The agreement, in plain words."
      lead="What you can expect from Kollide, and what we ask of everyone who joins."
      notice="This is a plain-language draft for version 1. It describes how Kollide is designed to work, and it has not had legal review yet."
      sections={SECTIONS}
    />
  )
}

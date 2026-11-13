import { ProsePage, type ProseSection } from '@/components/shared/prose-page'

const SECTIONS: ProseSection[] = [
  {
    id: 'not-a-dating-app',
    title: 'Not a dating app',
    body: (
      <>
        <p>
          <strong>Kollide is not a dating app.</strong> It exists so that people can make friends and find a group to go
          out with. Treating an event, a squad or a profile as a place to pursue someone is against the code of conduct.
        </p>
        <p>
          We say this plainly because it shapes everything else: who we approve as hosts, how profiles are designed, and
          what we act on when something is reported.
        </p>
      </>
    ),
  },
  {
    id: 'code-of-conduct',
    title: 'Code of conduct',
    body: (
      <>
        <p>Everyone accepts this before they join, and it applies at every event.</p>
        <ol>
          <li>
            <strong>Be kind.</strong> Welcome the person who came alone. Most people did.
          </li>
          <li>
            <strong>Turn up when you said you would.</strong> If you can’t, cancel early so someone else gets the place.
          </li>
          <li>
            <strong>Respect a no.</strong> To a drink, a conversation, a photo, a phone number or anything else.
          </li>
          <li>
            <strong>No pursuing.</strong> Do not use Kollide to ask people out or to press for contact details.
          </li>
          <li>
            <strong>Respect the host’s home and rules.</strong> House rules are shown before you request. Follow them.
          </li>
          <li>
            <strong>Nobody is pressured to drink.</strong> Ever.
          </li>
          <li>
            <strong>No harassment or hate.</strong> Not about gender, religion, caste, language, region, sexuality,
            disability, appearance or anything else.
          </li>
          <li>
            <strong>Keep private things private.</strong> Do not share an address, a photo or a profile outside the
            group it was shared with.
          </li>
          <li>
            <strong>Be who your profile says you are.</strong> Real photos, your real first name, your real age.
          </li>
        </ol>
      </>
    ),
  },
  {
    id: 'built-in',
    title: 'What is built in',
    body: (
      <>
        <ul>
          <li>
            <strong>18 and over only.</strong> Age is checked from your date of birth at sign-up. Only your age is ever
            shown.
          </li>
          <li>
            <strong>Verified profiles.</strong> A selfie check earns the verified badge, and hosts see it on every
            request.
          </li>
          <li>
            <strong>Private addresses.</strong> Listings show an area of Bengaluru. The exact address appears only once
            you are approved or have paid.
          </li>
          <li>
            <strong>Women-only events and squads.</strong> There is a filter for them, and only women can join.
          </li>
          <li>
            <strong>Limits on house parties.</strong> At most 25 guests, host approval always on, house rules up front.
          </li>
          <li>
            <strong>Share my plan.</strong> Send the details of where you are going to someone you trust, from the event
            page.
          </li>
          <li>
            <strong>A profile shows only what it needs to.</strong> Never your last name, phone number, email or
            address.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'reporting',
    title: 'Reporting',
    body: (
      <>
        <p>
          Every profile and every event has a report option. Use it for harassment, inappropriate behaviour, feeling
          unsafe, or a profile that does not seem real.
        </p>
        <ul>
          <li>A report goes straight to our team. The other person is never told who made it.</li>
          <li>
            A member who is reported is put <strong>on hold</strong> while we look into it. They cannot send new
            requests during that time.
          </li>
          <li>Depending on what we find, we may warn, suspend or permanently remove the member.</li>
        </ul>
        <p>
          <strong>If you are in immediate danger, call 112.</strong> Kollide’s reports are for our team to review. They
          are not an emergency service.
        </p>
      </>
    ),
  },
  {
    id: 'fair-feedback',
    title: 'Feedback that is hard to abuse',
    body: (
      <>
        <p>Reputation only works if it cannot be gamed or used to settle scores. So:</p>
        <ul>
          <li>Only people who checked in at the same event can review each other, once each, within 72 hours.</li>
          <li>
            Reviews are <strong>double-blind</strong>. Neither person sees the other’s until both have submitted, or the
            72 hours are up.
          </li>
          <li>Only positive tags are public. There are no star ratings and no written reviews of people.</li>
          <li>
            “Something felt off” feedback is private. It counts only once <strong>three or more people</strong> across{' '}
            <strong>two or more events</strong> have said the same thing, and then appears only as a gentle, anonymous
            tip on the person’s own profile.
          </li>
          <li>If you report someone, negative feedback they later give about you is discounted.</li>
          <li>Small groups who only ever rate each other are flagged for review.</li>
          <li>Recent feedback counts most. Things from more than a year ago fade.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'appeals',
    title: 'Appeals',
    body: (
      <p>
        We can get things wrong. If you receive a tip you think is unfair, or your account is put on hold or suspended,
        you can dispute it from your settings. A person on our team reviews every appeal, and you will see it marked as
        under review until they decide.
      </p>
    ),
  },
]

export function Component() {
  return (
    <ProsePage
      eyebrow="Safety and code of conduct"
      title="Safe by design. Women first."
      lead="Meeting new people should feel easy. These are the rules everyone agrees to, the protections built into Kollide, and what happens when something goes wrong."
      sections={SECTIONS}
    />
  )
}

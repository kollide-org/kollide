import { AppLink } from '@/components/shared/app-link'
import { ProsePage, type ProseSection } from '@/components/shared/prose-page'

const SECTIONS: ProseSection[] = [
  {
    id: 'what-we-collect',
    title: 'What we collect',
    body: (
      <>
        <p>We ask only for what Kollide needs to work.</p>
        <ul>
          <li>
            <strong>To create your account:</strong> your email address or Google sign-in, and your phone number.
          </li>
          <li>
            <strong>For your profile:</strong> your first name, date of birth, gender, area of Bengaluru, photos,
            interests, languages and prompt answers.
          </li>
          <li>
            <strong>If you choose to verify:</strong> a selfie, used to check that your profile photos are of you.
          </li>
          <li>
            <strong>As you use Kollide:</strong> the events you request, book and check in to, the squads you join, and
            the feedback you give.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'what-others-see',
    title: 'What other members see',
    body: (
      <>
        <p>Your profile card shows:</p>
        <ul>
          <li>your photos and the verified badge, if you have one;</li>
          <li>your first name, your age and your area;</li>
          <li>your prompts and interests;</li>
          <li>how many events you have attended and how often you turn up;</li>
          <li>your three most common positive tags;</li>
          <li>events you and the viewer have both attended.</li>
        </ul>
        <h3>What is never shown</h3>
        <ul>
          <li>your last name, phone number or email;</li>
          <li>your date of birth, or your exact address;</li>
          <li>your workplace, unless you add it yourself;</li>
          <li>who gave you any tag or any feedback.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'addresses',
    title: 'Event addresses',
    body: (
      <p>
        Event listings show an area, never an address. A host’s exact address is shown only to guests whose booking is
        approved or paid, and to our team. If you host from home, this is what keeps your address private.
      </p>
    ),
  },
  {
    id: 'feedback',
    title: 'Feedback and reports',
    body: (
      <>
        <p>
          Positive tags you give become part of the other person’s public profile, without your name. Private feedback
          and safety reports are seen only by our team. The person concerned is never told who wrote them.
        </p>
        <p>
          The full rules are on the <AppLink to="/safety">safety page</AppLink>.
        </p>
      </>
    ),
  },
  {
    id: 'your-choices',
    title: 'Your choices',
    body: (
      <ul>
        <li>
          <strong>Edit your profile</strong> at any time.
        </li>
        <li>
          <strong>Choose your notifications</strong> in settings.
        </li>
        <li>
          <strong>Delete your account</strong> from settings. Your profile, bookings and connections are removed.
        </li>
      </ul>
    ),
  },
  {
    id: 'what-we-do-not-do',
    title: 'What we do not do',
    body: (
      <ul>
        <li>We do not sell your personal information.</li>
        <li>We do not show your profile to people outside Kollide.</li>
        <li>We do not use your selfie for anything other than verification.</li>
      </ul>
    ),
  },
]

export function Component() {
  return (
    <ProsePage
      eyebrow="Privacy"
      title="What we know, and who sees it."
      lead="A plain account of the information Kollide asks for, what other members can see, and what stays private."
      notice="This is a plain-language draft for version 1. It describes how Kollide is designed to work, and it has not had legal review yet."
      sections={SECTIONS}
    />
  )
}

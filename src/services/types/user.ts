import type { ID, ISODate, ISODateTime } from './common'
import type { SpokenLanguage } from './languages'
import type { Area, CityId, Zone } from './places'
import type { HostRatingSummary, PositiveTag } from './review'
import type { Role } from './role'

export type Gender = 'woman' | 'man' | 'non_binary' | 'prefer_not_to_say'

/**
 * - `on_hold`: a safety report is open. The user cannot send new requests.
 * - `suspended`: an admin has paused the account for a period.
 * - `banned`: the account is closed for good.
 */
export type AccountStatus = 'active' | 'on_hold' | 'suspended' | 'banned'

/**
 * The private account record. Only its owner and admins ever receive it.
 * Nothing here appears on a profile card.
 */
export interface User {
  id: ID
  role: Role
  status: AccountStatus
  email: string
  phone: string | null
  lastName: string | null
  /** Used only to work out age and to enforce the 18+ rule. */
  dateOfBirth: ISODate | null
  onboardingComplete: boolean
  /** When the user accepted the code of conduct and the privacy notice. */
  consentAcceptedAt: ISODateTime | null
  createdAt: ISODateTime
}

export interface Photo {
  id: ID
  url: string
  alt: string
  /** 0 is the main photo. */
  position: number
}

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected'

export interface Verification {
  status: VerificationStatus
  submittedAt: ISODateTime | null
  reviewedAt: ISODateTime | null
}

/** One prompt on a profile. Which fields are used depends on the prompt's kind, in `prompts.ts`. */
export interface ProfilePrompt {
  promptId: string
  question: string
  /** The written answer, or the chosen option for "this or that". Empty for "two truths and a lie". */
  answer: string
  /** "Two truths and a lie": the three statements, and which one is false. */
  statements?: string[]
  lieIndex?: number
}

/** What other members may see about a person. */
export interface Profile {
  userId: ID
  firstName: string
  /** Worked out from the date of birth. The date itself is never exposed. */
  age: number
  gender: Gender
  city: CityId
  /** A listed locality, or one the member typed. */
  area: Area
  zone: Zone
  interests: string[]
  languages: SpokenLanguage[]
  prompts: ProfilePrompt[]
  photos: Photo[]
  verification: Verification
  /** Shown only if the user chose to add it. */
  workplace: string | null
  joinedAt: ISODateTime
}

export interface Reliability {
  showedUp: number
  outOf: number
}

export interface TagCount {
  tag: PositiveTag
  count: number
}

/**
 * Public reputation. Every value is calculated from check-ins and revealed
 * reviews when it is requested. None of it is stored, so none of it can be edited.
 */
export interface Reputation {
  eventsAttended: number
  /** `null` while the person is new, so a new member never shows a low score. */
  reliability: Reliability | null
  /** The three positive tags received most often. */
  topTags: TagCount[]
  /** True until the person has enough history. Shown as "New to Kollide". */
  isNew: boolean
}

export interface SharedEvent {
  eventId: ID
  title: string
}

/** A small reference to a person, for avatars and lists. */
export interface PersonPreview {
  userId: ID
  firstName: string
  photoUrl: string | null
  verified: boolean
}

export type HostStatus = 'pending' | 'approved' | 'declined'

/** A member who has applied, or been approved, to create events. */
export interface Host {
  userId: ID
  status: HostStatus
  about: string
  appliedAt: ISODateTime
  decidedAt: ISODateTime | null
}

/** What an event page shows about its host. */
export interface HostSummary extends PersonPreview {
  eventsHosted: number
  rating: HostRatingSummary | null
}

/** Everything the Hinge-style profile card shows. */
export interface ProfileCard extends Profile {
  reputation: Reputation
  /** Events both this person and the viewer checked in to. */
  eventsInCommon: SharedEvent[]
  host: HostSummary | null
  /** True while a safety report is open. The card shows an "on hold" state. */
  onHold: boolean
}

export interface OnboardingInput {
  firstName: string
  lastName?: string
  dateOfBirth: ISODate
  gender: Gender
  city: CityId
  area: Area
  /** Needed only for an area that is not in the list. A listed area's zone is looked up. */
  zone?: Zone
  interests: string[]
  languages: SpokenLanguage[]
  prompts: ProfilePrompt[]
  /** Local object URLs or data URLs from the cropper. */
  photos: { url: string; alt: string }[]
  phone: string
  acceptedConduct: boolean
  acceptedPrivacy: boolean
}

export type ProfilePatch = Partial<
  Pick<Profile, 'area' | 'interests' | 'languages' | 'prompts' | 'workplace'> & {
    /** With `area`, for an area that is not in the list. */
    zone: Zone
    photos: { url: string; alt: string }[]
  }
>

export interface Session {
  user: User
  /** `null` until onboarding is complete. */
  profile: Profile | null
}

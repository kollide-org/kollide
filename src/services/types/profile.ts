export type Gender = 'woman' | 'man' | 'non_binary' | 'prefer_not_to_say'
export type UserStatus = 'active' | 'on_hold' | 'suspended' | 'banned'
export type AppRole = 'admin' | 'host'

export interface Prompt {
  prompt: string
  answer: string
}

/** Everything the signed-in person may see about themselves. */
export interface MyProfile {
  id: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  dateOfBirth: string | null
  gender: Gender | null
  email: string | null
  areaId: number | null
  bioPrompts: Prompt[]
  isVerified: boolean
  onboardingCompletedAt: string | null
  deletedAt: string | null
  status: UserStatus | null
  photoKeys: string[]
  interestIds: number[]
  languageIds: number[]
  roles: AppRole[]
}

export interface OnboardingInput {
  firstName: string
  lastName?: string
  phone?: string
  dateOfBirth: string
  gender: Gender
  areaId: number
  interestIds: number[]
  languageIds: number[]
  prompts: Prompt[]
  photoKeys: string[]
  noticeVersion: string
  acceptConduct: boolean
  acceptPrivacy: boolean
}

export interface ProfileUpdate {
  firstName?: string
  lastName?: string
  phone?: string
  areaId?: number
  prompts?: Prompt[]
  interestIds?: number[]
  languageIds?: number[]
}

export interface ProfileService {
  /** Null when nobody is signed in. */
  getMyProfile(): Promise<MyProfile | null>
  completeOnboarding(input: OnboardingInput): Promise<void>
  updateMyProfile(update: ProfileUpdate): Promise<void>
  /** Anonymises the account and signs the person out. */
  deleteMyAccount(): Promise<void>
  exportMyData(): Promise<unknown>
}

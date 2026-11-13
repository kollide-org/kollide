import type { Appeal, GentleTip, ID, OnboardingInput, Profile, ProfileCard, ProfilePatch, Verification } from '../types'

export interface ProfileService {
  getMyProfile(): Promise<Profile | null>
  /** The public card for any member, with reputation and events in common. */
  getProfileCard(userId: ID): Promise<ProfileCard>
  /** Completes onboarding. Rejects anyone under 18. */
  completeOnboarding(input: OnboardingInput): Promise<Profile>
  updateProfile(patch: ProfilePatch): Promise<Profile>
  /** Sends the optional selfie. The badge shows "pending review" until an admin decides. */
  submitVerificationSelfie(): Promise<Verification>
  /** Gentle tips for the signed-in user only. Nobody else ever sees them. */
  getMyTips(): Promise<GentleTip[]>
  getMyAppeals(): Promise<Appeal[]>
  submitAppeal(input: { about: Appeal['about']; reference: string; message: string }): Promise<Appeal>
}

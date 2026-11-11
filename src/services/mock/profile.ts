import type { MyProfile, ProfileService, ProfileUpdate, VerificationState } from '../types/profile'
import { currentMockRole, mockAuth } from './auth'

let overrides: ProfileUpdate = {}
let photoKeys: (string | undefined)[] = []
let verification: VerificationState = 'none'

export const mockProfile: ProfileService = {
  async getMyProfile() {
    const role = currentMockRole()
    if (role === 'visitor') return null
    const profile: MyProfile = {
      id: `mock-${role}`,
      firstName: overrides.firstName ?? 'Meera',
      lastName: overrides.lastName ?? 'Iyer',
      phone: overrides.phone ?? '+910000000003',
      dateOfBirth: '1996-11-21',
      gender: 'woman',
      email: `${role}@kollide.test`,
      areaId: overrides.areaId ?? 3,
      bioPrompts: overrides.prompts ?? [
        { prompt: 'A perfect Saturday', answer: 'Filter coffee, then a long walk.' },
        { prompt: 'Hidden talent', answer: 'I can parallel park anywhere.' },
      ],
      isVerified: true,
      onboardingCompletedAt: '2026-01-01T00:00:00Z',
      deletedAt: null,
      status: 'active',
      photos: photoKeys.flatMap((key, index) => (key ? [{ position: index + 1, key }] : [])),
      interestIds: overrides.interestIds ?? [1, 2],
      languageIds: overrides.languageIds ?? [1, 2],
      roles: role === 'admin' ? ['admin'] : role === 'host' ? ['host'] : [],
    }
    return profile
  },
  async completeOnboarding() {},
  async updateMyProfile(update) {
    overrides = { ...overrides, ...update }
  },
  async deleteMyAccount() {
    await mockAuth.signOut()
  },
  async exportMyData() {
    return { mock: true, note: 'Mock data. Switch VITE_SERVICES to real for a real export.' }
  },
  async setProfilePhoto(position, key) {
    photoKeys = [...photoKeys]
    photoKeys[position - 1] = key
  },
  async removeProfilePhoto(position) {
    photoKeys = photoKeys.map((key, index) => (index === position - 1 ? undefined : key))
  },
  async submitSelfie() {
    verification = 'pending'
  },
  async getVerificationState() {
    return verification
  },
}

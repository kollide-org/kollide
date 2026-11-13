import { activeTipCategories, TIP_MESSAGES, type FeedbackContext } from '@/domain/private-feedback'
import { daysBetween, isAdult } from '@/domain/time'

import type { ProfileService } from '../interfaces'
import type { GentleTip } from '../types'

import { getDb, saveDb, type Db } from './db'
import { copy, invalid, latency, newId, now, nowIso, requireUser } from './runtime'
import { profileCard, profileOf, reputationOf } from './views'

/** What the private-feedback rules need to know about the people who gave it. */
export function feedbackContext(db: Db, at: Date): FeedbackContext {
  return {
    now: at,
    priorReports: db.safetyReports
      .filter((report) => report.subjectType === 'user')
      .map((report) => ({ reporterId: report.reporterId, subjectId: report.subjectId, createdAt: report.createdAt })),
    standingOf: (reviewerId) => {
      const user = db.users.find((candidate) => candidate.id === reviewerId)
      const profile = db.profiles.find((candidate) => candidate.userId === reviewerId)
      return {
        verified: profile?.verification.status === 'verified',
        accountAgeDays: user ? daysBetween(user.createdAt, at) : 0,
        reliability: reputationOf(db, reviewerId, at).reliability,
      }
    },
  }
}

function toPhotos(userId: string, photos: { url: string; alt: string }[]) {
  return photos.map((photo, index) => ({ id: `${userId}-photo-${index + 1}`, url: photo.url, alt: photo.alt, position: index }))
}

export const mockProfileService: ProfileService = {
  async getMyProfile() {
    await latency()
    const db = getDb()
    const user = requireUser(db)
    return db.profiles.some((profile) => profile.userId === user.id) ? copy(profileOf(db, user.id, now())) : null
  },

  async getProfileCard(userId) {
    await latency()
    const db = getDb()
    const viewer = requireUser(db)
    return copy(profileCard(db, userId, viewer.id, now()))
  },

  async completeOnboarding(input) {
    await latency(1.2)
    const db = getDb()
    const user = requireUser(db)
    if (!isAdult(input.dateOfBirth, now())) throw invalid('Kollide is for people aged 18 and over.')
    if (!input.firstName.trim()) throw invalid('Add your first name.')
    if (input.photos.length < 3) throw invalid('Add three photos.')
    if (input.interests.length === 0) throw invalid('Pick at least one interest.')
    if (input.prompts.length < 2 || input.prompts.length > 3) throw invalid('Answer two or three prompts.')
    if (!input.acceptedConduct || !input.acceptedPrivacy) {
      throw invalid('Accept the code of conduct and the privacy notice to continue.')
    }

    user.lastName = input.lastName?.trim() || null
    user.dateOfBirth = input.dateOfBirth
    user.phone = input.phone.trim()
    user.onboardingComplete = true
    user.consentAcceptedAt = nowIso()

    db.profiles = db.profiles.filter((profile) => profile.userId !== user.id)
    db.profiles.push({
      userId: user.id,
      firstName: input.firstName.trim(),
      gender: input.gender,
      area: input.area,
      interests: input.interests,
      languages: input.languages,
      prompts: input.prompts,
      photos: toPhotos(user.id, input.photos),
      verification: { status: 'unverified', submittedAt: null, reviewedAt: null },
      workplace: null,
      joinedAt: user.createdAt,
    })
    saveDb()
    return copy(profileOf(db, user.id, now()))
  },

  async updateProfile(patch) {
    await latency()
    const db = getDb()
    const user = requireUser(db)
    const profile = db.profiles.find((candidate) => candidate.userId === user.id)
    if (!profile) throw invalid('Finish your profile first.')
    if (patch.area) profile.area = patch.area
    if (patch.interests) profile.interests = patch.interests
    if (patch.languages) profile.languages = patch.languages
    if (patch.prompts) profile.prompts = patch.prompts
    if (patch.workplace !== undefined) profile.workplace = patch.workplace?.trim() || null
    if (patch.photos) profile.photos = toPhotos(user.id, patch.photos)
    saveDb()
    return copy(profileOf(db, user.id, now()))
  },

  async submitVerificationSelfie() {
    await latency(1.4)
    const db = getDb()
    const user = requireUser(db)
    const profile = db.profiles.find((candidate) => candidate.userId === user.id)
    if (!profile) throw invalid('Finish your profile first.')
    if (profile.verification.status === 'verified') return copy(profile.verification)
    profile.verification = { status: 'pending', submittedAt: nowIso(), reviewedAt: null }
    saveDb()
    return copy(profile.verification)
  },

  async getMyTips() {
    await latency()
    const db = getDb()
    const user = requireUser(db)
    const at = now()
    const about = db.privateFeedback.filter((feedback) => feedback.subjectId === user.id)
    const tips: GentleTip[] = activeTipCategories(about, feedbackContext(db, at))
      .filter((category): category is keyof typeof TIP_MESSAGES => category !== 'other')
      .map((category) => ({
        category,
        message: TIP_MESSAGES[category],
        appeal:
          db.appeals
            .filter((appeal) => appeal.userId === user.id && appeal.about === 'tip' && appeal.reference === category)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null,
      }))
      // A tip is withdrawn once an appeal against it succeeds.
      .filter((tip) => tip.appeal?.status !== 'overturned')
    return copy(tips)
  },

  async getMyAppeals() {
    await latency()
    const db = getDb()
    const user = requireUser(db)
    return copy(db.appeals.filter((appeal) => appeal.userId === user.id))
  },

  async submitAppeal(input) {
    await latency()
    const db = getDb()
    const user = requireUser(db)
    if (input.message.trim().length < 10) throw invalid('Tell us a little more, so we can look into it properly.')
    const open = db.appeals.find(
      (appeal) =>
        appeal.userId === user.id &&
        appeal.about === input.about &&
        appeal.reference === input.reference &&
        appeal.status === 'under_review',
    )
    if (open) return copy(open)
    const appeal = {
      id: newId('ap'),
      userId: user.id,
      about: input.about,
      reference: input.reference,
      message: input.message.trim(),
      status: 'under_review' as const,
      createdAt: nowIso(),
      decidedAt: null,
    }
    db.appeals.push(appeal)
    saveDb()
    return copy(appeal)
  },
}

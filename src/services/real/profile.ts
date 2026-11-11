import type { Json } from '@/types/database'

import { ServiceError } from '../types/errors'
import type { AppRole, MyProfile, Prompt, ProfileService } from '../types/profile'

const client = () => import('./client').then((module) => module.supabase)

/** Database errors raised by our functions carry a short code as the message, for example `under_18`. */
function toServiceError(error: { message: string; code?: string }): ServiceError {
  return /^[a-z0-9_]+$/.test(error.message)
    ? new ServiceError(error.message)
    : new ServiceError('unknown', error.message)
}

type Row = Record<string, unknown>

function parseProfile(raw: Json): MyProfile {
  const r = raw as Row
  const str = (key: string) => (typeof r[key] === 'string' ? (r[key] as string) : null)
  const nums = (key: string) => (Array.isArray(r[key]) ? (r[key] as number[]) : [])
  return {
    id: r.id as string,
    firstName: str('first_name'),
    lastName: str('last_name'),
    phone: str('phone'),
    dateOfBirth: str('date_of_birth'),
    gender: str('gender') as MyProfile['gender'],
    email: str('email'),
    areaId: typeof r.area_id === 'number' ? r.area_id : null,
    bioPrompts: Array.isArray(r.bio_prompts) ? (r.bio_prompts as Prompt[]) : [],
    isVerified: r.is_verified === true,
    onboardingCompletedAt: str('onboarding_completed_at'),
    deletedAt: str('deleted_at'),
    status: str('status') as MyProfile['status'],
    photoKeys: Array.isArray(r.photo_keys) ? (r.photo_keys as string[]) : [],
    interestIds: nums('interest_ids'),
    languageIds: nums('language_ids'),
    roles: Array.isArray(r.roles) ? (r.roles as AppRole[]) : [],
  }
}

export const realProfile: ProfileService = {
  async getMyProfile() {
    const supabase = await client()
    const { data, error } = await supabase.rpc('get_my_profile')
    if (error) throw toServiceError(error)
    return data ? parseProfile(data) : null
  },

  async completeOnboarding(input) {
    const supabase = await client()
    const { error } = await supabase.rpc('complete_onboarding', {
      p_first_name: input.firstName,
      p_date_of_birth: input.dateOfBirth,
      p_gender: input.gender,
      p_area_id: input.areaId,
      p_interest_ids: input.interestIds,
      p_language_ids: input.languageIds,
      p_prompts: input.prompts as unknown as Json,
      p_photo_keys: input.photoKeys,
      p_notice_version: input.noticeVersion,
      p_accept_conduct: input.acceptConduct,
      p_accept_privacy: input.acceptPrivacy,
      p_last_name: input.lastName,
      p_phone: input.phone,
    })
    if (error) throw toServiceError(error)
  },

  async updateMyProfile(update) {
    const supabase = await client()
    const { error } = await supabase.rpc('update_my_profile', {
      p_first_name: update.firstName,
      p_last_name: update.lastName,
      p_phone: update.phone,
      p_area_id: update.areaId,
      p_bio_prompts: update.prompts as unknown as Json | undefined,
      p_interest_ids: update.interestIds,
      p_language_ids: update.languageIds,
    })
    if (error) throw toServiceError(error)
  },

  async deleteMyAccount() {
    const supabase = await client()
    const { error } = await supabase.rpc('delete_my_account')
    if (error) throw toServiceError(error)
    await supabase.auth.signOut({ scope: 'local' })
  },

  async exportMyData() {
    const supabase = await client()
    const { data, error } = await supabase.rpc('export_my_data')
    if (error) throw toServiceError(error)
    return data
  },
}

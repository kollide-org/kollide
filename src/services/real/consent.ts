import { ServiceError } from '../types/errors'
import type { ConsentService, StoredChoice } from '../types/consent'

const client = () => import('./client').then((module) => module.supabase)

export const realConsent: ConsentService = {
  async record(anonymousId, noticeVersion, choice) {
    const supabase = await client()
    const { error } = await supabase.rpc('record_consent', {
      p_anonymous_id: anonymousId, p_notice_version: noticeVersion,
      p_preferences: choice.preferences, p_analytics: choice.analytics, p_marketing: choice.marketing,
    })
    if (error) throw new ServiceError(/^[a-z0-9_]+$/.test(error.message) ? error.message : 'unknown', error.message)
  },

  async mine(): Promise<StoredChoice | null> {
    const supabase = await client()
    const { data, error } = await supabase.rpc('my_consent')
    if (error) throw new ServiceError('unknown', error.message)
    const rows = data ?? []
    const analytics = rows.find((r) => r.purpose === 'analytics')
    if (!analytics) return null
    const answer = (purpose: string) => rows.find((r) => r.purpose === purpose)?.granted === true
    return { noticeVersion: analytics.notice_version, preferences: answer('preferences'), analytics: analytics.granted, marketing: answer('marketing') }
  },
}

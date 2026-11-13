import { analyticsConfigured, capture } from './posthog'

export { identifyUser, startAnalytics, stopAnalytics, analyticsConfigured, purgeAnalyticsStorage } from './posthog'
export { loadMarketingPixels, marketingPixelsLoaded, clearMarketingCookies } from './marketing'

/**
 * Interest events. They do nothing unless the person allows Analytics and a PostHog key is set. Only non-personal values go in:
 * ids, categories, counts. Never a name, an email, a phone number, an address or anything a person typed.
 */
export type InterestEvent =
  | { name: 'event_viewed'; props: { event_id: string; category: string | null; area: string | null; price_band: string; hub: string | null } }
  | { name: 'filter_applied'; props: { filters: string[]; active_count: number } }
  | { name: 'search_performed'; props: { active_count: number; result_count: number } }
  | { name: 'squad_viewed'; props: { event_id: string | null; squad_count: number } }

export function track<E extends InterestEvent>(event: E['name'], props: Extract<InterestEvent, { name: E['name'] }>['props']): void {
  if (!analyticsConfigured()) return
  capture(event, props)
}

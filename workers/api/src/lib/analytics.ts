import type { Env } from '../env'

export interface PartnerClick {
  eventId: string
}

/**
 * Hooks for analytics. They do nothing in B4: B8 replaces them with server-side PostHog events
 * (`partner_link_clicked`). They are an object so tests can watch them.
 */
export const analyticsHooks: {
  partnerClick: (env: Env, click: PartnerClick) => Promise<void>
} = {
  partnerClick: async () => {},
}

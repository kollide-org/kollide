import type { Env } from '../env'
import { capture } from './posthog'
import { supabaseAdmin } from './supabase-admin'

export interface PartnerClick {
  eventId: string
  /** The signed-in person who clicked, only when their browser said they allow analytics (the database checks again). */
  userId?: string
}

/**
 * Hooks for analytics. The partner click is counted in the database (one counter per event per day, nothing personal) so
 * admins can show partners how many people we sent, and is also sent to PostHog (`partner_link_clicked`) for people who consented.
 * They are an object so tests can watch them.
 */
export const analyticsHooks: {
  partnerClick: (env: Env, click: PartnerClick) => Promise<void>
} = {
  partnerClick: async (env, click) => {
    const db = supabaseAdmin(env)
    await db.rpc('record_partner_click', { p_event: click.eventId })
    // A PostHog event too, but only for a signed-in person who allows Analytics. A made-up user id can only add a click for
    // someone who has already agreed; it can never reveal anything.
    if (click.userId && env.POSTHOG_API_KEY && env.ENVIRONMENT !== 'local') {
      if (await db.rpc<boolean>('analytics_consent_ok', { p_user: click.userId })) {
        await capture(env.POSTHOG_API_KEY, [
          { event: 'partner_link_clicked', distinct_id: click.userId, properties: { event_id: click.eventId, env: env.ENVIRONMENT }, timestamp: new Date().toISOString() },
        ])
      }
    }
  },
}

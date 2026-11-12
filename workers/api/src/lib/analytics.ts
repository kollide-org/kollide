import type { Env } from '../env'
import { supabaseAdmin } from './supabase-admin'

export interface PartnerClick {
  eventId: string
}

/**
 * Hooks for analytics. The partner click is counted in the database (one counter per event per day, nothing personal) so
 * admins can show partners how many people we sent. B8 adds a server-side PostHog event (`partner_link_clicked`) next to it.
 * They are an object so tests can watch them.
 */
export const analyticsHooks: {
  partnerClick: (env: Env, click: PartnerClick) => Promise<void>
} = {
  partnerClick: async (env, click) => {
    await supabaseAdmin(env).rpc('record_partner_click', { p_event: click.eventId })
  },
}

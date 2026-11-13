import { Hono } from 'hono'

import { analyticsHooks } from '../lib/analytics'
import { dbErrorResponse, type AppEnv } from '../lib/http'
import { supabaseAdmin } from '../lib/supabase-admin'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const go = new Hono<AppEnv>()

/**
 * GET /go/:eventId  (public)
 * "Get tickets" for a partner event. Records the click (a hook for B8's analytics), then redirects to the
 * partner's link with our referral code, so we can show partners how many people we sent.
 * Only published partner events with an https link are followed; everything else is a 404.
 */
go.get('/:eventId', async (c) => {
  const id = c.req.param('eventId')
  if (!UUID.test(id)) return c.json({ error: 'not_found' }, 404)

  let row: { partner_url: string | null; referral_code: string | null } | undefined
  try {
    row = (
      await supabaseAdmin(c.env).select<{ partner_url: string | null; referral_code: string | null }>(
        `events?id=eq.${id}&type=eq.partner&status=eq.published&select=partner_url,referral_code`,
      )
    )[0]
  } catch (error) {
    const { body, status } = dbErrorResponse(error)
    return c.json(body, status)
  }
  if (!row?.partner_url) return c.json({ error: 'not_found' }, 404)

  let target: URL
  try {
    target = new URL(row.partner_url)
  } catch {
    return c.json({ error: 'not_found' }, 404)
  }
  if (target.protocol !== 'https:') return c.json({ error: 'not_found' }, 404)

  if (row.referral_code) target.searchParams.set('ref', row.referral_code)
  target.searchParams.set('utm_source', 'kollide')
  target.searchParams.set('utm_medium', 'referral')

  // The click is recorded without making the person wait for it.
  const user = c.req.query('u')
  const record = analyticsHooks.partnerClick(c.env, { eventId: id, userId: user && UUID.test(user) ? user.toLowerCase() : undefined }).catch(() => {})
  try {
    c.executionCtx.waitUntil(record)
  } catch {
    await record // no execution context (tests)
  }

  c.header('cache-control', 'no-store')
  return c.redirect(target.toString(), 302)
})

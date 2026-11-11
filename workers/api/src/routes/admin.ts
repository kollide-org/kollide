import { Hono } from 'hono'

import { dbErrorResponse, requireUser, type AppEnv } from '../lib/http'
import { presign, URL_LIFETIME_SECONDS } from '../lib/r2'
import { supabaseAdmin } from '../lib/supabase-admin'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const admin = new Hono<AppEnv>()

/**
 * GET /admin/selfies/:id/view
 * Admins only. Returns a 5-minute link to a selfie that is still waiting for review.
 * The role is read from the database (user_roles), never from the token.
 */
admin.get('/selfies/:id/view', requireUser, async (c) => {
  const id = c.req.param('id')
  if (!UUID.test(id)) return c.json({ error: 'not_found' }, 404)
  const db = supabaseAdmin(c.env)

  try {
    const roles = await db.select<{ role: string }>(`user_roles?user_id=eq.${c.get('userId')}&role=eq.admin&select=role`)
    if (roles.length === 0) return c.json({ error: 'not_allowed' }, 403)

    const rows = await db.select<{ selfie_key: string | null; result: string }>(
      `verifications?id=eq.${id}&select=selfie_key,result`,
    )
    const row = rows[0]
    if (!row || !row.selfie_key || row.result !== 'pending') return c.json({ error: 'not_found' }, 404)

    const url =
      c.env.ENVIRONMENT === 'local'
        ? `${new URL(c.req.url).origin}/dev/private/${row.selfie_key}`
        : await presign(c.env, 'GET', c.env.R2_PRIVATE_BUCKET, row.selfie_key)
    return c.json({ url, expiresIn: URL_LIFETIME_SECONDS })
  } catch (error) {
    const { body, status } = dbErrorResponse(error)
    return c.json(body, status)
  }
})

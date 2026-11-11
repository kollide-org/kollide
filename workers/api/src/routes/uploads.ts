import { Hono } from 'hono'

import { dbErrorResponse, requireUser, type AppEnv } from '../lib/http'
import { presign, URL_LIFETIME_SECONDS } from '../lib/r2'
import { supabaseAdmin } from '../lib/supabase-admin'

const PURPOSES = ['profile_photo', 'event_cover', 'hub_art', 'selfie'] as const
type Purpose = (typeof PURPOSES)[number]

// Absolute ceiling for any image. The database applies the exact cap per purpose (300 KB, selfie 500 KB).
const MAX_BYTES = 512_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const uploads = new Hono<AppEnv>()

/**
 * POST /uploads/sign  { purpose, contentType, size, eventId? }
 * The database decides who may upload what (role, limits) and records the key. Then we presign a
 * 5-minute PUT link. The browser uploads straight to R2 and afterwards attaches the key with a database function.
 */
uploads.post('/sign', requireUser, async (c) => {
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  const purpose = body?.purpose as Purpose
  const contentType = body?.contentType
  const size = body?.size
  const eventId = body?.eventId

  if (!PURPOSES.includes(purpose)) return c.json({ error: 'invalid_purpose' }, 400)
  if (contentType !== 'image/webp') return c.json({ error: 'invalid_type' }, 400)
  if (typeof size !== 'number' || !Number.isInteger(size) || size < 1 || size > MAX_BYTES) {
    return c.json({ error: 'too_large' }, 400)
  }
  if (eventId !== undefined && (typeof eventId !== 'string' || !UUID.test(eventId))) {
    return c.json({ error: 'invalid_event' }, 400)
  }

  let key: string
  try {
    key = await supabaseAdmin(c.env).rpc<string>('authorize_upload', {
      p_user: c.get('userId'),
      p_purpose: purpose,
      p_event: eventId ?? null,
      p_content_type: contentType,
      p_size: size,
    })
  } catch (error) {
    const { body: errorBody, status } = dbErrorResponse(error)
    return c.json(errorBody, status)
  }

  const bucketName = purpose === 'selfie' ? c.env.R2_PRIVATE_BUCKET : c.env.R2_MEDIA_BUCKET
  const url =
    c.env.ENVIRONMENT === 'local'
      ? // Local development has no real R2: uploads go to this Worker's own simulated bucket.
        `${new URL(c.req.url).origin}/dev/upload/${purpose === 'selfie' ? 'private' : 'media'}/${key}`
      : await presign(c.env, 'PUT', bucketName, key, { 'content-type': contentType, 'content-length': String(size) })

  return c.json({ url, key, method: 'PUT', headers: { 'content-type': contentType }, expiresIn: URL_LIFETIME_SECONDS })
})

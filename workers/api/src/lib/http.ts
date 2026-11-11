import { createMiddleware } from 'hono/factory'

import type { Env } from '../env'
import { authenticate } from './auth'
import { DbError } from './supabase-admin'

export type AppEnv = { Bindings: Env; Variables: { userId: string } }

/** Rejects the request unless it carries a valid Supabase access token. */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const claims = await authenticate(c.req.raw, c.env)
  if (!claims) return c.json({ error: 'unauthorized' }, 401)
  c.set('userId', claims.sub)
  await next()
})

const STATUS: Record<string, number> = {
  not_allowed: 403,
  not_active: 403,
  not_found: 404,
  invalid_type: 400,
  invalid_purpose: 400,
  invalid_size: 400,
  too_large: 400,
  event_required: 400,
  too_many_uploads: 429,
  verification_pending: 409,
}

/** Turns a database error into an HTTP response. Unknown errors become a plain 500 with no detail. */
export function dbErrorResponse(error: unknown): { body: { error: string }; status: 400 | 403 | 404 | 409 | 429 | 500 } {
  if (error instanceof DbError) {
    const status = STATUS[error.code]
    if (status) return { body: { error: error.code }, status: status as 400 | 403 | 404 | 409 | 429 }
  }
  return { body: { error: 'server_error' }, status: 500 }
}

/** Compares two strings in constant time, so the shared secret cannot be guessed byte by byte. */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b)),
  ])
  const x = new Uint8Array(ha)
  const y = new Uint8Array(hb)
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!
  return diff === 0 && a.length > 0
}

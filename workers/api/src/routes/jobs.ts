import { Hono } from 'hono'

import type { Env } from '../env'
import { dbErrorResponse, safeEqual, type AppEnv } from '../lib/http'
import { supabaseAdmin } from '../lib/supabase-admin'

const DAY_MS = 24 * 60 * 60 * 1000
const PAGE = 500 // objects looked at per bucket per run: keeps each call small and fast
const MEDIA_KEYS = /^(profiles|events|hubs)\//
const PRIVATE_KEYS = /^selfies\//

export const jobs = new Hono<AppEnv>()

async function sweep(
  bucket: R2Bucket,
  name: 'media' | 'private',
  pattern: RegExp,
  cursor: string | undefined,
  env: Pick<Env, 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY'>,
) {
  const listing = await bucket.list({ limit: PAGE, cursor })
  const cutoff = Date.now() - DAY_MS
  const candidates = listing.objects.filter((o) => pattern.test(o.key) && o.uploaded.getTime() < cutoff).map((o) => o.key)
  let deleted = 0
  if (candidates.length > 0) {
    const orphans = await supabaseAdmin(env).rpc<string[]>('unreferenced_keys', { p_bucket: name, p_keys: candidates })
    if (orphans.length > 0) {
      await bucket.delete(orphans)
      deleted = orphans.length
    }
  }
  return { deleted, next: listing.truncated ? listing.cursor : null }
}

/**
 * POST /jobs/r2-cleanup   header: X-Job-Secret
 * 1. Deletes the objects queued for deletion (reviewed selfies, replaced photos, deleted accounts).
 * 2. Deletes objects older than 24 hours that the database no longer references. One page per bucket per
 *    call; the response carries cursors so the caller can continue (body: { mediaCursor, privateCursor }).
 * 3. Drops old upload bookkeeping.
 */
jobs.post('/r2-cleanup', async (c) => {
  if (!(await safeEqual(c.req.header('x-job-secret') ?? '', c.env.JOB_SHARED_SECRET ?? ''))) {
    return c.json({ error: 'unauthorized' }, 401)
  }
  const input = ((await c.req.json().catch(() => null)) ?? {}) as { mediaCursor?: string; privateCursor?: string }
  const db = supabaseAdmin(c.env)

  try {
    const queued = await db.rpc<{ id: number; bucket: 'media' | 'private'; key: string }[]>('claim_deletions', { p_limit: PAGE })
    for (const bucket of ['media', 'private'] as const) {
      const keys = queued.filter((row) => row.bucket === bucket).map((row) => row.key)
      if (keys.length > 0) await (bucket === 'media' ? c.env.MEDIA : c.env.PRIVATE).delete(keys)
    }
    if (queued.length > 0) await db.rpc('mark_deletions_done', { p_ids: queued.map((row) => row.id) })

    const media = await sweep(c.env.MEDIA, 'media', MEDIA_KEYS, input.mediaCursor, c.env)
    const priv = await sweep(c.env.PRIVATE, 'private', PRIVATE_KEYS, input.privateCursor, c.env)
    const purged = await db.rpc<number>('purge_old_upload_keys')

    return c.json({
      deletedQueued: queued.length,
      deletedOrphans: { media: media.deleted, private: priv.deleted },
      purged,
      cursors: { media: media.next, private: priv.next },
    })
  } catch (error) {
    const { body, status } = dbErrorResponse(error)
    return c.json(body, status)
  }
})

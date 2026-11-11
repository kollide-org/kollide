import { Hono } from 'hono'

import type { Env } from '../env'
import { sendBrevo } from '../lib/brevo'
import { renderEmail, type EmailRow } from '../emails/templates'
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


// ---------------------------------------------------------------- email
const DAILY_CAP = 280 // Brevo's free plan allows 300 a day; we stop early to keep a margin
const WARN_AT = Math.floor(DAILY_CAP * 0.8)
const PER_RUN = 20 // Cloudflare's free plan allows 50 subrequests per call

type Outcome = { id: number; outcome: 'sent' | 'retry' | 'failed' | 'skipped'; message_id?: string; error?: string }

async function deliver(env: Env, row: EmailRow): Promise<Outcome> {
  if (!row.to_email) return { id: row.id, outcome: 'failed', error: 'no recipient (the person was deleted)' }
  const rendered = renderEmail(row, { siteUrl: env.SITE_URL.replace(/\/$/, '') })
  if (!rendered) return { id: row.id, outcome: 'failed', error: `unknown template ${row.template}` }

  if (env.ENVIRONMENT === 'staging' && env.EMAIL_ALLOWLIST) {
    const allowed = env.EMAIL_ALLOWLIST.split(',').map((a) => a.trim().toLowerCase())
    if (!allowed.includes(row.to_email.toLowerCase())) {
      return { id: row.id, outcome: 'skipped', error: 'not on the staging allow-list' }
    }
  }

  if (env.ENVIRONMENT === 'local') {
    // Nothing leaves the machine: the email lands in a dev mailbox the tests and developers can read at /dev/mail.
    await env.MEDIA.put(`dev-mail/${String(row.id).padStart(10, '0')}.json`, JSON.stringify({ id: row.id, to: row.to_email, template: row.template, data: row.data, ...rendered }))
    return { id: row.id, outcome: 'sent', message_id: `dev-${row.id}` }
  }

  const result = await sendBrevo(env.BREVO_API_KEY, {
    fromEmail: env.EMAIL_FROM, fromName: env.EMAIL_FROM_NAME || 'Kollide', to: row.to_email, ...rendered,
  })
  if (result.ok) return { id: row.id, outcome: 'sent', message_id: result.messageId }
  return { id: row.id, outcome: result.retry ? 'retry' : 'failed', error: result.error }
}

/**
 * POST /jobs/flush-email   header: X-Job-Secret   (called every minute by pg_cron through pg_net)
 * Sends queued emails through Brevo: critical ones first, at most 20 a run and 280 a day (UTC), retries are
 * handled by the database (the first try plus 3 retries). Records its result in job_runs.
 */
jobs.post('/flush-email', async (c) => {
  if (!(await safeEqual(c.req.header('x-job-secret') ?? '', c.env.JOB_SHARED_SECRET ?? ''))) {
    return c.json({ error: 'unauthorized' }, 401)
  }
  const db = supabaseAdmin(c.env)
  const record = (status: 'ok' | 'warning' | 'error' | 'skipped', detail: Record<string, unknown> | null, error?: string) =>
    db.rpc('record_job_run', { p_job: 'flush-email', p_status: status, p_detail: detail, p_error: error ?? null }).catch(() => {})

  try {
    if (c.env.ENVIRONMENT !== 'local' && (!c.env.BREVO_API_KEY || !c.env.EMAIL_FROM)) {
      await record('skipped', { reason: 'BREVO_API_KEY or EMAIL_FROM is not set' })
      return c.json({ sent: 0, skipped: 'not configured' })
    }
    const sentToday = await db.rpc<number>('emails_sent_today')
    const budget = Math.max(DAILY_CAP - sentToday, 0)
    if (budget === 0) {
      await record('warning', { reason: 'daily cap reached', sent_today: sentToday })
      return c.json({ sent: 0, capped: true })
    }

    const rows = await db.rpc<EmailRow[]>('claim_emails', { p_limit: Math.min(budget, PER_RUN) })
    const results: Outcome[] = []
    for (let i = 0; i < rows.length; i += 5) {
      results.push(...(await Promise.all(rows.slice(i, i + 5).map((row) => deliver(c.env, row)))))
    }
    if (results.length > 0) await db.rpc('finish_emails', { p_results: results })

    const count = (outcome: Outcome['outcome']) => results.filter((r) => r.outcome === outcome).length
    const total = sentToday + count('sent')
    await record(total >= WARN_AT ? 'warning' : 'ok', {
      claimed: rows.length, sent: count('sent'), retry: count('retry'), failed: count('failed'), skipped: count('skipped'),
      sent_today: total, daily_cap: DAILY_CAP,
    })
    return c.json({ claimed: rows.length, sent: count('sent'), retry: count('retry'), failed: count('failed'), skipped: count('skipped'), sentToday: total })
  } catch (error) {
    await record('error', null, error instanceof Error ? error.message : 'unknown error')
    const { body, status } = dbErrorResponse(error)
    return c.json(body, status)
  }
})

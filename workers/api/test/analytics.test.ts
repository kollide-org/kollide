import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import app from '../src/index'
import { mockBackend, resetBackend, testEnv } from './helpers'

afterEach(resetBackend)

const row = (id: number, patch: Record<string, unknown> = {}) => ({
  id, event: 'join_requested', user_id: '11111111-1111-4111-8111-111111111111', properties: { event_id: 'e1', event_type: 'community' },
  occurred_at: '2026-12-01T10:00:00Z', attempts: 1, ...patch,
})

const flush = (secret: string | null, env = testEnv({ POSTHOG_API_KEY: 'phc_test' })) =>
  app.request('/jobs/flush-analytics', { method: 'POST', headers: secret === null ? {} : { 'x-job-secret': secret } }, env)

function backend(opts: { rows?: any[]; posthog?: (body: any) => Response }) {
  const sends: { url: URL; body: any }[] = []
  const finished: any[] = []
  const records: any[] = []
  const mock = mockBackend({
    rpc: {
      claim_analytics_events: () => opts.rows ?? [],
      finish_analytics_events: (args) => void finished.push(...(args.p_results as any[])),
      record_job_run: (args) => void records.push(args),
    },
    external: async (url, init) => {
      const body = JSON.parse(init?.body as string)
      sends.push({ url, body })
      return opts.posthog ? opts.posthog(body) : Response.json({ status: 1 })
    },
  })
  return { ...mock, sends, finished, records }
}

describe('POST /jobs/flush-analytics', () => {
  it('refuses a missing, wrong or empty secret', async () => {
    const b = backend({ rows: [row(1)] })
    expect((await flush(null)).status).toBe(401)
    expect((await flush('wrong')).status).toBe(401)
    expect((await flush('', testEnv({ JOB_SHARED_SECRET: '' }))).status).toBe(401)
    expect(b.rpcCalls).toHaveLength(0)
    expect(b.sends).toHaveLength(0)
  })

  it('sends one batch to PostHog EU with the user id, the environment and the original time', async () => {
    const b = backend({ rows: [row(1), row(2, { event: 'checked_in', properties: { event_id: 'e1', method: 'qr' } })] })
    const res = await flush('job-secret')
    expect(await res.json()).toMatchObject({ claimed: 2, sent: 2 })
    expect(b.sends).toHaveLength(1)
    expect(b.sends[0]!.url.href).toBe('https://eu.i.posthog.com/batch/')
    expect(b.sends[0]!.body.api_key).toBe('phc_test')
    expect(b.sends[0]!.body.batch).toHaveLength(2)
    expect(b.sends[0]!.body.batch[0]).toMatchObject({
      event: 'join_requested', distinct_id: '11111111-1111-4111-8111-111111111111', timestamp: '2026-12-01T10:00:00Z',
      properties: { event_id: 'e1', env: 'staging' },
    })
    expect(JSON.stringify(b.sends[0]!.body)).not.toMatch(/email|first_name|phone/)
    expect(b.finished).toEqual([{ id: 1, outcome: 'sent' }, { id: 2, outcome: 'sent' }])
    expect(b.records.at(-1)).toMatchObject({ p_job: 'flush-analytics', p_status: 'ok' })
  })

  it('does nothing and records an ok run when the queue is empty', async () => {
    const b = backend({ rows: [] })
    expect(await (await flush('job-secret')).json()).toMatchObject({ claimed: 0, sent: 0 })
    expect(b.sends).toHaveLength(0)
    expect(b.records.at(-1)).toMatchObject({ p_status: 'ok' })
  })

  it('is skipped (and says so) when there is no PostHog key, and never claims anything', async () => {
    const b = backend({ rows: [row(1)] })
    const res = await flush('job-secret', testEnv())
    expect(await res.json()).toMatchObject({ sent: 0, skipped: 'not configured' })
    expect(b.rpcCalls.map((c) => c.name)).not.toContain('claim_analytics_events')
    expect(b.records.at(-1)).toMatchObject({ p_status: 'ok', p_detail: { configured: false } }) // optional feature: healthy, not an alarm
  })

  it('sends nothing from a local machine and marks the rows skipped', async () => {
    const b = backend({ rows: [row(1)] })
    await flush('job-secret', testEnv({ ENVIRONMENT: 'local', POSTHOG_API_KEY: 'phc_test' }))
    expect(b.sends).toHaveLength(0)
    expect(b.finished[0]).toMatchObject({ id: 1, outcome: 'skipped' })
  })

  it('retries when PostHog is down, and gives up on a rejected key', async () => {
    const down = backend({ rows: [row(1)], posthog: () => new Response('nope', { status: 503 }) })
    await flush('job-secret')
    expect(down.finished[0]).toMatchObject({ id: 1, outcome: 'retry' })
    resetBackend()
    const bad = backend({ rows: [row(2)], posthog: () => new Response('bad key', { status: 401 }) })
    await flush('job-secret')
    expect(bad.finished[0]).toMatchObject({ id: 2, outcome: 'failed' })
    expect(bad.records.at(-1)).toMatchObject({ p_status: 'warning' })
  })

  it('records an error when the database fails', async () => {
    const records: any[] = []
    mockBackend({ rpc: { claim_analytics_events: () => { throw new Error('boom') }, record_job_run: (a) => void records.push(a) } })
    expect((await flush('job-secret')).status).toBe(500)
    expect(records.at(-1)).toMatchObject({ p_status: 'error' })
  })
})

describe('partner_link_clicked (the real hook)', () => {
  const ID = '44444444-4444-4444-8444-444444444444'
  const USER = '22222222-2222-4222-8222-222222222222'
  const go = (query = '', env = testEnv({ POSTHOG_API_KEY: 'phc_test' })) => app.request(`/go/${ID}${query}`, { redirect: 'manual' }, env)

  function setup(consent: boolean) {
    const sends: any[] = []
    const mock = mockBackend({
      tables: { events: () => [{ partner_url: 'https://tickets.example.com/show', referral_code: null }] },
      rpc: { record_partner_click: () => null, analytics_consent_ok: () => consent },
      external: async (_u, init) => (sends.push(JSON.parse(init?.body as string)), Response.json({ status: 1 })),
    })
    return { ...mock, sends }
  }
  beforeEach(() => vi.restoreAllMocks())

  it('is sent to PostHog for a signed-in person who consented, and still redirects', async () => {
    const b = setup(true)
    const res = await go(`?u=${USER}`)
    expect(res.status).toBe(302)
    expect(b.sends).toHaveLength(1)
    expect(b.sends[0].batch[0]).toMatchObject({ event: 'partner_link_clicked', distinct_id: USER, properties: { event_id: ID, env: 'staging' } })
    expect(b.rpcCalls.some((c) => c.name === 'record_partner_click')).toBe(true) // the anonymous counter either way
  })

  it('is not sent when the database says the person has not consented', async () => {
    const b = setup(false)
    expect((await go(`?u=${USER}`)).status).toBe(302)
    expect(b.sends).toHaveLength(0)
    expect(b.rpcCalls.some((c) => c.name === 'record_partner_click')).toBe(true)
  })

  it('is not sent without a user, with a made-up user id, without a key, or locally', async () => {
    let b = setup(true)
    await go()
    await go('?u=not-a-uuid')
    await go(`?u=${USER}`, testEnv())
    await go(`?u=${USER}`, testEnv({ ENVIRONMENT: 'local', POSTHOG_API_KEY: 'phc_test' }))
    expect(b.sends).toHaveLength(0)
    expect(b.rpcCalls.filter((c) => c.name === 'analytics_consent_ok')).toHaveLength(0)
  })

  it('a PostHog failure never breaks the redirect', async () => {
    mockBackend({
      tables: { events: () => [{ partner_url: 'https://tickets.example.com/show', referral_code: null }] },
      rpc: { record_partner_click: () => null, analytics_consent_ok: () => true },
      external: () => new Response('down', { status: 500 }),
    })
    expect((await go(`?u=${USER}`)).status).toBe(302)
  })
})

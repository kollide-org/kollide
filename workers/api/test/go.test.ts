import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import app from '../src/index'
import { analyticsHooks } from '../src/lib/analytics'
import { mockBackend, resetBackend, testEnv } from './helpers'

const ID = '44444444-4444-4444-8444-444444444444'
const original = analyticsHooks.partnerClick
let clicks: string[] = []

beforeEach(() => {
  clicks = []
  analyticsHooks.partnerClick = vi.fn(async (_env, click) => void clicks.push(click.eventId))
})
afterEach(() => {
  analyticsHooks.partnerClick = original
  resetBackend()
})

const go = (id: string) => app.request(`/go/${id}`, { redirect: 'manual' }, testEnv())

describe('GET /go/:eventId', () => {
  it('redirects to the partner link with our referral code and records the click', async () => {
    const { rpcCalls } = mockBackend({
      tables: { 'events': () => [{ partner_url: 'https://tickets.example.com/show?id=7', referral_code: 'KOLLIDE' }] },
    })
    const res = await go(ID)
    expect(res.status).toBe(302)
    const location = new URL(res.headers.get('location') as string)
    expect(location.origin + location.pathname).toBe('https://tickets.example.com/show')
    expect(location.searchParams.get('id')).toBe('7') // the partner's own parameters survive
    expect(location.searchParams.get('ref')).toBe('KOLLIDE')
    expect(location.searchParams.get('utm_source')).toBe('kollide')
    expect(location.searchParams.get('utm_medium')).toBe('referral')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(clicks).toEqual([ID])
    expect(rpcCalls).toHaveLength(0)
  })

  it('the real hook counts the click in the database and never breaks the redirect', async () => {
    analyticsHooks.partnerClick = original
    const { rpcCalls } = mockBackend({
      tables: { 'events': () => [{ partner_url: 'https://tickets.example.com/show', referral_code: null }] },
      rpc: { record_partner_click: () => null },
    })
    const res = await go(ID)
    expect(res.status).toBe(302)
    expect(rpcCalls.some((call: any) => call.name === 'record_partner_click' && call.args.p_event === ID)).toBe(true)
  })

  it('works without a referral code', async () => {
    mockBackend({ tables: { 'events': () => [{ partner_url: 'https://tickets.example.com/a', referral_code: null }] } })
    const res = await go(ID)
    const location = new URL(res.headers.get('location') as string)
    expect(location.searchParams.has('ref')).toBe(false)
    expect(location.searchParams.get('utm_source')).toBe('kollide')
  })

  it('answers 404 when the event is not a published partner event, and records nothing', async () => {
    mockBackend({ tables: { 'events': () => [] } })
    const res = await go(ID)
    expect(res.status).toBe(404)
    expect(clicks).toEqual([])
  })

  it('answers 404 for a malformed id without asking the database', async () => {
    const { rpcCalls } = mockBackend({})
    expect((await go('not-a-uuid')).status).toBe(404)
    expect(rpcCalls).toHaveLength(0)
  })

  it('refuses to follow a link that is not https', async () => {
    mockBackend({ tables: { 'events': () => [{ partner_url: 'http://tickets.example.com/a', referral_code: null }] } })
    expect((await go(ID)).status).toBe(404)
    mockBackend({ tables: { 'events': () => [{ partner_url: 'javascript:alert(1)', referral_code: null }] } })
    expect((await go(ID)).status).toBe(404)
  })

  it('still redirects when the analytics hook fails', async () => {
    analyticsHooks.partnerClick = vi.fn(async () => {
      throw new Error('analytics is down')
    })
    mockBackend({ tables: { 'events': () => [{ partner_url: 'https://tickets.example.com/a', referral_code: 'K' }] } })
    expect((await go(ID)).status).toBe(302)
  })
})

import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import app from '../src/index'
import { mockBackend, resetBackend, setupKeys, testEnv, tokenFor } from './helpers'

const ADMIN = '00000000-0000-4000-8000-000000000001'
const VERIFICATION = '33333333-3333-4333-8333-333333333333'

beforeAll(setupKeys)
afterEach(resetBackend)

async function view(id: string, token: string | null) {
  return app.request(
    `/admin/selfies/${id}/view`,
    { headers: token ? { authorization: `Bearer ${token}` } : {} },
    testEnv(),
  )
}

const pending = [{ selfie_key: 'selfies/22222222-2222-4222-8222-222222222222.webp', result: 'pending' }]

describe('GET /admin/selfies/:id/view', () => {
  it('needs a token', async () => {
    mockBackend({})
    expect((await view(VERIFICATION, null)).status).toBe(401)
  })

  it('refuses someone who is not an admin, and never looks up the selfie', async () => {
    let looked = false
    mockBackend({
      tables: {
        'user_roles': () => [],
        'verifications': () => { looked = true; return pending },
      },
    })
    const res = await view(VERIFICATION, await tokenFor('00000000-0000-4000-8000-000000000003'))
    expect(res.status).toBe(403)
    expect(looked).toBe(false)
  })

  it('gives an admin a 5-minute link to a pending selfie in the private bucket', async () => {
    mockBackend({ tables: { 'user_roles': () => [{ role: 'admin' }], 'verifications': () => pending } })
    const res = await view(VERIFICATION, await tokenFor(ADMIN))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { url: string; expiresIn: number }
    const url = new URL(body.url)
    expect(url.pathname).toBe('/kollide-private-staging/selfies/22222222-2222-4222-8222-222222222222.webp')
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300')
    expect(body.expiresIn).toBe(300)
  })

  it('refuses a selfie that was already reviewed (it is deleted)', async () => {
    mockBackend({ tables: { 'user_roles': () => [{ role: 'admin' }], 'verifications': () => [{ selfie_key: null, result: 'approved' }] } })
    expect((await view(VERIFICATION, await tokenFor(ADMIN))).status).toBe(404)
  })

  it('answers 404 for an unknown or malformed id', async () => {
    mockBackend({ tables: { 'user_roles': () => [{ role: 'admin' }], 'verifications': () => [] } })
    expect((await view(VERIFICATION, await tokenFor(ADMIN))).status).toBe(404)
    expect((await view('not-a-uuid', await tokenFor(ADMIN))).status).toBe(404)
  })
})

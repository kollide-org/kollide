import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import app from '../src/index'
import { DbFailure, mockBackend, resetBackend, setupKeys, testEnv, tokenFor } from './helpers'

const USER = '00000000-0000-4000-8000-000000000003'
const KEY = 'profiles/11111111-1111-4111-8111-111111111111.webp'

beforeAll(setupKeys)
afterEach(resetBackend)

async function sign(body: unknown, opts: { token?: string | null; env?: Parameters<typeof testEnv>[0] } = {}) {
  const token = opts.token === undefined ? await tokenFor(USER) : opts.token
  return app.request(
    '/uploads/sign',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    },
    testEnv(opts.env),
  )
}

const good = { purpose: 'profile_photo', contentType: 'image/webp', size: 120_000 }

describe('POST /uploads/sign', () => {
  it('refuses a request with no token, and never asks the database', async () => {
    const { rpcCalls } = mockBackend({})
    const res = await sign(good, { token: null })
    expect(res.status).toBe(401)
    expect(rpcCalls).toHaveLength(0)
  })

  it('refuses a bad token', async () => {
    const { rpcCalls } = mockBackend({})
    expect((await sign(good, { token: 'not.a.jwt' })).status).toBe(401)
    expect(rpcCalls).toHaveLength(0)
  })

  it('refuses the wrong content type without asking the database', async () => {
    const { rpcCalls } = mockBackend({})
    const res = await sign({ ...good, contentType: 'image/png' })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_type' })
    expect(rpcCalls).toHaveLength(0)
  })

  it('refuses a file that is far too big without asking the database', async () => {
    const { rpcCalls } = mockBackend({})
    const res = await sign({ ...good, size: 600_000 })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'too_large' })
    expect(rpcCalls).toHaveLength(0)
  })

  it('refuses an unknown purpose, a fractional size and a bad event id', async () => {
    mockBackend({})
    expect((await sign({ ...good, purpose: 'avatar' })).status).toBe(400)
    expect((await sign({ ...good, size: 10.5 })).status).toBe(400)
    expect((await sign({ ...good, purpose: 'event_cover', eventId: 'nope' })).status).toBe(400)
  })

  it('passes the cap check to the database: a photo over its own limit is refused', async () => {
    mockBackend({ rpc: { authorize_upload: () => { throw new DbFailure('too_large') } } })
    const res = await sign({ ...good, size: 400_000 })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'too_large' })
  })

  it('answers 403 when the database says the role is wrong (member asking for an event cover)', async () => {
    const { rpcCalls } = mockBackend({ rpc: { authorize_upload: () => { throw new DbFailure('not_allowed') } } })
    const res = await sign({ purpose: 'event_cover', contentType: 'image/webp', size: 1000, eventId: '00000000-0000-4000-8000-0000000000e1' })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'not_allowed' })
    expect(rpcCalls[0]?.args).toMatchObject({ p_user: USER, p_purpose: 'event_cover' })
  })

  it('answers 429 when there are too many pending photos', async () => {
    mockBackend({ rpc: { authorize_upload: () => { throw new DbFailure('too_many_uploads') } } })
    const res = await sign(good)
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'too_many_uploads' })
  })

  it('turns an unknown failure into a plain 500 with no detail', async () => {
    mockBackend({ rpc: { authorize_upload: () => { throw new DbFailure('some secret detail x') } } })
    const res = await sign(good)
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'server_error' })
  })

  it('returns a 5-minute presigned PUT link for the media bucket', async () => {
    const { rpcCalls } = mockBackend({ rpc: { authorize_upload: () => KEY } })
    const res = await sign(good)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { url: string; key: string; method: string; headers: Record<string, string>; expiresIn: number }
    expect(body.key).toBe(KEY)
    expect(body.method).toBe('PUT')
    expect(body.expiresIn).toBe(300)
    expect(body.headers).toEqual({ 'content-type': 'image/webp' })

    const url = new URL(body.url)
    expect(url.host).toBe('acct123.r2.cloudflarestorage.com')
    expect(url.pathname).toBe(`/kollide-media-staging/${KEY}`)
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300')
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/)
    // The type and size are signed, so R2 refuses anything else.
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('content-length;content-type;host')
    expect(body.url).not.toContain('secret-test')
    expect(rpcCalls[0]?.args).toEqual({ p_user: USER, p_purpose: 'profile_photo', p_event: null, p_content_type: 'image/webp', p_size: 120_000 })
  })

  it('signs selfies for the private bucket', async () => {
    mockBackend({ rpc: { authorize_upload: () => 'selfies/22222222-2222-4222-8222-222222222222.webp' } })
    const res = await sign({ purpose: 'selfie', contentType: 'image/webp', size: 90_000 })
    const body = (await res.json()) as { url: string }
    expect(new URL(body.url).pathname.startsWith('/kollide-private-staging/selfies/')).toBe(true)
  })

  it('uses the Worker itself as the upload target in local development', async () => {
    mockBackend({ rpc: { authorize_upload: () => KEY } })
    const res = await sign(good, { env: { ENVIRONMENT: 'local' } })
    const body = (await res.json()) as { url: string }
    expect(body.url).toBe(`http://localhost/dev/upload/media/${KEY}`)
  })
})

describe('CORS', () => {
  it('allows our own site and nobody else', async () => {
    const ask = (origin: string) =>
      app.request('/uploads/sign', { method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'POST' } }, testEnv())
    expect((await ask('https://site.test')).headers.get('access-control-allow-origin')).toBe('https://site.test')
    expect((await ask('https://evil.test')).headers.get('access-control-allow-origin')).toBeFalsy()
  })
})

describe('local development shim', () => {
  const path = '/dev/upload/media/profiles/55555555-5555-4555-8555-555555555555.webp'

  it('stores and serves an upload locally', async () => {
    const env = testEnv({ ENVIRONMENT: 'local' })
    const put = await app.request(path, { method: 'PUT', headers: { 'content-type': 'image/webp' }, body: new Uint8Array([1, 2, 3]) }, env)
    expect(put.status).toBe(200)
    const get = await app.request('/media/profiles/55555555-5555-4555-8555-555555555555.webp', {}, env)
    expect(get.status).toBe(200)
    expect(get.headers.get('content-type')).toBe('image/webp')
    expect([...new Uint8Array(await get.arrayBuffer())]).toEqual([1, 2, 3])
  })

  it('does not exist in staging or production', async () => {
    const env = testEnv()
    expect((await app.request(path, { method: 'PUT', body: new Uint8Array([1]) }, env)).status).toBe(404)
    expect((await app.request('/media/profiles/55555555-5555-4555-8555-555555555555.webp', {}, env)).status).toBe(404)
  })
})

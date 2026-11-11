import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { clearJwksCache, verifyJwt } from '../src/lib/auth'

const URL_ = 'https://proj.supabase.co'
const env = { SUPABASE_URL: URL_ }
const enc = new TextEncoder()
const b64url = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b as ArrayBuffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const part = (o: unknown) => b64url(enc.encode(JSON.stringify(o)))

let privateKey: CryptoKey
let jwks: { keys: JsonWebKey[] }

async function sign(claims: Record<string, unknown>, kid = 'k1') {
  const signing = `${part({ alg: 'ES256', typ: 'JWT', kid })}.${part(claims)}`
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, enc.encode(signing))
  return `${signing}.${b64url(sig)}`
}

const good = () => ({
  sub: 'user-1',
  aud: 'authenticated',
  iss: `${URL_}/auth/v1`,
  exp: Math.floor(Date.now() / 1000) + 600,
})

beforeAll(async () => {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair
  privateKey = pair.privateKey
  const pub = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as JsonWebKey & { kid?: string }
  pub.kid = 'k1'
  jwks = { keys: [pub] }
})

afterEach(() => {
  vi.restoreAllMocks()
  clearJwksCache()
})

function mockJwks() {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json(jwks))
}

describe('verifyJwt', () => {
  it('accepts a valid token', async () => {
    mockJwks()
    expect((await verifyJwt(await sign(good()), env))?.sub).toBe('user-1')
  })

  it('rejects an expired token', async () => {
    mockJwks()
    expect(await verifyJwt(await sign({ ...good(), exp: 1 }), env)).toBeNull()
  })

  it('rejects the wrong audience and issuer', async () => {
    mockJwks()
    expect(await verifyJwt(await sign({ ...good(), aud: 'anon' }), env)).toBeNull()
    expect(await verifyJwt(await sign({ ...good(), iss: 'https://evil/auth/v1' }), env)).toBeNull()
  })

  it('rejects a tampered payload and an unknown key id', async () => {
    mockJwks()
    const [h, , s] = (await sign(good())).split('.')
    expect(await verifyJwt(`${h}.${part({ ...good(), sub: 'admin' })}.${s}`, env)).toBeNull()
    expect(await verifyJwt(await sign(good(), 'other'), env)).toBeNull()
  })

  it('rejects alg none and garbage', async () => {
    mockJwks()
    expect(await verifyJwt(`${part({ alg: 'none' })}.${part(good())}.`, env)).toBeNull()
    expect(await verifyJwt('not-a-jwt', env)).toBeNull()
  })
})

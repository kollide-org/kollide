import { env as workerEnv } from 'cloudflare:workers'
import { vi } from 'vitest'

import type { Env } from '../src/env'
import { clearJwksCache } from '../src/lib/auth'

export const SUPABASE_URL = 'https://proj.supabase.co'
const enc = new TextEncoder()
const b64url = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b as ArrayBuffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const part = (o: unknown) => b64url(enc.encode(JSON.stringify(o)))

let privateKey: CryptoKey
let jwks: { keys: JsonWebKey[] }

export async function setupKeys() {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair
  privateKey = pair.privateKey
  const pub = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as JsonWebKey & { kid?: string }
  pub.kid = 'k1'
  jwks = { keys: [pub] }
}

/** A valid Supabase access token for `sub`, signed with the test key. */
export async function tokenFor(sub: string): Promise<string> {
  const claims = { sub, aud: 'authenticated', iss: `${SUPABASE_URL}/auth/v1`, exp: Math.floor(Date.now() / 1000) + 600 }
  const signing = `${part({ alg: 'ES256', typ: 'JWT', kid: 'k1' })}.${part(claims)}`
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, enc.encode(signing))
  return `${signing}.${b64url(sig)}`
}

export function testEnv(overrides: Partial<Env> = {}): Env {
  return {
    ENVIRONMENT: 'staging',
    KOLLIDE_DOMAIN: 'example.invalid',
    SUPABASE_URL,
    ALLOWED_ORIGINS: 'https://site.test',
    R2_ACCOUNT_ID: 'acct123',
    R2_MEDIA_BUCKET: 'kollide-media-staging',
    R2_PRIVATE_BUCKET: 'kollide-private-staging',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-test-key',
    R2_ACCESS_KEY_ID: 'AKIDTEST',
    R2_SECRET_ACCESS_KEY: 'secret-test',
    JOB_SHARED_SECRET: 'job-secret',
    MEDIA: workerEnv.MEDIA,
    PRIVATE: workerEnv.PRIVATE,
    ...overrides,
  }
}

export class DbFailure extends Error {}

type Handler = (args: Record<string, unknown>) => unknown

/**
 * Replaces fetch: serves the JWKS and a fake PostgREST. `rpc` handlers return a value or throw
 * DbFailure('code') (which becomes a 400 with that code, like our SQL functions do).
 * `tables` handlers answer GET queries by path prefix.
 */
export function mockBackend(handlers: { rpc?: Record<string, Handler>; tables?: Record<string, () => unknown[]> }) {
  const rpcCalls: { name: string; args: Record<string, unknown> }[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url)
    if (url.pathname.endsWith('/.well-known/jwks.json')) return Response.json(jwks)
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const name = url.pathname.replace('/rest/v1/rpc/', '')
      const args = JSON.parse((init?.body as string) || '{}') as Record<string, unknown>
      rpcCalls.push({ name, args })
      const handler = handlers.rpc?.[name]
      if (!handler) return Response.json({ message: 'unexpected' }, { status: 500 })
      try {
        const result = handler(args)
        return new Response(result === undefined ? '' : JSON.stringify(result), { status: 200 })
      } catch (error) {
        if (error instanceof DbFailure) return Response.json({ code: 'P0001', message: error.message }, { status: 400 })
        throw error
      }
    }
    const table = url.pathname.replace('/rest/v1/', '')
    const handler = handlers.tables?.[table]
    if (handler) return Response.json(handler())
    return Response.json({ message: 'unexpected' }, { status: 500 })
  })
  return { rpcCalls }
}

export function resetBackend() {
  vi.restoreAllMocks()
  clearJwksCache()
}

import type { Env } from '../env'

type AuthEnv = Pick<Env, 'SUPABASE_URL'>

export type JwtClaims = {
  sub: string
  aud: string | string[]
  iss: string
  exp: number
  role?: string
  [claim: string]: unknown
}

type Jwk = JsonWebKey & { kid?: string }

const encoder = new TextEncoder()

function b64urlToBytes(input: string): Uint8Array<ArrayBuffer> {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=')
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function parseJson<T>(segment: string): T {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(segment))) as T
}

function algorithmFor(
  alg: string,
): { import: SubtleCryptoImportKeyAlgorithm; verify: SubtleCryptoSignAlgorithm } | null {
  if (alg === 'ES256') {
    return { import: { name: 'ECDSA', namedCurve: 'P-256' }, verify: { name: 'ECDSA', hash: 'SHA-256' } }
  }
  if (alg === 'RS256') {
    return { import: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, verify: { name: 'RSASSA-PKCS1-v1_5' } }
  }
  return null // Anything else, including "none" and HS256, is refused.
}

// JWKS cached per isolate. Refreshed when stale or when a token names an unknown key id.
const CACHE_MS = 10 * 60 * 1000
const jwksCache = new Map<string, { keys: Jwk[]; fetchedAt: number }>()

export function clearJwksCache() {
  jwksCache.clear()
}

async function getKeys(supabaseUrl: string, force: boolean): Promise<Jwk[]> {
  const cached = jwksCache.get(supabaseUrl)
  if (cached && !force && Date.now() - cached.fetchedAt < CACHE_MS) return cached.keys
  const res = await fetch(`${supabaseUrl}/auth/v1/.well-known/jwks.json`)
  if (!res.ok) throw new Error(`JWKS fetch failed with status ${res.status}`)
  const { keys } = (await res.json()) as { keys: Jwk[] }
  jwksCache.set(supabaseUrl, { keys, fetchedAt: Date.now() })
  return keys
}

/**
 * Verifies a Supabase access token (signature, expiry, issuer, audience) with WebCrypto against
 * the project's JWKS. Returns the claims, or null if the token is not valid.
 */
export async function verifyJwt(token: string, env: AuthEnv): Promise<JwtClaims | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [h, p, s] = parts as [string, string, string]

    const header = parseJson<{ alg: string; kid?: string }>(h)
    const algo = algorithmFor(header.alg)
    if (!algo) return null

    let keys = await getKeys(env.SUPABASE_URL, false)
    let jwk = keys.find((k) => k.kid === header.kid)
    if (!jwk) {
      keys = await getKeys(env.SUPABASE_URL, true)
      jwk = keys.find((k) => k.kid === header.kid)
    }
    if (!jwk) return null

    const key = await crypto.subtle.importKey('jwk', jwk, algo.import, false, ['verify'])
    const valid = await crypto.subtle.verify(algo.verify, key, b64urlToBytes(s), encoder.encode(`${h}.${p}`))
    if (!valid) return null

    const claims = parseJson<JwtClaims>(p)
    const now = Math.floor(Date.now() / 1000)
    if (typeof claims.exp !== 'number' || claims.exp <= now) return null
    if (claims.iss !== `${env.SUPABASE_URL}/auth/v1`) return null
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
    if (!aud.includes('authenticated')) return null
    if (!claims.sub) return null
    return claims
  } catch {
    return null
  }
}

/** Reads `Authorization: Bearer <token>` and verifies it. Returns the claims or null. */
export async function authenticate(request: Request, env: AuthEnv): Promise<JwtClaims | null> {
  const header = request.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return null
  return verifyJwt(header.slice(7), env)
}

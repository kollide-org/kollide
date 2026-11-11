import type { Env } from '../env'

type AdminEnv = Pick<Env, 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY'>

/** A failed database call. `code` is the short code our SQL functions raise, for example `not_allowed`. */
export class DbError extends Error {
  status: number
  code: string

  constructor(status: number, code: string) {
    super(code)
    this.name = 'DbError'
    this.status = status
    this.code = code
  }
}

async function fail(res: Response, what: string): Promise<never> {
  let message = ''
  try {
    message = ((await res.json()) as { message?: string }).message ?? ''
  } catch {
    // Not JSON: keep the generic code.
  }
  throw new DbError(res.status, /^[a-z0-9_]+$/.test(message) ? message : `${what}_failed`)
}

/**
 * Minimal service-role client for PostgREST, built on fetch so the Worker stays small and fast.
 * It bypasses Row Level Security, so only call it from server code after checking the caller.
 * The key comes from the Worker secret and must never be logged or returned.
 */
export function supabaseAdmin(env: AdminEnv) {
  const base = `${env.SUPABASE_URL}/rest/v1`
  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'content-type': 'application/json',
  }

  return {
    /** Calls a Postgres function: POST /rest/v1/rpc/<name>. */
    async rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
      const res = await fetch(`${base}/rpc/${name}`, { method: 'POST', headers, body: JSON.stringify(args) })
      if (!res.ok) return fail(res, name)
      const text = await res.text()
      return (text ? JSON.parse(text) : null) as T
    },

    /** Reads rows with a PostgREST query string, e.g. `bookings?id=eq.123&select=*`. */
    async select<T>(query: string): Promise<T[]> {
      const res = await fetch(`${base}/${query}`, { headers })
      if (!res.ok) return fail(res, 'select')
      return (await res.json()) as T[]
    },
  }
}

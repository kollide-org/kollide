import type { Env } from '../env'

type AdminEnv = Pick<Env, 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY'>

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
      const res = await fetch(`${base}/rpc/${name}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(args),
      })
      if (!res.ok) throw new Error(`Supabase rpc ${name} failed with status ${res.status}`)
      return (await res.json()) as T
    },

    /** Reads rows with a PostgREST query string, e.g. `bookings?id=eq.123&select=*`. */
    async select<T>(query: string): Promise<T[]> {
      const res = await fetch(`${base}/${query}`, { headers })
      if (!res.ok) throw new Error(`Supabase select failed with status ${res.status}`)
      return (await res.json()) as T[]
    },
  }
}

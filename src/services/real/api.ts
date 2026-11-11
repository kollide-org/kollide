import { ServiceError } from '../types/errors'

const client = () => import('./client').then((module) => module.supabase)

/** Calls our Worker with the person's access token. Errors carry the Worker's short code. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = import.meta.env.VITE_API_URL
  if (!base) throw new ServiceError('unknown', 'VITE_API_URL is not set.')
  const supabase = await client()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const res = await fetch(`${base.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...init.headers },
  })
  const body = (await res.json().catch(() => ({}))) as { error?: string } & Record<string, unknown>
  if (!res.ok) throw new ServiceError(typeof body.error === 'string' ? body.error : 'unknown')
  return body as T
}

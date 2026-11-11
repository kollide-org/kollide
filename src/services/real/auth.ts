import { ServiceError } from '../types/errors'
import type { AuthService, AuthUser } from '../types/auth'

/** Loaded on first use, so visitors on mock builds and the first paint never wait for it. */
const client = () => import('./client').then((module) => module.supabase)

function toUser(user: { id: string; email?: string | null } | null | undefined): AuthUser | null {
  return user ? { id: user.id, email: user.email ?? null } : null
}

export const realAuth: AuthService = {
  async getUser() {
    const supabase = await client()
    const { data } = await supabase.auth.getSession()
    return toUser(data.session?.user)
  },

  onChange(callback) {
    let unsubscribe: (() => void) | null = null
    let cancelled = false
    void client().then((supabase) => {
      if (cancelled) return
      // Keep this callback light: calling Supabase from inside it can deadlock.
      const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(toUser(session?.user)))
      unsubscribe = () => data.subscription.unsubscribe()
    })
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  },

  async signInWithGoogle() {
    const supabase = await client()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) throw new ServiceError('unknown', error.message)
  },

  async sendEmailCode(email) {
    const supabase = await client()
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
    if (error) throw new ServiceError(error.status === 429 ? 'rate_limited' : 'unknown', error.message)
  },

  async verifyEmailCode(email, code) {
    const supabase = await client()
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
    if (error) throw new ServiceError(error.status === 429 ? 'rate_limited' : 'invalid_code', error.message)
  },

  async signOut() {
    const supabase = await client()
    await supabase.auth.signOut()
  },
}

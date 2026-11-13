import type { Session } from '../types'

export interface AuthService {
  /** The signed-in session, or `null` for a visitor. */
  getSession(): Promise<Session | null>
  signInWithGoogle(): Promise<Session>
  /** Step one of email sign-in: send a 6-digit code. */
  requestEmailCode(email: string): Promise<{ email: string; expiresInSeconds: number }>
  /** Step two: check the code and sign in. Creates the account if it is new. */
  verifyEmailCode(email: string, code: string): Promise<Session>
  signOut(): Promise<void>
  deleteAccount(): Promise<void>
}

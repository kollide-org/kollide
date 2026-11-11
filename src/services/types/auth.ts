export interface AuthUser {
  id: string
  email: string | null
}

export interface AuthService {
  /** The signed-in user, or null for a visitor. */
  getUser(): Promise<AuthUser | null>
  /** Called when the person signs in or out. Returns an unsubscribe function. */
  onChange(callback: (user: AuthUser | null) => void): () => void
  /** Leaves the page to sign in with Google, and comes back to /auth/callback. */
  signInWithGoogle(): Promise<void>
  /** Emails a 6-digit code. */
  sendEmailCode(email: string): Promise<void>
  verifyEmailCode(email: string, code: string): Promise<void>
  signOut(): Promise<void>
  /** Mock only: lets the development role switcher change who is signed in. */
  devSetRole?(role: import('./role').Role): void
}

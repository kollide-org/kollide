import { readStored, writeStored } from '@/lib/storage'

import type { AuthService, AuthUser } from '../types/auth'
import { ROLES, type Role } from '../types/role'

/** The mock "signed-in" state is the development role, so the role switcher keeps working. */
export const MOCK_ROLE_KEY = 'kollide:dev-role'

const listeners = new Set<(user: AuthUser | null) => void>()

export function currentMockRole(): Role {
  return readStored(MOCK_ROLE_KEY, ROLES) ?? 'visitor'
}

function currentUser(): AuthUser | null {
  const role = currentMockRole()
  return role === 'visitor' ? null : { id: `mock-${role}`, email: `${role}@kollide.test` }
}

function setRole(role: Role) {
  writeStored(MOCK_ROLE_KEY, role)
  const user = currentUser()
  listeners.forEach((listener) => listener(user))
}

export const mockAuth: AuthService = {
  async getUser() {
    return currentUser()
  },
  onChange(callback) {
    listeners.add(callback)
    return () => listeners.delete(callback)
  },
  async signInWithGoogle() {
    setRole('member')
  },
  async sendEmailCode() {},
  async verifyEmailCode() {
    setRole('member')
  },
  async signOut() {
    setRole('visitor')
  },
  devSetRole: setRole,
}

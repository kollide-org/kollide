import type { AdminService, PendingVerification } from '../types/admin'

let pending: PendingVerification[] = [
  { id: 'mock-verification-1', userId: 'mock-user-1', firstName: 'Meera', createdAt: '2026-11-11T10:00:00Z' },
]

export const mockAdmin: AdminService = {
  async listPendingVerifications() {
    return pending
  },
  async getSelfieUrl() {
    return 'about:blank'
  },
  async reviewVerification(id) {
    pending = pending.filter((item) => item.id !== id)
  },
}

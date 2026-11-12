import type { Appeal, SafetyService } from '../types/safety'

const appeals: Appeal[] = []

export const mockSafety: SafetyService = {
  async report() {},
  async myTips() {
    return []
  },
  async myAppeals() {
    return [...appeals]
  },
  async createAppeal(kind, message, tipId) {
    appeals.unshift({
      id: `mock-appeal-${appeals.length + 1}`, kind, tipId: tipId ?? null, message, status: 'open',
      dueAt: new Date(Date.now() + 48 * 3_600_000).toISOString(), adminNote: null, createdAt: new Date().toISOString(),
    })
  },
}

import type { ConsentService } from '../types/consent'

export const mockConsent: ConsentService = {
  async record() {},
  async mine() {
    return null
  },
}

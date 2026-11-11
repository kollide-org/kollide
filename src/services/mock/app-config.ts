import type { AppConfigService } from '../types/app-config'

export const mockAppConfig: AppConfigService = {
  async get() {
    return { paymentsEnabled: false, noticeVersion: 'v1' }
  },
}

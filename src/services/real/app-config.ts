import { ServiceError } from '../types/errors'
import type { AppConfigService } from '../types/app-config'

const client = () => import('./client').then((module) => module.supabase)

export const realAppConfig: AppConfigService = {
  async get() {
    const supabase = await client()
    const { data, error } = await supabase.from('app_config').select('key, value')
    if (error) throw new ServiceError('unknown', error.message)
    const byKey = new Map((data ?? []).map((row) => [row.key, row.value]))
    return {
      // Anything but an explicit true means payments are off.
      paymentsEnabled: byKey.get('payments_enabled') === true,
      noticeVersion: typeof byKey.get('notice_version') === 'string' ? (byKey.get('notice_version') as string) : 'v1',
    }
  },
}

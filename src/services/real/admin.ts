import { ServiceError } from '../types/errors'
import type { AdminService } from '../types/admin'
import { api } from './api'

const client = () => import('./client').then((module) => module.supabase)

export const realAdmin: AdminService = {
  async listPendingVerifications() {
    const supabase = await client()
    const { data, error } = await supabase.rpc('admin_list_pending_verifications')
    if (error) throw new ServiceError(/^[a-z0-9_]+$/.test(error.message) ? error.message : 'unknown', error.message)
    return (data ?? []).map((row) => ({ id: row.id, userId: row.user_id, firstName: row.first_name, createdAt: row.created_at }))
  },

  async getSelfieUrl(verificationId) {
    const result = await api<{ url: string }>(`/admin/selfies/${verificationId}/view`)
    return result.url
  },

  async reviewVerification(verificationId, approved) {
    const supabase = await client()
    const { error } = await supabase.rpc('review_verification', { p_id: verificationId, p_approved: approved })
    if (error) throw new ServiceError(/^[a-z0-9_]+$/.test(error.message) ? error.message : 'unknown', error.message)
  },
}

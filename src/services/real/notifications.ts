import { ServiceError } from '../types/errors'
import type { NotificationsService } from '../types/notifications'

const client = () => import('./client').then((module) => module.supabase)

export const realNotifications: NotificationsService = {
  async list(limit = 50) {
    const supabase = await client()
    const { data, error } = await supabase
      .from('notifications')
      .select('id, kind, title, body, data, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw new ServiceError('unknown', error.message)
    return (data ?? []).map((r) => ({
      id: r.id, kind: r.kind, title: r.title, body: r.body, read: r.read_at !== null, createdAt: r.created_at,
      eventId: typeof (r.data as { event_id?: unknown } | null)?.event_id === 'string' ? ((r.data as { event_id: string }).event_id) : null,
    }))
  },
  async unreadCount() {
    const supabase = await client()
    const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null)
    if (error) throw new ServiceError('unknown', error.message)
    return count ?? 0
  },
  async markRead(ids) {
    const supabase = await client()
    const { error } = await supabase.rpc('mark_notifications_read', { p_ids: ids })
    if (error) throw new ServiceError('unknown', error.message)
  },
}

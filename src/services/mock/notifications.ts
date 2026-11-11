import type { AppNotification, NotificationsService } from '../types/notifications'

let items: AppNotification[] = [
  { id: 1, kind: 'booking_approved', title: 'You are in', body: 'Sunday board games at a cafe', eventId: null, read: false, createdAt: new Date().toISOString() },
]

export const mockNotifications: NotificationsService = {
  async list() {
    return items
  },
  async unreadCount() {
    return items.filter((item) => !item.read).length
  },
  async markRead(ids) {
    items = items.map((item) => (!ids || ids.includes(item.id) ? { ...item, read: true } : item))
  },
}

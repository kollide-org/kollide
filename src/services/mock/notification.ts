import type { NotificationService } from '../interfaces'

import { getDb, saveDb } from './db'
import { copy, latency, requireUser } from './runtime'

export const mockNotificationService: NotificationService = {
  async listNotifications() {
    await latency(0.6)
    const db = getDb()
    const user = requireUser(db)
    return copy(
      db.notifications.filter((notification) => notification.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    )
  },

  async markRead(notificationId) {
    await latency(0.3)
    const db = getDb()
    const user = requireUser(db)
    const notification = db.notifications.find((candidate) => candidate.id === notificationId && candidate.userId === user.id)
    if (notification) notification.read = true
    saveDb()
  },

  async markAllRead() {
    await latency(0.3)
    const db = getDb()
    const user = requireUser(db)
    for (const notification of db.notifications) if (notification.userId === user.id) notification.read = true
    saveDb()
  },
}

import type { ID, Notification } from '../types'

export interface NotificationService {
  /** Newest first. */
  listNotifications(): Promise<Notification[]>
  markRead(notificationId: ID): Promise<void>
  markAllRead(): Promise<void>
}

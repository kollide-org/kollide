export interface AppNotification {
  id: number
  kind: string
  title: string
  body: string | null
  eventId: string | null
  read: boolean
  createdAt: string
}

export interface NotificationsService {
  list(limit?: number): Promise<AppNotification[]>
  unreadCount(): Promise<number>
  /** Marks the given notifications (or all of them) as read. */
  markRead(ids?: number[]): Promise<void>
}

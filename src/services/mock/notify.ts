import type { ID, NotificationKind } from '../types'

import type { Db } from './db'
import { newId, nowIso } from './runtime'

export function notify(db: Db, userId: ID, kind: NotificationKind, title: string, body: string, href: string | null = null): void {
  db.notifications.push({ id: newId('nt'), userId, kind, title, body, href, read: false, createdAt: nowIso() })
}

export function notifyAdmins(db: Db, kind: NotificationKind, title: string, body: string, href: string | null = null): void {
  for (const admin of db.users.filter((user) => user.role === 'admin')) notify(db, admin.id, kind, title, body, href)
}

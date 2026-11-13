import type { ID, ISODateTime } from './common'

export type NotificationKind =
  | 'request_received'
  | 'request_approved'
  | 'request_declined'
  | 'waitlist_promoted'
  | 'reconfirm'
  | 'squad_request'
  | 'squad_approved'
  | 'payment'
  | 'refund'
  | 'feedback_open'
  | 'connection'
  | 'host_application'
  | 'event_review'
  | 'account'

export interface Notification {
  id: ID
  userId: ID
  kind: NotificationKind
  title: string
  body: string
  /** An in-app path to open, if there is one. */
  href: string | null
  read: boolean
  createdAt: ISODateTime
}

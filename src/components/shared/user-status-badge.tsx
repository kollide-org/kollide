import { Badge } from '@/components/ui/badge'
import type { UserStatus } from '@/services'

const LABEL: Record<UserStatus, string> = { active: 'Active', on_hold: 'On hold', suspended: 'Suspended', banned: 'Banned' }

export function UserStatusBadge({ status }: { status: UserStatus }) {
  return <Badge variant={status === 'active' ? 'success' : status === 'on_hold' ? 'warning' : 'destructive'}>{LABEL[status]}</Badge>
}

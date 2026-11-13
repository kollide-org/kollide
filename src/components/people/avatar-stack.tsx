import { cn } from '@/lib/utils'
import type { PersonPreview } from '@/services'

import { PersonAvatar } from './person-avatar'

interface AvatarStackProps {
  people: readonly PersonPreview[]
  /** Everyone going, including people not shown. */
  total?: number
  max?: number
  className?: string
}

/** Overlapping avatars of the people attending. */
export function AvatarStack({ people, total = people.length, max = 4, className }: AvatarStackProps) {
  const shown = people.slice(0, max)
  const extra = total - shown.length
  if (shown.length === 0) return null

  return (
    <div className={cn('flex items-center', className)}>
      <ul className="flex -space-x-2.5" aria-label={`${total} going, including ${shown.map((person) => person.firstName).join(', ')}`}>
        {shown.map((person) => (
          <li key={person.userId}>
            <PersonAvatar person={person} className="size-8 ring-2 ring-card" />
          </li>
        ))}
      </ul>
      {extra > 0 ? <span className="ml-2 text-sm font-medium text-muted-foreground">+{extra}</span> : null}
    </div>
  )
}

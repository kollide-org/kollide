import { Badge } from '@/components/ui/badge'
import type { Reputation, TagCount } from '@/services'

/** "Shows up 3 of 4" and the top tags, or "New to Kollide". Used on profile cards. */
export function ReputationLine({ reputation }: { reputation: Pick<Reputation, 'isNew' | 'showsUpAttended' | 'showsUpTotal' | 'eventsAttended'> }) {
  if (reputation.isNew) return <Badge variant="highlight-soft">New to Kollide</Badge>
  return (
    <p className="text-sm text-muted-foreground">
      {reputation.showsUpTotal > 0 ? `Shows up ${reputation.showsUpAttended} of ${reputation.showsUpTotal}` : 'No attendance counted in the last 12 months'}
      {' · '}{reputation.eventsAttended} {reputation.eventsAttended === 1 ? 'event' : 'events'} attended
    </p>
  )
}

export function TagBadges({ tags }: { tags: TagCount[] }) {
  if (tags.length === 0) return null
  return (
    <ul aria-label="Top tags" className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <li key={tag.slug}><Badge variant="soft">{tag.label}{tag.count > 1 ? ` · ${tag.count}` : ''}</Badge></li>
      ))}
    </ul>
  )
}

import { Badge } from '@/components/ui/badge'
import type { Reputation } from '@/services'

/**
 * "Shows up: 11 of 12", or "New to Kollide" for someone without history yet.
 * A new member never shows an empty or low score.
 */
export function ReliabilityChip({ reputation, size }: { reputation: Reputation; size?: 'default' | 'sm' }) {
  if (!reputation.reliability) {
    return (
      <Badge variant="soft" size={size}>
        New to Kollide
      </Badge>
    )
  }
  return (
    <Badge variant="highlight" size={size}>
      Shows up: {reputation.reliability.showedUp} of {reputation.reliability.outOf}
    </Badge>
  )
}

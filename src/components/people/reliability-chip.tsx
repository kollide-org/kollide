import { Badge } from '@/components/ui/badge'
import { useCountUp } from '@/lib/use-count-up'
import type { Reputation } from '@/services'

/** The number counts up as the card opens. Screen readers get the final number straight away. */
function Counted({ showedUp, outOf }: { showedUp: number; outOf: number }) {
  const value = useCountUp(showedUp, true, 900)
  return (
    <>
      <span aria-hidden="true" className="tabular-nums">
        Shows up: {value} of {outOf}
      </span>
      <span className="sr-only">
        Shows up: {showedUp} of {outOf}
      </span>
    </>
  )
}

/**
 * "Shows up: 11 of 12", or "New to Kollide" for someone without history yet.
 * A new member never shows an empty or low score.
 */
export function ReliabilityChip({ reputation, size, countUp = false }: { reputation: Reputation; size?: 'default' | 'sm'; countUp?: boolean }) {
  if (!reputation.reliability) {
    return (
      <Badge variant="soft" size={size}>
        New to Kollide
      </Badge>
    )
  }
  const { showedUp, outOf } = reputation.reliability
  return (
    <Badge variant="highlight" size={size}>
      {countUp ? <Counted showedUp={showedUp} outOf={outOf} /> : `Shows up: ${showedUp} of ${outOf}`}
    </Badge>
  )
}

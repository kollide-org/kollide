import { WordmarkLoader } from '@/components/brand/wordmark-loader'

/**
 * Shown while the first screen's code loads, or while the session is checked.
 * It is the same wordmark loader that index.html draws before any script runs.
 */
export function BootFallback() {
  return (
    <div role="status" aria-label="Loading Kollide" className="grid min-h-dvh place-items-center">
      <WordmarkLoader delayed className="text-[3rem]" />
    </div>
  )
}

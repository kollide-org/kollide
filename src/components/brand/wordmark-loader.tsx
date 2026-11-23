import { cn } from '@/lib/utils'

/**
 * The wordmark loader: the "k" arrives on its own, then "ollide" slides out
 * from behind it, holds, and folds back. CSS only, so it runs before Motion
 * loads. With reduced motion it is simply the wordmark.
 */
export function WordmarkLoader({ className, delayed = false }: { className?: string; delayed?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex font-display leading-none tracking-[-0.01em] text-primary',
        delayed && 'wordmark-loader',
        className,
      )}
    >
      <span className="wordmark-k">k</span>
      <span className="-mb-[0.12em] inline-block overflow-hidden pb-[0.12em]">
        <span className="wordmark-rest">ollide</span>
      </span>
    </span>
  )
}

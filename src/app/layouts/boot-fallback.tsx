/**
 * Shown while the first screen's code loads, or while the session is checked.
 * It is the same wordmark loader that index.html draws before any script runs.
 */
export function BootFallback() {
  return (
    <div role="status" aria-label="Loading Kollide" className="grid min-h-dvh place-items-center">
      <span
        aria-hidden="true"
        className="wordmark-loader inline-flex font-display text-[3rem] leading-none tracking-[-0.01em] text-primary"
      >
        <span className="wordmark-k">k</span>
        <span className="-mb-[0.12em] inline-block overflow-hidden pb-[0.12em]">
          <span className="wordmark-rest">ollide</span>
        </span>
      </span>
    </div>
  )
}

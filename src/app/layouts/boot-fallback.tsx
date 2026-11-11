import { Skeleton } from '@/components/ui/skeleton'

/** Shown for the moment it takes to load the first route's code. */
export function BootFallback() {
  return (
    <div role="status" aria-label="Loading Kollide" className="container-page min-h-dvh">
      <div className="flex h-16 items-center md:h-20">
        <span className="font-display text-[1.75rem] leading-none text-primary">kollide</span>
      </div>
      <div className="grid max-w-2xl gap-5 pt-12 md:pt-20">
        <Skeleton className="h-7 w-32 rounded-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-2/3" />
        <Skeleton className="h-6 w-5/6" />
      </div>
    </div>
  )
}

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LazyMotion, MotionConfig } from 'motion/react'
import { lazy, Suspense, useState, type ReactNode } from 'react'

import { TooltipProvider } from '@/components/ui/tooltip'

import { SessionProvider } from './session-provider'
import { ThemeProvider } from './theme-provider'

// Loaded on demand so neither delays the first screen.
const loadMotionFeatures = () => import('@/lib/motion-features').then((module) => module.default)
const Toaster = lazy(() => import('@/components/ui/sonner').then((module) => ({ default: module.Toaster })))

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  })
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient)

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {/* reducedMotion="user" drops movement for people who ask for less motion, and keeps fades. */}
        <MotionConfig reducedMotion="user">
          {/* `strict` makes a full `motion.*` component an error. Use `m.*` from "motion/react-m". */}
          <LazyMotion features={loadMotionFeatures} strict>
            <SessionProvider>
              <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
              <Suspense fallback={null}>
                <Toaster />
              </Suspense>
            </SessionProvider>
          </LazyMotion>
        </MotionConfig>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

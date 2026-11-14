import { QueryClientProvider } from '@tanstack/react-query'
import { LazyMotion, MotionConfig } from 'motion/react'
import { lazy, Suspense, type ReactNode } from 'react'

import { queryClient } from '@/app/query-client'

import { SessionProvider } from './session-provider'
import { ThemeProvider } from './theme-provider'

// Loaded on demand so neither delays the first screen.
const loadMotionFeatures = () => import('@/lib/motion-features').then((module) => module.default)
const Toaster = lazy(() => import('@/components/ui/sonner').then((module) => ({ default: module.Toaster })))

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {/* reducedMotion="user" drops movement for people who ask for less motion, and keeps fades. */}
        <MotionConfig reducedMotion="user">
          {/* `strict` makes a full `motion.*` component an error. Use `m.*` from "motion/react-m". */}
          <LazyMotion features={loadMotionFeatures} strict>
            <SessionProvider>
              {children}
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

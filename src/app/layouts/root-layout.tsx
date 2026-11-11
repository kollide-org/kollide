import { lazy, Suspense } from 'react'
import { Outlet, ScrollRestoration } from 'react-router'

import { servicesMode } from '@/services'

// The role switcher is only ever bundled into development builds, and only works with mock services.
const RoleSwitcher = import.meta.env.DEV ? lazy(() => import('@/dev/role-switcher')) : null

export function RootLayout() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <Outlet />
      <ScrollRestoration />
      {RoleSwitcher && servicesMode === 'mock' ? (
        <Suspense fallback={null}>
          <RoleSwitcher />
        </Suspense>
      ) : null}
    </>
  )
}

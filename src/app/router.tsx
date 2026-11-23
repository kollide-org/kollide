import { createBrowserRouter } from 'react-router'

import { RequireRole } from '@/app/guards/require-role'
import { queryClient } from '@/app/query-client'
import { eventQueries } from '@/features/events/queries'
import { BootFallback } from '@/app/layouts/boot-fallback'
import { PublicLayout } from '@/app/layouts/public-layout'
import { RootLayout } from '@/app/layouts/root-layout'
import { NotFoundPage } from '@/pages/not-found'
import { Component as LandingPage } from '@/pages/public/landing'
import { RouteErrorPage } from '@/pages/route-error'
import { StubPage } from '@/pages/stub-page'

/**
 * Starts fetching an event while the page's code is still loading, so the two
 * arrive together. It does not wait: the page shows its skeleton if data is late.
 */
function prefetchEvent({ params }: { params: { slug?: string } }) {
  if (params.slug) void queryClient.prefetchQuery(eventQueries.detail(params.slug))
  return null
}

/** The same idea for the home page: the hub and the feed start loading at once. */
function prefetchHome() {
  void queryClient.prefetchQuery(eventQueries.activeHub())
  return null
}

/**
 * The landing page ships in the first bundle, because it is the first screen
 * most people see. Every other layout and page is loaded on demand.
 */
export const router = createBrowserRouter([
  {
    Component: RootLayout,
    ErrorBoundary: RouteErrorPage,
    HydrateFallback: BootFallback,
    children: [
      {
        Component: PublicLayout,
        children: [
          { index: true, Component: LandingPage },
          { path: 'styleguide', lazy: () => import('@/pages/dev/styleguide') },
          { path: 'dev/data', lazy: () => import('@/pages/dev/mock-data') },
          { path: 'how-it-works', lazy: () => import('@/pages/public/how-it-works') },
          { path: 'safety', lazy: () => import('@/pages/public/safety') },
          { path: 'privacy', lazy: () => import('@/pages/public/privacy') },
          { path: 'terms', lazy: () => import('@/pages/public/terms') },
          { path: 'events/:slug', loader: prefetchEvent, lazy: () => import('@/pages/public/event') },
        ],
      },
      {
        lazy: async () => ({ Component: (await import('@/pages/auth/auth-layout')).AuthLayout }),
        children: [
          { path: 'sign-in', lazy: () => import('@/pages/auth/sign-in') },
          { path: 'sign-in/code', lazy: () => import('@/pages/auth/sign-in-code') },
        ],
      },
      { path: 'onboarding/:step?', lazy: () => import('@/pages/onboarding') },
      {
        element: <RequireRole minimum="member" />,
        children: [
          {
            path: 'app',
            lazy: async () => ({ Component: (await import('@/app/layouts/app-layout')).AppLayout }),
            children: [
              { index: true, loader: prefetchHome, lazy: () => import('@/pages/app/home') },
              { path: 'events/:slug', loader: prefetchEvent, lazy: () => import('@/pages/app/event') },
              { path: 'events/:slug/book', loader: prefetchEvent, lazy: () => import('@/pages/app/book') },
              { path: 'plans', lazy: () => import('@/pages/app/plans') },
              { path: 'plans/:bookingId/cancel', lazy: () => import('@/pages/app/cancel-booking') },
              { path: 'squads', lazy: () => import('@/pages/app/squads') },
              { path: 'squads/:squadId', lazy: () => import('@/pages/app/squad') },
              { path: 'connections', lazy: () => import('@/pages/app/connections') },
              { path: 'feedback/:eventId', lazy: () => import('@/pages/app/feedback') },
              { path: 'profile', lazy: () => import('@/pages/app/profile') },
              { path: 'people/:userId', lazy: () => import('@/pages/app/person') },
              { path: 'settings', element: <StubPage title="Settings" milestone={9} /> },
              {
                element: <RequireRole minimum="host" />,
                children: [
                  { path: 'host', lazy: () => import('@/pages/app/host') },
                  { path: 'host/new', lazy: () => import('@/pages/app/host-create') },
                  { path: 'host/events/:slug', loader: prefetchEvent, lazy: () => import('@/pages/app/host-event') },
                ],
              },
            ],
          },
        ],
      },
      {
        element: <RequireRole minimum="admin" />,
        children: [
          {
            path: 'admin',
            lazy: async () => ({ Component: (await import('@/app/layouts/admin-layout')).AdminLayout }),
            children: [
              { index: true, lazy: () => import('@/pages/admin/hosts') },
              { path: 'events', lazy: () => import('@/pages/admin/events') },
              { path: 'hubs', lazy: () => import('@/pages/admin/hubs') },
              { path: 'reports', lazy: () => import('@/pages/admin/reports') },
              { path: 'users', lazy: () => import('@/pages/admin/users') },
              { path: 'partners', lazy: () => import('@/pages/admin/partners') },
            ],
          },
        ],
      },
      { path: '*', Component: NotFoundPage },
    ],
  },
])

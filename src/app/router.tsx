import { createBrowserRouter } from 'react-router'

import { RequireOnboarded } from '@/app/guards/require-onboarded'
import { RequireRole } from '@/app/guards/require-role'
import { BootFallback } from '@/app/layouts/boot-fallback'
import { PublicLayout } from '@/app/layouts/public-layout'
import { RootLayout } from '@/app/layouts/root-layout'
import { NotFoundPage } from '@/pages/not-found'
import { Component as LandingPage } from '@/pages/public/landing'
import { RouteErrorPage } from '@/pages/route-error'
import { StubPage } from '@/pages/stub-page'

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
          { path: 'how-it-works', element: <StubPage padded title="How it works" milestone={3} /> },
          { path: 'safety', element: <StubPage padded title="Safety and code of conduct" milestone={3} /> },
          { path: 'privacy', lazy: () => import('@/pages/public/privacy') },
          { path: 'terms', element: <StubPage padded title="Terms" milestone={3} /> },
          { path: 'sign-in', lazy: () => import('@/pages/public/sign-in') },
          { path: 'auth/callback', lazy: () => import('@/pages/public/auth-callback') },
          { path: 'onboarding', lazy: () => import('@/pages/onboarding') },
          { path: 'reconfirm/:token', lazy: () => import('@/pages/public/reconfirm') },
        ],
      },
      {
        element: <RequireRole minimum="member" />,
        children: [
          {
            element: <RequireOnboarded />,
            children: [
              {
                path: 'app',
                lazy: async () => ({ Component: (await import('@/app/layouts/app-layout')).AppLayout }),
                children: [
                  { index: true, lazy: () => import('@/pages/app/home') },
                  { path: 'events/:id', lazy: () => import('@/pages/app/event') },
                  { path: 'hubs/:slug', lazy: () => import('@/pages/app/hub') },
                  { path: 'become-host', lazy: () => import('@/pages/app/become-host') },
                  { path: 'plans', lazy: () => import('@/pages/app/plans') },
                  { path: 'squads', lazy: () => import('@/pages/app/squads') },
                  { path: 'notifications', lazy: () => import('@/pages/app/notifications') },
                  { path: 'connections', lazy: () => import('@/pages/app/connections') },
                  { path: 'appeals', lazy: () => import('@/pages/app/appeals') },
                  { path: 'events/:id/feedback', lazy: () => import('@/pages/app/feedback') },
                  { path: 'profile', lazy: () => import('@/pages/app/profile') },
                  { path: 'settings', lazy: () => import('@/pages/app/settings') },
                  {
                    element: <RequireRole minimum="host" />,
                    children: [
                      { path: 'host', lazy: () => import('@/pages/app/host') },
                      { path: 'host/events/new', lazy: () => import('@/pages/app/host-event-form') },
                      { path: 'host/events/:id', lazy: () => import('@/pages/app/host-event-form') },
                      { path: 'host/events/:id/inbox', lazy: () => import('@/pages/app/host-inbox') },
                      { path: 'host/events/:id/checkin', lazy: () => import('@/pages/app/host-checkin') },
                    ],
                  },
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
            element: <RequireOnboarded />,
            children: [
              {
                path: 'admin',
                lazy: async () => ({ Component: (await import('@/app/layouts/admin-layout')).AdminLayout }),
                children: [
                  { index: true, lazy: () => import('@/pages/admin/host-applications') },
                  { path: 'verifications', lazy: () => import('@/pages/admin/verifications') },
                  { path: 'events', lazy: () => import('@/pages/admin/events') },
                  { path: 'hubs', lazy: () => import('@/pages/admin/hubs') },
                  { path: 'jobs', lazy: () => import('@/pages/admin/jobs') },
                  { path: 'reports', lazy: () => import('@/pages/admin/reports') },
                  { path: 'users', lazy: () => import('@/pages/admin/users') },
                  { path: 'appeals', lazy: () => import('@/pages/admin/appeals') },
                  { path: 'flags', lazy: () => import('@/pages/admin/flags') },
                  { path: 'partners', lazy: () => import('@/pages/admin/partners') },
                  { path: 'audit', lazy: () => import('@/pages/admin/audit') },
                  { path: 'config', lazy: () => import('@/pages/admin/config') },
                ],
              },
            ],
          },
        ],
      },
      { path: '*', Component: NotFoundPage },
    ],
  },
])

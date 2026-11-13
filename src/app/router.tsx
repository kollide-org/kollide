import { createBrowserRouter } from 'react-router'

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
          { path: 'dev/data', lazy: () => import('@/pages/dev/mock-data') },
          { path: 'how-it-works', lazy: () => import('@/pages/public/how-it-works') },
          { path: 'safety', lazy: () => import('@/pages/public/safety') },
          { path: 'privacy', lazy: () => import('@/pages/public/privacy') },
          { path: 'terms', lazy: () => import('@/pages/public/terms') },
          { path: 'events/:slug', element: <StubPage padded title="Event preview" milestone={5} /> },
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
              {
                index: true,
                element: (
                  <StubPage
                    eyebrow="Bengaluru"
                    title="What’s on"
                    description="The seasonal hub, squads forming and the event feed."
                    milestone={5}
                  />
                ),
              },
              { path: 'plans', element: <StubPage title="My plans" milestone={7} /> },
              { path: 'squads', element: <StubPage title="Squads" milestone={6} /> },
              { path: 'connections', element: <StubPage title="Connections" milestone={8} /> },
              { path: 'profile', lazy: () => import('@/pages/app/profile') },
              { path: 'people/:userId', lazy: () => import('@/pages/app/person') },
              { path: 'settings', element: <StubPage title="Settings" milestone={9} /> },
              {
                element: <RequireRole minimum="host" />,
                children: [{ path: 'host', element: <StubPage title="Host dashboard" milestone={6} /> }],
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
              { index: true, element: <StubPage eyebrow="Admin" title="Host approvals" milestone={9} /> },
              { path: 'events', element: <StubPage eyebrow="Admin" title="Events" milestone={5} /> },
              { path: 'hubs', element: <StubPage eyebrow="Admin" title="Hubs" milestone={5} /> },
              { path: 'reports', element: <StubPage eyebrow="Admin" title="Reports" milestone={9} /> },
              { path: 'users', element: <StubPage eyebrow="Admin" title="Users" milestone={9} /> },
              { path: 'partners', element: <StubPage eyebrow="Admin" title="Partner links" milestone={9} /> },
            ],
          },
        ],
      },
      { path: '*', Component: NotFoundPage },
    ],
  },
])

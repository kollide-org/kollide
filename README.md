# Kollide

The frontend for Kollide version 1, a social events platform for Bengaluru. People find an event, then host it or join it with a small group of verified people. Kollide is not a dating app.

This repository is the frontend only. There is no backend yet. All data will come from a typed mock layer that can be swapped for real services without changing any component.

## Status

| Milestone | State |
|---|---|
| 1. Foundations (tokens, theme, fonts, base components, layouts, role switcher) | Built |
| 2. Mock layer | Not started |
| 3. Landing page | Not started |
| 4. Onboarding | Not started |
| 5. Events | Not started |
| 6. Requests and squads | Not started |
| 7. Bookings | Not started |
| 8. After the event | Not started |
| 9. Admin and polish | Not started |

Routes for later milestones exist as placeholders, so the navigation and role guards can be reviewed now.

## Setup

You need Node 22 or later.

```bash
npm install
```

```bash
npm run dev
```

The site runs at `http://localhost:5173`.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Starts the development server |
| `npm run build` | Regenerates the class-merge tables, type-checks, and builds the static site into `dist/` |
| `npm run preview` | Serves the built site locally |
| `npm run lint` | Runs oxlint |
| `npm run cn` | Regenerates `src/lib/cn-tables.ts` (see "Class merging") |
| `npm run typecheck` | Type-checks the frontend |
| `npm run db:start` / `db:stop` / `db:reset` | Starts, stops or resets the local Supabase stack (reset also runs the demo seed) |
| `npm run db:test` | pgTAP tests (`supabase/tests`) |
| `npm run db:rls` | Fails if any table in `public` has Row Level Security off |
| `npm run db:race` | Two sessions race for the last seat; and a double check-in scan |
| `npm run db:types` | Regenerates `src/types/database.ts` after a migration |
| `npm run db:restore-test` | Backup drill: dump, encrypt, decrypt, restore into a scratch database, compare (`docs/backend/RESTORE.md`) |
| `npm run worker:dev` / `worker:test` / `worker:typecheck` | The Cloudflare Worker in `workers/api` |
| `npm run e2e` | Playwright end-to-end tests against the local stack |
| `npm run check:bundle` | Fails if the built frontend contains a service key or a server secret name |
| `npm run check:dns -- auth.<domain> mail.<domain>` | SPF, DKIM and DMARC check for the sending domains (`docs/backend/EMAIL_DNS.md`) |
| `npm run load:join` | 50 simultaneous join requests on one event: no overbooking (`docs/backend/LAUNCH_CHECKLIST.md`) |

## Stack

Vite, React, TypeScript, Tailwind CSS, shadcn/ui (Radix), React Router, TanStack Query and Motion for React. Icons are Lucide throughout. Zod, GSAP and Lenis are added in the milestones that first use them.

## Folder structure

```
src/
  app/            router, providers, layouts (public, app, admin), role guard
  pages/          one folder per area: public, app, admin, dev
  features/       feature code, added from milestone 4
  components/
    ui/           shadcn components, restyled to the Kollide tokens
    shared/       wordmark, links, empty and error states, footer
    motion/       shared animation components
  services/       types now; interfaces and the mock layer in milestone 2
  domain/         reputation and booking rules, added in milestone 2
  styles/         tokens.css, fonts.css, globals.css
  lib/            class merging, motion presets, storage helpers
  dev/            the development-only role switcher
public/fonts/     self-hosted fonts and their licences
```

## Theme

Every colour, radius, shadow and font is a CSS variable in `src/styles/tokens.css`. `src/styles/globals.css` maps those variables to Tailwind utilities. Components only use the semantic names (`bg-primary`, `text-muted-foreground`, `bg-highlight`), so a new theme is a change to `tokens.css` and nothing else.

| Token | Light | Dark | Use |
|---|---|---|---|
| `primary` | Cherry rose `#A63A50` | `#E58FA0` | The one main action per screen, links, the verified badge |
| `highlight` | Dusty rose `#BA6E63` | `#BA6E63` | Reliability chips, "Squads forming" tags, fills |
| `background` | Antique white `#F0E7D8` | `#1E1719` | Page background |
| `card` | `#FBF6EE` | `#2A2124` | Raised surfaces |
| `foreground` | `#2A2224` | `#F0E7D8` | Text |

Rules that keep the palette accessible (WCAG AA):

- Dusty rose is never used for body-size text on the page background. Its contrast there is about 3.1:1.
- The status colours (`success`, `warning`, `destructive`) are fixed in every theme and are for fills, icons and borders. Text that states a status uses the matching `-strong` shade.
- An error is always shown with an icon and words, because the error red is close to cherry rose.

Dark mode is the `dark` class on `<html>`. The choice is saved under `kollide:theme` in `localStorage`; with no saved choice the site follows the operating system.

Fonts are Gloock (headings) and Instrument Sans (body), self-hosted from `public/fonts` under the SIL Open Font License. The type scale is nine sizes, from `text-display` to `text-xs`, defined in `globals.css`.

The style guide at `/styleguide` shows every token and component in both themes.

## Motion

- Use `m.*` components from `motion/react-m`, not `motion.*`. The animation engine is loaded after first paint through `LazyMotion`, and a full `motion.*` component throws an error in development.
- Shared springs and the stagger presets are in `src/lib/motion.ts`.
- Animate position, scale and opacity only. Interface feedback lasts 150 to 300 ms.
- The operating system's "reduce motion" setting is respected for Motion, CSS animations and page transitions.
- Links use the View Transitions API where the browser supports it. Use `AppLink` and `AppNavLink` from `src/components/shared/app-link.tsx` instead of React Router's `Link`.

## Roles

There are four roles: visitor, member, host and admin. `RequireRole` in `src/app/guards` hides routes a role may not see. This is a courtesy in the interface; real enforcement belongs to the backend.

In development, a floating button in the bottom-right corner switches the current role and links to the main areas. It is not included in production builds. The choice is saved under `kollide:dev-role` in `localStorage`.

## Mock and real services

`VITE_SERVICES=mock` (the default) uses in-memory fake data. `VITE_SERVICES=real` uses Supabase and needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see `.env.example`). The flag is read in one file, `src/services/index.ts`. Components call TanStack Query hooks, the hooks call the service interfaces in `src/services/types`, and the lint rule in `.oxlintrc.json` blocks any import of `services/mock` or `services/real` from outside `src/services`.

Real so far: auth (Google and email code), profile and onboarding, app config and reference data. Everything else is still mock or not built. In mock mode the development role switcher works as before; in real mode it is hidden and the role comes from the database.

The Content-Security-Policy is written to `dist/_headers` by `npm run build` (`scripts/build-headers.mjs`), using `VITE_SUPABASE_URL`, `VITE_API_URL` and `VITE_MEDIA_URL`.

End-to-end tests run against the local Supabase stack: `npm run db:start`, then `npm run e2e`.

## Class merging

`cn()` in `src/lib/utils.ts` merges Tailwind classes. It uses tables compiled from this project's source files and theme, in `src/lib/cn-tables.ts`. That file is generated: do not edit it. The Vite plugin updates it during development, and `npm run build` regenerates it. Commit the result.

When you add a shadcn component, change its `import { cn } from "cn"` to `import { cn } from '@/lib/utils'`, so the custom type scale merges correctly.

## Deployment

The build is a static site with no server-side rendering, suitable for Cloudflare Pages.

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | 22 |

`public/_redirects` sends every path to `index.html`, so client-side routes work on a direct visit or a refresh.

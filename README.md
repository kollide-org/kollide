# Kollide

The frontend for Kollide version 1, a social events platform for Bengaluru. People find an event, then host it or join it with a small group of verified people. Kollide is not a dating app.

This repository is the frontend only. There is no backend yet. All data will come from a typed mock layer that can be swapped for real services without changing any component.

## Status

| Milestone | State |
|---|---|
| 1. Foundations (tokens, theme, fonts, base components, layouts, role switcher) | Built |
| 2. Mock layer (types, services, seed data, placeholder artwork) | Built |
| 3. Landing page and public pages (How it works, Safety, Privacy, Terms) | Built |
| 4. Sign-in, onboarding and profile | Built |
| 5. Events (home, filters, hubs, event page, create event, admin approval) | Built |
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
| `npm test` | Runs the unit tests for the rules and the mock services |
| `npm run placeholders` | Redraws the placeholder artwork in `public/assets` from the seed data |
| `npm run cn` | Regenerates `src/lib/cn-tables.ts` (see "Class merging") |

## Stack

Vite, React, TypeScript, Tailwind CSS, shadcn/ui (Radix), React Router, TanStack Query and Motion for React. Forms use React Hook Form with Zod for validation. GSAP with ScrollTrigger and Lenis are used on the public pages only. Icons are Lucide throughout.

## Folder structure

```
src/
  app/            router, providers, layouts (public, app, admin), role guard
  pages/          one folder per area: public, app, admin, dev
  features/       query hooks and feature code, one folder per area
  components/
    ui/           shadcn components, restyled to the Kollide tokens
    shared/       wordmark, links, empty and error states, footer
    people/       avatar, avatar stack, verified badge, reliability chip
    motion/       shared animation components
  services/
    types/        every entity, as TypeScript types
    interfaces/   one interface per service
    mock/         the mock backend and its seed data
    real/         where the real backend plugs in
    index.ts      the single mock/real switch
  domain/         reputation, booking and refund rules, as tested pure functions
  styles/         tokens.css, fonts.css, globals.css
  lib/            class merging, formatting, motion presets, storage helpers
  dev/            the development-only role switcher
public/assets/    covers, hub artwork and avatars for the seed data
public/fonts/     self-hosted fonts and their licences
scripts/          the placeholder artwork generator
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

Four tools, each with one job:

| Tool | Used for | Where |
|---|---|---|
| CSS | Entrances at the top of a page (`rise-in`, `line-reveal`) and slow decorative loops | Everywhere |
| Motion for React | Interface animation: staggered lists, scene changes, scroll-linked parallax | Everywhere |
| GSAP with ScrollTrigger | The two scroll moments: the statement that comes into focus word by word, and the pinned "How it works" sequence | Landing page only |
| Lenis | Smooth scrolling | Public pages only, never inside the app |

Rules:

- Use `m.*` components from `motion/react-m`, not `motion.*`. The animation engine is loaded after first paint through `LazyMotion`, and a full `motion.*` component throws an error in development.
- Anything visible on first load animates with CSS, so it never waits for JavaScript.
- Animate position, scale and opacity only. Interface feedback lasts 150 to 300 ms.
- Shared springs and the stagger presets are in `src/lib/motion.ts`.
- GSAP is fetched on the first scroll, through `useScrollMoment` in `src/pages/public/landing`. Lenis is fetched when the browser is idle.
- The operating system's "reduce motion" setting is respected everywhere. With it on, the landing page shows the steps as a plain list, text is fully visible, and Lenis stops smoothing.
- Links use the View Transitions API where the browser supports it. Use `AppLink` and `AppNavLink` from `src/components/shared/app-link.tsx` instead of React Router's `Link`.

## Performance

The first bundle holds the hero and nothing else from the landing page. The sections below it load once the hero has painted and mount one at a time. The mock backend, GSAP, Lenis, the mobile menu and toasts are all separate chunks, loaded when they are first needed.

A page that shows data, such as an event page, starts fetching its data in the route loader, at the same moment its code is requested. Its cover image still cannot start loading until that data has arrived, so on a slow phone the event page paints its largest element later than the landing page does.

## Roles

There are four roles: visitor, member, host and admin. `RequireRole` in `src/app/guards` hides routes a role may not see. This is a courtesy in the interface; real enforcement belongs to the backend.

In development, a floating button in the bottom-right corner signs you in as the seeded account for each role, links to the main areas, and resets the demo data. It is not included in production builds.

| Role | Signed in as | What their account shows |
|---|---|---|
| Member | Ananya | A plan to reconfirm, a pending request, a waitlist place, a gentle decline, two paid bookings, ₹900 credit, and feedback to give |
| Host | Arjun | A request inbox with six requests and two people on the waitlist |
| Admin | Meera | Host applications, an event to approve, open reports, an appeal and a collusion flag |

## Sign-in and onboarding

Both ways of signing in go through `authService`, so nothing here is a real login yet.

- **Google:** "Continue with Google" signs in as a new account (`you@gmail.com` in mock mode).
- **Email code:** enter an email, then a 6-digit code. In mock mode the code is always `123456`, and the screen says so. Use a seeded address such as `ananya.rao@example.com` to sign in as an existing member.

An account without a finished profile can only reach `/onboarding`. The steps, in order: first name, date of birth, gender, area, three photos, interests, languages, prompts, mobile number, an optional selfie, and consent.

- Date of birth comes second, so nobody under 18 is asked for photos or a phone number before being turned away.
- Each step has its own address (`/onboarding/photos`), so the browser's back button works. A step cannot be opened until the ones before it are done.
- The draft is saved to `localStorage` as it is typed, one per account, so a refresh loses nothing.
- Photos are cropped to four by five in the browser and stored as WebP (JPEG where the browser cannot write WebP).
- Validation rules live in `src/features/onboarding/schemas.ts` as Zod schemas, with tests. The mock service checks the same rules again.

## Events

- **Home (`/app`):** the active seasonal hub, squads forming, then the event feed.
- **Filters:** date, area, kind of event, cost, group size and women-only. They live in the page address (`/app?price=free&areas=Indiranagar`), so a filtered view can be shared and the back button steps through changes. "Free" means no entry cost, so it includes pay-at-venue events.
- **Hubs:** `HubSection` takes any hub: a title, artwork, an accent colour and its events. The accent arrives as a CSS variable, so nothing is styled for one season.
- **Event page:** `/events/:slug` is the public preview and `/app/events/:slug` is the member's page. They share one view. The exact address is fetched separately, and only once the service says the viewer may see it. Guest names appear only to people who are going.
- **The main button** depends on the kind of event: "Request to join" for community events, "Book" for Kollide's own, and "Get tickets" (an outbound link) with "Join a squad" for partner events.
- **Creating an event (`/app/host/new`):** seven steps, saved as they are written. House parties are capped at 25 guests. Every new event waits for approval at `/admin/events` before it is listed.

## Mock and real services

Components never talk to a backend directly. They call TanStack Query hooks in `src/features`, the hooks call the service interfaces, and one file decides which implementation answers.

```
component  ->  query hook  ->  service interface  ->  mock or real implementation
```

**The switch.** `src/services/index.ts` reads one flag:

| Setting | Result |
|---|---|
| `VITE_SERVICES=mock` (the default) | The mock backend runs in the browser |
| `VITE_SERVICES=real` | Calls go to `src/services/real` |

Put the flag in a `.env.local` file or in the build environment. To connect a real backend, implement the nine interfaces in `src/services/interfaces` inside `src/services/real`. No component or hook changes. A lint rule in `.oxlintrc.json` blocks any import of `services/mock` or `services/real` from outside `src/services`.

**The mock backend.**

- It keeps its data in memory and mirrors it to `localStorage` under `kollide:mock-db`, so changes survive a refresh. "Reset demo data" in the role switcher starts again from the seed.
- The seed is built relative to today, so there are always events coming up. It has 40 members, 16 events (14 of them live), 3 squads, 12 finished events that give reliability a history, and one event from yesterday whose feedback window is open.
- Calls take about 450 ms, so loading states are visible. Set `VITE_MOCK_DELAY_MS` to change this.
- The email sign-in code is always `123456`.
- To see a failed payment, pay with a UPI ID ending in `@fail` or a card number ending in `0002`.
- Raise `DB_VERSION` in `src/services/mock/db.ts` whenever the seed or its shape changes, so browsers with old data reseed.

**Calculated values.** Reliability ("Shows up: 7 of 8"), tag counts, spots left, host ratings and gentle tips are worked out from bookings, check-ins and reviews each time they are asked for. None of them is stored. The rules live in `src/domain` as pure functions with tests, ready to move to the backend unchanged.

**Seed images.** The covers, hub artwork and avatars in `public/assets` are placeholder artwork drawn from the brand palette by `npm run placeholders`. They stand in for generated photographs. To swap in real images, add the files and change `IMAGE_EXTENSION` in `src/services/mock/seed/assets.ts`.

The page at `/dev/data` shows the seed data read through the real hooks.

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

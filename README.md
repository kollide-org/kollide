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
| 6. Requests and squads (host inbox, waitlist, squads) | Built |
| 7. Bookings (checkout, reconfirmation, refunds and credit, My plans) | Built |
| 8. After the event (check-in, feedback, reports, reliability, meet again) | Built |
| 9. Admin, settings and polish | Built |

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

Vite, React, TypeScript, Tailwind CSS, shadcn/ui (Radix), React Router, TanStack Query and Motion for React. Forms use React Hook Form with Zod for validation. GSAP with ScrollTrigger and Lenis are used on the landing page only. Icons are Lucide throughout.

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
scripts/          the placeholder artwork generator and the route preload build plugin
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
| Lenis | Smooth scrolling | Landing page only |

Rules:

- Use `m.*` components from `motion/react-m`, not `motion.*`. The animation engine is loaded after first paint through `LazyMotion`, and a full `motion.*` component throws an error in development.
- Anything visible on first load animates with CSS, so it never waits for JavaScript.
- Animate position, scale and opacity only. Interface feedback lasts 150 to 300 ms.
- Shared springs and the stagger presets are in `src/lib/motion.ts`.
- GSAP is fetched on the first scroll, through `useScrollMoment` in `src/pages/public/landing`. Lenis is fetched when the browser is idle.
- The operating system's "reduce motion" setting is respected everywhere. With it on, the landing page shows the steps as a plain list, text is fully visible, and Lenis stops smoothing.
- Links use the View Transitions API where the browser supports it. Use `AppLink` and `AppNavLink` from `src/components/shared/app-link.tsx` instead of React Router's `Link`.

### Signature moments

Each one shows something real happening, and each plays once, at the moment it means something.

| Moment | Where | What happens |
|---|---|---|
| The wordmark loader | `index.html`, `BootFallback` | The "k" arrives alone, then "ollide" slides out from behind it. Drawn in plain HTML and CSS, so it shows before any script loads, and only after half a second, so fast loads never see it. The same wordmark is the waiting state while a payment is confirmed. |
| The last screen | Landing page, closing section | As you scroll to the end, the wordmark writes itself: "ollide" slides out from behind the "k". |
| The invitation | Event page, the first time you see the address | The address arrives as an invitation card ("You’re invited") that turns over to show the address on the back. It plays when the card is on screen. |
| Your place at the table | Event page, "Who’s going" | Guests are name place cards set down at slight angles. The first time, your card drops onto the table among them. |
| The guestbook | Connections | Each new connection is written in, "Ananya & Aditi", left to right at a writing pace, with an underline drawn beneath. |
| Evening light | Home | A soft light behind the greeting follows the time of day in Bengaluru: early light, daytime, golden hour, dusk and after dark. The eyebrow names it. |
| The live ticket | Ticket | A slow band of light crosses the stub, a live clock ticks under your name, and the stub settles away from the code along the perforation. |
| Reliability counting up | Profile cards | "Shows up: X of Y" counts up as the card opens. Screen readers get the final number straight away. |

One-time moments are remembered in `localStorage` (`kollide:address-revealed`, `kollide:seated`, `kollide:guestbook-seen-at`). Clear those keys to see them again.

## Performance

The first bundle holds the hero and nothing else from the landing page. The sections below it load once the hero has painted and mount one at a time. The mock backend, GSAP, Lenis, the mobile menu and toasts are all separate chunks, loaded when they are first needed.

A page that shows data, such as an event page, starts fetching its data in the route loader, at the same moment its code is requested. For the pages people most often open from a shared link (the event page, Home and the in-app event page), `index.html` starts downloading the page's code and the services alongside the main bundle, through `scripts/vite-route-preload.ts`. The toaster is mounted once the page is idle.

Lighthouse, mobile, on the production build (`npm run build`, then `npx vite preview`):

| Page | Performance | Accessibility | Best practices |
|---|---|---|---|
| Landing | 97–98 | 100 | 100 |
| How it works | 99 | 100 | 100 |
| Event page | 83–85 | 100 | 100 |

The event page is below the target of 90. Its largest element is the cover image, and a page drawn in the browser cannot know which cover to show until about 375 kB of fonts, styles and code have arrived and the event has loaded. Unthrottled, the cover paints at about 0.4 s. Lighthouse's simulated slow phone puts it at 4.3 s. The mock's artificial delay is not the cause: with it set to zero the score is the same. Reaching 90 needs the event page's HTML to be rendered ahead of time, on the server or at build time, which is a change to the stack.

## Roles

There are four roles: visitor, member, host and admin. `RequireRole` in `src/app/guards` hides routes a role may not see. This is a courtesy in the interface; real enforcement belongs to the backend.

In development, a floating button in the bottom-right corner signs you in as the seeded account for each role, links to the main areas, and resets the demo data. It is not included in production builds.

| Role | Signed in as | What their account shows |
|---|---|---|
| Member | Ananya | A plan to reconfirm, a pending request, a waitlist place, a gentle decline, two paid bookings, ₹900 credit, feedback to give, and a squad she started with two people waiting for her answer |
| Host | Arjun | Two events with requests: six requests and two on the waitlist for board games, four requests for New Year’s Eve. His quiz night is on right now, ready for check-in |
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

## Requests and squads

- **The request inbox (`/app/host/events/:slug`):** a capacity meter, then three tabs: Requests, Waitlist and Going. Each request opens as the person’s profile card, with any note they wrote above it, and three answers: accept, waitlist and decline.
- **On a phone** the host swipes between people, or uses the arrow buttons. Swiping only moves through the list. Every answer takes a button press, so nobody is declined by a slip of the thumb.
- **The approval limit:** hosts can accept up to 30% more people than there are places. At the limit, Accept is switched off and the screen says why.
- **Declines are gentle.** The member hears that the event is full and gets similar events. The word "rejected" is not used anywhere.
- **Squads (`/app/squads`):** your squads, then squads forming, with a women-only filter. A squad’s page (`/app/squads/:id`) shows who is in, the public place where the squad meets and at what time, and what the viewer can do. The creator opens each person’s profile card before answering.
- **Starting a squad:** every upcoming event has a "Start a squad" button. A squad has a name, a public meeting place, a meeting time (15 to 60 minutes before the start) and a size of 4 to 6. Women can make a squad women-only, and every squad for a women-only event is women-only.
- **No chat.** A squad page has no messages, notes or contact details, by design.

## Bookings

- **Checkout (`/app/events/:slug/book`):** for Kollide’s own events. A summary with the price, any Kollide credit (used first, automatically) and what is left to pay, then a checkout sheet with UPI and card. The sheet shows "processing", then success with a reference, or a failure that says nothing was charged. If credit covers the whole price, it books with credit alone.
- **The checkout is simulated.** Everything goes through `paymentService`; no payment SDK is called. Payment details are used once and never stored. In mock mode, a UPI ID ending in `@fail` or a card number ending in `0002` shows the failure screen.
- **Refunds (`/app/plans/:bookingId/cancel`):** the four rules, with the one that applies now drawn forward, and exactly what cancelling would give back. More than 72 hours before: money back to where it came from, and any credit used comes back as credit. Inside 72 hours: the full amount as credit. A no-show gets nothing. If Kollide cancels, everyone is refunded automatically.
- **"Still coming?":** in the 24 hours before a free event, My plans asks. "Yes" shows on the host’s guest list as "Still coming". "I can’t make it" frees the place.
- **The waitlist:** when someone gives up a place, the next person on the waitlist gets it. They see "Moved up" on My plans and on the event page, and the host sees "Moved up from the waitlist" on the guest list. The person who left is told their place has gone to the next person, but not who.
- **My plans (`/app/plans`):** "Still coming?" cards, new updates, Kollide credit, upcoming and past plans with each one’s status and the address once it’s yours, and a payment history.

## After the event

- **Tickets:** anyone with a place has a QR ticket on My plans and on the event page. The code is drawn by `qrcode-generator` (free, MIT licence), loaded only when a ticket is opened.
- **Check-in (the "Guests" tab on the host’s event page):** opens two hours before the start. The host taps names as people arrive, or scans a ticket. The camera is simulated in this version, so the scanner takes the code shown under the QR. "Close out" lists everyone not checked in before marking them as missed.
- **The live quiz night:** Arjun’s "Pub quiz, team of strangers" starts an hour before the demo data is created, with Ananya booked, so the whole loop can be tried. "Reset demo data" in the role switcher makes it live again.
- **Feedback (`/app/feedback/:eventId`):** opens when the event ends, or as soon as the host closes it out, and closes 72 hours after the end. Only people who were checked in can give it. For each person: up to three tags from the fixed list, "I’d like to meet them again", and an optional private "Something felt off?". Then three yes-or-no questions about the host. Reviews stay hidden until both people have answered, or the window closes.
- **Reliability:** "Shows up: X of Y" is worked out from check-ins. Giving up a place in advance never counts against anyone. Your own profile explains your score.
- **Gentle tips:** shown only on your own profile, once several people said the same thing at more than one event. You can ask us to look again, and the tip shows "Under review".
- **Safety reports:** on every other member’s profile, every event page and the feedback screen. A report about a person puts them on hold: they can’t send requests, and their profile says so, with a way to appeal. The emergency number is in `src/lib/safety.ts`.
- **Connections (`/app/connections`):** people who both said yes. When three or more all said yes to each other, Kollide suggests a repeat. There are no messages, by design.

## Admin

Sign in as Meera (admin) from the role switcher. Every list has loading, empty, error and success states, and a decided item eases out of its queue.

| Page | What it does |
|---|---|
| Host approvals (`/admin`) | Members who asked to host, with their reliability, the tags guests gave them most, and why they want to host. Approve, or "Not just yet". |
| Events (`/admin/events`) | New events wait for review. The "Live and featuring" tab features live events, which then come first on Home and in browsing. |
| Hubs (`/admin/hubs`) | Create and edit seasonal hubs: title, dates in Bengaluru time, artwork, an accent pair that keeps AA contrast, and events. One shows on Home at a time. |
| Reports (`/admin/reports`) | Safety reports, appeals and review patterns. Anyone named in an open report is on hold; the hold lifts when no report about them is open. Closing a report needs a note. |
| Users (`/admin/users`) | Search members, then put on hold, suspend, ban or restore, always with a reason the member is shown. The "Selfie checks" tab compares a selfie with the profile photos. |
| Partner links (`/admin/partners`) | Where "Get tickets" goes for each partner event. Links must start with `https://`. |

A banned account is signed out and cannot sign in again. Overturning an appeal against a hold or a suspension gives the account back.

## Settings

`/app/settings` holds:

- **Account:** your standing. A hold or a suspension is explained there, with "Tell us your side" and the state of each appeal.
- **Privacy:** "Show my photo on event cards" and "Let people I meet ask to meet again". Both are enforced by the services, not just hidden in the interface.
- **Notifications:** email and push for reminders, squads, meet again and new events. Bookings, payments and safety are always on. No WhatsApp or SMS.
- **Appearance:** light, dark, or match the device.
- **Leaving Kollide:** sign out, or delete the account after a confirmation. Deleting is refused while you host an upcoming event, so your guests are told first.

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

Put the flag in a `.env.local` file or in the build environment. To connect a real backend, implement the ten interfaces in `src/services/interfaces` inside `src/services/real`. No component or hook changes. A lint rule in `.oxlintrc.json` blocks any import of `services/mock` or `services/real` from outside `src/services`.

**The mock backend.**

- It keeps its data in memory and mirrors it to `localStorage` under `kollide:mock-db`, so changes survive a refresh. "Reset demo data" in the role switcher starts again from the seed.
- The seed is built relative to today, so there are always events coming up. It has 40 members, 17 events (14 in the feed, and one happening right now), 4 squads, 12 finished events that give reliability a history, and one event from yesterday whose feedback window is open.
- Calls take about 450 ms, so loading states are visible. Set `VITE_MOCK_DELAY_MS` to change this.
- The email sign-in code is always `123456`.
- To see a failed payment, pay with a UPI ID ending in `@fail` or a card number ending in `0002`.
- Raise `DB_VERSION` in `src/services/mock/db.ts` whenever the seed or its shape changes, so browsers with old data reseed.

**Calculated values.** Reliability ("Shows up: 7 of 8"), tag counts, spots left, host ratings and gentle tips are worked out from bookings, check-ins and reviews each time they are asked for. None of them is stored. The rules live in `src/domain` as pure functions with tests, ready to move to the backend unchanged.

**Seed images.** The covers, hub artwork and avatars in `public/assets` are placeholder artwork drawn from the brand palette by `npm run placeholders`: soft pools of colour and grain, with no shapes in them. They stand in for generated photographs. To swap in real images, add the files and change `IMAGE_EXTENSION` in `src/services/mock/seed/assets.ts`.

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

# Kollide

Frontend and backend for Kollide v1, a social events platform for Bengaluru: people find an event, then host it or join it with a small group of verified people. It is not a dating app.

- Frontend: Vite, React, TypeScript, Tailwind, shadcn/ui, React Router, TanStack Query. See `README.md` for scripts, theme and motion rules.
- Services: components call hooks, hooks call interfaces in `src/services`, and a single flag (`VITE_SERVICES=mock|real`) picks the implementation.
- Backend: Supabase (Postgres, Auth, RLS) in `supabase/`, one Cloudflare Worker in `workers/api/`. Env vars are listed in `docs/backend/ENV.md`.

## Backend

Read these before any backend work:

@docs/backend/BACKEND_RULES.md

The full plan is in `docs/backend/BACKEND_PLAN.md`.

# GuestHQ — Progress

## Plan
1. Folders: `src/app/(planner)/app/...` planner UI, `src/app/g/[token]` guest UI, `src/app/auth` magic-link callback, `src/lib/supabase/{server,client,admin}.ts`, `src/lib/*` domain helpers, `supabase/migrations/0001_init.sql`, `scripts/seed.ts`.
2. Tables: planners, weddings, events, households, guests, invitations, rsvps, dietary, travel, accommodation_blocks, consents, photos (one migration, RLS by planner ownership via wedding_id).
3. Indexes: every `wedding_id`, unique `households.token`, unique `rsvps(guest_id, event_id)`.
4. Guest access: `/g/[token]` server component → service-role client, token lookup, phase switch (invite|rsvp|travel|live). No guest auth.
5. Planner routes: `/login`, `/app` (weddings), `/app/w/[id]` (overview), `/app/w/[id]/waiting`, `/assisted`, `/guests`, `/outputs/[kind]`, `/photos`, `/app/settings`.
6. Outputs: `/app/w/[id]/outputs/{caterer,headcount,rooming,transfers}` print pages + `?format=csv` route handlers.
7. Mutations: Server Actions in `actions.ts` next to each route. WhatsApp via wa.me links only.
8. TZ Africa/Johannesburg, ZAR; EN/AF guest labels in `src/lib/i18n.ts`.
9. Seed: `npm run seed` (tsx) — demo planner + Thandi & Sipho (140/50) + Anna & Ruan (80, 25 UK).
10. Phases 1–6 per MVP_BUILD_PROMPT.md; commit + update this file after each.

## Status
- Setup done: Next.js 16.4.5 (App Router, TS, Tailwind, ESLint, src/), @supabase/supabase-js + @supabase/ssr. Scaffolded in a temp dir and copied in (repo wasn't empty).
- Next: Phase 1 (needs Supabase env values).

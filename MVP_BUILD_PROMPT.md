# Claude Code Build Prompt — Guest Logistics MVP

> Start Claude Code in a new, empty folder (or a new empty GitHub repo for web sessions). This is a fresh build; no existing code is needed.
> "GuestHQ" is a working name; find-and-replace it any time.

---

## ROLE AND RULES

You are building a production-quality MVP in ONE session with a hard budget. Work like a senior engineer who is paying for every token.

**Budget rules (follow strictly):**
1. Plan once, then build. Do not re-plan unless something breaks.
2. Never read `node_modules`, lockfiles, `.next`, or build output. Never `cat` large files; read only the lines you need.
3. Do not re-read a file you just wrote or edited.
4. Batch related edits into one write per file. No exploratory refactors.
5. Run `npm run build` only at the end of each phase, not after every edit. Fix only what fails.
6. Keep replies to me short: what you did, what's next, anything blocking. No code recaps.
7. After each phase: commit with a clear message, update `PROGRESS.md` (5 lines max), then stop and tell me the phase is done so I can run `/compact`.
8. If a decision isn't specified here, choose the simplest option that works and note it in `PROGRESS.md`. Don't ask me unless it blocks the build.

## WHAT WE'RE BUILDING

`GuestHQ`: guest logistics for complex weddings (destination and multi-event cultural weddings), sold to wedding planners. One planner manages many weddings. Each wedding has several events (e.g. lobola, umembeso, white wedding; or welcome dinner, ceremony, brunch). Guests never log in.

The product wins on three things. Every screen must serve one of them:

1. **WhatsApp-first RSVP with auto-chase.** Each household gets a personal link. One tap per person per event. The planner sees one "Still waiting" list and sends reminders with one click. Assisted mode lets a planner capture a phone/voice-note RSVP in under 10 seconds.
2. **Outputs, not dashboards.** One click produces the documents planners send suppliers: caterer sheet per event (allergies flagged red), venue headcount, rooming list, transfer manifest. All branded with the planner's logo.
3. **One link, whole journey.** The same household link moves through phases: Invite → RSVP → Travel info → Live (photo wall on the day). Guests never install anything.

## FIRST STEP: SET UP (keep it cheap)

- Scaffold with `npx create-next-app@latest` (TypeScript, App Router, Tailwind, ESLint, `src/` dir) in the current folder, then add `@supabase/supabase-js` and `@supabase/ssr`. Nothing else unless a phase needs it.
- Create `.env.example` with the Supabase URL, anon key and service role key names. Ask me for the real values once, then continue.
- Write a 10-line plan in `PROGRESS.md`: folder structure, tables, routes. Then start phase 1.

## STACK DECISIONS (fixed)

- Next.js App Router, TypeScript, Tailwind. No component library.
- Supabase: Postgres, Row Level Security, Storage, Auth (email magic link) for planners only.
- Guest access: unguessable household token in the URL (`/g/[token]`), validated server-side. No guest accounts.
- Server Actions for mutations. No separate API layer unless needed.
- WhatsApp: `https://wa.me/<number>?text=<encoded message>` links only. No WhatsApp Business API.
- Exports: CSV download + a print-optimised HTML page per document (planner uses browser "Save as PDF"). No PDF library.
- Mobile-first for guest pages. Planner pages must work on a phone too.
- Times and dates in Africa/Johannesburg; currency ZAR.

## DATA MODEL

Every table except `planners` carries `wedding_id`. RLS: planners see only their own weddings; guest pages go through server code that checks the token.

- `planners` — id, auth user id, business name, logo url, brand colour, whatsapp number
- `weddings` — id, planner_id, couple names, slug, start/end dates, location, phase (`invite|rsvp|travel|live`), rsvp_deadline, consent text
- `events` — id, wedding_id, name, date/time, venue, dress code, sort order
- `households` — id, wedding_id, name, whatsapp number, token (unique, random 24+ chars), language (`en|af`), last_reminded_at, notes
- `guests` — id, household_id, wedding_id, full name, is_child, age (nullable), is_plus_one
- `invitations` — guest_id, event_id (which guest is invited to which event)
- `rsvps` — guest_id, event_id, status (`pending|yes|no`), source (`self|assisted`), updated_at
- `dietary` — guest_id, preference (`none|vegetarian|vegan|halal|kosher|other`), allergies text, allergy_severity (`none|mild|severe`), notes
- `travel` — household_id, arrival date/time, flight no., departure date/time, needs_transfer bool, accommodation_block_id
- `accommodation_blocks` — id, wedding_id, name, rooms total, deadline
- `consents` — household_id, consented_at (POPIA consent for dietary/allergy data)
- `photos` — id, wedding_id, household_id, storage path, caption, created_at, is_hidden (planner can hide). Storage bucket `photos`, path `{wedding_id}/{uuid}.jpg`.

Write ONE migration file. Add indexes on `wedding_id`, `household.token`, and `rsvps(guest_id, event_id)`.

## SCREENS

**Guest (`/g/[token]`)** — renders by wedding phase:
- Invite/RSVP: couple names, only the events this household is invited to, one row per person per event with Yes/No buttons, dietary step (with POPIA consent checkbox before allergy fields), confirmation screen they can screenshot.
- Travel: arrival/departure, flight, transfer needed, accommodation choice, key info (map links, dress code, FAQs).
- Live: photo wall, only reachable with a valid household token. Upload from phone camera or gallery (multiple files, compress client-side to max ~2000px before upload), masonry grid of the wedding's photos, newest first, tap to view full screen. Planner can hide a photo from `/app`.
- Simple English/Afrikaans toggle for guest-facing labels only.

**Planner (`/app`)**
- Weddings list → wedding overview with live counts per event (yes / no / pending), allergy alerts count, rooms used vs available.
- **Still waiting** list: households with any pending RSVP, sorted by days since last reminder, each with a "Remind on WhatsApp" button (opens wa.me with a personalised message + their link; stamps `last_reminded_at`).
- Assisted RSVP: search household → tap answers per person per event → save (source = assisted). Must take under 10 seconds.
- Guests: CSV import (household, name, phone, events) + inline add/edit.
- Phase switcher (moves every guest link to the next phase).
- **Outputs**: caterer sheet per event, venue headcount per event, rooming list, transfer manifest. Each = print page with planner logo + CSV download.
- Settings: logo, brand colour, WhatsApp number.

## SEED DATA (for the demo)

One demo planner and two weddings with realistic mess:
1. **Thandi & Sipho** — Gauteng, multi-event: lobola, umembeso, white wedding. 140 guests, 50 households, different guest lists per event.
2. **Anna & Ruan** — destination weekend in the Cape Winelands: welcome dinner, ceremony, farewell brunch. 80 guests incl. 25 from the UK; accommodation blocks; transfers.

Include: ~30% pending RSVPs, a vegan, two severe nut allergies, halal guests, kids, plus-ones, and two households last reminded 9+ days ago. Seed script: `npm run seed`.

## BUILD PHASES (stop after each)

1. **Foundation:** migration, RLS, seed script, planner magic-link auth, token-protected guest route skeleton. Done when: seed runs, planner logs in and sees both weddings, a seeded token opens the right household.
2. **Guest RSVP flow:** per-person-per-event RSVP, dietary + consent, confirmation, EN/AF toggle. Done when: a household RSVPs on a phone and the planner overview updates.
3. **Chase + assisted:** Still waiting list, WhatsApp remind links, assisted RSVP, CSV import. Done when: one click opens a correct wa.me message; assisted RSVP saves in under 10 seconds.
4. **Outputs:** four print pages + CSVs with planner branding; severe allergies highlighted. Done when: each prints cleanly to a one- or two-page PDF.
5. **Journey + live:** phase switcher, travel phase, photo wall (upload, grid, full-screen view, planner hide). Done when: switching phase changes what every guest link shows, and a photo uploaded on a phone appears on the wall.
6. **Polish + deploy:** empty/loading/error states, mobile check of every guest screen, `npm run build` clean, deploy to Vercel, env vars documented in `README.md`, and a 3-minute demo script in `DEMO.md`.

## OUT OF SCOPE (do not build)

Payments, email sending, WhatsApp Business API, seating charts, multi-currency, native apps, analytics, admin super-user, i18n beyond EN/AF guest labels, the follow-from-home page (non-guest viewers, messages from home) and the keepsake view. Don't build hooks or placeholders for these; they'll be added in a later session.

## DEFINITION OF DONE

- Deployed on Vercel with both seeded weddings working.
- A guest can RSVP on a phone in under 60 seconds without logging in.
- A planner can find who hasn't replied and remind them in two taps.
- All four outputs print with the planner's logo.
- One household link shows the right screen for each phase.
- `PROGRESS.md`, `README.md` and `DEMO.md` are up to date.

Start with the set-up step now.

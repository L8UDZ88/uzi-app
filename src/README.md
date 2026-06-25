# Uzi — Next.js + Postgres

The content machine, productized. One input → 7 pillars → every channel → auto-delivered.

## Stack
- Next.js 14 (App Router) + TypeScript + Tailwind
- Postgres via Prisma (Supabase / Neon / local)
- Custom auth: bcrypt password hashing + JWT session cookie (jose)

## Setup
1. `npm install`
2. Copy `.env.example` → `.env` and set `DATABASE_URL` + `AUTH_SECRET`
3. `npm run db:push`   (creates tables)
4. `npm run dev`       → http://localhost:3000

## Flow
Landing → Sign up → Onboarding wizard (Profile → Inputs → 7 Pillars → Outputs → Cadence)
→ Dashboard with auto-built 28-day calendar (regenerate any time).

## Structure
- `prisma/schema.prisma` — User, Brand (the config seam: pillars/channels/inputs JSON), ScheduleItem, Asset
- `src/lib/` — db, auth, constants (PILLARS + CHANNELS), calendar engine (mirrors gen_calendar.py)
- `src/app/api/` — auth (signup/login/logout), brand (GET/PUT config), schedule (POST regenerate)
- `src/components/` — Wizard, Dashboard, ui primitives
- `src/middleware.ts` — gates /onboarding and /dashboard

## Roadmap (next phases)
- **Phase 2:** wire the four Python generators (gen_nowin/bridge/locator/calendar) as a render worker; store outputs as Assets per ScheduleItem.
- **Phase 3:** live publishing — Meta (IG/FB), LinkedIn, YouTube, TikTok, Podcast RSS; scheduler fires approved posts.
- **Phase 4:** Stripe billing, team seats, human-gate approval, analytics feedback loop.

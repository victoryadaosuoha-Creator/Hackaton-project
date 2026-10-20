# Déglu Gambia (working build, v0.1)

A civic reporting app for The Gambia: report a problem, track it, see public reports, get AI-assisted drafting.
Frontend: Vite + vanilla JS. Backend: Supabase (Postgres + RLS + Edge Function).

## Quick start
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build into dist/
npm run preview
```
**With no `.env`, the app runs in DEMO MODE** (banner shown): reports stay in your browser only, nothing is stored in Supabase, sign-in and AI are off.

## Turn on live mode
1. Create a Supabase project, then `npx supabase login` and `npx supabase link --project-ref <ref>`.
2. `npx supabase db push` (applies both migrations). For a **dev** project only, also run `supabase/seed.sql` in the SQL editor. It adds placeholder institutions, localities, and categories.
3. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (public values only).
4. Optional AI: see `supabase/functions/ai/README.md` (secrets, `functions deploy ai`). Without a key the app still works and says AI is unavailable.
5. In Supabase > Auth > URL Configuration, add `http://localhost:5173` as a redirect URL (password recovery).
6. Run `supabase/tests/security_checks.sql` in the SQL editor. Every check must pass.
7. First admin: see `docs/supabase-setup.md`.

## What is wired
Landing page with live stats | 4-step report form (RPC with idempotency key) | tracking by reference (safe fields only) | community map and list (approved public reports only) | sign up, sign in, sign out, password recovery | "My account" dashboard (reports you chose to link) | AI: suggest category, missing-detail questions, tidy text, help assistant | voice input via the browser's speech API (you edit the text before submitting).

## NOT built yet
Staff portal, admin portal (status updates and role management exist only as database functions), photo upload (photos stay on the device), notifications, duplicate/incident linking UI, real street map (Leaflet), Wolof/Mandinka text (marked "awaiting review"), rate limiting at the submission step, CAPTCHA, and the staff/citizen isolation tests.
A newly submitted report does not appear on the public map until a staff member or admin marks it public, and that screen does not exist yet. For testing, run in the SQL editor: `update public.reports set is_public = true where reference = '<ref>';`

## Verification so far (honest)
- `npm run build`: passes.
- AI function unit tests: 13 pass (run with a local assert shim because this sandbox cannot reach jsr.io; `npm run test:ai` needs Deno and internet). The handler type-checks.
- **Not verified:** the SQL migrations, RLS, the RPCs, and the deployed function have never run against a real Supabase project. The frontend has not been opened in a browser.
Please run the checklist below and report anything that fails.

## Test checklist
1. Demo mode (no `.env`): submit a report, copy the reference, track it, open the map.
2. Live mode: submit anonymously, then track the code. The result must show status and timeline only, with no description.
3. Submit twice quickly or retry after going offline: you must get one report only.
4. Create an account, submit with "Link this report to my account" ticked, and see it under My account. An anonymous report must not appear there.
5. Mark the report public via SQL (above), then check that the map and home page show it.
6. Try a bad reference, a description under 10 characters, and a photo over 5 MB.
7. With the AI function deployed: try Suggest category, Tidy my text, and the Help page. Then remove the key and confirm the app says AI is unavailable and still works.
8. Narrow your browser to phone width and tab through the form with the keyboard.

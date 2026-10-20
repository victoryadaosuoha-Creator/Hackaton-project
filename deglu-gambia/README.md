# D?glu Gambia

A civic reporting hackathon MVP for The Gambia. Vite + vanilla JavaScript, Supabase Postgres/Auth/RLS, and an optional AI Edge Function.

## Run locally

Use Node 24 (Node 22.13+ also supported).

```bash
npm install
npm run dev             # http://localhost:5173
npm run build
npm run preview
```

With no Supabase values the app runs in **demo mode**: reports stay in this browser, accounts and AI are off. Copy `.env.example` to `.env` for live mode. Set `VITE_SUPABASE_URL` to the project base URL (no `/rest/v1/`) and `VITE_SUPABASE_ANON_KEY` to a publishable or legacy anon key, then restart Vite. Never put secret, service-role or AI keys in frontend variables.

## Implemented MVP

- Public home statistics, approved report list and stylised locality map with category/status filters.
- Four-step reporting, input/photo-size validation, optional approximate coordinates and account linking. Submissions use a database RPC and an idempotency key retained on retry.
- Anonymous reference tracking exposes safe fields and public notes only.
- Signup, signin, signout, recovery-link handling, password updates and linked-report dashboard.
- **Staff queue** at `#/staff`: institution-scoped reports, status transitions, required resolution/rejection notes, history, private staff notes and public-map approval.
- **Admin controls** at `#/admin`: all-report review, institution assignment, profile roles, category routing/activation, new institutions/localities and audit log. Access links appear in My account for active staff/admin profiles.
- Connected draft category/summary/missing-detail suggestions, editable voice transcription and grounded civic help. Staff can analyse saved reports, review priority/category/summary suggestions and inspect possible duplicates. Institutional insights use authorised database counts. See [AI setup and verification](supabase/functions/ai/README.md). Ordinary reporting remains independent of AI.

## Supabase setup and migration recovery

See [the setup guide](docs/supabase-setup.md). The linked development project's two migrations were manually executed in the SQL Editor, leaving migration history empty. After comparing all 22 baseline function bodies and inspecting enums, tables, columns, policies, triggers and RLS, their versions were marked applied. No existing data was reset or deleted and no RLS rule was relaxed.

```bash
npx supabase migration list
npx supabase db push --dry-run
```

For a new database, `npx supabase db push` applies the migrations, including the additive connected-AI APIs. Do not rerun the baseline SQL against an existing schema or add blanket `IF NOT EXISTS` clauses to hide drift. Development seed data is already present in the linked project; do not rerun it there.

First admin: sign up in the app, then promote that user's UUID using the owner-only SQL in the setup guide. There are no default credentials. Other roles can then be managed in Administration.

In Supabase Auth URL Configuration, allow `http://localhost:5173/#/reset-password` and your deployed origin's corresponding recovery URL. Configure email delivery and test confirmation/recovery with your inbox.

## Verification commands

```bash
npm run lint
npm test
npm run test:ai
npm run test:browser
npm run check:db
npm run build
```

Browser tests use headless Microsoft Edge by default (installed on this machine), phone-sized viewports, isolated demo/mocked-live servers, and one **read-only real-project** check using your local environment. For another machine install Edge, or change the Playwright browser channel. The connected check requires a configured project and active categories/localities. No test configuration overwrites `.env`.

Owner-run database integration tests create fixture users/reports only inside rolled-back transactions:

```bash
npx supabase db query --linked --file supabase/tests/security_checks.sql
npx supabase db query --linked --file supabase/tests/role_isolation.sql
npx supabase db query --linked --file supabase/tests/reference_generation.sql
```

They check anonymous submission/idempotency/input rejection, safe tracking, signup-profile creation, citizen separation, institution isolation, role escalation, private notes, public approval, required resolution notes, admin reopening/assignment and auditing. See [verification notes](docs/verification.md) for the exact results and limits.

## Remaining scope

Photos are validated locally but **not uploaded**. Notifications, incident merging, street-map tiles, reviewed Wolof/Mandinka text, submission/tracking rate limits and CAPTCHA are not built. The stylised map has markers for the original five localities; other localities remain visible in the list. Staff/admin queries display bounded recent records (200 reports/profiles, 100 audit entries), without pagination.

The AI Edge Function is deployed to the development project, but Gemini credentials/model and the server rate-limit configuration still require setup. Unit tests/type checks do not prove a live provider works. See [AI setup](supabase/functions/ai/README.md). Confirmation email delivery and real recovery links require a manual inbox check. This is a demonstration project, not an official government channel; public-launch abuse controls, backups and retention are still outstanding.

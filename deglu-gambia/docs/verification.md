# Verification record ? 20 October 2026

## Scope and environment

Windows, Node 24.18.1, headless Microsoft Edge at a 390?844 viewport. Existing Vite/vanilla-JS and Supabase architecture retained. No SRS file is present; implementation scope follows README.md and docs/supabase-setup.md.

## Changes

- Completed staff review: RLS-scoped queue, search/status filtering, progress updates, required resolution/rejection reasons, history, private notes and community-map approval.
- Completed admin controls: all-report review/assignment, profile roles, category creation/routing/activation, institution/locality creation and recent audit log.
- Fixed admin account loading by filtering profile lookup to the current user; auth notifications render outside the Supabase auth callback.
- Added recovery-link routing and password update/confirmation, email/password validation and Enter-key submission.
- Added explicit invalid-configuration errors and rejection of secret/service-role credentials in the browser, restored empty env-example entries, and bounded API waits to 15 seconds.
- Protected report retry payloads from edits while submission is uncertain, preserved the idempotency key, restored account-link checkbox state, and prevented stale home/track/report/map/account requests from replacing a newer route.
- Added form label associations, location removal and immediate rejection of out-of-country coordinates, AI-processing notice, mobile portal styles and safe optional-AI network fallback.
- Updated Vite 5 to Vite 7.3.7 after dependency audit findings. An explicit build target retains the former browser compilation baseline. Development tooling requires Node 22.13 or Node 24+.

## Migration incident

Both manually applied baseline migrations existed in schema but were absent from migration history. Inspected enum values, all ten tables/columns, RLS policies, triggers and function definitions; every one of the 22 baseline function bodies matched the local SQL exactly. The owner-run anonymous security and role-isolation tests passed before migration repair.

Recorded 20261020000001 and 20261020000002 as applied using the CLI's migration repair command. This changed migration-history bookkeeping only. Original migrations remain unchanged. db push and its dry run now report the remote database is up to date, with no migrations/seeds/roles to apply. Database lint reports no schema errors.

No existing application records were reset or deleted. No RLS policy, grant, enum, application table or database function was changed. The exploratory generator migration was removed: the original 31-character alphabet was correct, and its generator passed 2,000 format checks. Database test fixtures and the exploratory DDL verification were entirely rolled back.

## Checks

| Check | Result / boundary |
| --- | --- |
| npm run lint | Pass |
| npm test | 4 passed: configuration and timeout/cancellation |
| npm run test:ai | 13 passed, mocked providers |
| deno check --node-modules-dir=none supabase/functions/ai/index.ts | Pass |
| npm run build | Pass on Vite 7 |
| npm audit | Zero known vulnerabilities after upgrade |
| Supabase db lint --linked | No schema errors |
| npm run check:db | Live reference data, public RPCs and invalid tracking checks pass; anonymous reads of private tables denied |
| Anonymous SQL security suite | Pass, rolled back |
| Citizen/staff/admin SQL isolation suite | Pass, rolled back |
| Reference-generator stress check | 2,000 valid references |
| Browser demo + mocked live flows | 12 passed: reporting, validation, oversized photo rejection, retry idempotency, account linking, safe tracking UI, staff/admin controls, access guards, signup, signin/out, recovery links, password updates and delayed navigation |
| Read-only real-project browser smoke | Pass: public stats/list, categories/localities, reporting validation and map; no runtime exceptions, successful REST responses |
| Visual inspection | Real-project mobile home screenshot inspected |

The connected browser check initially exceeded the default five-second assertion wait; with a 20-second network allowance it passed. This was not treated as proof of failure or success until rerun. API calls now have a separate 15-second timeout for user-facing retry behavior.

## Verification limits and manual handoff

1. Create a real account through the app and check its confirmation email. In the SQL Editor, promote that user's UUID using the first-admin instructions. No existing real user was promoted by this work. Staff/admin flows were exercised with mocked browser sessions and transaction-scoped database auth fixtures; a full browser flow using real Auth-issued staff/admin JWTs remains a manual smoke check.
2. Configure the site URL and allowed recovery redirect URL (http://localhost:5173/#/reset-password locally), then request and follow a real recovery email. Link parsing and password-update calls pass browser integration tests, but inbox delivery was not tested.
3. AI endpoint is unavailable. Provider secrets, supported gateway authentication for publishable-key anonymous requests, deployment and real-provider verification remain optional setup. No gateway authorization or production deployment was changed.
4. Photos stay local; notifications, incident grouping, street tiles and reviewed translations remain unfinished. New localities appear in lists; the stylised map only plots the five original localities. Recent staff/admin lists are bounded and lack pagination.
5. Submission/tracking abuse controls, production backups and retention still need implementation/configuration before public launch.

.env was not modified during this implementation. No secrets were printed, committed or copied into documentation/tests. Test servers use process-local public dummy configuration. No production site/function deployment occurred.

Final account integrity check: zero Auth users without profiles; zero active admins. The first-admin bootstrap is therefore still required.

Final CLI connectivity note: after db push, its dry run, and database lint succeeded, a later migration-list recheck and its retry timed out during Supabase login-role initialization. No further database writes were attempted. The repaired history was confirmed earlier; persistent CLI connectivity depends on the external Supabase service/network.

Final report-validation regression: after the last client fix, lint and production build pass again. Both targeted browser checks pass: unchanged idempotency payload on network retry, and returning to edit the report after a definite server validation failure. This adds one browser case to the previously passing 13-test full suite (14 distinct browser cases verified across the runs).

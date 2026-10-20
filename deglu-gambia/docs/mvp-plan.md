# Hackathon MVP implementation plan

Repository audit, 20 October 2026. Requirements are the README and setup documentation; the referenced SRS document is absent.

1. Reconcile migration history only after comparing the live schema and running rollback-only security tests. Both baseline migrations exist remotely but are absent from migration history. Preserve original migrations and existing data.
2. Fix configuration errors, async navigation, account recovery, validation, and report retry behavior.
3. Complete staff review: institution queue, status history, public approval, internal notes. Use existing RLS and RPCs.
4. Complete admin controls: institution assignment, roles, category routing, institutions/localities, audit viewer.
5. Verify with lint, production build, AI unit tests, browser integration tests, and rollback-only database tests for anonymous/citizen/staff/admin isolation.
6. Document precise verified behavior and remaining launch requirements.

Implemented before this audit: public statistics, report submission RPC, anonymous safe tracking, approved public listing, stylised map/filtering, basic auth and linked reports, AI provider adapters and rule fallback, RLS, audit history.

Gaps found: password recovery had no password update screen; profile lookup did not filter current user (breaks for admins); staff/admin UI absent; missing env-example entries; navigation could complete stale async requests; no lint/browser tests. Disk space is now available and the initial build passes.

Deferred beyond hackathon core: photo storage/uploads, notifications, incident merging, real street tiles, reviewed translations, public submission/tracking abuse controls, backup and retention configuration.

Audit correction: the reference alphabet has 31 characters. The original SQL generator passed 2,000 format checks; no SQL generator change is needed. The frontend now uses the alphabet length explicitly, with equivalent behavior.

Completed: migration history reconciliation, client reliability/auth recovery fixes, staff/admin MVP screens, automated browser/unit/database checks, updated setup documentation. See verification.md for results and remaining external configuration.

# Déglu Gambia: Supabase setup

Status (20 October 2026): both baseline migrations are present in the linked development database and their migration history has been reconciled after inspection. Live read-only API checks and rollback-only anonymous/citizen/staff/admin database tests pass. See verification.md for limitations.

## 1. Create the project
1. Create a project at supabase.com (free tier is fine for the demo).
2. Install the CLI (`npm i -D supabase`) and run `npx supabase login`, then `npx supabase link --project-ref <ref>`.

## 2. Apply the schema
- Remote: `npx supabase db push`
- Local dev (needs Docker): `npx supabase start`, then `npx supabase db reset`. This applies migrations **and** `seed.sql`.
- Seed data is for development only. Do not run `seed.sql` on production; add real institutions and routing through the admin portal.

## 3. Verify security
Open the SQL editor on a **dev** database and run `supabase/tests/security_checks.sql`. It must finish with `All anonymous-access checks passed`. It rolls back, so it leaves no data.

## 4. Environment variables
| Variable | Where | Public? |
|---|---|---|
| `VITE_SUPABASE_URL` | frontend | yes |
| `VITE_SUPABASE_ANON_KEY` (publishable key) | frontend | yes, safe only because RLS is on |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions only | **never** in frontend or git |
| `AI_API_KEY` | Edge Function secret (`npx supabase secrets set ...`) | **never** in frontend or git |

Without Supabase variables the frontend must show demo mode. Without the AI key it must show "AI unavailable".

## 5. Create the first admin (securely)
No default admin exists. There is no password in this repo.
1. Sign up normally through the app (or Auth > Users > Add user).
2. In the SQL editor (runs as the project owner, which is the only trusted way to bootstrap):
   ```sql
   update public.profiles set role = 'admin' where id = '<that user uuid>';
   ```
3. After that, use the admin portal, which calls `admin_set_role` (admin-only, audited). It stops admins removing their own role.

## 6. Authentication settings
In Auth > URL Configuration, set the site URL and allowed redirect URLs for local and deployed origins so password recovery works.

## Data model
`institutions`, `service_areas`, `report_categories` (routing: category → institution), `profiles` (1:1 with auth user), `reports`, `report_updates` (append-only history), `report_internal_notes` (append-only, staff only), `audit_logs` (append-only), `ai_assessments` (AI suggestions with review outcome).

Not built yet: `incidents` (duplicate grouping), `notifications`, `report_attachments` (photos are local-only in the demo).

## Permissions matrix
| Action | Anonymous | Citizen | Staff (own institution) | Admin |
|---|---|---|---|---|
| Submit report (RPC) | yes | yes, optionally linked to account | yes | yes |
| Track by reference (safe fields only) | yes | yes | yes | yes |
| Read own reports + public timeline notes | no | yes | n/a | yes |
| Read institution queue + all history | no | no | yes | all |
| Change status (validated transitions) | no | no | yes | yes (can also reopen) |
| Add internal notes | no | no | yes | yes |
| Assign institution, change roles, manage routing | no | no | no | yes |
| Read audit logs | no | no | no | yes |
| Public map data (approved reports only) | yes | yes | yes | yes |

## Design decisions to know
- Browser roles have **no write access** to `reports`. Everything goes through `submit_report`, `update_report_status`, etc.
- Anonymous reports store no identity. Signed-in citizens are linked only if they opt in (`p_link_account`).
- `track_report` never returns title, description, landmark, coordinates, or staff identity. A reference alone does not unlock private data.
- Coordinates are rounded to 2 decimals (~1 km) at submission. The public map shows approximate positions only.
- Staff access is checked server-side on every call via `is_staff_of(institution_id)`. Routing changes never rewrite old reports.
- A report with no routed institution is kept (`institution_id` null) and appears only to admins.

## Known limitations
- **Rate limiting and CAPTCHA are not implemented.** `submit_report` is callable by anyone with the anon key. Put an Edge Function with rate limiting in front of it before any public launch; do not claim abuse controls until configured and tested.
- Reference space is about 887 million codes. Brute-force guessing is impractical but still needs rate limiting on `track_report`.
- Citizens cannot edit a report after submission (deliberate for the MVP).
- Role-isolation tests now exist in supabase/tests/role_isolation.sql and pass using transaction-scoped auth user fixtures and trusted SQL JWT-claim simulation. Real Auth-issued JWTs and email delivery still need a manual smoke check.
- Dev passwords, backups, and retention policy are not configured.

## Manual authentication smoke check
Create two staff users in different institutions plus two citizens, then verify with their JWTs through the REST API: cross-institution status change is rejected, citizen A cannot read citizen B's report, a citizen updating their own `role` fails, and `resolved` without a note is rejected.

## Recovering manually applied migrations

The linked project originally had an empty supabase_migrations.schema_migrations table while both complete schemas were already present. All 22 function bodies matched exactly, and enums, tables/columns, RLS policies and triggers were inspected before changing history. The anonymous and role-isolation tests passed with all fixture changes rolled back. The following reversible bookkeeping operation was completed:

```bash
npx supabase migration repair --status applied 20261020000001 20261020000002
```

This marks existing SQL as applied; it does not execute the migration SQL or recreate objects. Check migration list and db push --dry-run afterward. On a different project, inspect the schema first; do not mark incomplete migrations applied. Supabase documents this workflow at https://supabase.com/docs/guides/deployment/database-migrations.

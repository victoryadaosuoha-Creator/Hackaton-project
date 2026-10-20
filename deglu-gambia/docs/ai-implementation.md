# AI implementation against AI-SPEC.md

Inspected the specification, existing provider/helper/Edge Function code and README, baseline migrations, report submission/authentication flow, RLS and staff UI before coding. Reused existing provider adapters, priority rules, SQL similarity/location search, assessment storage/review and trusted report APIs.

Existing versus added:

| Feature | Previously present | Added/connected |
| --- | --- | --- |
| Report analysis | Provider helper, draft category UI | Strict schema, displayed summary/questions, stale-draft guard, staff assessment generation and confirmation/correction |
| Duplicates | Service-only SQL search | Permission-checked staff API, current candidate display, location evidence, safe stored snapshots, no merging |
| Civic help | Free-text model prompt | Model selects verified fact IDs; server renders grounded facts and uncertainty; verified-help fallback |
| Voice | Single-result browser speech input | Final/interim handling, start/stop, editable transcript, permission/errors, unsupported browser and unverified-language notices |
| Institutional insights | Missing | RLS-scoped SQL aggregates, selectable time window/institution, real counts/tables, validated AI highlight selection and deterministic summaries |
| Security/tests | Basic helper tests | Caller-RLS report reads, atomic authorised assessment storage, client key/Auth checks, 8KB byte cap, fail-closed limits, handler and UI integration tests |

The linked project was confirmed to match the frontend configuration and was already identified by the user as a development/hackathon database. Before schema changes, inspected live function signatures, assessment columns, row count (zero) and enabled RLS. The additive migration was tested in a transaction that rolled back. It was then applied normally with db push; security tests passed again and database lint reported no errors. Original migrations/data/RLS policies were preserved.

The ai Edge Function was deployed to the development project using API bundling. Gemini is the selected provider but no provider secrets are configured. The attempt to initialise missing server settings was not approved, so configuration remains manual. See the function README for exact secret names; no provider key was exposed, invented, overwritten or committed, and .env was not changed.

Verified: 29 AI tests, 19 demo/mocked-live browser tests, four frontend unit tests, production build, JavaScript lint and Deno type check pass. Live database tests verify exact aggregates, duplicate scope/location filtering and assessment permissions/review. Tests use mocked AI outputs and simulated browser speech; they do not prove model accuracy or a working microphone. No successful real Gemini response is claimed.

Remaining: configure Gemini key/model, rate-limit salt and appropriate client-key/origin allowlists; verify a real provider call, real-user staff flow and English microphone recognition manually. Healthcare/Education categories can be added by an admin; the provider can only suggest configured categories. Incident linking/merging, actual report priority fields and automatic institutional actions are deliberately absent; review outcomes remain advisory assessment records.

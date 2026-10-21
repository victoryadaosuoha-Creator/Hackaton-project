# Connected civic AI

Implementation follows docs/AI-SPEC.md. The Edge Function and migration 20261020000003_connected_ai.sql are deployed to the linked development project. The provider is intended to be Gemini; its API key and explicit model are not configured. Deployment is not proof of a successful model call.

## Citizen flow

Analyse draft sends the title/description to the server for category, summary and missing-detail suggestions. The summary is displayed for review; it does not overwrite the report. Citizens can change the category and description. Tidy my text proposes an editable rewrite with Undo. Reports can be submitted without using either AI action.

Speak (English) uses SpeechRecognition or webkitSpeechRecognition when present. Final speech results are added to the editable description. Interim text, start/stop state, microphone errors and unsupported-browser messages are shown. Wolof and Mandinka are explicitly unverified. The application does not upload audio, but the browser's speech provider may process it. Real microphone accuracy was not tested by automated browser mocks.

## Staff flow

Open a report in the staff queue. Possible duplicates load from the authenticated database API even without a model. Analyse report calls the configured provider and saves category, summary/missing details, priority and duplicate evidence as pending suggestions. Staff can confirm, dismiss or correct suggestions. Review outcomes use review_ai_assessment; they do not change the report category, institution, status or visibility, and do not merge records. A confirmed priority is stored in the assessment; there is no separate priority column on reports.

Duplicate matching reuses the existing SQL trigram/location method: same institution/category, within 90 days, similarity >=0.35, and same locality or approximately 2 km apart. Source and candidate permissions are both checked. Stored snapshots contain IDs/evidence, not candidate private titles/references; displayed candidates are fetched under current permissions. An empty result means no match with this method, not proof of uniqueness. Detection is deterministic SQL, not a claimed AI model.

Institutional insights aggregate actual reports over 7/30/90 days. Staff are limited to their institution; admins may choose an institution or all. Counts are computed inside PostgreSQL without REST pagination limits. The provider sees aggregate categories/localities/status counts, never report titles, descriptions, identities, coordinates or internal notes. It can select highlight IDs only. The server renders all prose/numbers from real aggregates, preventing model-invented counts. Without a model the same database counts are summarised deterministically. Unresolved excludes resolved/rejected. This is a windowed report snapshot, not a claim of causation or a rise/fall over time.

## Civic assistant

The model selects up to three IDs from facts.ts. It cannot supply free-form policy answers. The server renders verified application facts and uncertainty statements; unknown IDs or malformed results fall back to verified keyword help. Facts cover the real report/account/tracking flow, six database statuses, photo limitations, voice limitations, visibility and recovery. The assistant cannot look up a reference or assert an individual report is repaired. Keep facts.ts aligned with application changes.

## HTTP actions

| Action | Access | Result |
| --- | --- | --- |
| status | recognised public client key | provider configuration flag, not a provider health test |
| analyze_draft | public client key, 10/10 minutes per IP | category, summary, missing details; priority kept staff-only |
| organise | public client key, 10/10 minutes per IP | editable title/description/questions |
| assistant | public client key, 20/10 minutes per IP | verified facts and uncertainty; no report lookup |
| assess_report | Auth-verified active staff/admin, 30/10 minutes per user | saved reviewable suggestions and currently permitted duplicates |
| institution_insights | Auth-verified active staff/admin, 10/10 minutes per user | authorised aggregate counts and grounded summary |

## Server configuration still required

In Supabase Dashboard > Edge Functions > Secrets, configure values on the server. Do not paste keys into chat, frontend code, .env or git.

- AI_PROVIDER: gemini (the runtime default, but set it explicitly).
- AI_API_KEY: your Gemini provider key.
- AI_MODEL: an exact model enabled for your account that supports JSON responses. No model identifier is guessed by the code.
- RATE_LIMIT_SALT: a long randomly generated private string. Public paid/help actions fail closed until this is configured.
- ALLOWED_ORIGINS: comma-separated exact browser origins. Default: http://localhost:5173. Add your actual development/deployed origins deliberately.
- AI_PUBLIC_CLIENT_KEYS: your frontend sb_publishable_ key if not automatically present in the runtime's SUPABASE_PUBLISHABLE_KEYS map. This is a public client credential, not a provider/service-role secret.

AI_TIMEOUT_MS is optional (3000-30000, default 15000). SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are runtime-provided. No server secrets were created or overwritten by this work; the configuration command was not approved.

config.toml replaces the legacy gateway JWT parser with explicit request authentication because publishable client keys are not JWTs. Every non-preflight action checks a recognised project client key. Staff actions additionally call Auth getUser(token), then use the caller's JWT/RLS and permission-checked database APIs. No frontend-supplied role is trusted. RLS and existing grants were not weakened. See https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys and https://supabase.com/docs/reference/javascript/auth-getuser.

Public IP limiting assumes trusted platform forwarding headers; validate your gateway configuration before public launch. A missing salt or failed limiter denies AI work. Existing ordinary submission/tracking abuse-control limitations are unchanged.

## Response schemas and safeguards

- Analysis: category is an active configured slug or null; confidence is null or finite 0-1; nonempty summary <=240 characters; at most four missing-detail questions <=140 characters; priority is low/medium/high/urgent; up to three model reasons <=140 characters. Missing/invalid fields reject the model result and use labelled rules. Conservative priority rules may raise a model suggestion; staff still decide.
- Rewrite: title 3-80 characters, description 10-500, at most four questions <=140 characters. Invalid output leaves the original report available.
- Assistant: fact_ids contains only known keys, maximum three; uncertain is boolean. Prose comes from verified facts, not model text.
- Insights: model output contains at most three existing category keys and three existing area IDs. Unknown highlights are rejected. All numeric output comes from validated database aggregates.

Inputs are untrusted data in system prompts and delimiters. Emails/phone-like contact details are masked before provider requests; this is not a guarantee of complete PII removal, so avoid personal details in drafts. Category labels and aggregate labels are also treated as data. Strict runtime validators are authoritative even if a provider emits JSON mode output.

The request body is capped at 8 KB of UTF-8 bytes. CORS origins are checked; API/database/provider waits are bounded; limiter failures fail closed. Logs contain action/status/timing only, never report text, credentials or provider error bodies. Structured results are suggestions, not proof of truth or institutional authority. Compare summaries with the original before accepting.

## Tests and verification

npm run test:ai: 29 passing provider/helper/HTTP-handler tests, including invalid schemas, redaction, hostile prompts, authentication, permission revocation, duplicate errors, rate limits, provider timeouts and grounded insights. npm run test:browser -- --project demo --project live: 19 passing tests including summaries, priority correction, duplicate display, counts, editable voice, unsupported browsers and rate-limit fallback. Browser speech and provider outputs are mocked in these tests.

The migration passed rollback-only tests before application, and supabase/tests/ai_security.sql passes on the applied development schema. Tests cover same-locality and nearby candidates, exclusion of distant/old/foreign candidates, exact institutional counts, citizen/staff/admin/inactive access, atomic review storage and no automatic report changes. Database lint reports no schema errors.

Run npm run lint, npm test, npm run test:ai, npm run test:browser and npm run build. For database tests run npx supabase db query --linked --file supabase/tests/ai_security.sql (fixture data rolls back).

Real Gemini output, real microphone transcription, and full staff-browser flows with real Auth-issued credentials still require manual verification after server setup. No provider API key has been supplied or tested. Optional extra contract tests/formatting were not added because that command was not approved; the existing passing tests remain in place.

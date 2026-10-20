# `ai` Edge Function

Status: **written, not yet deployed or run.** The unit tests use mocked providers and have not been executed yet. Run them before trusting this.

Every output is a **suggestion for human review**. Nothing here changes a report's status, assignment, or visibility.

## Actions
Call with `supabase.functions.invoke('ai', { body: { action, ... } })`.

| Action | Who | Input | Returns |
|---|---|---|---|
| `status` | anyone | none | `{ ai_available }` so the UI can show "AI unavailable" |
| `analyze_draft` | anyone (10 per 10 min per IP) | `title?`, `description` | suggested category, short summary, missing-detail questions. **No priority** (that is for staff). |
| `organise` | anyone (10 per 10 min per IP) | `text` (typed or voice transcript) | tidied `title` + `description` + missing-detail questions for the citizen to edit |
| `assistant` | anyone (20 per 10 min per IP) | `messages` (last 6, 500 chars each) | plain-text help about using the app |
| `assess_report` | staff/admin only (30 per 10 min per user) | `report_id` | stores category, summary, priority, and duplicate suggestions in `ai_assessments`; returns them with ids |

Staff accept, correct, or dismiss a stored suggestion with the existing `review_ai_assessment(id, outcome, corrected)` function.

## Setup
```bash
npx supabase db push                      # applies 0002_ai_support.sql (rate limits + duplicate search)
npx supabase secrets set AI_PROVIDER=gemini AI_API_KEY=<key> AI_MODEL=<model> \
  ALLOWED_ORIGINS=https://your-site.example,http://localhost:5173 RATE_LIMIT_SALT=<random string>
npx supabase functions deploy ai
deno test supabase/functions/ai/ai_test.ts
```
`AI_PROVIDER` is `gemini` or `anthropic`. **Set `AI_MODEL` explicitly** and check the provider's current model list; the built-in defaults are unverified guesses. `AI_TIMEOUT_MS` is optional (3000 to 30000, default 15000).
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically by Supabase. None of these secrets may ever appear in frontend code or `VITE_` variables.

## When AI is not configured
No key means the app keeps working:
- `status` returns `ai_available: false`.
- `analyze_draft` and `assess_report` fall back to **keyword rules** and say `source: "rules"`. The summary stays empty. They never pretend to be AI.
- `organise` and `assistant` return `ai_available: false`. The frontend should submit the citizen's own text unchanged.

Provider timeouts, errors, or malformed output trigger the same fallback with `ai_error: true`.

## What is sent to the AI provider
Only: the report title, description, and locality name (staff analysis), the draft text (citizen analysis), the typed or transcribed text (`organise`), or the chat messages (`assistant`). Emails and phone numbers are masked first. Never sent: reporter identity, account ids, coordinates, reference codes, internal notes, photos, or other reports' text. Duplicate detection runs entirely inside the database.
Providers may retain data under their own terms, so tell citizens in the privacy notice that drafts may be processed by a third-party AI service.

## Priority rules (transparent)
1. Wording about immediate danger (exposed wires, fire, collapse, gas leak, contaminated water) gives **urgent**.
2. Wording about injury, flooding, schools, clinics, children, disease, or no water/power gives at least **high**.
3. 5 or more possibly related reports gives at least **high**; 3 to 4 gives at least **medium**.
4. A stated duration of weeks or months gives at least **medium**.
5. The model may suggest higher. The final suggestion is the **higher** of rules and model. It is not a promise of response time.

## Duplicate detection
SQL, not an AI model: same category and institution, last 90 days, same locality or within about 2 km, and trigram text similarity of 0.35 or more. Coordinates are stored rounded (about 1 km), so distance is approximate. Candidates are advisory. Nothing is merged or deleted.

## Safeguards
- Report text is wrapped in `<report>` tags with angle brackets stripped, and the prompts treat it as untrusted data.
- Model output is validated: unknown categories, priorities, and over-long strings are dropped.
- Request size cap (8 KB), per-IP and per-user rate limits (fails closed), CORS allow-list, provider timeouts.
- Logs record action, status, and timing only. No report text, tokens, or provider responses.

## Known limitations
- **Voice:** this function only tidies a transcript. Speech-to-text is not done server-side. Use the browser's Web Speech API (support varies by browser and language) and let the citizen edit the text. Wolof and Mandinka recognition is untested.
- **Wolof/Mandinka replies** from the assistant are intentionally not offered until tested.
- The civic-assistant facts live in `ASSISTANT_SYSTEM` in `index.ts`. Have your team verify them and update them when the app changes.
- Seeded categories do not include Healthcare or Education from the AI spec. Add them in the admin portal (or seed) if wanted; the function reads categories from the database.
- Trend summaries for institutions are not built yet.
- The fixed-window rate limiter can allow a short burst at window edges. `ai_rate_limits` rows are never cleaned up; schedule a periodic delete for old rows.
- `assess_report` inserts new rows on every call. Add a UI guard against repeat clicks.

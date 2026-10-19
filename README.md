# Callframe

## Purpose

Callframe is a cold-call companion. While a sales call is happening, the caller works
through eight stages (Opening, Purpose, Permission, Their business, Their need in their
words, Objection, Next step, Close), taps what actually happened, and writes down the
prospect's own words. When the call ends, Callframe records an honest outcome and keeps a
history of every call, including every earlier version of what was recorded at each stage.

It was built for the DeepThought Forward Deployed Engineer selection task. The product
spec is [`prd.md`](prd.md).

What it deliberately does:

- keeps the **prospect's exact words** in their own field, separate from the caller's notes
  and from anything the AI wrote;
- never counts a **document request, callback or referral as a success**;
- treats **do not call** as a restriction on the prospect, set only by one explicit button;
- offers **one** optional AI feature ("Suggest what to say") that can never change saved data.

No transcript material is stored in this repository and none must be added.

## Architecture

```text
Browser
  |  HTTPS
  v
Frontend  (frontend/, Next.js + TypeScript + Tailwind, hosted on Vercel)
  |  HTTPS, JSON, optional x-access-code header     (only NEXT_PUBLIC_API_URL is public)
  v
Backend   (backend/, Node + Express + TypeScript, hosted on Render)
  |-- src/index.ts   HTTP routes, validation, transactions, CORS, access code
  |-- src/rules.ts   pure business rules (outcomes, do-not-call, status, revisions)
  |-- src/ai.ts      "Suggest what to say": prompt, Gemini call, limits, rate limit
  |
  |-- TLS (verified with the Supabase CA) --> Supabase PostgreSQL (database/schema.sql)
  |-- HTTPS (API key sent by the backend only) --> Gemini API
```

```text
frontend/    Next.js app (Vercel root directory)
backend/     Express API (Render root directory)
database/    schema.sql for Supabase PostgreSQL
docs/        architecture.md and TEST_PLAN.md
scripts/     verify-quotes.mjs (checks the examples against local transcripts)
```

More detail: [`docs/architecture.md`](docs/architecture.md).

## Local setup

Requirements: Node.js 20 or later, npm, a Supabase project (see
[Database setup](#database-setup)) and, for the AI feature, a Gemini API key.

Backend (first terminal):

```powershell
cd backend
npm install
Copy-Item .env.example .env
# Edit .env: set DATABASE_URL, FRONTEND_ORIGIN, GEMINI_API_KEY, GEMINI_MODEL
npm run dev
```

Frontend (second terminal):

```powershell
cd frontend
npm install
Copy-Item .env.example .env.local
# NEXT_PUBLIC_API_URL defaults to http://localhost:4000
npm run dev
```

Open <http://localhost:3000>. Check the API at <http://localhost:4000/health>: `200` with
`"db": "up"` means the database is reachable, `503` means it is not configured or not
reachable.

`.env` and `.env.local` are git-ignored. Never commit real values.

## Environment variables

Backend (set in `backend/.env` locally, in the Render environment in production):

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Supabase **pooler** connection string for the `callframe_api` role. Do not add `?sslmode=...` (see Database setup). Secret. |
| `DATABASE_SSL_CA_PATH` | optional | Path to the Supabase CA certificate, relative paths resolve from `backend/`. Default `certs/supabase-ca.crt`. **Currently read only by `scripts/test_db.js`; the API itself loads `backend/certs/supabase-ca.crt`** (see Known limitations). |
| `FRONTEND_ORIGIN` | yes | Exact browser origin allowed by CORS, for example `https://your-app.vercel.app` (no trailing slash). Comma-separate several. Default `http://localhost:3000`. |
| `GEMINI_API_KEY` | for AI | Gemini API key. Backend only. Secret. |
| `GEMINI_MODEL` | for AI | Gemini model id from Google AI Studio. **No default; it must be set.** Without it, or without the key, the AI button answers `503 AI_NOT_CONFIGURED` and the rest of the app works. |
| `APP_ACCESS_CODE` | optional | When set, every `/api` request must send it as the `x-access-code` header. Blank = open API. `/health` is always open. Secret. |
| `PORT` | optional | Port to listen on. Default `4000`. Render sets it for you. |
| `DATABASE_SSL` | local only | Set to `false` only for a local database without TLS. Leave unset everywhere else. |

Frontend (set in `frontend/.env.local` locally, in Vercel project settings in production):

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | yes | Base URL of the API, no trailing slash. Public, so never put a secret in it. Baked in at build time: change it, then redeploy. |

Secrets (`DATABASE_URL`, `GEMINI_API_KEY`, `APP_ACCESS_CODE`) exist only in backend
environment variables.

## Database setup

1. In Supabase, create a project.
2. Open [`database/schema.sql`](database/schema.sql). **Change the role password:**
   replace `CHANGE_ME_BEFORE_RUNNING` in the `create role` block with a long random
   password of your own. The script refuses to run while the placeholder is unchanged.
   Do not commit the edited file.
3. In **SQL Editor > New query**, paste the file and run it once. It creates the three
   tables, enables row level security, creates the `callframe_api` role and grants it only
   what the API needs (`stage_results` and `ai_suggestions` are insert-only; no deletes).
4. Build the **pooler** connection string for the new role. Copy the pooler host from your
   project's connection settings in the Supabase dashboard. The user name is
   `callframe_api.<project-ref>`, the password is the one from step 2:

   ```text
   postgresql://callframe_api.<project-ref>:<role-password>@<pooler-host>:6543/postgres
   ```

   Put it in `DATABASE_URL`. Do **not** add `?sslmode=...`: the `pg` driver lets a
   `sslmode` in the URL override the explicit CA setting, which `scripts/test_db.js`
   works around and `src/index.ts` does not.
5. Download the CA certificate from **Supabase Dashboard > Database > Settings > SSL**
   and save it as `backend/certs/supabase-ca.crt`.
   The repository already contains the public "Supabase Root 2021 CA" at that path; replace
   it only if your project needs a different one. TLS verification stays on; there is no
   option to turn it off.
6. Check the connection:

   ```powershell
   cd backend
   node scripts/test_db.js
   ```

   Expected: `SUCCESS: connected with verified TLS, SELECT 1 returned 1`.

## API endpoints

Base URL: `http://localhost:4000` locally. Errors always look like
`{ "error": { "code": "...", "message": "...", "details": [{ "field": "...", "message": "..." }] } }`.
When `APP_ACCESS_CODE` is set, every `/api` request needs an `x-access-code` header (in the
PowerShell examples below, add `"x-access-code" = "<code>"` to `$json`).

| Method and path | Purpose |
| --- | --- |
| `GET /health` | Database check. `200` ok, `503` degraded. Open (no access code). |
| `GET /api/calls?limit=50&offset=0` | Newest-first call list (limit 1 to 100) with `display_status` and `total`. |
| `POST /api/calls` | Start a call. `409 DNC_RESTRICTED` if the same name and company asked not to be called. |
| `GET /api/calls/:id` | One call with every stage revision, the latest revision per stage and the AI suggestions. |
| `PUT /api/calls/:id/stages/:stage` | Save a stage (1 to 8). Identical to the latest revision = no change; otherwise a new revision. `409 CALL_CLOSED` once closed. |
| `PATCH /api/calls/:id/progress` | Record the highest stage reached. |
| `POST /api/calls/:id/close` | Close with an outcome. Validates the next step. |
| `POST /api/calls/:id/assist` | "Suggest what to say" for one stage. |

Examples (PowerShell; use `curl.exe` if you prefer curl, because `curl` is an alias in
Windows PowerShell):

```powershell
$api = "http://localhost:4000"
$json = @{ "Content-Type" = "application/json" }

# Health
Invoke-RestMethod "$api/health"

# Start a call
$call = (Invoke-RestMethod -Method Post "$api/api/calls" -Headers $json `
  -Body (@{ prospect_name = "Test Person"; company = "Example Co"; prospect_role = "Owner" } | ConvertTo-Json)).call

# Save stage 5 (their need, in their words)
Invoke-RestMethod -Method Put "$api/api/calls/$($call.id)/stages/5" -Headers $json `
  -Body (@{ outcome_key = "named_goal"; prospect_words = "We want fewer manual reports."; notes = "" } | ConvertTo-Json)

# Close with a call agreed
Invoke-RestMethod -Method Post "$api/api/calls/$($call.id)/close" -Headers $json `
  -Body (@{ outcome = "next_step_set"; ended_stage = 7; next_step = @{ type = "call"; when = "Thursday 10:00" } } | ConvertTo-Json -Depth 4)

# Ask for a suggestion (needs GEMINI_API_KEY and GEMINI_MODEL on the backend)
Invoke-RestMethod -Method Post "$api/api/calls/$($call.id)/assist" -Headers $json -Body '{"stage":5}'
```

Close rules (`outcome`, plus `ended_stage` 1 to 8):

| `outcome` | Required `next_step` |
| --- | --- |
| `next_step_set` | `type` = `call` or `meeting`, and `when` |
| `document_requested` | `type` = `document`, and `channel` |
| `callback_requested` | `type` = `call`, and `when` |
| `referred` | `type` = `referral`, and `detail` |
| `declined`, `wrong_contact`, `no_contact` | none allowed |
| `do_not_call` | none allowed, and the latest Stage 6 revision must hold the `asked_not_to_call` button and the prospect's exact words |

`assist` answers `200 { suggestion }`, `200 { blocked: true }` for a do-not-call call, or an
error: `404`, `422 NOTHING_TO_ASSIST`, `429 RATE_LIMITED` or `AI_QUOTA`, `502 AI_CONFIG`,
`503 AI_NOT_CONFIGURED` or `AI_UNAVAILABLE`.

## Deployment

Deploy the backend first, because the frontend needs its URL.

### Render (backend)

1. New > Web Service, connect the repository.
2. Root directory: `backend`.
3. Build command: `npm install && npm run build`. Start command: `npm start`.
4. Health check path: `/health`.
5. Environment: `DATABASE_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, optionally
   `APP_ACCESS_CODE`, and `FRONTEND_ORIGIN` (set it after the Vercel deploy, see
   "Connect them"). Do not set `DATABASE_SSL`.
6. Make sure `backend/certs/supabase-ca.crt` is committed; the API reads it at start.

### Vercel (frontend)

1. Import the repository. Root directory: `frontend`. Framework preset: Next.js.
   Environment variable: `NEXT_PUBLIC_API_URL` = the Render URL (no trailing slash). Deploy.

### Connect them

1. In Render set `FRONTEND_ORIGIN` to the **exact** Vercel URL (scheme and host, no trailing
   slash, no path) and redeploy. Browser calls from any other origin are refused.
2. Warm the service up by opening `<render-url>/health` until it returns `200`, then run the
   checklist in [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md).

## URLs

| What | URL |
| --- | --- |
| Frontend (Vercel) | TODO: add the Vercel URL after deploying |
| Backend API (Render) | TODO: add the Render URL after deploying |
| Health check | TODO: `<Render URL>/health` |

## LLM

- **Provider:** Google Gemini, called only from the backend over HTTPS with plain `fetch`.
  The browser never sees the key.
- **Model:** read from `GEMINI_MODEL` and must be set. There is no built-in default; choose
  a currently available model in Google AI Studio.
- **Feature:** exactly one, the **Suggest what to say** button in the workspace. It returns
  one short line (at most 40 words) the caller could say next at the current stage.
- **Context sent:** read from the database, never from the request body: prospect name,
  company and role, the stage purpose, the button, prospect words and note at this stage,
  and the Stage 5 words when present.
- **Safeguards:**
  - the do-not-call block runs before any model work, so a blocked call never reaches
    Gemini. Any saved stage revision with the `asked_not_to_call` button, or a call already
    closed as do-not-call, blocks it;
  - captured text is wrapped as data and the prompt tells the model not to follow
    instructions inside it;
  - the only claim allowed about the caller's company is a fixed sentence in the prompt;
    no prices, results or statistics may be invented;
  - the 40-word limit is enforced on the server, not only requested;
  - 9-second timeout, and an in-memory limit of 10 requests per minute per client IP;
  - the suggestion is stored in its own table (`ai_suggestions`) and shown with a label.
    It is never written into the prospect's words or the caller's notes.
- **If it fails:** the button shows a short message and the call is unaffected. Saving
  stages, moving between stages and closing do not depend on AI. Codes: `AI_NOT_CONFIGURED`,
  `AI_QUOTA`, `AI_CONFIG`, `AI_UNAVAILABLE`, `RATE_LIMITED`.

## Design decisions

- **Append-only revisions.** Changing a stage never overwrites it: a changed save adds a
  new revision, and a repeated identical save adds nothing. The database role cannot update
  or delete `stage_results`. History detail shows the latest version and lists earlier ones.
- **Derived outcomes.** The status is derived on the server from the highest stage reached:
  `completed` only if stage 8 was reached, otherwise `ended_early`. Ending a call from an
  earlier stage keeps the highest stage reached. `abandoned` is a display state (an open
  call idle for more than two hours) and is never written. The workspace pre-selects a
  suggested final outcome from the buttons recorded; the caller can change it.
- **A document request is never a success.** Only an agreed call or meeting counts as
  success. Document requests, callbacks and referrals are "partial".
- **Do not call is a restriction, not a sales outcome.** The only trigger is the Stage 6
  button `asked_not_to_call`, and closing with it requires the prospect's exact words. An
  ordinary "no" or "not interested" is never upgraded to do-not-call. Once recorded, the
  prospect cannot be started again and AI is switched off for that call.
- **Prospect words stay separate.** Prospect words, caller notes and AI text live in
  different fields and tables, and are labelled differently on screen.

## Known limitations

- **No real authentication.** `APP_ACCESS_CODE` is one shared code, not user accounts. Anyone
  who has it sees every call, and the browser keeps it in `sessionStorage`.
- **Do-not-call is matched by name and company** (trimmed, case-insensitive). A spelling
  variant, a different company name or a different person is not matched.
- **Free-tier cold starts.** Render's free tier sleeps when idle, so the first request can
  take a while. The workspace shows a "warming up" message; warm the service up before a demo.
- **Gemini free-tier data terms.** Check Google's current terms for the Gemini API free
  tier before sending anything: content may be used to improve Google products. Do not type
  real personal data you are not allowed to share.
- **The AI rate limit is in memory.** It resets when the service restarts and is per instance.
- **CA path.** The API loads `backend/certs/supabase-ca.crt`; `DATABASE_SSL_CA_PATH` is
  honoured by `scripts/test_db.js` only.
- **No delete or edit of closed calls.** There is no delete endpoint, and a closed call is
  read-only.

## Testing

Backend unit tests (pure logic and Gemini handling with fakes; no database, no network, no
API key needed):

```powershell
cd backend
npm test
```

Frontend unit tests and checks:

```powershell
cd frontend
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Smoke test against a **running** API with a real database. It creates throw-away calls
named "Smoke Test ..." (there is no delete endpoint) and never calls Gemini:

```powershell
cd backend
$env:BASE_URL = "http://localhost:4000"      # or the Render URL
$env:ACCESS_CODE = "<code>"                  # only if APP_ACCESS_CODE is set on the API
node scripts/smoke.mjs
```

Quote check. It compares `frontend/src/data/examples.json` with your **local** copy of the
transcripts, which are not in this repository and must never be committed. Run from the
repository root:

```powershell
$env:TRANSCRIPTS_DIR = "C:\path\to\your\transcripts"
node scripts/verify-quotes.mjs
```

Exit code `0` = verified, `1` = a quote or logged outcome did not match, `2` = not run
(no folder given).

Manual end-to-end checklist: [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md). GitHub Actions
(`.github/workflows/ci.yml`) runs the backend tests and build, and the frontend lint,
type-check and build, on every push.

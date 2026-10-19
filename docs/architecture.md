# Architecture

```text
Browser
  -> Frontend: Next.js + TypeScript + Tailwind CSS   (frontend/, Vercel)
  -> Backend:  Express + TypeScript REST API          (backend/, Render)
       -> Supabase PostgreSQL                         (database/schema.sql)
       -> Gemini API                                  (backend only, one feature)
```

The frontend and backend are independent deployables. Database credentials, the Gemini API
key and the optional access code live only in backend environment variables. The browser
receives one public value, `NEXT_PUBLIC_API_URL`.

## Frontend (`frontend/`)

| Route | Purpose |
| --- | --- |
| `/` , `/features`, `/how-it-works`, `/help`, `/privacy`, `/terms` | Information pages |
| `/workspace` | Start a call, work through the eight stages, close the call |
| `/history` | List of calls with status, outcome and a do-not-call badge |
| `/history/[id]` | One call: result, stage-by-stage record, earlier versions, AI suggestions |

- `src/lib/api.ts` is the only code that talks to the API. A `401` opens the access-code
  dialog once; the code is kept in `sessionStorage` and sent as `x-access-code`.
- `src/lib/stages.ts` holds the stage guidance, button keys and final outcomes (data only).
- The workspace remembers the open call id in `localStorage` so a reload resumes the call.
  Saved stage results are loaded from the API; nothing else is trusted from the browser.

## Backend (`backend/src/`)

| File | Responsibility |
| --- | --- |
| `index.ts` | Routes, input validation, transactions, CORS, access code, error mapping |
| `rules.ts` | Pure rules: outcomes and their classes, next-step validation, do-not-call, status, revisions |
| `ai.ts` | "Suggest what to say": context, prompt, Gemini request, limits, rate limiter |

`rules.ts` and `ai.ts` import neither Express nor `pg`, so they are unit-tested with fakes
(`backend/test/rules.test.ts`, `backend/src/ai.test.ts`).

### Endpoints

| Method and path | Purpose |
| --- | --- |
| `GET /health` | Database check; open even when an access code is set |
| `GET /api/calls` | Paged call list (limit 1 to 100) with a derived `display_status` |
| `POST /api/calls` | Start a call; `409 DNC_RESTRICTED` for a do-not-call prospect |
| `GET /api/calls/:id` | Call, all stage revisions, latest revision per stage, AI suggestions |
| `PUT /api/calls/:id/stages/:stage` | Save a stage as a new revision (no-op if unchanged) |
| `PATCH /api/calls/:id/progress` | Record the highest stage reached |
| `POST /api/calls/:id/close` | Close with a validated outcome and next step |
| `POST /api/calls/:id/assist` | The one AI feature |

Everything under `/api` is guarded by `x-access-code` when `APP_ACCESS_CODE` is set
(constant-time comparison); when it is unset the API is open. Unknown routes return a JSON
`404`. Errors use one shape: `{ "error": { "code", "message", "details?" } }`.

### Data rules enforced in code and in the database

- **Revisions are append-only.** A save compares with the latest revision of that stage:
  identical = nothing written; different = revision + 1. Stage saves and close run in
  transactions with the call row locked (`FOR UPDATE`), so a closed call rejects further writes.
- **Status is derived.** On close the call keeps the highest stage reached
  (`GREATEST(last_stage, ended_stage)`); `completed` only if that is stage 8, otherwise
  `ended_early`. `abandoned` is computed for display (open and idle for more than two hours)
  and never stored.
- **Outcome classes.** Only `next_step_set` is a success. `document_requested`,
  `callback_requested` and `referred` are partial. `declined`, `wrong_contact` and
  `no_contact` are negative and may not carry a next step. `do_not_call` is a restriction.
- **Do not call.** The only trigger is the Stage 6 button `asked_not_to_call`. Closing with
  `do_not_call` requires that button and the prospect's words in the latest Stage 6
  revision; the server copies those words into `calls.dnc_words`. Starting a call for the
  same name and company (trimmed, case-insensitive) is refused with `409`. The assist
  endpoint is blocked for any call with that button in any saved revision, or already
  closed as do-not-call.

### AI feature

`POST /api/calls/:id/assist` with `{ "stage": 1..8 }`. In order: unknown call `404` ->
do-not-call block (`200 { blocked: true }`, Gemini never called) -> missing
`GEMINI_API_KEY` or `GEMINI_MODEL` `503` -> nothing captured at that stage `422` ->
Gemini request -> store in `ai_suggestions` -> `200 { suggestion }`.

- Context is loaded from the database, never taken from the request body.
- Model id comes from `GEMINI_MODEL`; there is no default.
- Output is capped at 40 words on the server, with a 9-second timeout and an in-memory
  limit of 10 requests per minute per client IP (the service trusts one proxy hop, as on Render).
- Gemini failures map by HTTP status to `AI_QUOTA`, `AI_CONFIG` or `AI_UNAVAILABLE`. They
  never affect saving or closing a call.
- The suggestion is written only to `ai_suggestions`; `stage_results` (prospect words and
  notes) is never touched.

## Database (`database/schema.sql`)

| Table | Content |
| --- | --- |
| `calls` | One row per call: prospect, status, highest stage, outcome, next step, do-not-call flag and words |
| `stage_results` | One row per stage revision: `(call_id, stage, revision)` unique, button key, prospect words, notes |
| `ai_suggestions` | Stored suggestions with stage and model, separate from stage results |

- Check constraints mirror the API rules (status consistency, outcome and next-step
  requirements, do-not-call needs words and no next step, 4,000-character limits).
- Row level security is enabled on all three tables; `anon` and `authenticated` have no
  grants. The `callframe_api` role gets `select, insert, update` on `calls` and
  `select, insert` on `stage_results` and `ai_suggestions`, so it cannot delete rows or
  rewrite a stage revision.
- The backend connects through the Supabase pooler as `callframe_api` over TLS, verified
  with the Supabase CA in `backend/certs/supabase-ca.crt`.

## Deployment

| Piece | Host | Settings |
| --- | --- | --- |
| Frontend | Vercel | Root `frontend`, `NEXT_PUBLIC_API_URL` = Render URL |
| Backend | Render | Root `backend`, build `npm install && npm run build`, start `npm start`, health check `/health`, `FRONTEND_ORIGIN` = exact Vercel URL |
| Database | Supabase | Run `database/schema.sql` once |

Step-by-step instructions and the environment variable table are in the root
[`README.md`](../README.md). The manual verification checklist is in
[`TEST_PLAN.md`](TEST_PLAN.md).

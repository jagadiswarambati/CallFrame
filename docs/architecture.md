# Callframe architecture

Callframe is a browser-based cold-call companion. It is not a dialer and does not place phone calls.

## Components

- `frontend/`: Next.js App Router, React and TypeScript UI. The UI calls the backend through `src/lib/api.ts`; the public `NEXT_PUBLIC_API_URL` contains only the backend URL.
- `backend/`: Express API, request validation, lifecycle rules, database transactions and the optional Gemini assist feature.
- `database/schema.sql`: PostgreSQL tables, least-privilege API role and row-level security setup.
- `prd.md`: product requirements and the authoritative eight-stage workflow.

## Call lifecycle

1. `POST /api/calls` creates a new `in_progress` call and returns its ID.
2. `PUT /api/calls/:id/stages/:stage` records the current stage as a revision and updates the highest stage reached.
3. `PATCH /api/calls/:id/progress` records progress when needed.
4. `POST /api/calls/:id/close` validates the selected final outcome, requires supporting next-step data where applicable, and marks the call `completed` or `ended_early` based on stage progress.
5. `GET /api/calls` and `GET /api/calls/:id` read persisted History and stage revisions.
6. `POST /api/calls/:id/assist` generates one optional suggestion. Its output is stored separately from prospect words and caller notes, and do-not-call evidence blocks AI use.

The frontend uses `localStorage` only as a best-effort active-call pointer/draft cache. PostgreSQL is authoritative for persisted calls. An active call may be resumed only by explicit History selection or restoring the currently active call on a normal workspace refresh; a `?new=1` route must show the new-call form instead of restoring a prior call.

## Local development

Follow the root `README.md` for environment setup. Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env.local`; never put credentials in the frontend environment file. Supabase TLS certificate verification must remain enabled.

# Callframe

Callframe is a focused workspace for guiding and recording calls. This
repository contains a separately deployable Next.js frontend, an Express API,
and a PostgreSQL schema for Supabase.

No transcript excerpts or transcript-derived examples are included. The PRD
records that the supplied transcript README says its contents are not to be
published; transcript material should not be added unless that restriction is
confirmed.

## Project structure

```text
frontend/       Next.js, TypeScript, Tailwind CSS application (Vercel root)
backend/        Express, TypeScript API (Render root)
database/       Supabase PostgreSQL schema
docs/           Architecture notes
```

## Requirements

- Node.js 20 or later and npm
- A Supabase PostgreSQL connection string for database-backed health checks

## Local setup

Install and start the frontend:

```powershell
cd frontend
npm install
Copy-Item .env.example .env.local
npm run dev
```

In a second terminal, install and start the API:

```powershell
cd backend
npm install
Copy-Item .env.example .env
npm run dev
```

Set `DATABASE_URL` in `backend/.env` to a Supabase pooler connection string
using a restricted API role. Apply [`database/schema.sql`](database/schema.sql)
to the Supabase project. If the tables already exist, rerun the script so the
stage-result `outcome_key` migration is applied. `GET
http://localhost:4000/health` checks database connectivity and returns `503`
while the database is unavailable or not configured.

The initial call API supports starting a call, loading it by id, saving stage
revisions, advancing progress, and closing with a validated outcome. The
frontend keeps the active call id in browser storage and restores saved stage
results from the API. A failed save keeps the current draft visible and blocks
navigation or closing until the save succeeds.

The frontend reads `NEXT_PUBLIC_API_URL` from `frontend/.env.local`. It is
public configuration and must not contain secrets. Backend credentials,
including `GEMINI_API_KEY` and `DATABASE_URL`, belong only in the backend
environment.

## Deployment

- Deploy `frontend/` as a Next.js application on Vercel and set
  `NEXT_PUBLIC_API_URL` to the deployed API origin.
- Deploy `backend/` as a Node.js web service on Render. Build with
  `npm install && npm run build`; start with `npm start`; set the health-check
  path to `/health`.
- Configure `FRONTEND_ORIGIN` on the backend to the exact frontend origin.
- Set `DATABASE_URL`, `GEMINI_API_KEY`, and `GEMINI_MODEL` only in the backend
  environment. Never commit `.env` files or real credentials.

## AI

The planned provider is Gemini. Its model is intentionally not hard-coded:
choose a currently available model in Google AI Studio and set `GEMINI_MODEL`
in the backend environment. The planned feature is an on-demand, stage-aware
spoken-line suggestion (at most 40 words); suggestions will be labelled and
will not be inserted into the prospect's words or the caller's notes. Gemini
integration is not implemented yet.

## Current status

The start screen, eight-stage workspace, stage-result revision saves, early
ending, callback/document/referral details, do-not-call validation, and saved
call summary are implemented. History browsing, Gemini assistance, access-code
handling, production role grants, and deployment verification remain
incomplete. Stage saving and closing use backend transactions; no database
connection or live Supabase save has been verified in this environment. The
frontend and backend have not been deployed; production URLs are not available.

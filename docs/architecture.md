# Architecture

```text
Browser
  -> Next.js + TypeScript + Tailwind CSS (frontend/, Vercel)
  -> Express + TypeScript REST API (backend/, Render)
       -> Supabase PostgreSQL (database/schema.sql)
       -> Gemini API (planned backend-only integration)
```

The frontend and backend are independent deployable applications. Database
credentials and the Gemini API key belong only in the backend environment.
The browser receives only the public API origin.

The frontend starts calls with `POST /api/calls`, reads a saved call through
`GET /api/calls/:id`, saves stage revisions through
`PUT /api/calls/:id/stages/:stage`, records forward progress through
`PATCH /api/calls/:id/progress`, and closes calls through
`POST /api/calls/:id/close`. The backend validates close-outcome requirements,
stores stage results transactionally, and derives do-not-call words from the
latest Stage 6 result. `GET /health` reports database availability. History
screens and Gemini assistance are not implemented.

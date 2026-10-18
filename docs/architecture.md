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
The browser receives only the public API origin. The initial API exposes
`GET /health`; application routes and Gemini assistance are not implemented
yet.

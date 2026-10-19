# Callframe

**A cold-call companion that helps a caller follow a structured conversation, capture what the prospect actually says, record a truthful outcome, and review past calls.**

> Built for the DeepThought CultureTech Forward Deployed Engineer selection task. This repository is intended to be public. Do not add the private task transcripts, real call recordings, credentials, or personal prospect data.

## Live links

Replace these placeholders after deployment. Do not submit the README with placeholder URLs.

| Resource | URL |
| --- | --- |
| Live application (Vercel) | **TODO: add Vercel URL** |
| Backend API (Render) | **TODO: add Render base URL** |
| Backend health check | **TODO: add `https://<render-service>/health`** |
| Public source repository | https://github.com/jagadiswarambati/CallFrame |
| Six-minute walkthrough video (Google Drive) | **TODO: add viewable Drive link** |

## What it does

Callframe is a browser-based companion for a caller speaking to a prospect on the phone. It does not dial or place phone calls. The caller moves through eight stages:

1. Opening
2. Purpose
3. Permission
4. Their business
5. Their need, in their words
6. Objection
7. Next step
8. Close

At each stage the caller records what happened, the prospect's exact words, and caller notes in separate fields. Calls are saved in the database, and History provides persisted call records, stage details, and revisions.

### Product rules

- Prospect words, caller notes, and AI-generated text are kept separate.
- A document request, callback, or referral is not counted as a successful outcome.
- **Do not call** is a restriction, not a generic refusal. It requires the explicit Stage 6 action and the prospect's exact words.
- The optional AI feature suggests one line the caller could say next. It does not edit saved call data and must be blocked when a do-not-call signal applies.
- Calls ended before reaching Stage 8 are recorded as `ended_early`; calls that reach Stage 8 can be `completed`.
- Earlier stage revisions are retained when changed.

## Technology

| Layer | Technology | Hosting target |
| --- | --- | --- |
| Frontend | Next.js App Router, React, TypeScript, Tailwind CSS | Vercel |
| Backend | Node.js, Express, TypeScript | Render |
| Database | Supabase PostgreSQL | Supabase |
| AI assistance | Google Gemini API, called only by the backend | Gemini API |
| Tests | Vitest / Testing Library for frontend; Node test runner through `tsx` for backend | GitHub Actions CI |

**LLM use:** Google Gemini is used only for the optional **Suggest what to say** feature. The backend reads the saved call and stage context, asks Gemini for a short suggested line (maximum 40 words), and stores the suggestion separately. Configure the model with `GEMINI_MODEL` in the backend environment. The model name must be a currently available model ID for the configured API key; verify the deployed value before the walkthrough.

## Repository layout

```text
.
├── .github/workflows/    # CI and repository maintenance workflows
├── backend/              # Express API, validation, rules, Gemini integration
│   ├── certs/            # Supabase TLS CA certificate
│   ├── scripts/          # Database test and API smoke test
│   └── src/
├── database/schema.sql   # PostgreSQL tables, role, grants and RLS policies
├── docs/
│   ├── architecture.md
│   └── TEST_PLAN.md
├── frontend/             # Next.js user interface
├── scripts/              # Local transcript-quote verification utility
└── prd.md                # Product requirements for the task
```

## Run locally

### Requirements

- Node.js 20 or later
- npm
- A Supabase project and PostgreSQL pooler connection
- A Gemini API key and a supported model ID for the optional AI feature

### 1. Configure the database

1. Create a Supabase project.
2. Open `database/schema.sql` and replace `CHANGE_ME_BEFORE_RUNNING` in the `callframe_api` role block with a long, unique password. **Do not commit the edited SQL or password.**
3. Run the SQL in **Supabase Dashboard → SQL Editor** on a fresh project. It creates the application tables, least-privilege API role, grants, and row-level security policies.
4. Obtain the PostgreSQL **pooler** connection details from Supabase. Use the `callframe_api.<project-ref>` role and port `6543`, following this shape:

   ```text
   postgresql://callframe_api.<project-ref>:<role-password>@<pooler-host>:6543/postgres
   ```

   URL-encode special characters in the password as required. Do not add an `sslmode` query parameter; the backend configures TLS with the certificate.
5. Ensure `backend/certs/supabase-ca.crt` contains the appropriate Supabase CA certificate. TLS verification must remain enabled.

If the role already exists, the SQL's `CREATE ROLE` block will not rotate its password. Manage an existing role's password deliberately in Supabase rather than assuming rerunning the script changes it.

### 2. Configure and start the backend

In PowerShell, from the repository root:

```powershell
cd backend
npm ci
Copy-Item .env.example .env
```

Edit `backend/.env` and set:

```dotenv
PORT=4000
FRONTEND_ORIGIN=http://localhost:3000
DATABASE_URL=postgresql://callframe_api.<project-ref>:<encoded-password>@<pooler-host>:6543/postgres
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=your-supported-gemini-model-id
```

Optional:

```dotenv
APP_ACCESS_CODE=your-long-random-demo-access-code
```

`APP_ACCESS_CODE` is a shared code, not user authentication. If enabled, supply it to authorized users so they can reach the app. Never expose `DATABASE_URL`, `GEMINI_API_KEY`, or `APP_ACCESS_CODE` in frontend variables or commit them to Git.

Test database connectivity, then run the backend:

```powershell
node scripts/test_db.js
npm run dev
```

The backend listens on port `4000` by default. Check `http://localhost:4000/health`; a healthy response should return HTTP `200` and indicate `db: "up"`.

### 3. Configure and start the frontend

Open a second PowerShell terminal at the repository root:

```powershell
cd frontend
npm ci
Copy-Item .env.example .env.local
```

Set this value in `frontend/.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Then run:

```powershell
npm run dev
```

Open <http://localhost:3000>. `NEXT_PUBLIC_API_URL` is public and is baked into the frontend at build time. Update it and redeploy if the backend URL changes. Never put a secret in a `NEXT_PUBLIC_*` variable.

## Deploy to the required free-tier stack

Deploy the backend first. The frontend requires the public Render URL at build time.

### 1. Supabase — database

- Create/configure the project and run `database/schema.sql` as described above.
- Use the least-privilege `callframe_api` database role, not the default administrative `postgres` user.
- Use the Supabase pooler connection string and verified TLS.
- Keep the database password out of source control and out of Vercel settings.

### 2. Render — backend API

1. In Render, create a **Web Service** and connect the public repository: `jagadiswarambati/CallFrame`.
2. Set **Root Directory** to `backend`.
3. Set **Build Command** to:

   ```bash
   npm ci --no-audit --no-fund && npm run build
   ```

4. Set **Start Command** to:

   ```bash
   npm start
   ```

5. Set **Health Check Path** to `/health`.
6. Add these environment variables in Render's service settings:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | Supabase pooler URL for `callframe_api` |
   | `GEMINI_API_KEY` | Gemini API key, only on Render |
   | `GEMINI_MODEL` | A verified, currently supported Gemini model ID |
   | `FRONTEND_ORIGIN` | Exact Vercel origin; set after deploying the frontend |
   | `APP_ACCESS_CODE` | Optional shared access code; if set, make it available to authorized reviewers |

   Render provides `PORT`. Do not set `DATABASE_SSL=false` in production. The service uses `backend/certs/supabase-ca.crt` for verified TLS.
7. Deploy and open `https://<your-render-service>.onrender.com/health`. Confirm HTTP `200` with the database up before proceeding.

### 3. Vercel — frontend

1. Import `jagadiswarambati/CallFrame` into Vercel.
2. Set **Root Directory** to `frontend` and use the Next.js framework preset.
3. Add the following environment variable to the appropriate deployment environment:

   ```text
   NEXT_PUBLIC_API_URL=https://<your-render-service>.onrender.com
   ```

   Do not include a trailing slash. Do not put the Gemini key, database URL, or access-code secret here.
4. Deploy and open the resulting Vercel URL.

### 4. Connect CORS and redeploy

After Vercel provides the final URL, set Render's `FRONTEND_ORIGIN` to that exact origin, including `https://` and without a trailing slash or path. Redeploy/restart the Render service after changing it. If you use separate production and preview origins, add only the exact origins you need, comma-separated.

### 5. Verify the live application

Use [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) as the end-to-end checklist. At minimum, confirm:

- [ ] Render `/health` returns HTTP `200` and the database reports up.
- [ ] The Vercel page loads without browser console, CORS, or API errors.
- [ ] Start a Call creates a new call and opens Stage 1.
- [ ] Stage data saves and is retained when navigating between stages.
- [ ] End Call persists the outcome and navigates to History only after success.
- [ ] The call remains in History after refresh, and explicit resume opens the selected in-progress call.
- [ ] Do-not-call rules block prohibited calls and AI assistance.
- [ ] **Suggest what to say** returns an actual Gemini-generated suggestion with the AI label, separate from prospect words and caller notes.
- [ ] Timeouts and failed requests show a recoverable error rather than a false success.

Render free-tier services may sleep while idle; the first request can take longer while the backend starts. Wait for `/health` to return healthy before the demo.

## API overview

All API paths below are relative to the backend base URL.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Health and database status; no access code required |
| `GET` | `/api/calls?limit=50&offset=0` | List persisted calls, newest first |
| `POST` | `/api/calls` | Create a new call |
| `GET` | `/api/calls/:id` | Fetch a call and its stage revisions/AI suggestions |
| `PUT` | `/api/calls/:id/stages/:stage` | Save a stage revision (stages 1–8) |
| `PATCH` | `/api/calls/:id/progress` | Record highest stage reached |
| `POST` | `/api/calls/:id/close` | Close a call with validated final outcome/next step |
| `POST` | `/api/calls/:id/assist` | Generate one optional AI suggestion for a stage |

When `APP_ACCESS_CODE` is configured, every `/api` request must include the `x-access-code` header. `/health` remains open for the hosting platform's health check.

## Tests and quality checks

Run these before pushing changes or deploying.

Backend:

```powershell
cd backend
npm ci
npm test
npm run build
```

Frontend:

```powershell
cd frontend
npm ci
npm test
npm run lint
npx tsc --noEmit
npm run build
```

GitHub Actions runs frontend tests, lint, TypeScript checking and production build, plus backend tests and build, on pushes and pull requests. A green unit-test step does not replace the production build and live browser test. Resolve all failed required checks before considering the deployment ready.

For a smoke test against an already-running API and test database, run from `backend/`:

```powershell
$env:BASE_URL = "https://<your-render-service>.onrender.com"
# Only if APP_ACCESS_CODE is enabled:
$env:ACCESS_CODE = "<your-access-code>"
node scripts/smoke.mjs
```

The smoke script creates throwaway test calls. The API has no delete endpoint, so avoid repeated runs against production data; prefer a staging/test database.

## DeepThought submission checklist

- [ ] Public GitHub repository containing the frontend, backend, SQL schema, and this README.
- [ ] README updated with the real Vercel URL, Render URL, Render health URL, and the Gemini model actually configured for the demo.
- [ ] Live Vercel application tested end to end.
- [ ] Render health endpoint opens and returns a healthy result.
- [ ] Six-minute-or-longer video recorded with you visible on camera, walking through the product using a fictional call scenario and explaining one product/design decision.
- [ ] Video uploaded to Google Drive with **Anyone with the link can view** permission.
- [ ] Submit the GitHub repository link and Google Drive video link using the DeepThought task page.

The transcripts supplied with the task are for the task only. Do not include them, quote them in this public repository, or publish transcript-derived private material.

## Known limitations

- The optional access code is a shared code, not individual authentication. Anyone authorized with the code can access all stored calls.
- Do-not-call matching uses normalized prospect name and company; name/company variants can evade matching.
- The AI rate limit is in memory and resets when the backend restarts.
- Do not enter real personal or confidential call data in a public demo. Review Google's current Gemini API data terms for your API tier before sending data.
- The model's current availability and latency depend on the configured provider/model; AI assistance may be unavailable if Gemini times out or returns an upstream error. Core call recording should remain usable independently of AI.

## Further documentation

- Product requirements: [`prd.md`](prd.md)
- Architecture: [`docs/architecture.md`](docs/architecture.md)
- End-to-end test plan: [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md)

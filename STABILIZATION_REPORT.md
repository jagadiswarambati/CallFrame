# Callframe stabilization report

## Implemented in this source snapshot

- Aligned the frontend adapter with the backend API contract for creating calls, fetching call details/history, saving stage revisions, closing calls and requesting AI suggestions.
- Updated workspace behavior so `?new=1` shows a clean new-call form rather than silently restoring a previous active call; explicit History resume uses `?resume=<id>`.
- Reworked the workspace around the product's eight stages, separate prospect-words and caller-notes fields, server-backed stage saves, inline close panel, actual final-outcome choices, next-step validation, do-not-call evidence, and AI suggestions kept separate from recorded words/notes.
- Reworked History and call details to read persisted call records and show stage revisions; explicit Resume is available only for `in_progress` calls.
- Changed API requests to use a finite timeout, including GET requests, so loading states do not wait indefinitely on an unresponsive API.
- Corrected the Next.js local rewrite target to backend port `4000`; updated Start a Call links to use `?new=1`.
- Added `.env.example` files, architecture documentation and a manual end-to-end test plan; updated the README's frontend test commands.

## Checks completed in this environment

- TypeScript/TSX parser check: 30 files parsed, zero syntax errors.
- Static route-contract checks passed for create, stage save and close routes, fresh-call query behavior, close panel and DNC evidence guard.
- Backend pure-rule smoke assertions: 8/8 passed, including early ending, Stage 8 completion, abandoned display state, callback validation and DNC evidence.

## Not verified here

The npm registry was not reachable from this environment (`registry.npmjs.org` DNS failure), and the available `frontend/node_modules` directory was incomplete. Therefore the full frontend lint, semantic TypeScript check, Vitest suite, production build, browser interaction and live Supabase persistence were **not run successfully here**. These checks are required before deployment; use `docs/TEST_PLAN.md` and the commands in `README.md`.

No production deployment was performed. No live database was changed. The report does not claim that live browser or database behavior has been verified.

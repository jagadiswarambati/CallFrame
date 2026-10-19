# Callframe manual end-to-end test plan

Run these checks against a local or staging instance connected to a test database. Do not run destructive or repeated smoke tests against production data.

## Setup checks

- [ ] `GET /health` reports database status accurately.
- [ ] Wrong `APP_ACCESS_CODE` is rejected; the access-code prompt permits a valid code when configured.
- [ ] Browser API requests go to the intended backend URL; no CORS, TLS or console errors appear.

## Start and stage workflow

- [ ] Start a Call validates required prospect name and company.
- [ ] Successful creation returns a new call ID, begins at Stage 1, and starts a new timer.
- [ ] Starting another call does not silently reopen a prior call or copy its notes/outcomes.
- [ ] Each stage's outcome, exact prospect words and caller notes save against the same call ID.
- [ ] Save/Continue advances only after server confirmation; failed saves leave the user on that stage with an error.
- [ ] Previous-stage navigation restores values and does not reset the timer.
- [ ] Revising stage data creates a new revision; earlier revisions remain visible in call details.

## Close and do-not-call

- [ ] End Call opens the inline close panel from every stage without forcing Stage 8.
- [ ] `next_step_set` requires a call/meeting type and time.
- [ ] `document_requested` requires type `document` and a delivery channel.
- [ ] `callback_requested` requires type `call` and a time.
- [ ] `referred` requires type `referral` and referral details.
- [ ] `declined`, `wrong_contact`, and `no_contact` accept no next-step fields.
- [ ] `do_not_call` cannot close until Stage 6 contains `asked_not_to_call` and the prospect's exact words.
- [ ] AI assistance is blocked after a saved do-not-call signal.
- [ ] Successful closure records the outcome/end time and navigates to History only after the API confirms it.
- [ ] Network failure/timeout never displays false success or clears the active call/draft; retry resolves an ambiguous close by re-reading server state.
- [ ] Closing before Stage 8 records `ended_early`; reaching Stage 8 records `completed`.

## History, resume and details

- [ ] Refreshing History retains persisted records.
- [ ] An in-progress call can be explicitly resumed by its ID with latest stage data restored.
- [ ] Completed/ended-early calls are read-only and cannot be resumed as active calls.
- [ ] Call detail includes latest saved stage data, exact words, notes, prior revisions and separate AI suggestions.
- [ ] The elapsed duration remains consistent across refresh/resume and stops after closure.

## Release checks

- [ ] Frontend: `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`.
- [ ] Backend: `npm test`, `npm run build`.
- [ ] Test the actual browser workflows above; passing unit tests alone is not sufficient.

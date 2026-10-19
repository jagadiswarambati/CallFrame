# Manual test plan

End-to-end checklist to run by hand against the **deployed** app (and, where noted,
locally). It covers what the automated tests cannot: the real database, the real Gemini
call, the browser and a phone-width screen. Tick a box only after you saw the result.

## 0. Before you start

- [ ] Open `<Render URL>/health` until it returns `200` with `"db": "up"` (the free tier
      sleeps; the first request can be slow).
- [ ] Open the Vercel URL. If `APP_ACCESS_CODE` is set on Render, the workspace asks for the
      access code the first time; enter it once.
- [ ] Use made-up people and companies only. There is no delete endpoint, so every test call
      stays in history. Give each test a unique name, for example `Test A 1019`.
- [ ] Optional automatic check first: `node scripts/smoke.mjs` from `backend/`
      (see the README, Testing). It does not replace this list.

## 1. Full call, stages 1 to 8

1. [ ] `/workspace`: enter a prospect name, company and optional role, then **Start call**.
2. [ ] At each stage tap one button and type a short line in the prospect-words field.
       At Stage 5 type an obvious sentence and keep your own interpretation in the notes field.
3. [ ] Use **Next: ...** to go forward. The status line reads "Saved" after each stage.
4. [ ] At Stage 8 tap **Review and finish**. Choose **Call or meeting agreed**, set Type = Call
       and a time, then **Save and end call**.
5. [ ] "Call saved successfully." appears.
6. [ ] `/history`: the call is listed as **Completed**, last stage 8, outcome "Call or
       meeting agreed", no do-not-call badge.
7. [ ] `/history/<id>`: every stage shows its button and words; the Stage 5 words are shown
       as the prospect's words, and your notes are shown separately.

## 2. Calls ended early at stages 1, 3 and 6

Run each as a new call. Use **End call**, then choose the outcome.

| Ended at | Do this | Outcome to choose | Expected in history |
| --- | --- | --- | --- |
| Stage 1 | Tap "Wrong number or left the company" and end the call | Wrong contact or person left (no next step) | **Ended early**, last stage 1, no next step |
| Stage 3 | Tap "Asked for a callback" and end the call | Callback requested, with a callback time | **Ended early**, last stage 3, partial outcome, next step shows the callback time |
| Stage 6 | Tap "Said no" and end the call | Declined (no next step) | **Ended early**, last stage 6, negative outcome |

- [ ] Each row behaves as written.
- [ ] A **document request is not a success**: end a call with **Document requested**
      (Type document, a channel such as "email"). It is shown as a partial outcome, never as
      the success style.
- [ ] The next-step fields appear only for the four outcomes that need one (call or
      meeting agreed, document requested, callback requested, referred). Choosing Declined,
      Wrong contact, No proper contact or Do not call again offers none.
- [ ] **Highest stage kept:** start a call, go to Stage 4, press **Back** to Stage 3, then
      **End call** and choose Declined. History shows last stage **4**, not 3.

## 3. Go back from 6 to 3 and change a button

1. [ ] Start a call and move forward to Stage 6, saving something at Stage 3 on the way
       (for example "Agreed to talk now" with the words "Yes, go ahead").
2. [ ] Press **Back** until Stage 3. Change the button (for example "Asked for a callback")
       and edit the words. Wait for "Saved".
3. [ ] Go forward again; Stage 4 to 6 keep what you recorded.
4. [ ] Close the call (any valid outcome).
5. [ ] `/history/<id>`, Stage 3: the new button and words are shown as current, and
       **Earlier versions (1)** opens to show **Version 1** with the old button and words.
6. [ ] Save Stage 3 again without changing anything: no new version appears (reload the
       detail page to confirm the count is unchanged).

## 4. Reload mid-call and resume

1. [ ] Start a call, record something at Stages 1 and 2, move to Stage 3, then reload the page
       (F5).
2. [ ] The workspace reopens the same call at the highest stage you had reached (Stage 3
       here); the Stage 1 and 2 entries are still there.
3. [ ] Close the tab, open `/history`, open the call and press **Resume this call**
       (shown only while the call is in progress). It reopens in the workspace at the
       highest stage reached.
4. [ ] Finish the call normally.
5. [ ] An open call you leave alone for more than two hours is shown as **Abandoned**
       (display only). Not practical to wait for, so tick "not tested" if you skip it.

## 5. Do not call

Use one prospect name and company for this whole section.

1. [ ] Start the call. At Stage 6 tap **Asked not to be called again** but leave the words
       empty. The close panel opens by itself with **Do not call again** selected. Press
       **Save and end call**: it is refused with a message that the exact words are required,
       and **Go to Stage 6** is offered.
2. [ ] At Stage 6 type the prospect's exact words, wait for "Saved", then end the call with
       **Do not call again** (no next-step fields are offered). The saved-call summary shows
       a **Restricted** badge.
3. [ ] **AI blocked:** on a separate call, tap only the Stage 6 button (close the panel
       without saving the call). On any stage the **Suggest what to say** button is disabled
       with the note "They asked not to be called. End the call politely. AI suggestions are
       switched off for this call." The server enforces this too: `smoke.mjs` checks that the
       API answers `blocked: true`, and Gemini is never called.
4. [ ] **Restart blocked:** start a new call with the same name and company (also try
       different capitalisation and spaces at the start or end). It is refused with "This prospect has
       requested no further calls." and a **View the earlier call** link.
5. [ ] **Badge in history:** `/history` and the call's detail page show **Do not call**,
       and the detail page shows "Do-not-call request, in their words" with the exact words.
6. [ ] **Ordinary refusal is not do-not-call:** on a fresh prospect tap **Said no** at
       Stage 6 and close as Declined. No Restricted or Do not call badge appears, and the
       same prospect can be started again.

## 6. AI suggestion and AI failures

With a valid `GEMINI_API_KEY` and `GEMINI_MODEL` on the backend:

1. [ ] At a stage where you tapped a button, **Suggest what to say** returns one short line
       (no more than 40 words) in a box labelled "AI suggestion, not the prospect's words".
2. [ ] The prospect-words and notes fields are unchanged. After closing the call the
       suggestion appears only under **AI suggestions** in history.
3. [ ] On a stage with nothing recorded the button is disabled.

Failure handling. Change one thing at a time in the Render environment, redeploy or
restart, test, then restore it:

| Break this | Press the button | Expected |
| --- | --- | --- |
| Remove `GEMINI_MODEL` | Suggest what to say | Short "not available" message; no crash |
| Set `GEMINI_API_KEY` to a wrong value | Suggest what to say | Short "not available" message |
| Press the button more than 10 times in a minute | Suggest what to say | "Too many AI requests..." message |

- [ ] After each failure, saving a stage, **Next**, **Back**, **End call** and closing all
      still work, and the text you typed is intact.
- [ ] Nothing about the key or model appears in the page, the network responses or the
      browser console.

## 7. Phone width and keyboard only

Phone width: use the browser's device toolbar at about 375 px wide (and, if you can, a real
phone).

- [ ] Home, Features, How it works, Help, Workspace, History and a history detail page have
      no sideways scrolling and no cut-off text.
- [ ] The workspace buttons (**Back**, **End call**, **Next: ...**) are full width and easy
      to tap; the stage buttons wrap.
- [ ] The close panel and the access-code dialog fit on screen with the keyboard open.

Keyboard only (no mouse):

- [ ] Tab reaches the navigation, every stage button, both text fields, **Suggest what to
      say**, **Back**, **End call** and **Next**, in a sensible order, with a visible focus
      outline.
- [ ] Space or Enter activates buttons; stage buttons show which one is selected.
- [ ] The final-outcome choices and the close form can be completed and submitted from the
      keyboard.
- [ ] In the access-code dialog, focus starts in the field and Escape closes it.
- [ ] Error messages (for example the do-not-call message) are announced or are at least
      next to the control that caused them.

## 8. Security spot checks

- [ ] Browser developer tools > Network: no request carries `GEMINI_API_KEY` or a database
      string; the only API address is `NEXT_PUBLIC_API_URL`.
- [ ] Opening an API URL such as `<Render URL>/api/calls` in a browser with
      `APP_ACCESS_CODE` set returns `401`, while `/health` returns `200`.
- [ ] Calling the API from a different origin (not `FRONTEND_ORIGIN`) is refused.

## Result

Fill in after a run:

- Date and tester:
- Frontend URL and backend URL tested:
- Sections passed (0 to 8):
- Failures and notes:

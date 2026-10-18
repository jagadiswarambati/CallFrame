# Callframe — Product Requirements Document

**Project:** DeepThought CultureTech Forward Deployed Engineer (Hyderabad) selection task
**Working name:** Callframe (temporary)
**Status:** Draft for approval. No application code is to be written until this PRD is approved.
**Deadline:** Tuesday 20 October 2026, 11:34 AM (taken from the candidate's registered page; assumed IST; fixed).

### How to read this document

Every factual claim about the task or the transcripts carries a tag:

| Tag | Meaning |
|---|---|
| **[V]** | Verified directly from the source text or the index file (exact). |
| **[R]** | My reading of the transcripts (I read the opening and ending of every call, plus full text of several). Reliable in direction, not exact counts. |
| **[K]** | Keyword scan over all 100 files. Counts are approximate lower bounds; patterns can miss phrasings, especially in Hindi, Marathi and Kannada. |
| **[A]** | Assumption or recommendation. Needs confirmation or is my design decision. |

Where this document and the official task disagree, the official task wins.

---

## 1. Product overview

### 1.1 Problem

A caller at a Hyderabad growth-analysis firm phones owners and senior managers they have never spoken to. Most calls are short: the median call in the dataset is 93.5 seconds, and 68 of 100 are under two minutes **[V]**. Inside that time the caller must find the right person, explain the purpose, get permission, listen, handle a refusal, and agree one concrete next step. Afterwards they log an outcome in a system.

The transcripts show what goes wrong:

- The outcome logged afterwards often does not match what was said (section 2.5).
- The prospect's own words are not preserved anywhere. The outcome vocabulary is a single word per call **[V: README, index.csv]**.
- Callers do not seem to know what is about to happen at each stage: the same four or five prospect reactions recur (section 2.3) and are handled inconsistently **[R]**.

### 1.2 Product

Callframe is a screen the caller keeps open during a cold call. It:

1. Shows the current stage of eight, what that stage is for, and three things prospects actually said at that stage in the supplied calls.
2. Lets the caller record what happened with one tap, using buttons specific to that stage.
3. Captures the prospect's exact words in a dedicated box, kept visibly separate from the caller's notes and from AI text.
4. Lets the caller move forward, step back to review, or end the call from any stage.
5. Saves every call, including calls that end early, and shows them in a history screen with the stage reached and the outcome.

It is not a CRM, a chatbot, or a dashboard **[V: task brief]**.

### 1.3 Target users

| User | Need | Priority |
|---|---|---|
| **Caller** (e.g. the callers in the dataset) | Stay oriented while someone is talking. Minimum reading, minimum typing. | Primary |
| **Reviewer / manager** | See where calls end, what was agreed, and whether the logged outcome is honest. | Secondary |
| **Hiring panel** (DeepThought) | Judge reasoning, evidence use, working deployment and the candidate's explanation. | Evaluation audience for this task |

### 1.4 Objectives

1. A caller can run a full call from the screen with no free-text typing except the prospect's words.
2. Every call is saved with the correct last stage and a true outcome, including early endings.
3. A document request or a polite goodbye is never recorded as a success.
4. An explicit request not to be called is treated as a restriction, not an ordinary objection.
5. All screen content (stage guidance, example responses, buttons) is traceable to the transcripts.
6. The system is deployed on the required services and demonstrable in the required video.

### 1.5 Value proposition

"See what is about to happen at this stage, tap what happened, write down what they actually said, and leave with a record you can trust."

### 1.6 Success criteria

Product success (measurable in the demo):

- A complete call from start to saved record in under two minutes of interaction time on a supplied transcript.
- A call ended at stage 1, 3 and 6 each appears correctly in history with the right last stage.
- Going back to stage 3 from stage 6 and changing a button keeps the earlier record (revision history) **[A]**.
- The AI suggestion is clearly labelled, never edits the prospect's words, and is blocked after a do-not-call request.

Submission success: section 11.

---

## 2. Transcript analysis

### 2.1 Dataset **[V]**

Source: `cold-call-transcripts-100.zip` (103 files: 100 transcripts, `index.csv`, `index.json`, `README.md`). All calls are from callers at a fictional "Meridian Growth Partners" (Hyderabad), selling growth analysis and growth work to Indian businesses. Names, numbers and companies are fictional and rewritten from real calls.

Header fields per call: duration, logged outcome, prospect role, company kind, company, caller. Speaker labels are `CALLER`, `PROSPECT`, and (rarely) `RECEPTION`.

README instructions that constrain the product:

- The `outcome` field is the caller's word and "does not always match what you read in the call".
- Speaker labels were sometimes swapped in the original transcription; most were corrected, some may remain.
- Lines that break off mid-sentence are real breaks in the call (line dropped or interruption).
- "Nothing in them is to be published."

### 2.2 Call shape **[V]**

**Logged outcomes (100 calls):** not_interested 14, agreed_to_receive_report 14, follow_up 14, not_logged 13, next_step_agreed 11, do_not_call 10, wrong_person 8, interested 7, moved_company 5, call_again 4.

**Duration:** minimum 30 s, maximum 687 s, median 93.5 s. 25 calls are under 60 s; 68 under 120 s; 78 under 180 s; 20 run 240 s or longer.

**Median duration by logged outcome:** call_again 45 s, wrong_person 57.5 s, moved_company 71 s, do_not_call 76.5 s, not_logged 90 s, not_interested 91 s, next_step_agreed 113 s, follow_up 121 s, interested 145 s, agreed_to_receive_report 158 s.

**Company kinds:** India arm of a multinational 30 (plus 1 "India office of a multinational"), mid-size private company 22, mid-size private manufacturer 20, listed Indian company 10, startup 8, large private company 4, not known 2, public sector utility 1, small private company 1 (plus 1 "since acquired").

**Switchboard:** five calls pass through `RECEPTION` (T027, T044, T055, T059, T062).

**Languages (README):** mostly English; several switch to Hindi or Hinglish; two are partly Marathi; one is Hindi in Devanagari; one prospect asks for Kannada. Implication: free-text fields must accept any script.

**Contact quality:** nine index rows describe a prospect who is not the person listed or whose role differs from the list (T004, T015, T022, T028, T031, T066, T068, T087, T099).

### 2.3 Where calls end, and what prospects say

**Where calls end [R, approximate].** There are no stage labels in the data. From the opening and ending of each call:

| Where the call effectively ended | Approx. share | Examples |
|---|---|---|
| Opening: wrong number, person has left, line or language failed | about a dozen | T015, T022, T028, T031, T032, T034, T038, T039, T040, T045, T066, T070, T016 |
| Permission: a callback or "later" before the real conversation | about ten | T002, T005, T027, T033, T069, T089 |
| Objection: a refusal, "not the right person", "we already have..." | about a quarter | T003, T007, T009, T012, T017, T020, T021, T024, T029, T043, T044, T071, T076, T097 |
| Next step shaped: a document, channel or time was agreed | about half | T001, T008, T026, T060, T083, T085, T086, T095, T096 |

I did not find more than a handful of calls in which the caller asks about the prospect's business (stage 4) as a distinct step before the pitch **[R, weak: my keyword for it is unreliable]**. **To verify in Phase 0:** manually read ten to fifteen calls of 150 s or more to confirm whether stage 4 is reached.

**What prospects say (counts are approximate numbers of calls containing the pattern [K]):**

| Stage | Pattern | Approx. calls | Examples |
|---|---|---|---|
| 2 Purpose | "Who is this / calling from where?" | 36 | T002, T010, T014, T016 |
| 2 Purpose | "What is this regarding / what do you do?" | 30 | T007, T009, T010, T012 |
| 2 Purpose | "Where did you get my number?" | at least 4 | T063, T081, T084, T087 |
| 2 Purpose | "Meridian?" (name not recognised) | about 7 | T021, T030, T042, T049 |
| 2 Purpose | Explicit "is this a sales call?" | none found by keyword | not verified |
| 3 Permission | Call me later / after a time | about 11 | T001, T002, T005, T014 |
| 3 Permission | Busy, in a meeting, driving, travelling | about 7 | T026, T033, T036, T069 |
| 3 Permission | Send it on WhatsApp or email first | 36 (broad pattern; includes post-pitch requests) | T006, T019, T023 |
| 3 Permission | Bad line or language problem | about 10 | T006, T016, T031, T032 |
| 6 Objection | Not the right person, referral, person has left | about 25 | T003, T004, T013, T014, T024 |
| 6 Objection | We already have a team, process or consultant | about 16 | T009, T021, T043, T058, T071 |
| 6 Objection | Not interested / no need | about 11 | T002, T009, T012 |
| 6 Objection | Send details or a sample in writing | about 20 | T019, T023, T036, T064, T078, T090 |
| 6 Objection | Cost or "what will I do with this?" | about 13 | T047, T053 |

Referrals sometimes come without a usable contact: the prospect declines to share a number in T029, T041, T070 and T075 **[R]**.

**Purpose statements vary between callers [R].** The same caller organisation describes itself as helping "fast growing companies... with the operational problems that come up during growth" (T003), making "a research series" about mid-size companies (T020), or preparing "a short growth report" (T009). One prospect asks "What is the objective?" and the caller answers that it is "to connect with different companies and build a relationship" (T048). Another says "I have no idea what this is" (T095). Evidence for a single, repeatable purpose line at stage 2.

### 2.4 Stage 5: the prospect's words

The data has no caller notes, only a logged outcome, so **I cannot measure how well callers captured exact words [V: no such field exists]**. What can be observed:

- Callers typically ask a scripted growth question ("Are you looking to expand your business as of now?", T009, T016, T021). Roughly 23 calls contain such a question **[K]**.
- Clear need statements appear mainly in the longest calls. 44 calls contain at least one prospect turn of 30 or more words, but many are explanations or objections, not needs **[K]**.
- Observed shapes of a stage-5 answer: a goal or concern (T093: "Nowadays my customers are more and more into sustainability."); "everything is fine" (T009); turning the question around (T084: "How are you going to help me grow my business?").
- The outcome vocabulary has no place for these words **[V]**. This is the strongest argument for a dedicated verbatim box.

### 2.5 Logged outcomes that do not match the conversation

All findings below come from reading the ending (and for T084 the full call).

| Logged | Call | What the call shows |
|---|---|---|
| do_not_call | all 10 (T003, T013, T015, T020, T021, T024, T041, T049, T075, T084) | **No prospect says anything like "do not call me" [K, plus ending reads].** They are wrong-person, not-interested, can't-share-a-number or similar. README defines the label as "asked not to be called, **or the caller judged it so**". |
| do_not_call | T084 | The prospect agrees to a WhatsApp report and a call "next Thursday" ("Done."). The logged outcome is the opposite of the call. |
| not_logged | 12 of 13 | The call contains a callback time, a send-it request or a referral: T002, T005, T019, T023, T036, T042, T046, T050, T052, T056, T082, T094. Only T045 (company acquired) has nothing to log. |
| interested | T033, T035, T047, T078, T080, T090 | Mostly "send it", a callback, or consent to prepare a report. T033: a new joiner in a meeting asks to call back. T078: the prospect asks the caller to send a portfolio (roles reversed). |
| not_interested | T088 | Ends with "Sure, sure, sure. Yeah, sure." to receiving the deck. |
| not_interested | T066 | Wrong company and wrong person (the prospect is a chartered accountant). |
| agreed_to_receive_report | T010 | Ends with the prospect reading out a colleague's number (a referral). |
| agreed_to_receive_report | T100 | Report plus a phone call "next Monday": a next step. |
| follow_up | T048 | Prospect objects ("market leader") and says "Hold on one second". Nothing agreed. |
| follow_up | T098 | Prospect says it is "not a good" time because of re-orgs: a soft no. |

Swapped speaker labels: I found essentially none (one doubtful line in T072). I did not audit every line **[R]**.

### 2.6 Insights that drive the product

| # | Insight | Source | Product consequence |
|---|---|---|---|
| I1 | Most calls are short and end early. | 2.2, 2.3 | Early termination is first-class: End call at every stage, saved with true last stage. |
| I2 | Logged outcomes often misdescribe the call. | 2.5 | Outcome is derived from recorded stage data, requires supporting details, and is shown with a suggestion the caller confirms. |
| I3 | `do_not_call` was used for ordinary refusals; real DNC wording is absent. | 2.5 | Separate stage-6 "Asked not to be called again" button, with the prospect's words required. Ordinary no is never promoted to DNC. |
| I4 | Documents and WhatsApp requests dominate "success". | 2.3, 2.5 | `document_requested` is a distinct, non-success outcome and needs a channel. |
| I5 | Callers and prospects trip over "who are you / what is this". | 2.3 | Stage 2 shows the likely questions and a single purpose line. |
| I6 | Callbacks and "send first" are frequent at stage 3. | 2.3 | Stage 3 separates agreed, callback, send-first, unclear and declined. |
| I7 | Contact data is unreliable (wrong person, left company). | 2.2, 2.3 | Stage 1 buttons for wrong number and left company; outcome `wrong_contact`. |
| I8 | Referrals occur, sometimes without a number. | 2.3 | Stage 7 "referred" with a detail field. Recorded even if no number is given. |
| I9 | Multiple languages. | 2.2 | Free-text fields accept any script; no English-only assumptions. |
| I10 | Prospect words are not stored anywhere. | 2.4 | Dedicated verbatim box at every stage; stage 5 words shown again at close. |

---

## 3. Functional requirements

IDs are used by the test plan and acceptance criteria.

### 3.1 Start a call (FR-START)

- **FR-START-1** Fields: prospect name (required), company (required), role (optional). No other fields **[A]**.
- **FR-START-2** Starting a call creates a record immediately (status `in_progress`, stage 1).
- **FR-START-3** If a closed call exists with `do_not_call = true` for the same name and company (case-insensitive, trimmed), starting is refused with a clear message and a link to that call (section 3.7).
- **FR-START-4** A call timer shows elapsed time from the server `started_at`.
- **FR-START-5** If the server is not ready (cold start), the screen says so, keeps the form filled, and enables Start when the server answers.

### 3.2 Active-call workspace (FR-CALL)

Each stage view shows, in this order of visual priority:

1. Prospect name, company, timer (compact).
2. Current stage number, title and one sentence of purpose.
3. "They may say": three transcript-based examples with call ID and speaker.
4. Outcome buttons specific to the stage (3.4).
5. "Their words" box (verbatim), then a smaller "Your note" field.
6. Actions: Back, Next (named, e.g. "Next: Permission"), End call.
7. AI assistance control (section 6), visually subordinate.

Rules:

- **FR-CALL-1** All eight stages exist, in order: Opening, Purpose, Permission, Their business, Their need in their words, Objection, Next step, Close.
- **FR-CALL-2** A stepper shows all eight, marks the current one unmistakably, and shows visited stages as visited.
- **FR-CALL-3** Forward movement is only via Next, one stage at a time (stages are not skipped). Going back is via Back or by selecting any visited stage **[A]**.
- **FR-CALL-4** Moving between stages never discards anything. Each stage's saved result is restored when revisiting.
- **FR-CALL-5** Outcome buttons act as a single-choice group; re-tapping the chosen button clears it. Choosing one saves immediately.
- **FR-CALL-6** "Their words" and "Your note" autosave after a pause and on leaving the field or stage. A visible save state (Saving, Saved, Not saved: Retry) is always shown.
- **FR-CALL-7** Next is never blocked by missing data (a real call moves on regardless). At stage 5, if no words are captured, a non-blocking hint is shown.
- **FR-CALL-8** End call is available at every stage, including stage 8, and opens the close panel (3.6) inline, not as a modal.

### 3.3 Example prospect responses (FR-EX)

Three per stage, verbatim from the transcripts, each with call ID, speaker, and the outcome the caller logged for that call. All 24 quotes below were checked against the transcript files **[V]**.

| Stage | Call | Speaker | Quote |
|---|---|---|---|
| 1 | T027 | Reception | "Record your name and reason for calling. I'll see if this person is available." |
| 1 | T038 | Prospect | "I am not in Fairline anymore. I left last year." |
| 1 | T016 | Prospect | "See, your voice is cracking up. Can you just write down one number?" |
| 2 | T014 | Prospect | "Sorry, I didn't get you. You are calling from where?" |
| 2 | T007 | Prospect | "So what is that regarding? What do I need to help you with in this?" |
| 2 | T084 | Prospect | "Okay, and where did you get my number from?" |
| 3 | T005 | Prospect | "Can you call me in an hour?" |
| 3 | T019 | Prospect | "It would be better if you can send me on WhatsApp. I will reply to you on WhatsApp." |
| 3 | T026 | Prospect | "I am driving, but I can speak to you. No problem." |
| 4 | T090 | Prospect | "We cater more to the steel industry: steel, cement, hydro power, wind." |
| 4 | T095 | Prospect | "...our company majorly works on a job work basis. We are into chemical manufacturing..." |
| 4 | T084 | Prospect | "...we are a manufacturing facility here. We have three types of employees." |
| 5 | T093 | Prospect | "Nowadays my customers are more and more into sustainability." |
| 5 | T009 | Prospect | "We have an internal business model, actually, and we are following it." |
| 5 | T084 | Prospect | "...How are you going to help me grow my business?" |
| 6 | T071 | Prospect | "...we have global tie-ups with the big four consulting firms." |
| 6 | T024 | Prospect | "...I am not the right person to give you the data, because my CFO takes care of all those things." |
| 6 | T036 | Prospect | "If you can send me some details by mail, it will be helpful." |
| 7 | T060 | Prospect | "...give me a call sometime on Tuesday morning." |
| 7 | T050 | Prospect | "...I want you to connect with Mr. Naik. He handles our entire company operations." |
| 7 | T019 | Prospect | "Then you send me. Then if required, if I feel it is good for me, I will connect." |
| 8 | T099 | Prospect | "...let me understand first whether I'll be able to manage your requirement or not." |
| 8 | T098 | Prospect | "...due to the re-orgs, I'm not very clear on what role I'll be taking." |
| 8 | T088 | Prospect | "Sure, sure, sure. Yeah, sure." |

Rules:

- **FR-EX-1** Stored as data (a JSON file), not hard-coded in components, so they can be re-verified by script.
- **FR-EX-2** A verification script compares every quote to the local transcript files (supplied by path, not committed) and fails if any is missing.
- **FR-EX-3** Each example shows its call ID so the caller and reviewer can trace it. Showing the logged outcome next to it is **[A]**: it teaches that words and logs differ.
- **FR-EX-4** Quotes are short excerpts. The transcript files themselves are never added to the repository (README restriction).

### 3.4 Stage-specific outcome buttons (FR-BTN)

Buttons are my design, derived from the patterns in section 2.3 **[A]**. Keys are stored; labels are display text.

| Stage | Key | Label |
|---|---|---|
| 1 Opening | `reached_prospect` | Reached the right person |
| | `via_assistant` | Assistant or switchboard |
| | `not_available` | Not available now |
| | `wrong_or_left` | Wrong number or left the company |
| | `line_or_language` | Bad line or language barrier |
| 2 Purpose | `purpose_heard` | Heard the purpose |
| | `asked_what_we_do` | Asked what we do |
| | `asked_number_source` | Asked where we got the number |
| | `called_it_sales` | Said it sounds like a sales call |
| 3 Permission | `yes_now` | Agreed to talk now |
| | `asked_callback` | Asked for a callback |
| | `send_first` | Wants it sent first |
| | `no_clear_answer` | Did not answer clearly |
| | `declined_to_talk` | Declined to talk |
| 4 Their business | `shared_business` | Described their business |
| | `one_line_waiting` | One line, then waited |
| | `corrected_us` | Corrected what we assumed |
| | `asked_us_first` | Asked about us first |
| 5 Their need | `named_goal` | Named a goal or problem |
| | `says_fine` | Says all is fine |
| | `asked_what_we_offer` | Asked what we can do for them |
| | `unclear` | Unclear or no answer |
| 6 Objection | `has_provider` | Already has a team or consultant |
| | `not_right_person` | Not the right person |
| | `not_relevant` | Not relevant or no need |
| | `wants_writing` | Wants it in writing |
| | `declined` | Said no |
| | `asked_not_to_call` | **Asked not to be called again** (restricted style, see 3.7) |
| 7 Next step | `doc_agreed` | Agreed to receive a document |
| | `time_named` | Named a time to talk |
| | `meeting_agreed` | Agreed to a meeting |
| | `referred` | Referred us to someone |
| | `nothing_agreed` | Nothing agreed |
| 8 Close | `closed_with_agreement` | Closed with something agreed |
| | `closed_after_no` | Closed after a no |
| | `line_dropped` | Line dropped or they hung up |

The reference screen's "Four taps" principle is respected: at most six buttons, one row of wrapped chips on mobile.

### 3.5 Prospect's words and notes (FR-WORDS)

- **FR-WORDS-1** "Their words" is verbatim, stored exactly as typed (no trimming of inner text, no AI editing). Whitespace-only is saved as empty.
- **FR-WORDS-2** Rendered in a distinct typeface and style everywhere (live screen and history) so it reads as the prospect's voice.
- **FR-WORDS-3** "Your note" is the caller's own text, visually distinct from the words box.
- **FR-WORDS-4** AI text is never written into either field automatically. It lives in its own table and its own labelled box.
- **FR-WORDS-5** Limits: 4,000 characters per field (enforced in the UI, the API and the database).
- **FR-WORDS-6** Stage 5 is the "primary" stage for words: the box is larger and its label reads "What they said they need, in their words".

### 3.6 Next step, close and outcomes (FR-CLOSE)

**Final outcomes** (stored on the call) **[A]**:

| Outcome | Meaning | Class | Requires |
|---|---|---|---|
| `next_step_set` | A call or meeting agreed with a time | success | next step type `call` or `meeting`, plus when |
| `document_requested` | They asked for something to be sent | partial | next step type `document`, plus channel |
| `callback_requested` | They asked to be called back | partial | next step type `call`, plus when |
| `referred` | They pointed to someone else | partial | next step type `referral`, plus who |
| `declined` | A no (any reason) | negative | none |
| `wrong_contact` | Wrong number or person has left | negative | none |
| `no_contact` | Never properly connected (line, language, unavailable) | negative | none |
| `do_not_call` | They asked not to be called again | restricted | their words |

Mapping from the transcripts' logged words, for the demo and README **[A]**:

| Logged word | Closest Callframe outcome |
|---|---|
| next_step_agreed | `next_step_set` |
| agreed_to_receive_report | `document_requested` |
| follow_up, call_again | `callback_requested` (or `no_contact` if never connected) |
| interested | no direct equivalent: becomes `document_requested`, `callback_requested` or `next_step_set` depending on what was agreed |
| not_interested | `declined` |
| wrong_person, moved_company | `wrong_contact` |
| not_logged | derived from what was recorded |
| do_not_call | `do_not_call` only if the prospect said so |

**Status** (stored): `in_progress`, `completed` (ended at stage 8), `ended_early` (ended at stages 1 to 7). **Abandoned** is a display state: an `in_progress` call with no activity for two hours **[A]**. The row is never rewritten to say so.

Requirements:

- **FR-CLOSE-1** The close panel replaces the main area inline. It shows: the stage the call ended at, a suggested outcome with the reason ("Suggested from what you recorded"), the full outcome list, next-step fields when the outcome needs them, a read-only recap of the stage-5 words, and Save and end call.
- **FR-CLOSE-2** The suggestion is derived from the last stage and the latest button recorded (table below). The caller can override.
- **FR-CLOSE-3** The server rejects an outcome whose required details are missing (the table above), with field-level messages. The UI shows the same rules.
- **FR-CLOSE-4** `document_requested`, `callback_requested` and `referred` are never labelled or coloured as success.
- **FR-CLOSE-5** Closing sets `status` from the ended stage, `ended_at`, and `last_stage`. A closed call cannot receive further stage saves.
- **FR-CLOSE-6** Closing first flushes any unsaved stage drafts. If a flush fails, closing is blocked with a Retry, so nothing is lost.

Suggestion logic **[A]**:

| Latest recorded signal | Suggested outcome |
|---|---|
| Any `asked_not_to_call` | `do_not_call` |
| Stage 7 `meeting_agreed` or `time_named` | `next_step_set` |
| Stage 7 `doc_agreed` | `document_requested` |
| Stage 7 `referred` | `referred` |
| Stage 3 `asked_callback` | `callback_requested` |
| Stage 3 `send_first` or stage 6 `wants_writing` | `document_requested` |
| Stage 3 `declined_to_talk`; stage 6 `declined`, `not_relevant`, `has_provider` | `declined` |
| Stage 6 `not_right_person` | `referred` if a referral was captured at stage 7, else `declined` |
| Stage 1 `wrong_or_left` | `wrong_contact` |
| Stage 1 `line_or_language`, `not_available` | `no_contact` |
| Otherwise | none: the caller must choose |

### 3.7 Do-not-call (FR-DNC)

- **FR-DNC-1** `asked_not_to_call` appears only at stage 6, visually distinct (icon plus text, not colour alone).
- **FR-DNC-2** Tapping it opens the close panel with outcome `do_not_call` selected and the prospect's words required.
- **FR-DNC-3** `do_not_call` outcome is only valid with words, and forbids a next step (server and database rules).
- **FR-DNC-4** After a do-not-call request on the call (button or outcome), AI assistance is disabled for that call and the server refuses to call the model.
- **FR-DNC-5** Starting a new call for the same name and company is blocked (FR-START-3). There is no override in the first version **[A, decision D2]**.
- **FR-DNC-6** History shows a visible restriction badge on such calls.
- **FR-DNC-7** An ordinary refusal ("not interested", "we have a team") is never automatically upgraded to do-not-call. This follows insight I3.

### 3.8 History (FR-HIST)

- **FR-HIST-1** Lists all saved calls, newest first, 50 per page.
- **FR-HIST-2** Each row: prospect and company, date and time, last stage (number and title), outcome, status (including Ended early and Abandoned), next step summary if any, restriction badge if do-not-call.
- **FR-HIST-3** Opening a call shows a read-only detail: header, outcome and next step, a per-stage timeline with the latest recorded button, words and note, earlier revisions collapsed, the stage-5 words, any AI suggestions in a separate labelled list, and the do-not-call words if applicable.
- **FR-HIST-4** In-progress calls can be resumed from the history list **[A]**.
- **FR-HIST-5** Empty, loading and error states (section 5.5).

### 3.9 Persistence and integrity (FR-DATA)

- **FR-DATA-1** Stage results are append-only revisions. A save that changes nothing creates no new revision.
- **FR-DATA-2** A stage result belongs to exactly one call and one stage (foreign key, unique on call, stage, revision).
- **FR-DATA-3** Saving a stage and updating `last_stage` happen in one database transaction.
- **FR-DATA-4** Reloading the page during a call restores the call and each stage's latest result (active call id kept in browser storage, state read from the server) **[A]**.
- **FR-DATA-5** Calls ending at any stage 1 to 8 are valid.

---

## 4. User flows and edge cases

### 4.1 Normal call

1. Start: name, company. Timer starts.
2. Stages 1 to 3: tap what happened. Stage 4: tap, note. Stage 5: capture their words.
3. Stage 6 only if there is an objection (otherwise tap Next; nothing is forced). Stage 7: tap the next step. Stage 8: Finish call.
4. Close panel: confirm the suggested outcome, fill the next step details, Save and end call.
5. The call appears in History with last stage 8 and status Completed.

### 4.2 Edge-case handling

| Situation | Where | Handling |
|---|---|---|
| Switchboard or assistant (T027, T044, T055, T059, T062) | Stage 1 | `via_assistant`; note the name or reason asked. Move to stage 2 once the prospect is on the line. |
| Prospect unavailable | Stage 1 | `not_available`; End call. Suggested `no_contact`. Callback time can be added as `callback_requested` if the assistant gives one. |
| Wrong number / person left (T015, T038, T039, T040) | Stage 1 or 2 | `wrong_or_left`; note any new company or contact they mention. End call. `wrong_contact`. |
| Person is not the one listed but is willing to talk (T066, T099) | Stage 1 | Record the real role in the note. Continue. |
| Bad line or language barrier (T006, T016, T032) | Stage 1 or 3 | `line_or_language`; note language ("asked for Kannada"). End call: `no_contact`. |
| Prospect asks who/what (T014, T007) | Stage 2 | `asked_what_we_do`; the screen shows the likely questions so the caller is not surprised. |
| Asks where the number came from (T084) | Stage 2 | `asked_number_source`. Note what the caller answered. |
| Asks to call back / "after 2" / "in an hour" (T001, T005, T027) | Stage 3 | `asked_callback`. End call with outcome `callback_requested` and a time, or continue if they then agree to talk. |
| "Send it on WhatsApp first" (T019, T023) | Stage 3 | `send_first`. End with `document_requested`, channel required. Not a success. |
| Busy but willing (T026) | Stage 3 | `yes_now`; note it. |
| No clear answer; they keep talking | Stage 3 | `no_clear_answer`. Not treated as a yes. |
| "Already have a team or consultant" (T071, T009) | Stage 6 | `has_provider`; note the words. End: `declined`. |
| "Not the right person" with a name (T050, T030, T025) | Stage 6 then 7 | `not_right_person`; then stage 7 `referred` and detail. Outcome `referred`. |
| Referral but they refuse to give a number (T029, T041, T075) | Stage 6/7 | Record `referred` only if a person or role was named; otherwise `declined`. The detail field says who. |
| Asks for information in writing / sample (T036, T064, T078, T090) | Stage 6 or 7 | `wants_writing` or `doc_agreed`; channel required; outcome `document_requested`. |
| Asks about cost (T047) | Stage 6 | Note the words. There is no price information in the transcripts or the task, so the app offers none. |
| Polite maybe or soft no (T099, T088, T098) | Stage 6 to 8 | The prospect's actual words are recorded. The outcome is chosen from what was agreed, not from the goodbye. |
| Asks not to be called | Stage 6 | Section 3.7. |
| Line drops mid-sentence | Any | End call; if never connected, `no_contact`; if a next step was already agreed, record it. |
| Call ends before stage 8 | Any | Normal: status `ended_early`, last stage stored, outcome required. |
| Caller closes the tab or loses connection | Any | The call stays `in_progress`. On return it can be resumed. After two hours of inactivity it shows as Abandoned in history. |
| Save fails (network) | Any | State shows Not saved with Retry. Drafts stay in memory; flush runs before closing. |
| Going back and editing | Any | New revision; older revision stays visible in the detail view. |
| Server asleep (cold start) | Start | Banner "Waking the server, up to a minute on the free plan". Polls `/health`, enables Start when ready. |
| AI unavailable or quota hit | Any | Inline message. Nothing else changes. |
| Email or phone number given by the prospect | Stage 7 | Goes in the note or next-step detail as text. Treated as personal data (section 8). |

---

## 5. UI/UX requirements

### 5.1 Screens

1. **Start** (`/`): a compact form: name, company, role (optional), Start call. Below it, a link to History and, if an in-progress call exists in this browser, "Resume call".
2. **Active call** (`/` after start, same route): the workspace (5.2). Includes the inline close panel.
3. **History** (`/history`).
4. **Call detail** (`/history/[id]`).

### 5.2 Active-call layout

Desktop (1024 px and wider):

```
+-----------------------------------------------------------------+
| Menon, Dr. Anjali · Menon Family Clinic            02:14  Saved |
+--------------+--------------------------------------------------+
| 1 Opening    |  Stage 2 of 8: Purpose                           |
| 2 Purpose *  |  Say why you called in words they can repeat.    |
| 3 Permission |                                                  |
| 4 Business   |  They may say                                    |
| 5 Need       |   "Sorry, I didn't get you. You are calling..."  |
| 6 Objection  |   "So what is that regarding?..."                |
| 7 Next step  |   "Okay, and where did you get my number...?"    |
| 8 Close      |                                                  |
|              |  What happened   [chip][chip][chip][chip]        |
|              |  Their words     [______________________]        |
|              |  Your note       [_____]                         |
|              |  [Suggest what to say]                           |
|              |                                                  |
|              |  [Back]            [Next: Permission] [End call] |
+--------------+--------------------------------------------------+
```

Mobile (under 1024 px): the stepper becomes a compact horizontal strip with "Stage 2 of 8" and tick marks; the content is one column; the action bar (Back, Next, End call) is fixed to the bottom with safe-area padding. Outcome chips wrap; the words box is at least three lines.

### 5.3 Components

Stepper (`aria-current="step"` on the current stage, completed ones marked), stage header, example-quote list (call ID and logged outcome in small text), outcome chip group (radio-group semantics), words textarea (serif), note input, save-state indicator (live region), AI suggestion box, action bar, close panel, history row, call-detail timeline, restriction badge, status badge, error banner, warm-up banner.

### 5.4 Visual direction **[A]**

- Prospect's words are set in a serif face (Source Serif 4); everything the caller or system says is in a sans face (IBM Plex Sans). The type difference carries the product's main rule: whose words are these.
- Palette: ink `#16202C`, paper `#F3F5F8`, surface `#FFFFFF`, accent `#2A5BD7`, danger `#B42318`, caution `#B45309`, success `#1F7A4D`. Contrast to be checked against WCAG AA with a tool before sign-off; not yet verified.
- AI suggestions use a distinct tinted container with an "AI suggestion" label and a different border style from the prospect-words box.
- Restraint: no gradients, no entrance animations. Motion only in response to a tap (chip selection, panel opening), and respecting reduced-motion.

### 5.5 States

| State | Behaviour |
|---|---|
| Loading (call load, history) | Skeleton rows or a short "Loading" line; no layout jump. |
| Warm-up | Banner on Start, polling, elapsed seconds shown. |
| Empty history | "No calls yet. Start a call and it will appear here with the stage it reached." plus a Start button. |
| Save error | Stage-level "Not saved. Retry." Close blocked until flush succeeds. |
| Start error | Inline under the form: reason and what to do. DNC refusal names the restriction and links to the call. |
| 404 call | "This call does not exist." with link to History. |
| AI error | Inline in the AI box; stage and notes untouched. |
| Access gate (if enabled) | A single access-code field when the API returns 401. |

### 5.6 Accessibility

- Full keyboard operation: tab order follows reading order; stage chips respond to arrow keys within the group; Enter or Space selects.
- Visible focus ring on every control.
- Touch targets at least 44 by 44 px.
- Meaning never carried by colour alone (do-not-call, success and partial all include text or an icon).
- Save state and errors in `aria-live="polite"` regions.
- Text scales to 200 percent without loss; line length under 80 characters.
- Respects `prefers-reduced-motion`.
- Language of free text is not assumed to be English (`lang` not forced on user content).

---

## 6. AI feature

### 6.1 Choice and rationale **[A]**

**Primary: "Suggest what to say"**, an on-demand, stage-aware suggestion of one short line the caller can say next, based only on what has been captured on this call. It matches the brief's suggested feature and the live-call purpose.

**Alternative considered (decision D1):** an AI check at close that compares the chosen outcome with the captured words and flags mismatches. It fits insight I2 more directly, but the first version already addresses I2 with deterministic rules (3.6), which are cheaper, testable and never wrong in a new way. If you prefer the check, only section 6 and one endpoint change.

### 6.2 Inputs

- Prospect name, role, company.
- Current stage number, title and purpose (fixed text).
- The button tapped on this stage (as its label).
- The latest "Their words" for this stage, verbatim, delimited as data.
- The caller's note.
- The latest stage-5 words, if already captured and the current stage is not 5.
- Fixed offering context: Meridian prepares a free growth report about the prospect's company. Nothing else about the offering is supplied to the model.

### 6.3 Output

- One suggestion, at most 40 words, plain spoken English.
- Labelled "AI suggestion, not the prospect's words" with the model name.
- Stored in `ai_suggestions`, never in `stage_results`. Never auto-inserted into any field.
- The caller may ignore it; no action is required to continue.

### 6.4 Where it fits

A button under the notes at each stage, enabled when a button is tapped or words exist. It is never triggered automatically, because reading during a live call costs attention.

### 6.5 Safeguards against invention and misuse

1. The system prompt forbids facts about the prospect that are not in the captured text, and any claim about Meridian beyond "free growth report".
2. The prospect's words are passed inside delimiters and declared to be data, not instructions (prompt-injection hygiene).
3. Refusals: if the prospect declined, said not the right person, or asked not to be called, the suggestion is a brief respectful acknowledgement, at most a polite request for the right contact.
4. **Hard block:** if the call has a do-not-call outcome or a stage-6 `asked_not_to_call` result, the server answers `blocked` and does not call the model.
5. Output length capped, empty output treated as failure.
6. The prospect's original wording is never modified by this feature.
7. The server rate-limits the endpoint per client to protect the free quota **[A]**.

### 6.6 Failure handling

| Failure | Server response | UI |
|---|---|---|
| No API key configured | 503 `AI_NOT_CONFIGURED` | "AI assistance is not available." |
| Quota or rate limit (HTTP 429 from the model) | 429 `AI_QUOTA` | "AI quota reached for now. Carry on; nothing is lost." |
| Model or key rejected (400, 401, 403, 404) | 502 `AI_CONFIG` | Generic unavailable message; details in server log only. |
| Timeout (9 s) or 5xx | 503 `AI_UNAVAILABLE` | Same. |
| Empty text | 503 `AI_UNAVAILABLE` | Same. |
| Do-not-call | 200 `blocked: true` | "They asked not to be called. End the call politely." |

No AI failure can affect saving, navigation or closing.

### 6.7 Provider details to confirm

- Gemini REST: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` with header `x-goog-api-key`. Consistent across the third-party sources I found; **not yet confirmed against Google's own documentation** (my fetch of the official docs was not performed).
- **Model ID is unconfirmed.** Third-party pages disagree (names such as `gemini-2.5-flash` and `gemini-3.5-flash` appear). The model is an environment variable; the exact free-tier model ID must be read from Google AI Studio on the day.
- Free-tier terms: third-party pages say free-tier data may be used to improve Google products and that the free tier excludes commercial use. **To verify in Google's terms.** Consequence: demo only with the fictional transcript data.

---

## 7. Technical architecture

```
Caller's browser
      |  HTTPS (JSON)
      v
Next.js + TypeScript + Tailwind   (Vercel)
      |  HTTPS (JSON), header x-access-code (optional)
      v
Express + TypeScript REST API     (Render)  ---> Gemini API
      |  Postgres over TLS (Supabase pooler, restricted role)
      v
Supabase PostgreSQL
```

### 7.1 Responsibilities

| Component | Owns |
|---|---|
| Frontend | All screens, stage content and quotes (static data), local draft state, save-state UI, warm-up polling, suggestion of outcome (display only). |
| Backend | Input validation, business rules (outcome requirements, DNC enforcement, status), database access, AI calls and their safeguards, error shape, CORS. |
| Database | Persistence, integrity constraints, append-only revisions, transactional save, row-level lock-down. |
| Gemini | Generates the suggestion text only. Receives no secrets and no ids. |

Rule duplication note: outcome rules live on the server and are mirrored in the UI for instant feedback. The server is authoritative.

### 7.2 Data flow (one call)

1. Browser: `POST /api/calls`. API checks DNC, inserts, returns the call.
2. Each tap or pause: `PUT /api/calls/:id/stages/:stage`. API runs the transactional function and returns the saved revision.
3. Next: `PATCH /api/calls/:id/progress` (moves `last_stage`).
4. Suggest: `POST /api/calls/:id/assist`. API reads saved context from the database (not from the request body), checks DNC, calls Gemini, stores and returns the suggestion.
5. End: `POST /api/calls/:id/close`. API validates the rules, then updates the call in a transaction.
6. History: `GET /api/calls`, `GET /api/calls/:id`.

### 7.3 API endpoints

Base URL from environment. All `/api` routes return JSON. Errors share one shape:

```json
{ "error": { "code": "VALIDATION", "message": "Human-readable text", "details": [ { "field": "company", "message": "Required" } ] } }
```

| Method and path | Purpose | Success | Errors |
|---|---|---|---|
| `GET /health` | Liveness and database check | 200 `{status:"ok", service, db:"up", time}` | 503 `{status:"degraded", db:"down"}` |
| `POST /api/calls` | Start a call | 201 `{call}` | 422 VALIDATION; 409 DNC_RESTRICTED (with `call_id`) |
| `PUT /api/calls/:id/stages/:stage` | Save a stage result (new revision) | 200 `{result}` | 404; 409 CALL_CLOSED; 422 |
| `PATCH /api/calls/:id/progress` | Move to a stage (`{stage}`) | 200 `{call}` | 404; 409 CALL_CLOSED |
| `POST /api/calls/:id/close` | Close with outcome and next step | 200 `{call}` | 404; 409 CALL_CLOSED; 422 RULE_VIOLATION |
| `GET /api/calls` | List (`limit`, `offset`) | 200 `{calls:[], limit, offset}` | 401 |
| `GET /api/calls/:id` | Detail | 200 `{call, stage_results, latest_by_stage, ai_suggestions}` | 404 |
| `POST /api/calls/:id/assist` | AI suggestion for a stage (`{stage}`) | 200 `{suggestion}` or 200 `{blocked:true,message}` | 404; 422 NOTHING_TO_ASSIST; 429 AI_QUOTA; 502/503 AI_* |

Sample payloads:

```json
// POST /api/calls
{ "prospect_name": "Ayesha Khan", "company": "Vijay Writing Instruments", "prospect_role": "Managing Director" }
// 201
{ "call": { "id": "uuid", "status": "in_progress", "last_stage": 1, "started_at": "2026-10-19T09:30:00Z", "do_not_call": false } }

// PUT /api/calls/:id/stages/5
{ "outcome_key": "named_goal", "prospect_words": "exact words typed here", "notes": "mentioned expansion" }
// 200
{ "result": { "id": "uuid", "call_id": "uuid", "stage": 5, "revision": 2, "outcome_key": "named_goal", "prospect_words": "exact words typed here", "notes": "mentioned expansion", "created_at": "..." } }

// POST /api/calls/:id/close
{ "outcome": "document_requested", "ended_stage": 7, "next_step": { "type": "document", "channel": "WhatsApp", "when": "tomorrow", "detail": null } }
// 200
{ "call": { "status": "ended_early", "outcome": "document_requested", "last_stage": 7, "ended_at": "..." } }

// POST /api/calls/:id/assist
{ "stage": 6 }
// 200
{ "suggestion": { "id": "uuid", "stage": 6, "text": "...", "model": "...", "ai_generated": true } }
```

Validation rules: UUID ids; `stage` 1 to 8; `outcome_key` matching `^[a-z0-9_]{1,40}$`; text fields at most 4,000 characters; JSON body limit 50 KB; unknown fields ignored.

### 7.4 Database tables and relationships

```
calls 1 ---- * stage_results      (call_id, stage, revision; unique)
calls 1 ---- * ai_suggestions     (call_id, stage)
```

**calls:** id, prospect_name, company, prospect_role, status (`in_progress|completed|ended_early`), last_stage (1 to 8), outcome, next_step_type, next_step_channel, next_step_when, next_step_detail, do_not_call, dnc_words, started_at, ended_at, updated_at.

**stage_results:** id, call_id, stage (1 to 8), revision, outcome_key, prospect_words, notes, created_at.

**ai_suggestions:** id, call_id, stage, model, suggestion, created_at.

**Function** `save_stage_result(call, stage, outcome_key, words, notes)`: locks the call row, rejects a missing or closed call, returns the existing row if nothing changed, otherwise inserts revision + 1 and raises `last_stage`, in one transaction.

Stage definitions (titles, purposes, buttons) live in application code, not in a table: simplest maintainable design, allowed by the task **[V: brief]**.

Constraints (enforced in SQL): closed calls require an outcome and `ended_at`; `do_not_call` equals (outcome = `do_not_call`); a do-not-call needs non-empty words and no next step; field lengths; key format.

A draft of `sql/schema.sql` exists in the workspace (not yet reviewed or run).

---

## 8. Data and security

| Concern | Requirement |
|---|---|
| Secrets | `GEMINI_API_KEY`, `DATABASE_URL`, `APP_ACCESS_CODE` exist only in backend environment variables (Render). The browser receives only `NEXT_PUBLIC_API_URL`. `.env` files are git-ignored; `.env.example` has placeholders only. Before publishing, a scan of the repository history for secrets is run. |
| Database credentials | The API connects with a dedicated least-privilege role (`callframe_api`), not the project owner and not a service-role key. Row Level Security is enabled on all tables; the browser never talks to Supabase directly; `anon` and `authenticated` roles have no grants. |
| Connection | Supabase pooler connection string over TLS (direct connections are IPv6-only, reported as a problem for hosts without IPv6; to verify when deploying). |
| Authentication | The task does not require user accounts, so none are built. **Optional access code [A, D3]:** if `APP_ACCESS_CODE` is set, every `/api` request needs it in a header; the UI asks once and keeps it in session storage. This is a shared-secret gate, not identity, and is visible to anyone who has the code. Without it, the API would let any visitor list all calls. |
| CORS | Exact allow-list from `FRONTEND_ORIGIN` (the production Vercel URL, plus `http://localhost:3000` in development). No wildcard. Preview URLs are not allowed unless added. |
| Input handling | Schema validation on every route; parameterised SQL only; length limits; JSON size limit; no HTML is ever rendered from stored text (React escapes by default). |
| Rate limiting | A small in-memory limit on `/assist` (for example ten per minute per client) **[A]**. |
| Privacy | Prospect names, roles and companies are personal data. For this task the demo uses fictional transcript data only. Words and notes may contain emails or phone numbers; they are not logged and not sent anywhere except, on request, to Gemini. A delete endpoint and retention policy are out of scope and listed as known limitations. |
| Logging | Server logs contain method, path, status and ids; never prospect words or notes. |
| DNC enforcement | Server-side: start refusal, AI hard block, database constraints. The UI mirrors but does not enforce. Limitation: matching is by normalised name and company (no phone number in the data), so it can be bypassed by changing spelling (decision D2). |
| Repository | No transcripts, no real keys, no `.env`. |

---

## 9. Deployment

| Service | Setup | Verification |
|---|---|---|
| **Supabase** | New project (free tier). Run `sql/schema.sql` in the SQL editor after changing the role password. Copy the pooler connection string, using the `callframe_api` role. Free projects can pause after inactivity (reported; to verify). | A test row can be inserted and read through the API. |
| **Render** | Web service, root directory `backend`. Build: `npm install && npm run build`. Start: `npm start`. Health check path `/health`. Node 20 or later. Environment: `DATABASE_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `FRONTEND_ORIGIN`, `APP_ACCESS_CODE` (optional). Free tier availability and sleep behaviour **must be confirmed on the day** (reported: idle sleep and a cold start of up to about a minute). | `GET https://<service>.onrender.com/health` returns 200 `{status:"ok", db:"up"}`. |
| **Vercel** | Import the GitHub repository, root directory `frontend`, framework Next.js. Environment: `NEXT_PUBLIC_API_URL` (the Render URL). | The production URL loads, a call can be started and saved. |
| **CORS** | Set `FRONTEND_ORIGIN` on Render to the exact Vercel production origin (scheme and host, no trailing slash). Redeploy. | Browser preflight succeeds; a call starts from the live site. |

Deploy a trivial vertical slice (health endpoint plus a placeholder page) early, so deployment problems surface on day one, not the last night.

**Environment variables**

| Name | Where | Required | Notes |
|---|---|---|---|
| `DATABASE_URL` | backend | yes | Supabase pooler string, restricted role |
| `DATABASE_SSL` | backend | no | `false` only for a local Postgres |
| `GEMINI_API_KEY` | backend | for AI | Free key from Google AI Studio |
| `GEMINI_MODEL` | backend | for AI | Exact ID from AI Studio (unconfirmed) |
| `FRONTEND_ORIGIN` | backend | yes | Comma-separated exact origins |
| `APP_ACCESS_CODE` | backend | optional | If unset, `/api` is open |
| `PORT` | backend | provided by Render | Default 4000 locally |
| `NEXT_PUBLIC_API_URL` | frontend | yes | Public by design; contains no secret |

---

## 10. Testing strategy

### 10.1 Unit

- Outcome rules: each outcome with and without its required details; do-not-call; status from ended stage; abandoned display; revision selection. **A draft of this suite exists and 9 of 9 tests pass in my environment** (pure logic only; run with Node's built-in test runner).
- Prompt builder and response parsing for the AI module (including empty and malformed responses).
- Suggestion logic for the close panel (table in 3.6).
- Stage-content integrity: eight stages, three quotes each, unique keys, DNC key present only at stage 6.
- Quote verification script against the local transcripts (all 24 passed when checked manually in this review; the script will automate it).

### 10.2 Integration (API with a real Postgres)

Run against a local Postgres or a throwaway Supabase project, never the production data.

- Start a call; save stage results; verify revisions increment and no-op saves do not.
- Concurrent saves to the same stage: revisions stay unique and sequential.
- Saving to a closed call returns 409.
- Close with each outcome: valid and invalid payloads, field-level errors.
- DNC: close with `do_not_call`; start the same prospect again returns 409; `/assist` returns `blocked`.
- Database constraints reject direct violating inserts.
- List and detail return correct last stage, status, abandoned display, and next step.

### 10.3 End-to-end (manual script, Playwright only if time allows)

Using a supplied transcript (candidate: T084, see 11.3) on the deployed site:

1. Full call to stage 8, close, check history.
2. Call ended at stage 1 (wrong number), stage 3 (callback), stage 6 (refusal).
3. Go back from stage 6 to stage 3, change the button, confirm the older revision is retained in detail.
4. Reload mid-call and resume.
5. Do-not-call: tap the button, words required, AI disabled, restart blocked.
6. Mobile viewport pass and keyboard-only pass.

### 10.4 AI failure tests

Missing key, 429, 403, timeout, empty response, malformed JSON: each returns the specified error, the UI shows the inline message, and saving and closing still work. A prompt-injection attempt in the words field ("ignore your rules") must not change the output format or break limits.

### 10.5 Persistence tests

Stop and restart the API; data remains. Reload the browser during a call; state restored from the server. Failed save then retry; no duplicate revisions.

### 10.6 Deployment verification checklist

- `GET /health` on Render returns 200 with `db:"up"`.
- Cold start: wait for sleep, open the site, the banner appears and clears, Start works.
- Production CORS: a call started from the Vercel origin succeeds; a request from another origin is rejected.
- Secrets: repository search for keys and connection strings is empty; the browser bundle contains no secret (search the built output).
- Supabase shows the rows created by the test call.
- README links and URLs open.

---

## 11. Deliverables and acceptance criteria

### 11.1 Deliverables (from the official task)

1. A public GitHub repository.
2. A live Vercel application URL.
3. A live Render health endpoint URL.
4. A Google Drive video link.

The task page says the work also ends with a WhatsApp message to the CEO from the candidate's own page, once the work is in **[V: public task page]**. The exact submission form is on the candidate's registered page, which I cannot see **[to confirm]**.

### 11.2 Repository contents

Frontend source, backend source, `sql/schema.sql`, `README.md`, `.env.example` (frontend and backend, placeholders only), setup and deployment instructions. README must state: purpose, architecture, local setup, environment variables, database setup, Vercel URL, Render URL, health URL, which LLM and model, what the LLM does, design decisions and known limitations.

### 11.3 Video requirements (from the candidate's brief; confirm on the registered page)

- At least six minutes; the candidate on camera.
- The deployed application demonstrated using one supplied transcript.
- One important product or technical decision explained and defended.
- Shared on Google Drive as anyone with the link can view.
- Suggested demo transcript: **T084** (296 s). It contains a number-source question, a business description, scripted need answers, an agreement to a WhatsApp report and a Thursday call, and a logged outcome (`do_not_call`) that contradicts the call. It shows, in one call, why derived outcomes matter. Candidate decision to explain: separating "document requested" from "success", and deriving outcomes from recorded evidence.

### 11.4 Acceptance criteria

| ID | Criterion |
|---|---|
| AC-1 | A call can be started with name and company and appears in the database immediately. |
| AC-2 | All eight stages appear in order with a visible current stage. |
| AC-3 | Each stage shows its purpose sentence and three transcript-based examples with call IDs; the quote verification script passes. |
| AC-4 | Each stage has its own outcome buttons; tapping one saves without a page reload. |
| AC-5 | The prospect's words are saved exactly as typed and are visually separate from notes and AI text. |
| AC-6 | Back and forward navigation restores everything saved; edits create revisions and never overwrite. |
| AC-7 | End call works at every stage; an early-ended call appears with the correct last stage and status. |
| AC-8 | Outcomes are rejected when required details are missing; a document request is never shown as success. |
| AC-9 | A do-not-call request requires the prospect's words, disables AI, blocks restarting the same prospect and is flagged in history. |
| AC-10 | History lists name, company, date and time, last stage, outcome, next step; detail shows stage history, words, outcome and next step. |
| AC-11 | The AI suggestion is labelled, never alters prospect words, and its failure never blocks saving. |
| AC-12 | `/health` on Render returns a meaningful success body. |
| AC-13 | The Vercel frontend works against the Render API with production CORS. |
| AC-14 | No secrets in the repository or browser bundle; `.env.example` present. |
| AC-15 | Works on a phone-width viewport and by keyboard alone. |
| AC-16 | README complete per 11.2. |
| AC-17 | Video recorded, at least six minutes, on camera, Drive link set to anyone with the link. |

---

## 12. Implementation roadmap

Time budget: about 47 hours remain from the start of this plan to the deadline (IST assumed) **[A]**. Plan to freeze features about 14 hours before the deadline.

| Phase | Target window | Work | Depends on | Checkpoint |
|---|---|---|---|---|
| **0 Decisions and accounts** | Hours 0 to 2 | Approve this PRD; answer D1 to D8; create Supabase, Render, Vercel and GitHub accounts and an AI Studio key (never pasted into chat); confirm the video and submission rules on the registered page; manually read 10 to 15 long calls to verify stage 4. | none | All open decisions closed |
| **1 Walking skeleton, deployed** | Hours 2 to 8 | Run the schema in Supabase; backend with `/health` and start/save/read endpoints; trivial Next.js page that starts and shows a call; deploy both; set CORS. | Phase 0 | A call started on the live Vercel site is visible in Supabase (**vertical slice proven in production**) |
| **2 Full stage workspace** | Hours 8 to 18 | Stage data and quotes; stepper; outcome buttons; words and note autosave; Back and Next; progress updates; resume after reload. | Phase 1 | All eight stages usable; persistence test passes |
| **3 Closing, history, DNC** | Hours 18 to 26 | Close panel with suggestions and server rules; early ending; history list and detail with revisions; do-not-call behaviours; warm-up banner and error states. | Phase 2 | AC-7 to AC-10 pass on the deployed app |
| **4 AI feature** | Hours 26 to 30 | Gemini integration, labelled box, safeguards, failure handling, rate limit. | Phase 3, AI key | AI failure tests pass; DNC block verified |
| **5 Hardening and docs** | Hours 30 to 36 | Accessibility and mobile pass; secret scan; quote verification script; README; polish; full test checklist (10.6) on production. | Phase 4 | AC-1 to AC-16 all pass |
| **6 Video and submission** | Hours 36 to 43 | Rehearse with T084; warm up Render and Supabase; record; upload; set sharing; submit the four links; send the WhatsApp message if the task requires it. | Phase 5 | AC-17 and submission confirmed, with at least about four hours to spare |
| **Buffer** | Hours 43 to 47 | Fixes only. No new features. | | |

Priorities if time runs short, cut from the bottom: (1) history detail revisions view, (2) rate limiting, (3) access code, (4) resume from history, (5) mobile polish. Never cut: persistence, early endings, outcome rules, do-not-call, the health endpoint, the README and the video.

---

## 13. Risks, assumptions and decisions needed

### 13.1 Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Render free tier unavailable, changed or slow to wake | Demo fails | Confirm on the day; deploy skeleton early; warm-up banner and polling; warm up before recording. |
| Supabase pooler or IPv6 connection problems | API cannot reach the database | Use the pooler string from day one; test from Render in Phase 1. |
| Supabase free project pausing | Database unavailable | Open the app before the video; check the dashboard. |
| Gemini model ID, quota or terms differ from the third-party sources I found | AI feature fails | Model is an environment variable; read the ID from AI Studio; AI failure never blocks the workflow. |
| Free-tier data may be used by Google | Privacy | Demo with fictional data only. |
| My environment cannot run `npm install` (network disabled) | Code not compiled here | Only the dependency-free rules tests have been run. First action on your machine will be install, build and test; any compile errors are fixed in Phase 1. |
| Stage 4 usage not yet verified | Stage 4 examples may be less representative | Manual read in Phase 0. |
| Quoting transcripts when the README says "nothing is to be published" | Policy concern | Only 24 short excerpts with call IDs; transcripts not in the repo; the task itself asks for transcript-based examples. Confirm with the task page if in doubt. |
| API has no real authentication | Anyone with the URL could list calls | Optional access code; stated as a known limitation. |
| Scope creep | Misses the deadline | Section 12 cut list; no features beyond this PRD. |
| Time zone or deadline misread | Late submission | Confirm the deadline and time zone on the registered page. |

### 13.2 Assumptions

- Single-user selection-task usage; no accounts.
- Next.js with TypeScript and Tailwind (App Router); Express with TypeScript; `pg` driver with the Supabase pooler.
- Stage definitions live in code. Buttons, outcomes and mapping tables in sections 3.4 and 3.6 are my design, not data from the task.
- The two-hour abandoned threshold and 50-row pages are arbitrary defaults.

### 13.3 Decisions needed from you

| # | Decision | My recommendation |
|---|---|---|
| **D1** | AI feature: "Suggest what to say" (live) or "Outcome check at close". | Live suggestion; outcome consistency is handled by deterministic rules. |
| **D2** | How strict is do-not-call matching: name plus company only, or add an optional phone number field, and does one person's request cover the whole company? | Name plus company, exact match, person-level, no override. |
| **D3** | Add the optional shared access code to the API? | Yes (small, avoids an open list endpoint). |
| **D4** | Stage 2 purpose line: the screen may show one suggested sentence. Wording must come from you; I will not invent claims about the offering beyond "free growth report" seen in the transcripts. | Provide one sentence, or omit it. |
| **D5** | Final outcome list and mapping (section 3.6). Keep as is, or align names with the transcripts' logged words? | Keep, with the mapping table in the README. |
| **D6** | Show the logged outcome beside each example quote? | Yes (teaches that words and logs differ). |
| **D7** | Abandoned threshold of two hours, and resume from history. | Keep. |
| **D8** | E2E tests: manual script only, or Playwright if time allows. | Manual script. |
| **D9** | Demo transcript for the video. | T084. |
| **D10** | Gemini model ID, read from AI Studio. | Confirm on the day. |

---

## Appendix A. Status of existing draft files (not part of the plan)

Before this PRD was requested I had already written, in the workspace only: `sql/schema.sql`, `backend/src/rules.ts` (with 9 passing unit tests), `backend/src/gemini.ts`, `backend/src/db.ts`. They are drafts. They will not be used, changed or built upon until you approve this PRD, and any of them can be discarded.

## Appendix B. Evidence index

- Task and readings (fetched in full): task page, structure page, reference page. The task page confirms the deliverables ("Four links and a six-minute video"), the stack, and the 48-hour window from registration. The video's other conditions come from your brief.
- Transcript ZIP (opened and unpacked): README, `index.csv`, `index.json`, 100 transcripts. Counts in 2.2 are exact. Counts marked [K] are keyword scans. Endings and openings of all 100 calls were read; T084 was read in full.
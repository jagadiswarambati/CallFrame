// Stage definitions and final-outcome tables for the call workspace.
// Data only: no React, no network.

export const stages = [
  {
    title: "Opening",
    guidance:
      "Reach the right person, introduce yourself, and listen for contact or availability issues.",
    prompts: [
      "Introduce yourself and your organisation.",
      "Check that you have reached the intended person.",
      "Listen for a transfer, an unavailable contact, or a wrong number.",
    ],
    outcomes: [
      ["reached_prospect", "Reached the right person"],
      ["via_assistant", "Assistant or switchboard"],
      ["not_available", "Not available now"],
      ["wrong_or_left", "Wrong number or left the company"],
      ["line_or_language", "Bad line or language barrier"],
    ],
  },
  {
    title: "Purpose",
    guidance:
      "Explain why you are calling in one or two clear sentences, then listen for questions or concerns.",
    prompts: [
      "State the reason for the call simply.",
      "Avoid claims you cannot support.",
      "Listen for questions about the purpose or how you made contact.",
    ],
    outcomes: [
      ["purpose_heard", "Heard the purpose"],
      ["asked_what_we_do", "Asked what we do"],
      ["asked_number_source", "Asked where we got the number"],
      ["called_it_sales", "Said it sounds like a sales call"],
    ],
  },
  {
    title: "Permission",
    guidance:
      "Capture a clear yes, no, or callback request; silence and an unanswered question are not permission.",
    prompts: [
      "Ask if they are willing and available to continue.",
      "Listen for an explicit yes or no.",
      "If they ask for another time, record the callback request.",
    ],
    outcomes: [
      ["yes_now", "Agreed to talk now"],
      ["asked_callback", "Asked for a callback"],
      ["send_first", "Wants it sent first"],
      ["no_clear_answer", "Did not answer clearly"],
      ["declined_to_talk", "Declined to talk"],
    ],
  },
  {
    title: "Their business",
    guidance:
      "Understand the prospect's company and work before pitching; listen for their own description and corrections.",
    prompts: [
      "Invite them to describe their company or work.",
      "Listen for the terms they use and what they emphasise.",
      "Check your understanding rather than filling in gaps.",
    ],
    outcomes: [
      ["shared_business", "Described their business"],
      ["one_line_waiting", "One line, then waited"],
      ["corrected_us", "Corrected what we assumed"],
      ["asked_us_first", "Asked about us first"],
    ],
  },
  {
    title: "Their need, in their words",
    guidance:
      "Capture the prospect's statement exactly; keep your interpretation and notes in the separate field.",
    prompts: [
      "Listen for the goal, concern, or current priority they actually name.",
      "Do not paraphrase in the prospect-words field.",
      "If they do not identify a need, record that without inference.",
    ],
    outcomes: [
      ["named_goal", "Named a goal or problem"],
      ["says_fine", "Says all is fine"],
      ["asked_what_we_offer", "Asked what we can do for them"],
      ["unclear", "Unclear or no answer"],
    ],
  },
  {
    title: "Objection",
    guidance:
      "Record the reason for hesitation or refusal and respect the prospect's boundary.",
    prompts: [
      "Listen for the specific concern before responding.",
      "Acknowledge a refusal without pressure.",
      "A do-not-call request is a restriction, not a sales outcome.",
    ],
    outcomes: [
      ["has_provider", "Already has a team or consultant"],
      ["not_right_person", "Not the right person"],
      ["not_relevant", "Not relevant or no need"],
      ["wants_writing", "Wants it in writing"],
      ["declined", "Said no"],
      ["asked_not_to_call", "⚠ Asked not to be called again"],
    ],
  },
  {
    title: "Next step",
    guidance:
      "Record one concrete action the prospect agreed to, including a time or channel where relevant.",
    prompts: [
      "Confirm what the prospect explicitly agreed to.",
      "Capture a specific time, channel, or person where applicable.",
      "If nothing was agreed, record that rather than implying a commitment.",
    ],
    outcomes: [
      ["doc_agreed", "Agreed to receive a document"],
      ["time_named", "Named a time to talk"],
      ["meeting_agreed", "Agreed to a meeting"],
      ["referred", "Referred us to someone"],
      ["nothing_agreed", "Nothing agreed"],
    ],
  },
  {
    title: "Close",
    guidance:
      "End respectfully and ensure the outcome and next step match what was actually said.",
    prompts: [
      "Confirm the agreed action, if there is one.",
      "Keep a callback, document request, or referral distinct from a success.",
      "The Stage 5 words below remain the prospect's exact statement.",
    ],
    outcomes: [
      ["closed_with_agreement", "Closed with something agreed"],
      ["closed_after_no", "Closed after a no"],
      ["line_dropped", "Line dropped or they hung up"],
    ],
  },
] as const;

export const finalOutcomes = [
  { key: "next_step_set", label: "Call or meeting agreed", className: "success" },
  { key: "document_requested", label: "Document requested", className: "partial" },
  { key: "callback_requested", label: "Callback requested", className: "partial" },
  { key: "referred", label: "Referred to someone", className: "partial" },
  { key: "declined", label: "Declined", className: "negative" },
  { key: "wrong_contact", label: "Wrong contact or person left", className: "negative" },
  { key: "no_contact", label: "No proper contact", className: "negative" },
  { key: "do_not_call", label: "Do not call again", className: "restricted" },
] as const;

export type OutcomeKey = (typeof finalOutcomes)[number]["key"];

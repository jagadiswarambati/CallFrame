import Link from "next/link";

const helpSections = [
  {
    id: "getting-started",
    title: "Getting Started",
    content: [
      {
        heading: "What is Callframe?",
        body: "Callframe is a browser-based workspace that helps you conduct structured phone calls. It guides you through eight stages — from opening to close — with prompts, outcome buttons, and dedicated fields for capturing the prospect's exact words separately from your own notes. You make the actual phone call separately; Callframe is your companion screen.",
      },
      {
        heading: "Who should use it?",
        body: "Anyone who makes outbound calls and wants a clearer record: sales development reps, founders doing customer discovery, account managers, researchers, or anyone who needs to capture what was actually said on a call.",
      },
      {
        heading: "What to prepare before starting",
        body: "Have the prospect's name and company ready. Their role is optional but helpful. You'll enter these when you click 'Start a Call'.",
      },
    ],
  },
  {
    id: "starting-navigating",
    title: "Starting and Navigating a Call",
    content: [
      {
        heading: "Starting a call",
        body: "Click 'Start a Call' on the landing page or workspace. Enter the prospect's name and company (required) and role (optional). Click 'Start call'. The timer begins and you're taken to Stage 1 (Opening).",
      },
      {
        heading: "Moving through stages",
        body: "Each stage shows guidance, transcript examples, and outcome buttons. Tap an outcome button, add any prospect words or your notes, then click 'Next' to advance. You can go back to any visited stage using the left sidebar or the 'Back' button. Your data is preserved.",
      },
      {
        heading: "The stage sidebar",
        body: "On desktop, the left sidebar shows all eight stages. The current stage is highlighted. Completed stages show a checkmark. You can click any visited stage to jump back. Future stages are disabled until you reach them.",
      },
      {
        heading: "Timer",
        body: "A call timer in the header shows elapsed time since the call started. It updates every second and persists if you refresh the page.",
      },
    ],
  },
  {
    id: "entering-prospect-info",
    title: "Entering Prospect Information",
    content: [
      {
        heading: "Two separate fields",
        body: "Every stage has two text areas:",
        list: [
          "<strong>Their words</strong> (serif font) — for the prospect's verbatim statements only. Do not paraphrase here.",
          "<strong>Your note</strong> (sans font) — for your interpretation, context, or internal reminders.",
        ],
      },
      {
        heading: "Stage 5 is special",
        body: "At Stage 5 (Their Need), the 'Their words' field is larger and labelled 'What they said they need, in their words'. This is the primary capture point for the prospect's stated needs. A gentle reminder appears if it's empty, but you can continue without it.",
      },
      {
        heading: "Character limits",
        body: "Both fields accept up to 4,000 characters. Text is saved automatically when you leave the field or after a short pause.",
      },
      {
        heading: "Auto-save",
        body: "Changes are saved to the backend after a 700ms pause or when you navigate away. A status indicator shows: Saving…, Saved, Not saved (with Retry), or No unsaved changes.",
      },
    ],
  },
  {
    id: "recording-exact-words",
    title: "Recording Exact Words vs Personal Interpretation",
    content: [
      {
        heading: "Why the separation matters",
        body: "In typical call logs, the prospect's words get mixed with the caller's interpretation. Callframe keeps them separate so reviewers can see exactly what the prospect said. This prevents logged outcomes from drifting from reality.",
      },
      {
        heading: "What goes in 'Their words'",
        body: "Only what the prospect actually said. Use quotation marks if helpful. Example: \"Nowadays my customers are more and more into sustainability.\"",
      },
      {
        heading: "What goes in 'Your note'",
        body: "Your interpretation, context, or follow-up reminders. Example: \"Prospect mentioned sustainability as a new priority — may align with our green manufacturing report.\"",
      },
      {
        heading: "At close",
        body: "The Stage 5 'Their words' are shown again in the close panel so you can verify the outcome matches what they actually said.",
      },
    ],
  },
  {
    id: "handling-objections",
    title: "Handling Objections",
    content: [
      {
        heading: "Stage 6: Objection",
        body: "When the prospect hesitates, refuses, or raises a concern, use the outcome buttons at Stage 6. Common options: Already has a team, Not the right person, Not relevant, Wants it in writing, Said no.",
      },
      {
        heading: "Do Not Call",
        body: "If the prospect explicitly asks not to be called again, select '⚠ Asked not to be called again'. This opens the close panel with 'Do not call again' pre-selected. You must record their exact words in the Stage 6 'Their words' field. No next step is allowed. Future calls to the same name and company will be blocked.",
      },
      {
        heading: "Referrals",
        body: "If the prospect says they're not the right person and names someone else, select 'Not the right person' at Stage 6, then 'Referred us to someone' at Stage 7. Enter the referred person's name or role in the detail field.",
      },
      {
        heading: "Requests for written info",
        body: "If the prospect wants details sent (email, WhatsApp, post), select 'Wants it in writing' at Stage 6 or 'Agreed to receive a document' at Stage 7. You'll need to specify the channel (e.g., 'WhatsApp', 'Email'). This outcome is 'Document requested' — a partial outcome, not a success.",
      },
    ],
  },
  {
    id: "scheduling-next-step",
    title: "Scheduling a Next Step",
    content: [
      {
        heading: "Stage 7: Next Step",
        body: "Record one concrete action the prospect agreed to. Options:",
        list: [
          "<strong>Agreed to receive a document</strong> — specify the channel (WhatsApp, Email, etc.)",
          "<strong>Named a time to talk</strong> — enter the specific date/time",
          "<strong>Agreed to a meeting</strong> — enter the date/time",
          "<strong>Referred us to someone</strong> — enter the person's name or role",
          "<strong>Nothing agreed</strong> — use this if no commitment was made",
        ],
      },
      {
        heading: "Required fields",
        body: "Each outcome type requires specific details: time for calls/meetings, channel for documents, person for referrals. You cannot close without filling these.",
      },
      {
        heading: "Callbacks from Stage 3",
        body: "If the prospect asked for a callback at Stage 3, the close panel will suggest 'Callback requested' and ask for the time they requested.",
      },
    ],
  },
  {
    id: "understanding-outcomes",
    title: "Understanding Call Outcomes",
    content: [
      {
        heading: "Final outcome categories",
        body: "When you end a call, you choose one outcome. They are grouped by result type:",
        list: [
          "<strong>Success (green)</strong>: Call or meeting agreed — a concrete next step with a time.",
          "<strong>Partial (amber)</strong>: Document requested, Callback requested, Referred — progress but no commitment yet.",
          "<strong>Negative (gray)</strong>: Declined, Wrong contact, No proper contact — the call did not achieve its goal.",
          "<strong>Restricted (red)</strong>: Do not call again — a legal restriction requiring exact words.",
        ],
      },
      {
        heading: "Suggested outcome",
        body: "The close panel shows a suggested outcome based on what you recorded. You can override it, but the suggestion helps ensure consistency.",
      },
      {
        heading: "Early endings",
        body: "You can end the call at any stage using the 'End call' button. The outcome will reflect the last stage reached. Calls ending before Stage 8 are marked 'Ended early'.",
      },
    ],
  },
  {
    id: "saving-retrieving",
    title: "Saving and Retrieving Records",
    content: [
      {
        heading: "Automatic saving",
        body: "Every stage change, outcome selection, and text entry is saved to the backend automatically. If the save fails, you'll see a 'Not saved' indicator with a Retry button.",
      },
      {
        heading: "Call history",
        body: "After closing a call, you see a summary with the outcome, stage reached, and next step. The History page lists your past calls, and each one opens a detail view with its stage results. The call ID of an in-progress call is stored in your browser so you can resume it.",
      },
      {
        heading: "Resuming in-progress calls",
        body: "If you close the tab during a call, your call ID is saved locally. When you return to the workspace, it restores the call automatically. Click 'Retry loading' if it does not.",
      },
      {
        heading: "Data retention",
        body: "Call records are stored in PostgreSQL (Supabase) with Row Level Security. Only the API role can access them. There is no automatic deletion — contact support for data removal requests.",
      },
    ],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting Common Errors",
    content: [
      {
        heading: "Server warming up",
        body: "On the free tier, the backend may sleep after inactivity. You'll see a 'Warming up the server…' banner. It polls /health every 3 seconds and enables 'Start call' when ready. This can take up to a minute.",
      },
      {
        heading: "Database unavailable",
        body: "If the database connection fails, you'll see 'The call service is unavailable.' This usually means the Supabase connection needs attention. Check that the CA certificate is in place and the DATABASE_URL is correct.",
      },
      {
        heading: "Stage not saved",
        body: "If a stage shows 'Not saved', click the Retry button next to the status indicator. Your data is still in the browser — nothing is lost.",
      },
      {
        heading: "Cannot close call",
        body: "If 'Save and end call' is disabled, check: you've selected an outcome, and for outcomes requiring next-step details (time, channel, person), those fields are filled. For Do Not Call, Stage 6 must have the 'Asked not to be called again' outcome and their exact words.",
      },
      {
        heading: "Do Not Call blocked",
        body: "If starting a call fails with 'This prospect has requested no further calls', a previous call with this name and company has a Do Not Call outcome. This is enforced at the database level.",
      },
    ],
  },
] as const;

export default function HelpPage() {
  return (
    <>
      <section className="section section--dark" aria-labelledby="help-heading">
        <div className="container">
          <header className="max-w-3xl mx-auto text-center mb-16">
            <h1 id="help-heading" className="heading-1 text-cream-50 mb-6">
              Help & Guide
            </h1>
            <p className="body-lg text-espresso-700">
              Everything you need to know to use Callframe effectively. Click a section to jump directly.
            </p>
          </header>

          <nav className="mb-12" aria-label="Help sections">
            <ul className="flex flex-wrap justify-center gap-2">
              {helpSections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="btn btn--secondary btn--sm"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-16 max-w-4xl mx-auto">
            {helpSections.map((section) => (
              <article key={section.id} id={section.id} className="space-y-8">
                <header className="pb-4 border-b border-espresso-300">
                  <h2 className="heading-2 text-cream-50">{section.title}</h2>
                </header>
                <div className="space-y-6 pt-6">
                  {section.content.map((item, index) => (
                    <div key={index} className="space-y-3">
                      <h3 className="heading-3 text-cream-50">{item.heading}</h3>
                      <div className="prose prose-espresso max-w-none">
                        <p className="body text-espresso-700">{item.body}</p>
                        {(item as { list?: readonly string[] }).list && (
                          <ul className="list-disc list-inside space-y-2 mt-3 text-espresso-700">
                            {(item as { list?: readonly string[] }).list!.map((li, liIndex) => (
                              <li key={liIndex} className="body">{li}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="cta-heading">
        <div className="container text-center">
          <h2 id="cta-heading" className="heading-2 text-espresso-100 mb-4">
            Ready to make a call?
          </h2>
          <p className="body-lg text-espresso-500 mb-8">
            Apply what you&apos;ve learned in the workspace.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/workspace" className="btn btn--primary btn--lg">
              Start a Call
            </Link>
            <Link href="/how-it-works" className="btn btn--secondary btn--lg">
              See the Workflow
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
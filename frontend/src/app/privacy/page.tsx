import Link from "next/link";
import LastUpdated from "./LastUpdated";

export default function PrivacyPage() {
  return (
    <>
      <section className="section section--dark" aria-labelledby="privacy-heading">
        <div className="container">
          <header className="max-w-3xl mx-auto text-center mb-16">
            <h1 id="privacy-heading" className="heading-1 text-cream-50 mb-6">
              Privacy Policy
            </h1>
            <p className="body-lg text-espresso-700">
              Last updated: <LastUpdated />
            </p>
            <p className="mt-4 p-4 rounded-lg bg-ochre-50 border border-ochre-200 text-ochre-800 body-sm">
              This policy describes the actual data practices of the Callframe application as implemented. It does not make claims
              about practices that are not currently in the codebase. Placeholder contact details require owner input.
            </p>
          </header>

          <div className="max-w-3xl mx-auto space-y-12">
            <section>
              <h2 className="heading-3 text-cream-50 mb-4">1. Information We Collect</h2>
              <p className="body text-espresso-700 mb-4">
                Callframe collects only the information you explicitly enter into the application:
              </p>
              <ul className="space-y-3 text-espresso-700">
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>Prospect details:</strong> Name (required), company (required), role (optional) — entered when starting a call.</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>Stage outcomes:</strong> Which outcome button you select at each of the eight stages.</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>Prospect words:</strong> Verbatim statements you record in the &ldquo;Their words&rdquo; field at each stage (up to 4,000 characters per stage).</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>Caller notes:</strong> Your interpretations and context in the &ldquo;Your note&rdquo; field at each stage (up to 4,000 characters per stage).</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>Next-step details:</strong> Channel, time, person, or other details for the agreed next step (when applicable).</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>Call metadata:</strong> Start time, end time, last stage reached, final outcome, and Do Not Call status.</li>
              </ul>
              <p className="mt-4 body text-espresso-700">
                The application does <strong>not</strong> collect: audio recordings, live transcriptions, keystroke logs, IP addresses beyond standard server logs,
                browser fingerprints, location data, or any information from third-party sources.
              </p>
            </section>

            <section>
              <h2 className="heading-3 text-cream-50 mb-4">2. How Information Is Stored</h2>
              <p className="body text-espresso-700 mb-4">
                All call data is persisted in a PostgreSQL database hosted on Supabase:
              </p>
              <ul className="space-y-3 text-espresso-700">
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>Database:</strong> Supabase (PostgreSQL) with Row Level Security enabled on all tables.</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>Tables:</strong> <code className="bg-espresso-100 px-1 rounded font-mono text-sm">calls</code>, <code className="bg-espresso-100 px-1 rounded font-mono text-sm">stage_results</code>, <code className="bg-espresso-100 px-1 rounded font-mono text-sm">ai_suggestions</code>.</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>Access control:</strong> The <code className="bg-espresso-100 px-1 rounded font-mono text-sm">anon</code> and <code className="bg-espresso-100 px-1 rounded font-mono text-sm">authenticated</code> roles have no grants. Only a dedicated API role (<code className="bg-espresso-100 px-1 rounded font-mono text-sm">callframe_api</code>) can read/write via the backend API.</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>Append-only revisions:</strong> Stage results are stored as immutable revisions (call_id, stage, revision) — edits create new revisions, preserving history.</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>Connection:</strong> TLS-encrypted connection using Supabase pooler with CA certificate verification.</li>
              </ul>
            </section>

            <section>
              <h2 className="heading-3 text-cream-50 mb-4">3. Frontend-Backend Communication</h2>
              <p className="body text-espresso-700 mb-4">
                The frontend (Next.js on Vercel) communicates with the backend (Express on Render) over HTTPS:
              </p>
              <ul className="space-y-3 text-espresso-700">
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>API base URL:</strong> Configured via <code className="bg-espresso-100 px-1 rounded font-mono text-sm">NEXT_PUBLIC_API_URL</code> (public, no secrets).</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>Endpoints used:</strong> <code className="bg-espresso-100 px-1 rounded font-mono text-sm">POST /api/calls</code>, <code className="bg-espresso-100 px-1 rounded font-mono text-sm">GET /api/calls/:id</code>, <code className="bg-espresso-100 px-1 rounded font-mono text-sm">PUT /api/calls/:id/stages/:stage</code>, <code className="bg-espresso-100 px-1 rounded font-mono text-sm">PATCH /api/calls/:id/progress</code>, <code className="bg-espresso-100 px-1 rounded font-mono text-sm">POST /api/calls/:id/close</code>, <code className="bg-espresso-100 px-1 rounded font-mono text-sm">GET /api/calls</code>.</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>CORS:</strong> Restricted to the exact frontend origin (configured via <code className="bg-espresso-100 px-1 rounded font-mono text-sm">FRONTEND_ORIGIN</code>).</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>Request limits:</strong> JSON body limited to 50 KB; text fields limited to 4,000 characters.</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>No direct database access:</strong> The browser never connects to Supabase directly.</li>
              </ul>
            </section>

            <section>
              <h2 className="heading-3 text-cream-50 mb-4">4. External Services and Data Sharing</h2>
              <p className="body text-espresso-700 mb-4">
                The following external services may receive data:
              </p>
              <ul className="space-y-3 text-espresso-700">
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>Supabase:</strong> Stores all call records, stage results, and AI suggestions. Data resides in the configured PostgreSQL database.</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>Google Gemini API (optional):</strong> Only when <code className="bg-espresso-100 px-1 rounded font-mono text-sm">GEMINI_API_KEY</code> is configured in the backend environment AND the user explicitly clicks the &ldquo;Suggest what to say&rdquo; button. The request includes: prospect name/role/company, current stage, selected outcome, prospect words for that stage, caller notes, and Stage 5 words (if captured). The prospect&apos;s words are passed as delimited data, not instructions. The response is stored in <code className="bg-espresso-100 px-1 rounded font-mono text-sm">ai_suggestions</code> and never auto-inserted into any field. <strong>Hard block:</strong> If the call has a Do Not Call outcome or Stage 6 &ldquo;asked_not_to_call&rdquo;, the request is blocked server-side and the model is not called.</li>
              </ul>
              <p className="mt-4 body text-espresso-700">
                No other third parties receive data. The Service does not sell, rent, or share personal information for advertising or marketing.
              </p>
            </section>

            <section>
              <h2 className="heading-3 text-cream-50 mb-4">5. Data Retention and Deletion</h2>
              <p className="body text-espresso-700 mb-3">
                Current implementation:
              </p>
              <ul className="space-y-3 text-espresso-700">
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>No automatic deletion:</strong> Call records are retained indefinitely unless manually removed.</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>No user-facing deletion:</strong> The current UI does not provide a delete button for call records.</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>Correction:</strong> You can edit stage data during an in-progress call. After closing, records are immutable (revision history is preserved).</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>Data removal requests:</strong> Contact support (see Section 8) to request deletion of specific records.</li>
              </ul>
              <p className="mt-3 body-sm text-espresso-500">
                Note: A formal retention policy and automated deletion are not yet implemented. This is a known limitation.
              </p>
            </section>

            <section>
              <h2 className="heading-3 text-cream-50 mb-4">6. Security Measures</h2>
              <p className="body text-espresso-700 mb-3">
                Implemented measures:
              </p>
              <ul className="space-y-3 text-espresso-700">
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>TLS everywhere:</strong> Frontend (Vercel) and backend (Render) enforce HTTPS. Database connection uses TLS with CA certificate verification.</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>Secrets management:</strong> <code className="bg-espresso-100 px-1 rounded font-mono text-sm">DATABASE_URL</code>, <code className="bg-espresso-100 px-1 rounded font-mono text-sm">GEMINI_API_KEY</code>, <code className="bg-espresso-100 px-1 rounded font-mono text-sm">APP_ACCESS_CODE</code> exist only in backend environment variables (Render). Frontend receives only <code className="bg-espresso-100 px-1 rounded font-mono text-sm">NEXT_PUBLIC_API_URL</code>.</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>Least-privilege database role:</strong> API uses a restricted role, not the project owner or service role.</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>Row Level Security:</strong> Enabled on all tables; public roles have no access.</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>Input validation:</strong> All endpoints validate UUIDs, stage bounds (1–8), outcome keys, text lengths (≤4,000), and JSON size (≤50 KB). Parameterized queries only.</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>Rate limiting:</strong> In-memory limit on AI assist endpoint (configured per-client).</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>Logging:</strong> Server logs contain method, path, status, and call IDs — never prospect words, notes, or API keys.</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>Optional access code:</strong> If <code className="bg-espresso-100 px-1 rounded font-mono text-sm">APP_ACCESS_CODE</code> is set, all API requests require it via header.</li>
              </ul>
              <p className="mt-3 body-sm text-espresso-500">
                The Service does not currently implement: end-to-end encryption, automated penetration testing, SOC 2 compliance, or a bug bounty program.
              </p>
            </section>

            <section>
              <h2 className="heading-3 text-cream-50 mb-4">7. Personal Data and Special Categories</h2>
              <p className="body text-espresso-700 mb-3">
                The data you enter may constitute personal data under GDPR and similar laws:
              </p>
              <ul className="space-y-3 text-espresso-700">
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>Prospect names, roles, companies:</strong> Personal data. You are the data controller for this information.</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>Prospect words and notes:</strong> May contain special category data (e.g., health, political opinions) if the prospect volunteers it. You are responsible for ensuring lawful basis.</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>Contact details in notes:</strong> Email addresses or phone numbers entered in notes/next-step fields are stored as plain text.</li>
              </ul>
              <p className="mt-3 body text-espresso-700">
                For the demonstration using fictional transcript data, no real personal data is processed.
              </p>
            </section>

            <section>
              <h2 className="heading-3 text-cream-50 mb-4">8. Your Rights and Controls</h2>
              <p className="body text-espresso-700 mb-3">
                Current capabilities:
              </p>
              <ul className="space-y-3 text-espresso-700">
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>Access:</strong> View your call records in the workspace after closing a call. List all calls via <code className="bg-espresso-100 px-1 rounded font-mono text-sm">GET /api/calls</code>.</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>Rectification:</strong> Edit stage data during an in-progress call. After closing, records are immutable.</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>Deletion:</strong> Not available in UI. Contact support to request removal.</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>Portability:</strong> Export via API (<code className="bg-espresso-100 px-1 rounded font-mono text-sm">GET /api/calls/:id</code> returns full call with all stage revisions).</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" /><strong>AI opt-out:</strong> Do not click &ldquo;Suggest what to say&rdquo; if you don&apos;t want data sent to Gemini. Do Not Call calls automatically block AI.</li>
              </ul>
            </section>

            <section>
              <h2 className="heading-3 text-cream-50 mb-4">9. Children&apos;s Privacy</h2>
              <p className="body text-espresso-700">
                The Service is not intended for users under 18. We do not knowingly collect personal information from children.
                If you believe a child has provided data, contact us to have it removed.
              </p>
            </section>

            <section>
              <h2 className="heading-3 text-cream-50 mb-4">10. Changes to This Policy</h2>
              <p className="body text-espresso-700 mb-3">
                We may update this policy to reflect changes in the codebase or legal requirements. The &ldquo;Last updated&rdquo; date will change.
                Continued use constitutes acceptance.
              </p>
            </section>

            <section>
              <h2 className="heading-3 text-cream-50 mb-4">11. Contact Information</h2>
              <p className="body text-espresso-700">
                For privacy questions, data access, or deletion requests:
              </p>
              <address className="not-italic body text-espresso-700 mt-3">
                [COMPANY NAME PLACEHOLDER]<br />
                [ADDRESS PLACEHOLDER]<br />
                Email: privacy@callframe.example
              </address>
            </section>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="cta-heading">
        <div className="container text-center">
          <h2 id="cta-heading" className="heading-2 text-espresso-100 mb-4">
            Ready to make a call?
          </h2>
          <p className="body-lg text-espresso-500 mb-8">
            Your data stays yours. Start a call in the workspace.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/workspace" className="btn btn--primary btn--lg">
              Start a Call
            </Link>
            <Link href="/terms" className="btn btn--secondary btn--lg">
              Read Terms & Conditions
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
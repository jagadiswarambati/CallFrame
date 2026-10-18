import Link from "next/link";
import LastUpdated from "./LastUpdated";

export default function TermsPage() {
  return (
    <>
      <section className="section section--dark" aria-labelledby="terms-heading">
        <div className="container">
          <header className="max-w-3xl mx-auto text-center mb-16">
            <h1 id="terms-heading" className="heading-1 text-cream-50 mb-6">
              Terms & Conditions
            </h1>
            <p className="body-lg text-espresso-700">
              Last updated: <LastUpdated />
            </p>
            <p className="mt-4 p-4 rounded-lg bg-ochre-50 border border-ochre-200 text-ochre-800 body-sm">
              <strong>Important:</strong> This is a draft document requiring legal review. Placeholder company details, contact information, and jurisdiction references must be replaced with actual information before use. This document does not constitute legal advice.
            </p>
          </header>

          <div className="max-w-3xl mx-auto space-y-12">
            <section>
              <h2 className="heading-3 text-cream-50 mb-4">1. Acceptance of Terms</h2>
              <p className="body text-espresso-700">
                By accessing or using Callframe (&ldquo;the Service&rdquo;), you agree to be bound by these Terms & Conditions (&ldquo;Terms&rdquo;).
                If you do not agree to these Terms, do not use the Service.
              </p>
            </section>

            <section>
              <h2 className="heading-3 text-cream-50 mb-4">2. Description of Service</h2>
              <p className="body text-espresso-700">
                Callframe is a browser-based workspace for guiding and recording phone calls. It provides a structured eight-stage framework,
                captures prospect statements and caller notes, and stores call records. The Service does not make phone calls, record audio,
                transcribe conversations, or function as a CRM. You are responsible for making the actual phone calls separately.
              </p>
            </section>

            <section>
              <h2 className="heading-3 text-cream-50 mb-4">3. User Responsibilities</h2>
              <ul className="space-y-3 text-espresso-700">
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" />You are solely responsible for all information you enter into the Service, including prospect names, company details, and call notes.</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" />You must ensure that all data entered is accurate and that you have the right to record and store it.</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" />You must comply with all applicable laws and regulations when making calls and recording information.</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" />You are responsible for maintaining the confidentiality of your account and call records.</li>
              </ul>
            </section>

            <section>
              <h2 className="heading-3 text-cream-50 mb-4">4. Accuracy of Entered Information</h2>
              <p className="body text-espresso-700 mb-3">
                You represent that all information you enter is truthful and accurate to the best of your knowledge.
                The Service does not verify the accuracy of prospect details, call notes, or outcomes.
              </p>
              <p className="body text-espresso-700">
                You acknowledge that logged outcomes in the Service may not match the actual conversation, and you are responsible for
                ensuring your records reflect what actually occurred.
              </p>
            </section>

            <section>
              <h2 className="heading-3 text-cream-50 mb-4">5. Compliance with Calling Laws and Do Not Call Restrictions</h2>
              <p className="body text-espresso-700 mb-3">
                You are solely responsible for complying with all applicable telemarketing, telecommunications, and data protection laws,
                including but not limited to:
              </p>
              <ul className="space-y-2 text-espresso-700">
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" />National and local Do Not Call registries</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" />Telephone Consumer Protection Act (TCPA) and similar regulations</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" />General Data Protection Regulation (GDPR) and similar privacy laws</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" />Any industry-specific calling regulations</li>
              </ul>
              <p className="mt-3 body text-espresso-700">
                The Service provides a &ldquo;Do Not Call&rdquo; outcome that blocks future calls to the same prospect name and company within the system.
                This is a system-level restriction and does not relieve you of your legal obligations to honor do-not-call requests across all channels.
              </p>
            </section>

            <section>
              <h2 className="heading-3 text-cream-50 mb-4">6. Respecting Refusals and Callback Preferences</h2>
              <p className="body text-espresso-700 mb-3">
                You must respect all prospect refusals and callback requests:
              </p>
              <ul className="space-y-2 text-espresso-700">
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" />If a prospect declines to talk, end the call politely and record the outcome as &ldquo;Declined&rdquo;.</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" />If a prospect requests a callback, record the specific time and honor it.</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" />If a prospect asks for information to be sent first, record the agreed channel and follow through.</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" />Do not pressure, mislead, or continue a conversation after a clear refusal.</li>
              </ul>
            </section>

            <section>
              <h2 className="heading-3 text-cream-50 mb-4">7. Responsibility for Follow-Up Actions</h2>
              <p className="body text-espresso-700">
                Any next steps agreed during a call (callbacks, meetings, document delivery, referrals) are your responsibility to execute.
                The Service records these commitments but does not automate, schedule, or guarantee their fulfillment.
              </p>
            </section>

            <section>
              <h2 className="heading-3 text-cream-50 mb-4">8. Service Availability and Limitations</h2>
              <ul className="space-y-3 text-espresso-700">
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" />The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind.</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" />We do not guarantee uninterrupted, timely, secure, or error-free access.</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" />The backend may experience cold starts on free-tier hosting, causing temporary delays.</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" />We may modify, suspend, or discontinue the Service at any time without notice.</li>
              </ul>
            </section>

            <section>
              <h2 className="heading-3 text-cream-50 mb-4">9. Third-Party Services</h2>
              <p className="body text-espresso-700 mb-3">
                The Service may integrate with or rely on third-party services including:
              </p>
              <ul className="space-y-2 text-espresso-700">
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" />Supabase (PostgreSQL database hosting)</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" />Vercel (frontend hosting)</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" />Render (backend hosting)</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" />Google Gemini API (optional AI suggestions — only when configured and explicitly invoked)</li>
              </ul>
              <p className="mt-3 body text-espresso-700">
                Your use of the Service constitutes acceptance of these third parties&apos; terms and privacy policies.
                We are not responsible for their availability, performance, or data practices.
              </p>
            </section>

            <section>
              <h2 className="heading-3 text-cream-50 mb-4">10. Intellectual Property</h2>
              <p className="body text-espresso-700">
                The Service, its original content, features, and functionality are owned by [COMPANY NAME PLACEHOLDER] and are protected
                by international copyright, trademark, and other intellectual property laws. You may not copy, modify, distribute, sell,
                or lease any part of the Service without written permission.
              </p>
            </section>

            <section>
              <h2 className="heading-3 text-cream-50 mb-4">11. Limitation of Liability</h2>
              <p className="body text-espresso-700 mb-3">
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:
              </p>
              <ul className="space-y-2 text-espresso-700">
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" />In no event shall [COMPANY NAME PLACEHOLDER], its directors, employees, or agents be liable for any indirect, incidental, special, consequential, or punitive damages.</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" />Total liability for any claim arising from the Service shall not exceed the amount paid by you, if any, in the 12 months preceding the claim.</li>
                <li className="body flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" />We are not liable for any loss of data, call records, or business opportunity resulting from use of the Service.</li>
              </ul>
              <p className="mt-3 body-sm text-espresso-500">
                Some jurisdictions do not allow the exclusion of certain warranties or limitation of liability, so the above may not apply to you.
              </p>
            </section>

            <section>
              <h2 className="heading-3 text-cream-50 mb-4">12. Indemnification</h2>
              <p className="body text-espresso-700">
                You agree to indemnify and hold harmless [COMPANY NAME PLACEHOLDER] and its officers, directors, employees, and agents
                from any claims, damages, losses, or expenses (including reasonable attorneys&apos; fees) arising from your use of the Service,
                your violation of these Terms, or your violation of any law or third-party rights.
              </p>
            </section>

            <section>
              <h2 className="heading-3 text-cream-50 mb-4">13. Changes to the Service and Terms</h2>
              <p className="body text-espresso-700 mb-3">
                We may modify these Terms at any time. Changes will be posted on this page with an updated &ldquo;Last updated&rdquo; date.
                Continued use of the Service after changes constitutes acceptance of the new Terms.
              </p>
              <p className="body text-espresso-700">
                We may also change, suspend, or discontinue any feature of the Service without prior notice.
              </p>
            </section>

            <section>
              <h2 className="heading-3 text-cream-50 mb-4">14. Governing Law and Jurisdiction</h2>
              <p className="body text-espresso-700">
                These Terms shall be governed by the laws of [JURISDICTION PLACEHOLDER], without regard to conflict of law principles.
                Any disputes shall be resolved in the courts of [JURISDICTION PLACEHOLDER].
              </p>
            </section>

            <section>
              <h2 className="heading-3 text-cream-50 mb-4">15. Contact Information</h2>
              <p className="body text-espresso-700">
                For questions about these Terms, contact:
              </p>
              <address className="not-italic body text-espresso-700 mt-3">
                [COMPANY NAME PLACEHOLDER]<br />
                [ADDRESS PLACEHOLDER]<br />
                Email: legal@callframe.example
              </address>
            </section>

            <section>
              <h2 className="heading-3 text-cream-50 mb-4">16. Severability and Waiver</h2>
              <p className="body text-espresso-700">
                If any provision is found unenforceable, the remaining provisions remain in effect. Failure to enforce any right
                does not constitute a waiver of that right.
              </p>
            </section>

            <section>
              <h2 className="heading-3 text-cream-50 mb-4">17. Entire Agreement</h2>
              <p className="body text-espresso-700">
                These Terms, together with the Privacy Policy, constitute the entire agreement between you and [COMPANY NAME PLACEHOLDER]
                regarding the Service.
              </p>
            </section>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="cta-heading">
        <div className="container text-center">
          <h2 id="cta-heading" className="heading-2 text-espresso-100 mb-4">
            Questions about our terms?
          </h2>
          <p className="body-lg text-espresso-500 mb-8">
            Contact our legal team at the address above.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/workspace" className="btn btn--primary btn--lg">
              Go to Workspace
            </Link>
            <Link href="/privacy" className="btn btn--secondary btn--lg">
              Read Privacy Policy
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
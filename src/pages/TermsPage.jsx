/**
 * TermsPage — /terms
 * Terms of Service for TaxLift SR&ED platform.
 */
import { useNavigate } from 'react-router-dom'
import { usePageMeta } from '../hooks/usePageMeta'
import { ArrowLeft } from 'lucide-react'
import TaxLiftLogo from '../components/TaxLiftLogo'

const EFFECTIVE_DATE = 'April 1, 2026'
const COMPANY        = 'TaxLift Inc.'
const EMAIL          = 'hello@taxlift.ai'
const WEBSITE        = 'https://taxlift.ai'

function Section({ title, children }) {
  return (
    <div className="mb-10">
      <h2 className="text-lg font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">{title}</h2>
      <div className="space-y-3 text-sm text-gray-600 leading-relaxed">{children}</div>
    </div>
  )
}

export default function TermsPage() {
  usePageMeta({
    title:       'Terms of Service — TaxLift',
    description: 'Terms of Service governing use of the TaxLift SR&ED tax credit automation platform.',
    path:        '/terms',
  })
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="w-full bg-red-600 text-center py-0.5">
        <span className="text-white text-xs font-medium tracking-wide">🇨🇦 Proudly Canadian — Built for Canadian founders</span>
      </div>
      {/* Nav */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="flex items-center">
            <TaxLiftLogo variant="light" size="sm" />
          </button>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-500">Terms of Service</span>
          <span className="ml-auto text-xs text-gray-400 font-medium">🇨🇦 Proudly Canadian</span>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-10">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-6 transition-colors">
            <ArrowLeft size={14} /> Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
          <p className="text-sm text-gray-500">
            Effective date: {EFFECTIVE_DATE} · {COMPANY} · <a href={`mailto:${EMAIL}`} className="text-indigo-600 hover:underline">{EMAIL}</a>
          </p>
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 leading-relaxed">
            <strong>Please read these terms carefully.</strong> By creating an account or using the TaxLift platform, you agree to be bound by these Terms of Service. If you do not agree, do not use the platform.
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-10">

          <Section title="1. About TaxLift">
            <p>{COMPANY} ("TaxLift", "we", "us", or "our") operates the TaxLift platform accessible at {WEBSITE} (the "Platform"). The Platform provides software tools to help Canadian businesses identify, document, and prepare Scientific Research and Experimental Development (SR&ED) tax credit claims under the Income Tax Act (Canada).</p>
            <p>TaxLift is a software tool, not a tax advisor, accountant, or legal counsel. The output of the Platform is intended to be reviewed and filed by a qualified CPA or SR&ED consultant. Nothing in the Platform constitutes tax advice.</p>
          </Section>

          <Section title="2. Eligibility and Accounts">
            <p>You must be at least 18 years old and have the legal authority to bind your organization to these Terms. By registering, you represent that you meet these requirements.</p>
            <p>You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. Notify us immediately at {EMAIL} if you suspect unauthorized access.</p>
            <p>We reserve the right to suspend or terminate accounts that violate these Terms or are used for fraudulent purposes.</p>
          </Section>

          <Section title="3. Fees and Payment">
            <p><strong>Flat-Fee Pricing.</strong> TaxLift charges a flat fee of $999 CAD per fiscal year for the SR&amp;ED Filing Package (end users). CPA Partner Seat pricing is provided upon request and confirmed in a written order form prior to activation. No percentage of your SR&amp;ED refund is taken. Current pricing is available at {WEBSITE}/pricing and is subject to change with 30 days' notice to existing customers.</p>
            <p><strong>Billing.</strong> The SR&amp;ED Filing Package is a one-time payment per fiscal year. The CPA Partner Seat is a recurring annual subscription managed through Stripe — your payment method will be charged automatically each year until you cancel. All amounts are in Canadian Dollars (CAD). Payments are processed by Stripe. By providing payment information, you authorize TaxLift to charge your payment method for the applicable fee.</p>
            <p><strong>Cancellation and Refunds.</strong> Fees paid for completed packages are non-refundable. CPA Partner Seat subscriptions may be cancelled at any time through the billing portal — access continues until the end of the current paid period and will not renew.</p>
          </Section>

          <Section title="4. Acceptable Use">
            <p>You agree to use the Platform only for lawful purposes and in accordance with these Terms. You must not:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Submit false, misleading, or fraudulent information for the purpose of inflating an SR&ED claim</li>
              <li>Attempt to circumvent or reverse-engineer any security feature of the Platform</li>
              <li>Use the Platform to process data relating to individuals without their consent</li>
              <li>Resell or sublicense access to the Platform without written consent from TaxLift</li>
              <li>Upload malicious code, viruses, or any content that could damage the Platform or other users</li>
              <li>Use automated scraping tools or bots to extract data from the Platform</li>
            </ul>
          </Section>

          <Section title="5. Your Data and Intellectual Property">
            <p><strong>Your Data.</strong> You retain ownership of all data, code, documents, and other content you upload to the Platform ("Your Data"). By uploading Your Data, you grant TaxLift a limited, non-exclusive, royalty-free licence to process Your Data solely for the purpose of providing the Platform services to you.</p>
            <p><strong>SR&ED Output.</strong> All T661 narratives, financial schedules, and supporting documents generated by the Platform from Your Data are owned by you. TaxLift does not claim any rights to your SR&ED claim output.</p>
            <p><strong>Platform IP.</strong> TaxLift owns all rights, title, and interest in the Platform, including all software, algorithms, interfaces, and branding. These Terms do not transfer any TaxLift intellectual property to you.</p>
            <p><strong>Feedback.</strong> If you provide suggestions or feedback about the Platform, TaxLift may use that feedback without restriction or compensation to you.</p>
          </Section>

          <Section title="6. Third-Party Integrations">
            <p>The Platform integrates with third-party services including GitHub, Atlassian/Jira, and Stripe. Your use of those services is governed by their own terms of service and privacy policies. TaxLift is not responsible for the data practices or service availability of third-party providers.</p>
            <p>When you connect a third-party account (e.g., GitHub), you authorize TaxLift to access that account with read-only permissions as described in our Privacy Policy. You can revoke these connections at any time through your account settings or the third-party provider's settings.</p>
          </Section>

          <Section title="7. CPA Partner Referral Fees">
            <p><strong>Flat Referral Commission.</strong> TaxLift pays verified CPA partners a flat referral commission of <strong>$300 CAD</strong> for each client they refer who completes a paid T661 package. The commission is the same regardless of the client's SR&ED credit size — no tiers, no caps. The current commission rate is available at {WEBSITE}/partners and is subject to change with 30 days' notice to enrolled partners.</p>
            <p><strong>Payment Timing.</strong> Referral fees are paid by electronic funds transfer (EFT) at the time the client's T661 package is delivered and the TaxLift platform fee is collected. Payment is not contingent on CRA review or approval of the claim and is not subject to true-up based on the final Notice of Assessment.</p>
            <p><strong>Independence.</strong> Referral fees are structured as flat compensation for client introduction services and are not calculated as a percentage of the SR&ED credit or CRA assessment. CPA partners are responsible for ensuring their participation in the TaxLift partner program complies with their applicable professional rules of conduct, including CPA Canada Rule 205 and any provincial equivalent.</p>
            <p><strong>Eligibility.</strong> Referral fees are payable only to CPA partners whose credentials have been verified by TaxLift and who have executed a Partner Agreement. Fees are forfeited for referrals involving fraudulent, ineligible, or improperly filed claims.</p>
          </Section>

          <Section title="8. CPA and Professional Advisor Use">
            <p>TaxLift produces CPA-ready documentation packages. CPAs and SR&ED consultants who access the Platform on behalf of their clients are responsible for independently verifying the accuracy and completeness of all output before filing with the Canada Revenue Agency (CRA).</p>
            <p>TaxLift does not guarantee that any SR&ED claim prepared using the Platform will be approved by CRA. CRA approval depends on the eligibility of your specific research and development activities and the accuracy of the information you provide.</p>
          </Section>

          <Section title="9. Disclaimers and Limitation of Liability">
            <p><strong>No Tax Advice.</strong> The Platform does not provide tax, legal, accounting, or financial advice. All output should be reviewed by a qualified professional before filing.</p>
            <p><strong>As-Is Service.</strong> THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.</p>
            <p><strong>Limitation of Liability.</strong> TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, TAXLIFT'S TOTAL LIABILITY TO YOU FOR ANY CLAIMS ARISING OUT OF OR RELATED TO THESE TERMS OR THE PLATFORM SHALL NOT EXCEED THE GREATER OF (A) THE TOTAL FEES PAID BY YOU TO TAXLIFT IN THE 12 MONTHS PRECEDING THE CLAIM, OR (B) $500 CAD.</p>
            <p><strong>Consequential Damages.</strong> IN NO EVENT SHALL TAXLIFT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES, INCLUDING LOST PROFITS, LOST REVENUE, OR LOSS OF DATA, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.</p>
          </Section>

          <Section title="10. Indemnification">
            <p>You agree to indemnify and hold harmless TaxLift, its officers, directors, employees, and agents from any claims, losses, damages, liabilities, and expenses (including reasonable legal fees) arising out of: (a) your use of the Platform; (b) Your Data; (c) your violation of these Terms; or (d) your violation of any law or the rights of a third party.</p>
          </Section>

          <Section title="11. Privacy">
            <p>Your use of the Platform is also governed by our Privacy Policy, available at {WEBSITE}/privacy, which is incorporated into these Terms by reference.</p>
          </Section>

          <Section title="12. Modifications to Terms">
            <p>We may update these Terms from time to time. We will notify you of material changes by email or by posting a notice on the Platform at least 14 days before the changes take effect. Your continued use of the Platform after the effective date of any changes constitutes acceptance of the updated Terms.</p>
          </Section>

          <Section title="13. Termination">
            <p>TaxLift may suspend or terminate your access to the Platform at any time, with or without cause, with reasonable notice. Upon termination, you may export Your Data for 30 days, after which it will be deleted in accordance with our Privacy Policy.</p>
            <p>You may terminate your account at any time by contacting {EMAIL}. Termination does not entitle you to a refund of any prepaid fees.</p>
          </Section>

          <Section title="14. Governing Law and Disputes">
            <p>These Terms are governed by the laws of the Province of Ontario and the federal laws of Canada applicable therein, without regard to conflict of law principles.</p>
            <p>Any dispute arising out of or relating to these Terms or the Platform shall first be attempted to be resolved through good-faith negotiation. If negotiation fails, disputes shall be resolved by binding arbitration in Toronto, Ontario, under the rules of the ADR Institute of Canada, except that either party may seek injunctive relief in a court of competent jurisdiction.</p>
          </Section>

          <Section title="15. General">
            <p><strong>Entire Agreement.</strong> These Terms, together with our Privacy Policy, constitute the entire agreement between you and TaxLift regarding the Platform.</p>
            <p><strong>Severability.</strong> If any provision of these Terms is found unenforceable, the remaining provisions will continue in full force.</p>
            <p><strong>Waiver.</strong> Failure to enforce any provision of these Terms does not constitute a waiver of that provision.</p>
            <p><strong>Assignment.</strong> You may not assign your rights under these Terms without TaxLift's prior written consent. TaxLift may assign its rights in connection with a merger, acquisition, or sale of assets.</p>
          </Section>

          <Section title="16. Contact">
            <p>Questions about these Terms? Contact us at:</p>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mt-2">
              <p className="font-semibold text-gray-900">{COMPANY}</p>
              <p>Email: <a href={`mailto:${EMAIL}`} className="text-indigo-600 hover:underline">{EMAIL}</a></p>
              <p>Website: <a href={WEBSITE} className="text-indigo-600 hover:underline" target="_blank" rel="noopener noreferrer">{WEBSITE}</a></p>
            </div>
          </Section>

        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          © {new Date().getFullYear()} {COMPANY} · <button onClick={() => navigate('/privacy')} className="text-indigo-500 hover:underline">Privacy Policy</button>
        </p>
      </div>
    </div>
  )
}

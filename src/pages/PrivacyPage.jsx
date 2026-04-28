/**
 * PrivacyPage — /privacy
 * Privacy Policy for TaxLift SR&ED platform.
 * PIPEDA-compliant for Canadian operations.
 */
import { useNavigate } from 'react-router-dom'
import { usePageMeta } from '../hooks/usePageMeta'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import TaxLiftLogo from '../components/TaxLiftLogo'

const EFFECTIVE_DATE = 'April 1, 2026'
const COMPANY        = 'TaxLift Inc.'
const EMAIL          = 'privacy@taxlift.ai'
const WEBSITE        = 'https://taxlift.ai'

function Section({ title, children }) {
  return (
    <div className="mb-10">
      <h2 className="text-lg font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">{title}</h2>
      <div className="space-y-3 text-sm text-gray-600 leading-relaxed">{children}</div>
    </div>
  )
}

const DATA_TABLE = [
  { category: 'Account data', examples: 'Name, email, company name, role', purpose: 'Account creation, authentication, billing', retained: 'Duration of account + 90 days after deletion' },
  { category: 'GitHub data', examples: 'Commit messages, file names, timestamps, branch names', purpose: 'SR&ED activity identification and T661 narrative generation', retained: 'Duration of subscription + 7 years (CRA audit window)' },
  { category: 'Jira/Atlassian data', examples: 'Ticket summaries, worklog hours, story points, sprint names', purpose: 'SR&ED eligible time quantification', retained: 'Duration of subscription + 7 years (CRA audit window)' },
  { category: 'Financial data', examples: 'SR&ED eligible expenditures, salary data you enter', purpose: 'T661 financial schedule and credit calculation', retained: '7 years (CRA statutory retention period)' },
  { category: 'Billing data', examples: 'Subscription tier, billing date', purpose: 'Subscription management', retained: '7 years (tax purposes)' },
  { category: 'Payment card data', examples: 'Not stored by TaxLift', purpose: 'Processed and stored by Stripe, Inc.', retained: 'Stripe\'s retention policy applies' },
  { category: 'Usage data', examples: 'Pages visited, features used, browser type', purpose: 'Product improvement, support', retained: '24 months' },
  { category: 'Communications', examples: 'Support emails, feedback', purpose: 'Support and product improvement', retained: '3 years' },
]

export default function PrivacyPage() {
  usePageMeta({
    title:       'Privacy Policy — TaxLift',
    description: 'Privacy Policy describing how TaxLift collects, uses, and protects your data. PIPEDA compliant.',
    path:        '/privacy',
  })
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="flex items-center">
            <TaxLiftLogo variant="light" size="sm" />
          </button>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-500">Privacy Policy</span>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-10">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-6 transition-colors">
            <ArrowLeft size={14} /> Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-500">
            Effective date: {EFFECTIVE_DATE} · {COMPANY} · <a href={`mailto:${EMAIL}`} className="text-indigo-600 hover:underline">{EMAIL}</a>
          </p>

          {/* Trust badges */}
          <div className="flex flex-wrap gap-3 mt-5">
            {[
              'PIPEDA Compliant',
              'Data stored in Canada (AWS ca-central-1)',
              'AES-256 encryption at rest',
              'TLS 1.3 in transit',
              'Read-only OAuth scopes',
            ].map(badge => (
              <div key={badge} className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-medium rounded-full px-3 py-1">
                <ShieldCheck size={11} /> {badge}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-10">

          <Section title="1. Who We Are">
            <p>{COMPANY} ("TaxLift", "we", "us", or "our") operates the TaxLift platform at {WEBSITE}. We help Canadian businesses identify and document SR&ED (Scientific Research and Experimental Development) activities to support tax credit claims under the Income Tax Act (Canada).</p>
            <p>This Privacy Policy explains what personal information we collect, how we use it, and your rights regarding that information. It applies to all users of the TaxLift platform, including company administrators, developers, and CPA partners.</p>
          </Section>

          <Section title="2. Legal Basis — PIPEDA">
            <p>We collect and process personal information in accordance with Canada's <em>Personal Information Protection and Electronic Documents Act</em> (PIPEDA) and applicable provincial privacy legislation. We collect only the information necessary to provide our services and obtain your consent where required.</p>
          </Section>

          <Section title="3. Information We Collect">
            <p>We collect information in three ways: information you provide directly, information from third-party integrations you authorize, and information collected automatically.</p>

            {/* Data table */}
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="text-left px-3 py-2 font-semibold">Category</th>
                    <th className="text-left px-3 py-2 font-semibold">Examples</th>
                    <th className="text-left px-3 py-2 font-semibold">Purpose</th>
                    <th className="text-left px-3 py-2 font-semibold">Retained</th>
                  </tr>
                </thead>
                <tbody>
                  {DATA_TABLE.map((row, i) => (
                    <tr key={row.category} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="px-3 py-2 font-medium text-gray-900 align-top">{row.category}</td>
                      <td className="px-3 py-2 text-gray-600 align-top">{row.examples}</td>
                      <td className="px-3 py-2 text-gray-600 align-top">{row.purpose}</td>
                      <td className="px-3 py-2 text-gray-600 align-top">{row.retained}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-3"><strong>What we do NOT collect:</strong> We do not collect source code content. GitHub integration reads commit metadata only (message, timestamp, author, files changed). We never read file contents, private keys, or environment variables.</p>
          </Section>

          <Section title="4. How We Use Your Information">
            <p>We use your information to:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Provide, operate, and improve the TaxLift platform</li>
              <li>Generate SR&ED T661 narratives and financial schedules from your connected data sources</li>
              <li>Process payments and manage your subscription via Stripe</li>
              <li>Send transactional emails (account confirmations, package completion notifications, CPA handoff links)</li>
              <li>Send educational email sequences about SR&ED (you may opt out at any time)</li>
              <li>Respond to support requests and inquiries</li>
              <li>Comply with legal obligations, including CRA information requests where required by law</li>
              <li>Detect and prevent fraud, abuse, or unauthorized access</li>
            </ul>
            <p><strong>We do not sell your personal information.</strong> We do not use your data to train AI models for third parties. We do not share your SR&ED data with any party other than those listed below.</p>
          </Section>

          <Section title="5. How We Share Your Information">
            <p>We share your information only in the following circumstances:</p>
            <p><strong>CPA Partners:</strong> If you use the CPA handoff feature, we share your T661 package and evidence summary with the CPA you designate. You control which CPA receives access and may revoke access at any time.</p>
            <p><strong>Service Providers:</strong> We use trusted third-party providers to operate the platform:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Stripe, Inc.</strong> — payment processing (governed by Stripe's Privacy Policy)</li>
              <li><strong>Amazon Web Services (AWS ca-central-1)</strong> — cloud infrastructure and data storage, located in Canada</li>
              <li><strong>Anthropic, PBC</strong> — AI-powered narrative generation (commit metadata and Jira summaries only; not source code)</li>
              <li><strong>Railway / Vercel</strong> — application hosting</li>
            </ul>
            <p>All service providers are bound by data processing agreements that prohibit them from using your data for any purpose other than providing services to TaxLift.</p>
            <p><strong>Legal Requirements:</strong> We may disclose information if required by law, court order, or governmental authority, including CRA audits. We will notify you of any such request to the extent permitted by law.</p>
            <p><strong>Business Transfers:</strong> If TaxLift is acquired or merges with another company, your information may be transferred as part of that transaction. We will notify you before your information is transferred and becomes subject to a different privacy policy.</p>
          </Section>

          <Section title="6. Data Storage and Security">
            <p><strong>Location.</strong> All customer data is stored on AWS servers located in the Canada (Central) region (ca-central-1), ensuring your data remains in Canada.</p>
            <p><strong>Encryption.</strong> Data is encrypted at rest using AES-256 and in transit using TLS 1.3. SR&ED evidence documents in the audit vault are encrypted at the file level.</p>
            <p><strong>Access Controls.</strong> Access to customer data is restricted to TaxLift employees and contractors who require it to perform their duties. All access is logged and reviewed.</p>
            <p><strong>Security Program.</strong> TaxLift is pursuing SOC 2 Type II certification. In the meantime, we conduct annual security reviews and penetration testing.</p>
            <p><strong>Breach Notification.</strong> In the event of a data breach affecting your personal information, we will notify you and the Office of the Privacy Commissioner of Canada (OPC) within 72 hours of becoming aware of the breach, as required by PIPEDA.</p>
          </Section>

          <Section title="7. Third-Party OAuth Access">
            <p>When you connect GitHub or Jira, TaxLift requests the minimum scopes required:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>GitHub:</strong> <code className="bg-gray-100 px-1 rounded text-xs">repo:read</code> — read access to repositories and commit history. We never read file contents or private data beyond commit metadata.</li>
              <li><strong>Atlassian/Jira:</strong> <code className="bg-gray-100 px-1 rounded text-xs">read:jira-work</code> — read access to issues and worklogs. We do not access Jira admin settings or user management.</li>
            </ul>
            <p>You can revoke these connections at any time from your Integrations settings, or directly from GitHub/Atlassian's authorized apps settings. Revoking access stops future data collection; previously collected data is retained per the schedule in Section 3.</p>
          </Section>

          <Section title="8. Cookies and Tracking">
            <p>We use cookies and similar technologies to operate the platform and improve your experience. We use:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Essential cookies:</strong> Required for authentication and session management. Cannot be disabled.</li>
              <li><strong>Analytics cookies:</strong> Used to understand how the platform is used (anonymized). You may opt out through your browser settings.</li>
            </ul>
            <p>We do not use advertising or tracking cookies. We do not participate in third-party ad networks.</p>
          </Section>

          <Section title="9. Your Rights Under PIPEDA">
            <p>As a Canadian resident, you have the following rights regarding your personal information:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Access:</strong> Request a copy of the personal information we hold about you</li>
              <li><strong>Correction:</strong> Request correction of inaccurate or incomplete information</li>
              <li><strong>Deletion:</strong> Request deletion of your personal information, subject to our legal retention obligations</li>
              <li><strong>Withdrawal of Consent:</strong> Withdraw consent for non-essential data processing at any time</li>
              <li><strong>Complaint:</strong> Lodge a complaint with the Office of the Privacy Commissioner of Canada (OPC) at <a href="https://www.priv.gc.ca" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">priv.gc.ca</a></li>
            </ul>
            <p>To exercise any of these rights, contact us at <a href={`mailto:${EMAIL}`} className="text-indigo-600 hover:underline">{EMAIL}</a>. We will respond within 30 days.</p>
          </Section>

          <Section title="10. Data Retention and Deletion">
            <p>We retain your personal information for as long as your account is active or as needed to provide services. SR&ED evidence data is retained for 7 years from the date of filing, matching CRA's audit window, even after account closure.</p>
            <p>Upon account deletion, we remove your personal profile and non-SR&ED data within 90 days. SR&ED claim data is anonymized after the 7-year retention period.</p>
          </Section>

          <Section title="11. Children's Privacy">
            <p>The TaxLift platform is intended for business use by adults. We do not knowingly collect personal information from anyone under the age of 18. If you believe a minor has provided us with personal information, contact us at {EMAIL} and we will delete it promptly.</p>
          </Section>

          <Section title="12. Changes to This Policy">
            <p>We may update this Privacy Policy from time to time. We will notify you of material changes by email or by posting a notice in the platform at least 14 days before the changes take effect. The effective date at the top of this policy reflects the date of the most recent update.</p>
          </Section>

          <Section title="13. Contact — Privacy Officer">
            <p>For privacy inquiries, data requests, or to exercise your rights under PIPEDA, contact our Privacy Officer:</p>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mt-2">
              <p className="font-semibold text-gray-900">{COMPANY} — Privacy Officer</p>
              <p>Email: <a href={`mailto:${EMAIL}`} className="text-indigo-600 hover:underline">{EMAIL}</a></p>
              <p>Response time: Within 30 days</p>
              <p className="mt-2 text-xs text-gray-500">If you are not satisfied with our response, you may file a complaint with the Office of the Privacy Commissioner of Canada at <a href="https://www.priv.gc.ca/en/report-a-concern/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">priv.gc.ca</a>.</p>
            </div>
          </Section>

        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          © {new Date().getFullYear()} {COMPANY} · <button onClick={() => navigate('/terms')} className="text-indigo-500 hover:underline">Terms of Service</button>
        </p>
      </div>
    </div>
  )
}

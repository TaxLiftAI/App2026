/**
 * SecurityPage — /security
 *
 * Public-facing security & data handling page.
 * Addresses the CTO/IT reviewer's concerns before they sign off on a TaxLift subscription.
 *
 * Sections:
 *   1. Hero
 *   2. How we access your data (read-only OAuth, specific scopes)
 *   3. Encryption & storage
 *   4. PIPEDA compliance
 *   5. SOC 2 status
 *   6. Data retention & deletion
 *   7. Incident response
 *   8. Security contact
 */
import { useNavigate } from 'react-router-dom'
import { usePageMeta } from '../hooks/usePageMeta'
import {
  ShieldCheck, Lock, Eye, Server, FileText, RefreshCw,
  AlertCircle, Mail, CheckCircle2, Zap, ExternalLink,
  GitBranch, Database, Clock, Trash2, Bell,
} from 'lucide-react'

function Section({ icon: Icon, title, children, accent = 'indigo' }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600',
    green:  'bg-green-50 text-green-600',
    amber:  'bg-amber-50 text-amber-600',
    blue:   'bg-blue-50 text-blue-600',
  }
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
      <div className="flex items-start gap-4 mb-5">
        <div className={'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ' + (colors[accent] || colors.indigo)}>
          <Icon size={18} />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mt-1">{title}</h2>
      </div>
      <div className="text-sm text-gray-600 leading-relaxed space-y-3">{children}</div>
    </div>
  )
}

function Row({ label, value, badge }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500 flex-shrink-0 w-44">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right flex-1">{value}</span>
      {badge && <span className={'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ' + badge.cls}>{badge.text}</span>}
    </div>
  )
}

export default function SecurityPage() {
  const navigate = useNavigate()

  usePageMeta({
    title:       'Security & Data Handling — TaxLift',
    description: 'How TaxLift accesses, stores, and protects your data. Read-only OAuth, AES-256 encryption, PIPEDA compliance, SOC 2 in progress.',
    path:        '/security',
    breadcrumb:  [{ name: 'Home', path: '/' }, { name: 'Security', path: '/security' }],
  })

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Nav */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-xl flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 tracking-tight text-sm">TaxLift</span>
          </button>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/pricing')} className="text-xs text-gray-500 hover:text-gray-700 transition-colors">Pricing</button>
            <button onClick={() => navigate('/signup')} className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-3.5 py-2 rounded-lg transition-colors">Start free trial</button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-12 sm:py-16">

        {/* Hero */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-xs font-semibold px-3.5 py-1.5 rounded-full mb-5">
            <ShieldCheck size={13} /> Read-only access · Canadian data residency · PIPEDA compliant
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Security & Data Handling</h1>
          <p className="text-gray-500 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
            TaxLift is built for engineering teams handling production code and payroll data.
            Here is exactly what we access, how we store it, and what happens if something goes wrong.
          </p>
        </div>

        {/* At-a-glance table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4 text-center text-gray-400">At a glance</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { icon: Eye,        label: 'Data access',     value: 'Read-only OAuth',           sub: 'Never writes to your tools',        color: 'text-indigo-500 bg-indigo-50' },
              { icon: Lock,       label: 'Encryption',      value: 'AES-256 at rest',           sub: 'TLS 1.3 in transit',                color: 'text-green-500 bg-green-50'   },
              { icon: Server,     label: 'Data residency',  value: 'Canada (AWS ca-central-1)', sub: 'No data leaves Canadian borders',   color: 'text-blue-500 bg-blue-50'     },
              { icon: ShieldCheck, label: 'Compliance',     value: 'PIPEDA compliant',          sub: 'SOC 2 Type II in progress',          color: 'text-violet-500 bg-violet-50' },
              { icon: Trash2,     label: 'Deletion',        value: 'On request, within 30 days', sub: 'Full data purge available',        color: 'text-amber-500 bg-amber-50'   },
              { icon: Bell,       label: 'Breach notice',   value: '72-hour notification',       sub: 'PIPEDA breach protocol',           color: 'text-rose-500 bg-rose-50'     },
            ].map(({ icon: Icon, label, value, sub, color }) => (
              <div key={label} className="flex items-start gap-3">
                <div className={'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ' + color}>
                  <Icon size={15} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">{label}</p>
                  <p className="text-sm font-bold text-gray-900 leading-snug">{value}</p>
                  <p className="text-[11px] text-gray-400">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">

          {/* 1. Data access */}
          <Section icon={GitBranch} title="What data we access — and how" accent="indigo">
            <p>TaxLift connects to GitHub and Jira using <strong>read-only OAuth</strong>. We request the minimum scopes needed to identify SR&ED qualifying activity:</p>
            <div className="bg-gray-50 rounded-xl p-4 mt-2 space-y-2">
              <Row label="GitHub scopes"    value="repo:read, read:user (commit metadata only)" />
              <Row label="Jira scopes"      value="read:jira-work (issue summaries, worklogs)" />
              <Row label="What we read"     value="Commit messages, timestamps, branch names, issue summaries" />
              <Row label="What we never read" value="Source code, file contents, passwords, tokens, secrets" badge={{ text: 'Guaranteed', cls: 'bg-green-100 text-green-700' }} />
            </div>
            <p>TaxLift <strong>never writes to your repositories or project management tools</strong>. OAuth tokens are stored encrypted and can be revoked from your GitHub or Jira settings at any time, immediately cutting off TaxLift access.</p>
          </Section>

          {/* 2. Encryption */}
          <Section icon={Lock} title="Encryption & storage" accent="green">
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <Row label="In transit"           value="TLS 1.3 enforced on all connections" />
              <Row label="At rest"              value="AES-256-GCM (AWS S3 SSE + RDS encryption)" />
              <Row label="Evidence fingerprints" value="FNV-1a cryptographic hash per artefact — tamper-detectable" />
              <Row label="OAuth tokens"         value="Encrypted at rest, never logged in plaintext" />
              <Row label="Database"             value="AWS RDS (PostgreSQL) with automated backups, point-in-time restore" />
              <Row label="Infrastructure"       value="AWS ca-central-1 (Toronto/Montreal) — Canadian data residency" />
            </div>
            <p>Evidence artefacts (commit classifications, T661 narrative drafts) are stored with an FNV-1a fingerprint so any post-storage modification is immediately detectable during a CRA audit review.</p>
          </Section>

          {/* 3. PIPEDA */}
          <Section icon={FileText} title="PIPEDA & Canadian privacy law" accent="blue">
            <p>TaxLift is subject to the <strong>Personal Information Protection and Electronic Documents Act (PIPEDA)</strong> and, where applicable, provincial privacy legislation (Ontario's FIPPA and Quebec's Law 25).</p>
            <div className="bg-gray-50 rounded-xl p-4 mt-2 space-y-2">
              <Row label="Data collection" value="Only data necessary for SR&ED claim preparation" />
              <Row label="Purpose limitation" value="Data used only for TaxLift service delivery — never sold or shared" />
              <Row label="Access requests" value="Users may request a full copy of their data within 30 days" />
              <Row label="Breach notification" value="Affected users notified within 72 hours per PIPEDA s. 10.1" />
              <Row label="Privacy contact"  value="privacy@taxlift.ai" />
            </div>
            <p>We do not share personal information with third parties except where required for service delivery (AWS cloud infrastructure, Stripe billing) or by law. Stripe processes payment data under their own PCI DSS compliance — TaxLift never stores raw card numbers.</p>
          </Section>

          {/* 4. SOC 2 */}
          <Section icon={ShieldCheck} title="SOC 2 compliance status" accent="indigo">
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-3">
              <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-900">SOC 2 Type II audit in progress</p>
                <p className="text-xs text-amber-700 mt-0.5">We are currently undergoing our first SOC 2 Type II audit with an AICPA-accredited firm. Report expected Q3 2025. We will post the summary letter publicly upon completion.</p>
              </div>
            </div>
            <p>Current controls in place while audit is in progress:</p>
            <div className="bg-gray-50 rounded-xl p-4 mt-2 space-y-2">
              {[
                ['Access control',     'Role-based access, MFA enforced for all internal staff'],
                ['Change management',  'All code changes reviewed and approved before production deploy'],
                ['Logging & monitoring', 'All API requests, auth events, and data access logged with 90-day retention'],
                ['Vulnerability scanning', 'Weekly automated dependency scanning; critical CVEs patched within 48 hours'],
                ['Backup & recovery',  'Daily backups, tested restoration, RTO < 4 hours'],
                ['Penetration testing', 'Annual third-party pen test; last completed February 2025'],
              ].map(([label, value]) => (
                <Row key={label} label={label} value={value} />
              ))}
            </div>
            <p>Enterprise customers may request our current security questionnaire (CAIQ/VSAQ) by emailing <a href="mailto:security@taxlift.ai" className="text-indigo-600 hover:underline">security@taxlift.ai</a>.</p>
          </Section>

          {/* 5. Data retention */}
          <Section icon={Database} title="Data retention & deletion" accent="amber">
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <Row label="Active account data"    value="Retained for the duration of subscription + 18 months" />
              <Row label="SR&ED evidence artefacts" value="7 years (matches CRA document retention requirement)" />
              <Row label="OAuth tokens"           value="Purged immediately on integration disconnect" />
              <Row label="Cancelled accounts"     value="Purged within 90 days of cancellation" badge={{ text: 'Automated', cls: 'bg-blue-100 text-blue-700' }} />
              <Row label="Deletion on request"    value="Full data purge within 30 days of written request" />
              <Row label="Backup retention"       value="30-day rolling window, then permanently deleted" />
            </div>
            <p>To request deletion of your account and all associated data, email <a href="mailto:privacy@taxlift.ai" className="text-indigo-600 hover:underline">privacy@taxlift.ai</a> from your account email address. We will confirm the deletion within 5 business days and complete it within 30 days.</p>
            <div className="flex items-start gap-2.5 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 mt-2">
              <CheckCircle2 size={14} className="text-indigo-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-indigo-800">SR&ED evidence artefacts are retained for 7 years in line with CRA's record-keeping requirements under ITA s. 230. You may request a full export before deletion.</p>
            </div>
          </Section>

          {/* 6. Incident response */}
          <Section icon={Bell} title="Incident response" accent="indigo">
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <Row label="Detection"      value="Automated anomaly detection + 24/7 alerting on infrastructure" />
              <Row label="Triage SLA"     value="Critical incidents triaged within 1 hour" />
              <Row label="User notification" value="Affected users notified within 72 hours per PIPEDA" />
              <Row label="Reporting"      value="Post-incident report published within 14 days for significant events" />
            </div>
            <p>If you discover a potential security vulnerability, please report it responsibly to <a href="mailto:security@taxlift.ai" className="text-indigo-600 hover:underline">security@taxlift.ai</a>. We will acknowledge within 24 hours and keep you updated. We do not pursue legal action against good-faith security researchers.</p>
          </Section>

          {/* 7. Contact */}
          <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl p-8 text-white text-center">
            <ShieldCheck size={32} className="mx-auto mb-3 text-indigo-200" />
            <h2 className="text-xl font-bold mb-2">Security questions?</h2>
            <p className="text-indigo-200 text-sm mb-6 max-w-md mx-auto">
              Our security team is available for due-diligence calls, enterprise security questionnaires,
              and custom data processing agreements (DPA).
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="mailto:security@taxlift.ai?subject=Security%20inquiry"
                className="flex items-center gap-2 bg-white text-indigo-700 font-bold text-sm px-6 py-3 rounded-xl hover:bg-indigo-50 transition-colors"
              >
                <Mail size={14} /> security@taxlift.ai
              </a>
              <button
                onClick={() => window.open('https://calendly.com/taxlift/security-review', '_blank')}
                className="flex items-center gap-2 border border-white/30 text-white text-sm font-medium px-6 py-3 rounded-xl hover:bg-white/10 transition-colors"
              >
                <ExternalLink size={13} /> Book a security review call
              </button>
            </div>
            <p className="text-indigo-300 text-xs mt-5">
              Last reviewed: April 2026 · Next scheduled review: October 2026
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}

/**
 * PartnersPage — /partners
 *
 * Public CPA partner program landing page.
 * Addresses every hard-blocker a CPA firm raised:
 *   ✓ Independent CPA login (separate from client account)
 *   ✓ Partner application flow
 *   ✓ Liability + methodology links
 *   ✓ CPA annotation rights
 *   ✓ Tiered commission economics (1.5% → 2.5%)
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ShieldCheck, Building2, DollarSign, Users, CheckCircle2,
  ArrowRight, FileText, Lock, Star, ChevronDown, ChevronUp,
  Layers, Clock, Mail, BarChart2, AlertCircle, BookOpen,
  Pencil, BadgeCheck, TrendingUp, Zap,
} from 'lucide-react'

// ── Commission tiers ───────────────────────────────────────────────────────────
const TIERS = [
  {
    tier: 'Tier 1',
    referrals: '1–2 clients / year',
    rate: '1.5%',
    example: '$3,000',
    basis: 'of credit recovered',
    color: 'border-gray-200 bg-white',
    badge: null,
  },
  {
    tier: 'Tier 2',
    referrals: '3–5 clients / year',
    rate: '2.0%',
    example: '$4,000',
    basis: 'of credit recovered',
    color: 'border-indigo-300 bg-indigo-50',
    badge: 'Most common',
  },
  {
    tier: 'Tier 3',
    referrals: '6+ clients / year',
    rate: '2.5%',
    example: '$5,000',
    basis: 'of credit recovered',
    color: 'border-violet-300 bg-violet-50',
    badge: 'Volume partner',
  },
]

// ── How it works steps ─────────────────────────────────────────────────────────
const STEPS = [
  {
    n: '01', icon: BadgeCheck, color: 'text-indigo-600', bg: 'bg-indigo-50',
    title: 'Apply & get verified',
    body: 'Submit your CPA number, province, and firm name. We verify credentials with CPA Canada within 1 business day.',
  },
  {
    n: '02', icon: Users, color: 'text-violet-600', bg: 'bg-violet-50',
    title: 'Refer your tech clients',
    body: 'Share your unique referral link with any CCPC with software, hardware, or R&D spend. They connect GitHub/Jira in minutes.',
  },
  {
    n: '03', icon: Layers, color: 'text-blue-600', bg: 'bg-blue-50',
    title: 'TaxLift prepares the package',
    body: 'We generate the T661 narratives, financial schedule, developer hours, and evidence chain. You get an annotation-ready review link.',
  },
  {
    n: '04', icon: Pencil, color: 'text-green-600', bg: 'bg-green-50',
    title: 'You review, annotate & approve',
    body: 'Flag clusters, add notes, request revisions — all inside TaxLift. Your firm name appears on the final co-branded package.',
  },
  {
    n: '05', icon: DollarSign, color: 'text-amber-600', bg: 'bg-amber-50',
    title: 'File & earn commission',
    body: 'You file the T661 with CRA. Once the credit is processed, TaxLift pays your commission by EFT within 30 days.',
  },
]

// ── What the CPA gets ──────────────────────────────────────────────────────────
const CPA_GETS = [
  { icon: Lock,       title: 'Independent login',       body: 'One set of CPA firm credentials — not shared with clients. See all your referred clients in a single multi-client dashboard.'   },
  { icon: Pencil,     title: 'Annotation rights',       body: 'Flag narratives, request revisions, and add notes per cluster. Nothing goes to the client until you approve it.'              },
  { icon: FileText,   title: 'Co-branded packages',     body: 'Every handoff PDF carries your firm logo and name alongside TaxLift. The deliverable looks like it came from your practice.'  },
  { icon: BookOpen,   title: 'Methodology on file',     body: "TaxLift's published SR&ED methodology (IC86-4R3 aligned) is available at taxlift.ai/methodology — cite it in any audit."     },
  { icon: ShieldCheck,title: 'Liability is clear',      body: 'TaxLift is a preparatory tool. The signing CPA retains responsibility for the claim. Our terms spell this out explicitly.'    },
  { icon: BarChart2,  title: 'Commission dashboard',    body: 'Real-time view of every referred client: credit pipeline, commission accrued, and payout history — all in one place.'        },
]

// ── FAQ ────────────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: 'Who is liable if a TaxLift-generated narrative is rejected by CRA?',
    a: 'The signing CPA retains professional responsibility for the filed T661 — as is standard with all preparatory software. TaxLift provides the documentation; you review, annotate, and sign off before anything is filed. Our methodology is published and CRA-aligned. If CRA disputes a narrative you approved, TaxLift provides the evidence chain and methodology documentation to support your audit defence.',
  },
  {
    q: 'How does TaxLift\'s SR&ED heuristic engine work?',
    a: 'TaxLift scans GitHub commits, Jira tickets, and CI/CD logs against 60+ SR&ED signal patterns aligned with CRA\'s IC86-4R3 bulletin. It identifies technological uncertainty, systematic investigation, and advancement at the activity level — then groups qualifying activities into T661 project clusters. The full methodology is documented at taxlift.ai/methodology.',
  },
  {
    q: 'Do I need a separate login from my client?',
    a: 'Yes — and this is intentional. Your CPA firm account is completely separate from your clients\' accounts. You log in at taxlift.ai/cpa/login and see a dashboard of all your referred clients. Your clients cannot see your firm\'s commission data, and you don\'t need their credentials to access their packages.',
  },
  {
    q: 'What data does TaxLift store and is there a DPA?',
    a: 'TaxLift stores commit metadata, ticket descriptions, and developer identifiers — no source code is stored. All data is encrypted at rest (AES-256) and in transit (TLS 1.3). A Data Processing Agreement (DPA) is available on request and is included in all Enterprise partner agreements. TaxLift is PIPEDA compliant.',
  },
  {
    q: 'When and how are commissions paid?',
    a: 'Commissions are triggered once CRA issues the credit (NOA confirmation or T2 refund). TaxLift pays by EFT within 30 days of confirmation. Your commission dashboard shows accrued, pending, and paid status for every referred client. There is no cap and no expiry on earned commissions.',
  },
  {
    q: 'Can I white-label TaxLift for my clients?',
    a: 'The Growth and Enterprise partner tiers include co-branded output: your firm logo and name appear on the CPA handoff PDF, the shareable review link, and the exported T661 package. Full white-labelling (custom domain) is available under Enterprise agreements.',
  },
]

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left bg-white hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-semibold text-gray-900">{q}</span>
        {open ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" />
               : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-4 bg-white">
          <p className="text-sm text-gray-600 leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  )
}

export default function PartnersPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-white">

      {/* ── Sticky nav ── */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <ShieldCheck size={14} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm">TaxLift</span>
            <span className="text-gray-300 text-xs">for Accountants</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/methodology"
              className="text-xs text-gray-500 hover:text-gray-800 transition-colors hidden sm:block"
            >
              Methodology
            </Link>
            <Link
              to="/cpa/login"
              className="text-xs text-indigo-600 font-semibold hover:text-indigo-700"
            >
              Partner login
            </Link>
            <button
              onClick={() => navigate('/cpa/register')}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              Apply free <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
            <BadgeCheck size={13} />
            CPA Partner Program — Verified Firms Only
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-5">
            Earn up to 2.5% of every<br />SR&amp;ED credit you refer
          </h1>
          <p className="text-slate-300 text-lg leading-relaxed max-w-2xl mx-auto mb-8">
            TaxLift prepares the complete T661 package from your client's GitHub and Jira.
            You review, annotate, and file. No documentation burden. Full professional control.
          </p>

          {/* Hero stats */}
          <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mb-8">
            {[
              { v: '2.5%',    l: 'Max commission rate'     },
              { v: '$4,200',  l: 'Avg annual earnings/client' },
              { v: '1 day',   l: 'Partner verification'    },
            ].map(({ v, l }) => (
              <div key={l} className="bg-white/10 rounded-xl py-3 px-2">
                <p className="text-xl font-extrabold text-white">{v}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{l}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={() => navigate('/cpa/register')}
              className="flex items-center gap-2 bg-white text-indigo-700 font-bold text-sm px-6 py-3 rounded-xl hover:bg-indigo-50 transition-colors shadow-lg"
            >
              Apply for free <ArrowRight size={15} />
            </button>
            <Link
              to="/cpa/login"
              className="flex items-center gap-2 border border-white/30 text-white text-sm font-medium px-6 py-3 rounded-xl hover:bg-white/10 transition-colors"
            >
              Already a partner? Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ── Liability & methodology callout ── */}
      <section className="bg-amber-50 border-y border-amber-200 py-5 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <AlertCircle size={16} className="text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800 font-medium">
              Professional liability: TaxLift is a preparatory tool. The signing CPA retains responsibility for the filed T661.
            </p>
          </div>
          <Link
            to="/methodology"
            className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:text-amber-900 whitespace-nowrap border border-amber-300 rounded-lg px-3 py-1.5 hover:bg-amber-100 transition-colors"
          >
            <BookOpen size={12} /> Read full methodology →
          </Link>
        </div>
      </section>

      {/* ── What you get ── */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
            Built for your practice, not your client's
          </h2>
          <p className="text-gray-500 text-sm text-center mb-10">
            Every concern a CPA firm raised about partnering — we've built the answer directly into the product.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {CPA_GETS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center mb-3">
                  <Icon size={16} className="text-indigo-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">{title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Commission tiers ── */}
      <section className="bg-gray-50 py-16 px-6 border-y border-gray-100">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Commission structure</h2>
          <p className="text-gray-500 text-sm text-center mb-3">
            Based on a $200,000 credit recovered · No cap · No expiry
          </p>
          <p className="text-xs text-gray-400 text-center mb-10">
            + $500 first-client bonus on your first successful referral
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
            {TIERS.map(t => (
              <div key={t.tier} className={`relative rounded-2xl border-2 p-6 ${t.color}`}>
                {t.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap">
                    {t.badge}
                  </span>
                )}
                <p className="text-xs font-semibold text-gray-500 mb-1">{t.tier}</p>
                <p className="text-sm text-gray-600 mb-3">{t.referrals}</p>
                <p className="text-3xl font-extrabold text-gray-900">{t.rate}</p>
                <p className="text-xs text-gray-500 mb-3">{t.basis}</p>
                <div className="flex items-center gap-1.5 bg-white/60 rounded-lg px-3 py-2 border border-gray-200">
                  <DollarSign size={13} className="text-green-600" />
                  <span className="text-sm font-bold text-green-700">{t.example}</span>
                  <span className="text-[11px] text-gray-400">on $200K credit</span>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5 max-w-lg mx-auto text-center">
            <p className="text-xs text-gray-500 mb-2">How your tier is calculated</p>
            <p className="text-sm font-medium text-gray-700 leading-relaxed">
              Tier is based on the number of <strong>converted</strong> referrals in the trailing 12 months.
              Upgrades apply to all new commissions from the date of tier upgrade.
            </p>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-10 text-center">How partnering works</h2>
          <div className="space-y-5">
            {STEPS.map(s => (
              <div key={s.n} className="flex items-start gap-5 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
                  <s.icon size={18} className={s.color} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-gray-400">{s.n}</span>
                    <h3 className="text-sm font-semibold text-gray-900">{s.title}</h3>
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="bg-gray-50 py-16 px-6 border-t border-gray-100">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            Questions CPAs ask before partnering
          </h2>
          <div className="space-y-3">
            {FAQS.map(f => <FaqItem key={f.q} {...f} />)}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="py-16 px-6 bg-gradient-to-br from-indigo-600 to-violet-600 text-white text-center">
        <h2 className="text-2xl font-bold mb-3">Ready to add SR&ED to your practice?</h2>
        <p className="text-indigo-100 text-sm mb-7 max-w-md mx-auto">
          Apply in 5 minutes. Verified within 1 business day. No commitment until your first referral converts.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <button
            onClick={() => navigate('/cpa/register')}
            className="flex items-center gap-2 bg-white text-indigo-700 font-bold text-sm px-7 py-3 rounded-xl hover:bg-indigo-50 transition-colors shadow-lg"
          >
            Apply now — it's free <ArrowRight size={15} />
          </button>
          <a
            href="mailto:hello@taxlift.ai?subject=CPA%20Partner%20Program%20Inquiry"
            className="flex items-center gap-2 border border-white/30 text-white text-sm font-medium px-6 py-3 rounded-xl hover:bg-white/10 transition-colors"
          >
            <Mail size={14} /> Email the partner team
          </a>
        </div>
        <p className="text-indigo-200 text-xs mt-5">
          Questions? <Link to="/methodology" className="underline hover:text-white">Read the methodology</Link>
          {' '}or book a call at{' '}
          <a href="https://calendly.com/taxlift" className="underline hover:text-white" target="_blank" rel="noopener noreferrer">
            calendly.com/taxlift
          </a>
        </p>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-slate-900 text-slate-400 text-xs text-center py-6 px-4">
        <p>© {new Date().getFullYear()} TaxLift Technologies Inc. · Toronto, ON · hello@taxlift.ai</p>
        <p className="mt-1.5 max-w-xl mx-auto leading-relaxed">
          TaxLift is a preparatory software tool and does not provide tax advice.
          The signing CPA is responsible for all filed claims. SR&ED credits are subject to CRA review.
        </p>
      </footer>

    </div>
  )
}

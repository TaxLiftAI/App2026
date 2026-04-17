/**
 * PartnersPage — /partners
 *
 * Public CPA partner program landing page.
 * Addresses every hard-blocker a CPA firm raised:
 *   ✓ Independent CPA login (separate from client account)
 *   ✓ Partner application flow
 *   ✓ Liability + methodology links
 *   ✓ CPA annotation rights
 *   ✓ Flat $300 referral commission per client (no tiers)
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePageMeta } from '../hooks/usePageMeta'
import {
  ShieldCheck, Building2, DollarSign, Users, CheckCircle2,
  ArrowRight, FileText, Lock, Star, ChevronDown, ChevronUp,
  Layers, Clock, Mail, BarChart2, AlertCircle, BookOpen,
  Pencil, BadgeCheck, TrendingUp, Zap, Loader2,
} from 'lucide-react'

const PROVINCES = [
  'AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT',
]
const HEARD_OPTIONS = [
  'Google search', 'LinkedIn', 'Referral from a colleague',
  'Accounting association', 'Conference / event', 'Other',
]

// ── Commission stats ───────────────────────────────────────────────────────────
const COMMISSION_STATS = [
  { label: 'Referral commission',            value: '$300',     sub: 'flat per client — no tiers'           },
  { label: 'Break-even',                     value: '16',       sub: 'referrals/yr to cover seat cost'      },
  { label: 'Paid at package delivery',       value: 'Day 0',    sub: 'not when CRA processes — no wait'     },
]

// ── Why TaxLift (non-revenue reasons) ─────────────────────────────────────────
const WHY_TAXLIFT = [
  {
    icon: Users,
    color: 'text-indigo-600', bg: 'bg-indigo-50',
    title: 'Your client relationship stays yours',
    body: 'Traditional SR&ED consultants go direct — and eventually cut the CPA out. TaxLift is structurally different: you have your own login, annotation rights, and your firm name on every client-facing document. Your clients never see a TaxLift sales page, sign-up flow, or pricing. The tool is yours to offer.',
  },
  {
    icon: Clock,
    color: 'text-violet-600', bg: 'bg-violet-50',
    title: 'Turn 60–80 hours into 2–3',
    body: 'T661 documentation from memory takes weeks. TaxLift generates it from 100% of your client\'s GitHub commits automatically. You review, annotate, and approve — nothing more. That means you can service 5× the SR&ED clients with the same team.',
  },
  {
    icon: ShieldCheck,
    color: 'text-blue-600', bg: 'bg-blue-50',
    title: 'A stronger audit defence',
    body: 'CRA is increasingly scrutinising T661 narratives. A claim backed by a commit-level SHA-256 audit trail is harder to dispute than one reconstructed from memory. Every TaxLift package includes a methodology document aligned with IC86-4R3 — cite it in any CRA review.',
  },
  {
    icon: TrendingUp,
    color: 'text-emerald-600', bg: 'bg-emerald-50',
    title: 'Win tech mandates competitors can\'t',
    body: 'A CPA who can say "I have a platform that scans 100% of your GitHub commits and prepares your T661 same-day" wins tech company engagements that accountants using spreadsheets cannot. SR&ED is often the foot in the door that becomes a 10-year audit relationship.',
  },
  {
    icon: Lock,
    color: 'text-amber-600', bg: 'bg-amber-50',
    title: 'Professional liability is clear',
    body: 'TaxLift is a preparatory tool — you retain responsibility for the filed T661, exactly as you do with any preparation software. Our published methodology (IC86-4R3 aligned) is available at taxlift.ai/methodology. You review and approve before anything goes to the client.',
  },
  {
    icon: Star,
    color: 'text-rose-600', bg: 'bg-rose-50',
    title: 'A differentiated service your clients notice',
    body: 'Same-day T661 drafts, commit-level evidence chains, and a co-branded handoff PDF your client can actually read — this is a materially better deliverable than a manually-drafted narrative. CPAs who use TaxLift routinely hear "I didn\'t know my accountant could do this."',
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
    body: 'Flag clusters, add notes, request revisions — all inside your partner portal. The final package PDF shows your firm name and logo. "Powered by TaxLift" is a footer note — your client sees your firm\'s deliverable.',
  },
  {
    n: '05', icon: DollarSign, color: 'text-amber-600', bg: 'bg-amber-50',
    title: 'File & earn your referral fee',
    body: 'You file the T661 with CRA. Your flat referral fee is paid by EFT at T661 package delivery — before CRA even receives the claim. No waiting 12–18 months. The fee is fixed and not contingent on CRA outcome.',
  },
]

// ── What the CPA gets ──────────────────────────────────────────────────────────
const CPA_GETS = [
  { icon: Lock,       title: 'Independent login',       body: 'One set of CPA firm credentials — not shared with clients. See all your referred clients in a single multi-client dashboard.'   },
  { icon: Pencil,     title: 'Annotation rights',       body: 'Flag narratives, request revisions, and add notes per cluster. Nothing goes to the client until you approve it.'              },
  { icon: FileText,   title: 'Your-firm-branded deliverables', body: 'Your firm name and logo are front and centre on every handoff PDF and T661 package. "Powered by TaxLift" appears only in the footer — your clients receive a document that looks like it came entirely from you.' },
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
    q: 'When and how are referral fees paid?',
    a: 'Referral commissions are $300 flat per client — no tiers, no caps, no true-up. Payment is by EFT at T661 package delivery — before CRA even receives the claim, so you\'re not waiting 12–18 months for CRA to process. The commission is not contingent on the CRA assessment outcome.',
  },
  {
    q: 'Will my clients know they\'re using TaxLift, or does it look like my firm\'s service?',
    a: 'Your clients receive a document that looks like it came entirely from your practice. Your firm name and logo are the primary branding on every handoff PDF and T661 export. "Powered by TaxLift" appears only as a small footer attribution — similar to how audit software appears in notes. Your clients do not interact with TaxLift\'s sign-up flow, pricing pages, or marketing. The CPA portal is a separate, partner-only environment your clients never see. For full custom-domain white-labelling (your own URL, no TaxLift footer), contact us about an Enterprise agreement.',
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

// ── Partner contact / intake form section ─────────────────────────────────────
function PartnerContactSection({ navigate }) {
  const [showForm, setShowForm]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent]           = useState(false)
  const [formError, setFormError] = useState('')

  const EMPTY = { name: '', firm: '', designation: '', province: '', sred_clients: '', heard: '' }
  const [fields, setFields] = useState(EMPTY)

  function set(k, v) { setFields(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!fields.name || !fields.firm || !fields.designation || !fields.province) {
      setFormError('Please fill in all required fields.')
      return
    }
    setSubmitting(true); setFormError('')
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/v1/leads`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:             fields.name,
          email:            `${fields.firm.toLowerCase().replace(/\s+/g, '')}@partner.inquiry`,
          company:          fields.firm,
          source:           'partner_application',
          message:          [
            `CPA Designation: ${fields.designation}`,
            `Province: ${fields.province}`,
            `SR&ED clients: ${fields.sred_clients || 'Not specified'}`,
            `How they heard: ${fields.heard || 'Not specified'}`,
          ].join(' | '),
        }),
      })
      if (!res.ok) throw new Error('Server error')
      setSent(true)
    } catch {
      setFormError('Something went wrong — please email us at hello@taxlift.ai instead.')
    } finally { setSubmitting(false) }
  }

  return (
    <section className="py-16 px-6 bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-2xl font-bold mb-3">Ready to add SR&amp;ED to your practice?</h2>
        <p className="text-indigo-100 text-sm mb-7 max-w-md mx-auto">
          Apply in 5 minutes. Verified within 1 business day. No commitment until your first referral converts.
        </p>

        <div className="flex items-center justify-center gap-3 flex-wrap mb-7">
          <button
            onClick={() => navigate('/cpa/register')}
            className="flex items-center gap-2 bg-white text-indigo-700 font-bold text-sm px-7 py-3 rounded-xl hover:bg-indigo-50 transition-colors shadow-lg"
          >
            Apply now — it's free <ArrowRight size={15} />
          </button>
          {!sent && (
            <button
              onClick={() => setShowForm(v => !v)}
              className="flex items-center gap-2 border border-white/30 text-white text-sm font-medium px-6 py-3 rounded-xl hover:bg-white/10 transition-colors"
            >
              <Mail size={14} />
              {showForm ? 'Hide form' : 'Contact the partner team'}
            </button>
          )}
        </div>

        {/* Inline contact form */}
        {!sent && showForm && (
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 text-left">
            <h3 className="text-base font-semibold text-white mb-4">Tell us about your practice</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-indigo-100 mb-1">Full name *</label>
                  <input
                    type="text" required
                    value={fields.name} onChange={e => set('name', e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full bg-white/20 border border-white/30 text-white placeholder:text-indigo-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-indigo-100 mb-1">Firm name *</label>
                  <input
                    type="text" required
                    value={fields.firm} onChange={e => set('firm', e.target.value)}
                    placeholder="Smith & Associates CPA"
                    className="w-full bg-white/20 border border-white/30 text-white placeholder:text-indigo-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-indigo-100 mb-1">CPA designation *</label>
                  <input
                    type="text" required
                    value={fields.designation} onChange={e => set('designation', e.target.value)}
                    placeholder="CPA, CA / CPA, CGA…"
                    className="w-full bg-white/20 border border-white/30 text-white placeholder:text-indigo-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-indigo-100 mb-1">Province *</label>
                  <select
                    required
                    value={fields.province} onChange={e => set('province', e.target.value)}
                    className="w-full bg-white/20 border border-white/30 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
                  >
                    <option value="" className="text-gray-800">Select…</option>
                    {PROVINCES.map(p => <option key={p} value={p} className="text-gray-800">{p}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-indigo-100 mb-1">SR&amp;ED clients today</label>
                  <select
                    value={fields.sred_clients} onChange={e => set('sred_clients', e.target.value)}
                    className="w-full bg-white/20 border border-white/30 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
                  >
                    <option value="" className="text-gray-800">Select…</option>
                    {['0','1–3','4–10','11–25','26+'].map(o => <option key={o} value={o} className="text-gray-800">{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-indigo-100 mb-1">How did you hear?</label>
                  <select
                    value={fields.heard} onChange={e => set('heard', e.target.value)}
                    className="w-full bg-white/20 border border-white/30 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
                  >
                    <option value="" className="text-gray-800">Select…</option>
                    {HEARD_OPTIONS.map(o => <option key={o} value={o} className="text-gray-800">{o}</option>)}
                  </select>
                </div>
              </div>

              {formError && (
                <p className="text-xs text-red-200 flex items-center gap-1">
                  <AlertCircle size={12} /> {formError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-white text-indigo-700 font-bold text-sm py-2.5 rounded-xl hover:bg-indigo-50 transition-colors disabled:opacity-60"
              >
                {submitting ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : 'Send inquiry →'}
              </button>
            </form>
          </div>
        )}

        {/* Success state */}
        {sent && (
          <div className="bg-white/10 border border-white/20 rounded-2xl p-6 flex flex-col items-center gap-3">
            <CheckCircle2 size={32} className="text-emerald-300" />
            <p className="text-white font-semibold">Thanks! We'll be in touch within 1 business day.</p>
            <p className="text-indigo-200 text-xs">In the meantime, you can still <button onClick={() => navigate('/cpa/register')} className="underline hover:text-white">apply now</button> and get verified immediately.</p>
          </div>
        )}

        <p className="text-indigo-200 text-xs mt-5">
          Questions? <Link to="/methodology" className="underline hover:text-white">Read the methodology</Link>
          {' '}or book a call at{' '}
          <a href="https://calendly.com/taxlift" className="underline hover:text-white" target="_blank" rel="noopener noreferrer">
            calendly.com/taxlift
          </a>
        </p>
      </div>
    </section>
  )
}

export default function PartnersPage() {
  const navigate = useNavigate()
  usePageMeta({
    title:       'CPA Partner Program — TaxLift',
    description: 'Refer clients to TaxLift and earn $300 per SR&ED client — flat, no tiers, no caps. White-label ready, CPA-controlled, zero liability.',
    path:        '/partners',
    breadcrumb:  [{ name: 'Home', path: '/' }, { name: 'CPA Partners', path: '/partners' }],
  })

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
            Earn $300 per SR&amp;ED client<br />you refer — no tiers, no caps
          </h1>
          <p className="text-slate-300 text-lg leading-relaxed max-w-2xl mx-auto mb-8">
            TaxLift prepares the complete T661 package from your client's GitHub and Jira.
            You review, annotate, and file. No documentation burden. Full professional control.
            Flat $300 commission per client, paid at package delivery — not contingent on CRA outcome.
          </p>

          {/* Hero stats */}
          <div className="grid grid-cols-3 gap-2 max-w-lg mx-auto mb-8">
            {[
              { v: '$300',     l: 'Flat commission / client'     },
              { v: '$4,800',   l: 'CPA Partner Seat / year'      },
              { v: '1 day',    l: 'Partner verification'         },
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

      {/* ── White-label clarity section ── */}
      <section className="py-14 px-6 bg-indigo-950">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold px-4 py-1.5 rounded-full mb-4">
              <FileText size={12} /> What your clients actually see
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">
              Your firm's name on every deliverable.
              <span className="text-indigo-400"> Not TaxLift's.</span>
            </h2>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">
              "Powered by TaxLift" appears only as a small footer note — the way audit software is
              credited in financial statements. Your clients expect your firm's work product, and
              that's exactly what they get.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {/* What clients see */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                <CheckCircle2 size={12} /> What your clients see
              </p>
              <ul className="space-y-3">
                {[
                  'Your firm name & logo on the T661 handoff PDF cover page',
                  'Your name as the reviewing practitioner on each narrative',
                  'Your firm\'s email and contact in the package footer',
                  'A shareable review link sent from your branded portal',
                  'No TaxLift pricing pages, sign-up flows, or sales emails to your client',
                ].map(item => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-slate-300">
                    <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* What clients don't see */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                <Lock size={12} className="text-slate-500" /> What your clients don't see
              </p>
              <ul className="space-y-3">
                {[
                  'TaxLift\'s sign-up or login screens',
                  'Our pricing pages or commission structure',
                  'Any marketing or upsell communication from TaxLift',
                  'Your partner portal or commission dashboard',
                  'Anything that positions TaxLift as a direct competitor to your firm',
                ].map(item => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-slate-400">
                    <span className="w-3.5 h-3.5 rounded-full border border-slate-600 flex-shrink-0 mt-0.5 flex items-center justify-center">
                      <span className="w-1 h-1 rounded-full bg-slate-500" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-white/5 border border-indigo-500/30 rounded-2xl px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-9 h-9 bg-indigo-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Zap size={16} className="text-indigo-400" />
            </div>
            <div className="flex-1">
              <p className="text-white text-sm font-semibold mb-0.5">Need a fully custom-branded experience?</p>
              <p className="text-slate-400 text-xs leading-relaxed">
                Enterprise agreements include custom domain, fully suppressed TaxLift branding, and a
                white-label onboarding flow for your clients. <a href="mailto:hello@taxlift.ai" className="text-indigo-400 hover:text-indigo-300 underline">Contact us</a> to discuss.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why TaxLift (non-revenue) ── */}
      <section className="py-16 px-6 border-t border-gray-100">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
            More than a referral fee
          </h2>
          <p className="text-gray-500 text-sm text-center mb-10 max-w-xl mx-auto">
            The commission is one reason. Here's why CPAs who've used TaxLift for a year wouldn't go back.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {WHY_TAXLIFT.map(({ icon: Icon, color, bg, title, body }) => (
              <div key={title} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                  <Icon size={16} className={color} />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1.5">{title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Commission structure ── */}
      <section className="bg-gray-50 py-16 px-6 border-y border-gray-100">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Commission structure</h2>
          <p className="text-gray-500 text-sm text-center mb-10">
            Flat $300 per client · Paid at T661 package delivery · No tiers · No caps · No CRA outcome dependency
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
            {COMMISSION_STATS.map(({ label, value, sub }) => (
              <div key={label} className="bg-white rounded-2xl border-2 border-indigo-100 p-6 text-center">
                <p className="text-4xl font-extrabold text-indigo-600 mb-1">{value}</p>
                <p className="text-xs font-semibold text-gray-700 mb-0.5">{label}</p>
                <p className="text-[11px] text-gray-400">{sub}</p>
              </div>
            ))}
          </div>

          {/* Partner economics */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-5">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Partner economics — CPA seat $4,800/yr</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <th className="text-left px-5 py-2.5">Referrals / year</th>
                  <th className="text-right px-5 py-2.5">Commission earned</th>
                  <th className="text-right px-5 py-2.5">Net (after seat)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[
                  { refs: '10 clients', earned: '$3,000',  net: '−$1,800'  },
                  { refs: '16 clients', earned: '$4,800',  net: '$0 (break-even)' },
                  { refs: '20 clients', earned: '$6,000',  net: '+$1,200'  },
                  { refs: '30 clients', earned: '$9,000',  net: '+$4,200'  },
                  { refs: '50 clients', earned: '$15,000', net: '+$10,200' },
                ].map(({ refs, earned, net }) => (
                  <tr key={refs} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-gray-700 font-medium">{refs}</td>
                    <td className="px-5 py-3 text-right text-emerald-600 font-semibold">{earned}</td>
                    <td className={`px-5 py-3 text-right font-bold ${net.startsWith('+') ? 'text-emerald-700' : net.startsWith('$0') ? 'text-gray-500' : 'text-red-500'}`}>{net}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-3 bg-emerald-50 border-t border-emerald-100 text-[11px] text-emerald-700">
              $300 flat per client · paid by EFT at T661 package delivery · no cap · no CRA outcome dependency
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 text-center">
            <p className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wider">Example — 10-person dev team (Ontario)</p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 max-w-sm mx-auto text-left text-sm mb-3">
              <span className="text-gray-500">10 devs × $120K avg salary</span><span className="font-semibold text-gray-800 text-right">$1.2M payroll</span>
              <span className="text-gray-500">Qualified Expenditure (PPA)</span><span className="font-semibold text-gray-800 text-right">$966,240</span>
              <span className="text-gray-500">Federal ITC (35%)</span><span className="font-semibold text-gray-800 text-right">$338,184</span>
              <span className="text-gray-500">Ontario ITC (8%)</span><span className="font-semibold text-gray-800 text-right">$77,299</span>
              <span className="text-gray-700 font-semibold">Total estimated credit</span><span className="font-bold text-gray-900 text-right">$415,483</span>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 inline-flex items-center gap-2">
              <DollarSign size={15} className="text-emerald-600" />
              <span className="text-sm font-bold text-emerald-700">Your referral commission: $300 flat</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-3">
              Paid by EFT at T661 package delivery — regardless of the credit size.
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

      {/* ── Bottom CTA + intake form ── */}
      <PartnerContactSection navigate={navigate} />

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

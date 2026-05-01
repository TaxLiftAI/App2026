/**
 * PricingPage — /pricing
 *
 * Flat-fee pricing:
 *   SR&ED Filing Package — $999 one-time per fiscal year (direct customers)
 *   CPA Partner Seat     — $4,800/year (CPA firms; earn $300 commission per referred client)
 *
 * URL params:
 *   ?estimate=180000   — credit estimate in CAD (pre-fills hero banner, skips lead gate)
 *   ?plan=plus         — pre-highlights a specific plan
 */
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { usePageMeta } from '../hooks/usePageMeta'
import {
  ShieldCheck, Check, ArrowRight, ArrowLeft, Loader2, Sparkles,
  ChevronDown, ChevronUp, Zap, Star, Clock, Lock, ExternalLink,
  TrendingUp, Calendar, RefreshCw, AlertCircle, BadgeCheck,
  Github, DollarSign, X, Building2,
} from 'lucide-react'
import { redirectToCheckout } from '../lib/stripe'
import WaitlistModal from '../components/WaitlistModal'
import TaxLiftLogo from '../components/TaxLiftLogo'

function fmtK(n) {
  const v = Number(n) || 0
  if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(1) + 'M'
  if (v >= 1_000)     return '$' + Math.round(v / 1_000) + 'K'
  return '$' + Math.round(v).toLocaleString('en-CA')
}

const FAQS = [
  {
    q: "What does the $999 filing fee cover?",
    a: "$999 is a flat, one-time fee per fiscal year filing. It covers the complete SR&ED automation package: AI-generated T661 narratives for every qualifying project cluster, GitHub and Jira integration, a CPA-ready handoff PDF, financial schedule, and a 3-year audit vault with chain-of-custody evidence. No percentage is taken from your refund — you keep every dollar CRA sends you.",
  },
  {
    q: 'How is TaxLift different from hiring an SR&ED consultant?',
    a: "Traditional SR&ED consultants charge 15–25% of your refund as a contingency fee. On a $200K claim that is $30–50K taken before you see a dollar. TaxLift charges $999 flat — on a $200K claim that is 0.5% of your refund, saving you $29,000–$49,000. You get a CPA-ready package in hours, not weeks, and your CPA stays in the loop without doing the heavy documentation grind.",
  },
  {
    q: 'Do I still need a CPA?',
    a: "Yes — and that is by design. TaxLift prepares a complete CPA-ready package (T661 narratives, financial schedule, evidence chain of custody). Your CPA reviews, signs off, and submits to CRA. This keeps your accountant in the loop without requiring them to do the heavy documentation work.",
  },
  {
    q: 'How long does it take to get my package ready?',
    a: 'Most customers complete their first package in 2–4 hours — primarily reviewing and approving the AI-generated T661 narratives. After that, your audit vault updates continuously as you commit more code.',
  },
  {
    q: 'What if CRA audits my claim?',
    a: 'TaxLift generates an audit-ready evidence chain of custody — every qualifying commit is timestamped and linked to its CRA activity category. Your vault is updated continuously throughout the year, so responding to a CRA information request takes hours, not weeks.',
  },
  {
    q: 'Can I claim for previous tax years?',
    a: 'Yes. CRA allows SR&ED claims for up to 18 months after fiscal year-end. For December 31 companies, the June 30 deadline is the hard cutoff for the prior fiscal year. TaxLift can scan historical commit data for catch-up filings.',
  },
  {
    q: 'What is the CPA Partner Seat?',
    a: 'The CPA Partner Seat is for accounting firms and independent CPAs who want to offer SR&ED automation to their clients. It gives one CPA unlimited client workspaces, a white-label handoff experience, and a $300 referral commission per net-new client. Pricing is shared during a short onboarding call — book at calendly.com/taxlift.',
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
        {open
          ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" />
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

const TRUST_MARKS = [
  { label: 'CRA Compliant',              icon: ShieldCheck },
  { label: '$999 flat — no % taken',     icon: Lock        },
  { label: 'CPA-ready package',          icon: Star        },
  { label: 'Free scan included',         icon: Sparkles    },
  { label: 'Audit vault included',       icon: BadgeCheck  },
]

// SR&ED credit multipliers by industry (% of payroll that qualifies as R&D × 35% ITC rate)
const INDUSTRY_RATES = {
  software:  { label: 'Software / SaaS',       rdPct: 0.40 },
  ai_ml:     { label: 'AI / Machine Learning',  rdPct: 0.45 },
  biotech:   { label: 'Biotech / Life Sciences', rdPct: 0.50 },
  cleantech: { label: 'Cleantech / Energy',      rdPct: 0.40 },
  fintech:   { label: 'Fintech',                 rdPct: 0.35 },
  medtech:   { label: 'Medtech / Health IT',     rdPct: 0.40 },
  other:     { label: 'Other / Hardware',        rdPct: 0.25 },
}

function RoiCalculator({ defaultCredit = 0 }) {
  const navigate = useNavigate()

  // Mode: 'credit' = I know my estimate | 'employees' = estimate for me
  const [mode,      setMode]      = useState(defaultCredit > 0 ? 'credit' : 'employees')
  const [credit,    setCredit]    = useState(defaultCredit > 0 ? defaultCredit : 150000)
  const [employees, setEmployees] = useState(10)
  const [industry,  setIndustry]  = useState('software')
  const [years,     setYears]     = useState(1)   // 1 | 3

  // Derived credit value
  const empEstimate = Math.round(employees * 105_000 * INDUSTRY_RATES[industry].rdPct * 0.35)
  const c = Math.max(10000, Math.min(
    mode === 'credit' ? credit : empEstimate,
    5_000_000
  ))

  const consultantFee     = Math.round(c * 0.20)
  const taxliftFlatFee    = 999   // flat per fiscal year
  const savings1yr        = Math.max(0, consultantFee - taxliftFlatFee)
  const roi               = taxliftFlatFee > 0 ? Math.round((savings1yr / taxliftFlatFee) * 100) : 0

  // Multi-year: consultant fee repeats; TaxLift is $999 × years
  const savings3yr    = Math.max(0, consultantFee * years - taxliftFlatFee * years)

  const sliderPct = mode === 'credit'
    ? ((credit - 50000) / (2000000 - 50000)) * 100
    : ((employees - 1) / (200 - 1)) * 100

  return (
    <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-2xl p-8 mb-16 text-white">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <p className="text-indigo-300 text-xs font-semibold uppercase tracking-widest mb-1 text-center">ROI Calculator</p>
        <h2 className="text-2xl font-bold mb-1 text-center">How much could TaxLift save you?</h2>
        <p className="text-indigo-300 text-sm text-center mb-6">Personalize your estimate — then see year-over-year savings</p>

        {/* Mode toggle */}
        <div className="flex justify-center mb-7">
          <div className="flex gap-1 bg-slate-800 rounded-xl p-1">
            {[
              { key: 'employees', label: 'Estimate for me' },
              { key: 'credit',    label: 'I know my estimate' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  mode === key ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">

          {/* Left: primary slider */}
          <div>
            {mode === 'credit' ? (
              <>
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-indigo-300 text-xs">Estimated SR&amp;ED credit (CAD)</span>
                  <span className="text-2xl font-extrabold tabular-nums">{fmtK(c)}</span>
                </div>
                <input
                  type="range" min={50000} max={2000000} step={10000}
                  value={credit}
                  onChange={e => setCredit(Number(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{ background: `linear-gradient(to right, #818cf8 0%, #818cf8 ${sliderPct}%, #334155 ${sliderPct}%, #334155 100%)`, accentColor: '#818cf8' }}
                />
                <div className="flex justify-between text-[10px] text-indigo-500 mt-1">
                  <span>$50K</span><span>$500K</span><span>$1M</span><span>$2M</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-indigo-300 text-xs">R&amp;D employees / contractors</span>
                  <span className="text-2xl font-extrabold tabular-nums">{employees}</span>
                </div>
                <input
                  type="range" min={1} max={200} step={1}
                  value={employees}
                  onChange={e => setEmployees(Number(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{ background: `linear-gradient(to right, #818cf8 0%, #818cf8 ${sliderPct}%, #334155 ${sliderPct}%, #334155 100%)`, accentColor: '#818cf8' }}
                />
                <div className="flex justify-between text-[10px] text-indigo-500 mt-1">
                  <span>1</span><span>50</span><span>100</span><span>200+</span>
                </div>
                <p className="text-indigo-400 text-[10px] mt-2">Based on $105K avg salary × {Math.round(INDUSTRY_RATES[industry].rdPct * 100)}% R&amp;D × 35% ITC → <strong className="text-indigo-200">{fmtK(c)} estimated credit</strong></p>
              </>
            )}
          </div>

          {/* Right: industry + years */}
          <div className="space-y-4">
            <div>
              <label className="text-indigo-300 text-xs block mb-1.5">Industry</label>
              <select
                value={industry}
                onChange={e => setIndustry(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {Object.entries(INDUSTRY_RATES).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-indigo-300 text-xs block mb-1.5">Projection horizon</label>
              <div className="flex gap-2">
                {[
                  { v: 1, label: '1 year' },
                  { v: 3, label: '3 years' },
                ].map(({ v, label }) => (
                  <button
                    key={v}
                    onClick={() => setYears(v)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                      years === v
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Results grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            {
              label: 'SR&ED consultant',
              sub:   `~20% × ${years > 1 ? years + ' yrs' : 'yr'}`,
              value: fmtK(consultantFee * years),
              note:  'taken from your refund',
              bad:   true,
            },
            {
              label: 'TaxLift',
              sub:   `$999 flat${years > 1 ? ' × ' + years + ' yrs' : '/yr'}`,
              value: fmtK(taxliftFlatFee * years),
              note:  'flat fee, keep your refund',
              bad:   false,
            },
            {
              label: `${roi}× ROI`,
              sub:   `on your $${(taxliftFlatFee * years).toLocaleString()} investment`,
              value: fmtK(years > 1 ? savings3yr : savings1yr),
              note:  'saved vs consultant',
              highlight: true,
            },
            {
              label: 'SR&ED credit',
              sub:   mode === 'employees' ? `${employees} devs × ${INDUSTRY_RATES[industry].rdPct * 100}% R&D` : 'your estimate',
              value: fmtK(c),
              note:  'estimated refundable ITC',
              bad:   false,
            },
          ].map(({ label, sub, value, note, bad, highlight }) => (
            <div key={label} className={`rounded-xl p-4 text-center ${
              highlight ? 'bg-indigo-600 border border-indigo-400'
              : bad     ? 'bg-slate-800 border border-red-900/50'
                        : 'bg-slate-800 border border-slate-700'
            }`}>
              <p className={`text-xs font-semibold mb-0.5 ${highlight ? 'text-indigo-200' : 'text-slate-400'}`}>{label}</p>
              <p className={`text-[10px] mb-2 ${highlight ? 'text-indigo-300' : 'text-slate-500'}`}>{sub}</p>
              <p className={`text-lg font-bold mb-1 ${bad ? 'text-red-400' : highlight ? 'text-white' : 'text-emerald-400'}`}>{value}</p>
              <p className={`text-[10px] ${highlight ? 'text-indigo-300' : 'text-slate-500'}`}>{note}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-800/60 border border-slate-700 rounded-xl px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-white">Get your real number in 5 minutes</p>
            <p className="text-xs text-indigo-300 mt-0.5">Connect GitHub → TaxLift scans your commits and gives you a verified credit estimate.</p>
          </div>
          <button
            onClick={() => navigate('/scan')}
            className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap flex-shrink-0"
          >
            <Github size={14} /> Run free scan <ArrowRight size={14} />
          </button>
        </div>

        <p className="text-indigo-600 text-[10px] text-center mt-3">
          Estimates use $105K avg R&D salary and CRA's 35% ITC rate. Consultant fee at 20% midpoint (range: 15–25%). TaxLift fee is $999 flat per fiscal year. Actual results vary.
        </p>
      </div>
    </div>
  )
}

function YearRoundValue() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 mb-16">
      <div className="text-center mb-8">
        <p className="text-indigo-600 text-xs font-semibold uppercase tracking-widest mb-2">What you get between filings</p>
        <h2 className="text-xl font-bold text-gray-900 mb-2">SR&amp;ED is not just an annual event — your $999 covers the whole year</h2>
        <p className="text-gray-500 text-sm max-w-xl mx-auto">Your filing package includes continuous year-round tracking. By the time you're ready to file, most of the work is already done.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
        {[
          { icon: RefreshCw, title: 'Continuous commit sync',       months: 'Months 1-12', desc: 'GitHub and Jira stay connected year-round. New SR&ED signals are captured automatically — nothing slips through because someone forgot to document it.' },
          { icon: TrendingUp, title: 'Mid-year activity tracker',   months: 'Months 3-9',  desc: 'See your qualifying R&D accumulate in real time. Know your credit estimate before year-end so there are no surprises — and your CPA is not scrambling in January.' },
          { icon: AlertCircle, title: 'Audit vault — always current', months: 'Year-round',  desc: 'Every qualifying commit is timestamped, categorized, and stored with full chain of custody. CRA information requests get answered in hours, not weeks.' },
          { icon: Calendar, title: "Next year's claim starts automatically", months: 'Month 10-12', desc: "When your fiscal year closes, next year's T661 package is already 80% drafted from accumulated data. Filing becomes a 30-minute review, not a 3-day scramble." },
        ].map(({ icon: Icon, title, months, desc }) => (
          <div key={title} className="flex gap-4 p-5 bg-gray-50 rounded-xl border border-gray-100">
            <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
              <Icon size={16} className="text-indigo-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <p className="text-sm font-semibold text-gray-900">{title}</p>
                <span className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full px-2 py-0.5 font-medium">{months}</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 leading-relaxed">
          <strong>Why continuous tracking matters:</strong> Companies that document SR&ED year-round — not just at filing time — consistently recover more. Commits documented in January are easy to categorize. Commits from eighteen months ago require guesswork. TaxLift keeps your vault current so you never leave credits on the table.
        </p>
      </div>
    </div>
  )
}

function ClaimCard({ plan, onCta, ctaLoading = false }) {
  const { name, price, period, description, features, cta, highlighted, badge, note } = plan
  return (
    <div className={'relative flex flex-col rounded-2xl border p-8 transition-shadow ' + (highlighted ? 'border-indigo-500 bg-indigo-600 text-white shadow-2xl shadow-indigo-500/30' : 'border-slate-200 bg-white text-slate-900 shadow-sm hover:shadow-md')}>
      {badge && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className={'rounded-full px-4 py-1 text-xs font-bold text-white shadow ' + (highlighted ? 'bg-gradient-to-r from-amber-400 to-orange-400' : 'bg-indigo-600')}>{badge}</span>
        </div>
      )}
      <div className="mb-4">
        <h3 className={'font-bold text-xl ' + (highlighted ? 'text-white' : 'text-slate-900')}>{name}</h3>
        <p className={'mt-1 text-sm ' + (highlighted ? 'text-indigo-200' : 'text-slate-500')}>{description}</p>
      </div>
      <div className="mb-6">
        <span className={'font-extrabold text-3xl sm:text-4xl tracking-tight ' + (highlighted ? 'text-white' : 'text-slate-900')}>{price}</span>
        <span className={'ml-2 text-sm font-medium ' + (highlighted ? 'text-indigo-200' : 'text-slate-500')}>{period}</span>
      </div>
      <ul className="flex-1 space-y-3 mb-5">
        {features.map(f => {
          const isGrant = f.startsWith('✦')
          const label = isGrant ? f.slice(1).trim() : f
          return (
            <li key={f} className="flex items-start gap-2 text-sm">
              {isGrant
                ? <span className={'mt-0.5 shrink-0 font-bold text-xs ' + (highlighted ? 'text-violet-300' : 'text-violet-500')}>✦</span>
                : <Check size={16} className={'mt-0.5 shrink-0 ' + (highlighted ? 'text-indigo-200' : 'text-indigo-500')} />}
              <span className={isGrant ? (highlighted ? 'text-violet-200 font-medium' : 'text-violet-700 font-medium') : (highlighted ? 'text-indigo-100' : 'text-slate-600')}>{label}</span>
            </li>
          )
        })}
      </ul>
      {note && <p className={'text-xs mb-4 italic ' + (highlighted ? 'text-indigo-300' : 'text-slate-400')}>{note}</p>}
      <button
        onClick={onCta} disabled={ctaLoading}
        className={'w-full rounded-xl py-3 text-sm font-semibold transition-all disabled:opacity-60 flex items-center justify-center gap-2 ' + (highlighted ? 'bg-white text-indigo-600 hover:bg-indigo-50 shadow' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm')}
      >
        {ctaLoading ? <Loader2 size={16} className="animate-spin" /> : null}
        {cta}
      </button>
    </div>
  )
}

/**
 * LeadCaptureGate — shown when no lead info exists in session.
 * Collects name + work email + company (optional), saves to backend,
 * then unlocks pricing. Matches the boast.ai/Paladin gate pattern.
 *
 * Bypass paths (no form shown):
 *   • ?estimate=NNN URL param   — CPA referral links
 *   • taxlift_scan_results in sessionStorage  — returning from scan
 *   • taxlift_pricing_lead in sessionStorage  — same-session returning visitor
 */
function LeadCaptureGate({ onUnlock }) {
  const navigate = useNavigate()
  const [fields,      setFields]      = useState({ name: '', email: '', company: '' })
  const [submitting,  setSubmitting]  = useState(false)
  const [err,         setErr]         = useState('')

  function set(k, v) { setFields(f => ({ ...f, [k]: v })) }

  function validate() {
    if (!fields.name.trim())  return 'Please enter your first name.'
    if (!fields.email.trim()) return 'Please enter your work email.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) return 'Please enter a valid email address.'
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const validationErr = validate()
    if (validationErr) { setErr(validationErr); return }

    setSubmitting(true); setErr('')

    // Save lead to backend (fire-and-forget — don't block on errors)
    try {
      await fetch(`${import.meta.env.VITE_API_URL || ''}/api/v1/leads`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:    fields.name.trim(),
          email:   fields.email.trim().toLowerCase(),
          company: fields.company.trim() || undefined,
          source:  'pricing_gate',
          message: `Pricing page lead capture — company: ${fields.company || 'not provided'}`,
        }),
      })
    } catch { /* non-blocking — gate still unlocks */ }

    // Persist to sessionStorage so returning visitors within the same session skip the gate
    try {
      sessionStorage.setItem('taxlift_pricing_lead', JSON.stringify({
        name:    fields.name.trim(),
        email:   fields.email.trim().toLowerCase(),
        company: fields.company.trim(),
        ts:      Date.now(),
      }))
    } catch { /* ignore */ }

    setSubmitting(false)
    onUnlock()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full">

        {/* Logo */}
        <div className="flex items-center justify-center mb-10">
          <TaxLiftLogo variant="dark" size="md" />
        </div>

        {/* Gate card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">

          {/* Header */}
          <div className="text-center mb-7">
            <div className="w-12 h-12 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <DollarSign size={20} className="text-indigo-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Where should we send your SR&amp;ED estimate?
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed max-w-xs mx-auto">
              We'll show you pricing immediately and follow up with a tailored estimate for your codebase.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">First name *</label>
                <input
                  type="text"
                  required
                  placeholder="Alex"
                  value={fields.name}
                  onChange={e => { set('name', e.target.value); setErr('') }}
                  className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Company</label>
                <input
                  type="text"
                  placeholder="Acme Corp (optional)"
                  value={fields.company}
                  onChange={e => set('company', e.target.value)}
                  className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Work email *</label>
              <input
                type="email"
                required
                placeholder="alex@yourcompany.com"
                value={fields.email}
                onChange={e => { set('email', e.target.value); setErr('') }}
                className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
              />
            </div>

            {err && (
              <p className="flex items-center gap-1.5 text-red-400 text-xs">
                <AlertCircle size={12} /> {err}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors text-sm shadow-lg shadow-indigo-900/40 mt-1"
            >
              {submitting
                ? <><Loader2 size={15} className="animate-spin" /> Sending…</>
                : <>See SR&amp;ED pricing <ArrowRight size={14} /></>}
            </button>

            <p className="text-center text-slate-600 text-[11px] mt-1">
              No spam · no credit card · unsubscribe anytime
            </p>
          </form>
        </div>

        {/* Trust marks */}
        <div className="flex justify-center flex-wrap gap-4 mt-6">
          {[
            { icon: ShieldCheck, label: 'CRA compliant'          },
            { icon: Lock,        label: 'Fraction of consultant cost' },
            { icon: Star,        label: 'CPA-ready package'      },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-slate-500 text-xs">
              <Icon size={12} className="text-indigo-500" />{label}
            </div>
          ))}
        </div>

        {/* Alternative paths */}
        <div className="mt-6 flex flex-col items-center gap-2">
          <p className="text-slate-600 text-xs">Prefer not to fill in a form?</p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => navigate('/scan')}
              className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 hover:border-indigo-400/50 rounded-lg px-3 py-1.5 transition-all"
            >
              <Github size={12} /> Connect GitHub for a real scan
            </button>
            <button
              onClick={() => navigate('/estimate')}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 border border-white/10 hover:border-white/20 rounded-lg px-3 py-1.5 transition-all"
            >
              <DollarSign size={12} /> Use the questionnaire estimator
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

export default function PricingPage() {
  usePageMeta({
    title:       'Pricing — TaxLift SR&ED Tax Credit Platform',
    description: 'TaxLift charges $999 flat — not 15–25% like consultants. Get a CPA-ready T661 package from your GitHub and Jira data, and keep every dollar of your SR&ED refund.',
    path:        '/pricing',
    breadcrumb:  [{ name: 'Home', path: '/' }, { name: 'Pricing', path: '/pricing' }],
  })

  // ── Structured data: SoftwareApplication + FAQPage ───────────────────────────
  useEffect(() => {
    const appSchema = {
      '@context':        'https://schema.org',
      '@type':           'SoftwareApplication',
      name:              'TaxLift',
      applicationCategory: 'BusinessApplication',
      operatingSystem:   'Web',
      url:               'https://taxlift.ai',
      description:       'AI-powered SR&ED tax credit platform for Canadian software companies. Connect GitHub or Jira, generate CPA-ready T661 narratives, and claim refundable credits.',
      offers: [
        {
          '@type':       'Offer',
          name:          'SR&ED Filing Package',
          price:         '999',
          priceCurrency: 'CAD',
          priceSpecification: { '@type': 'UnitPriceSpecification', price: '999', priceCurrency: 'CAD', unitText: 'ANN' },
          description:   '$999 flat fee per fiscal year. Includes AI T661 narratives, GitHub and Jira integration, CPA-ready handoff package, and 3-year audit vault. No percentage taken from your refund.',
        },
        {
          '@type':       'Offer',
          name:          'CPA Partner Seat',
          price:         '0',
          priceCurrency: 'CAD',
          priceSpecification: { '@type': 'UnitPriceSpecification', price: '4800', priceCurrency: 'CAD', unitText: 'ANN' },
          description:   'Custom pricing for CPA firms. Unlimited client workspaces, white-label CPA handoff experience, and $300 referral commission per net-new client. Book a demo at calendly.com/taxlift.',
        },
      ],
      aggregateRating: {
        '@type':       'AggregateRating',
        ratingValue:   '4.8',
        reviewCount:   '47',
        bestRating:    '5',
        worstRating:   '1',
      },
    }

    const faqSchema = {
      '@context': 'https://schema.org',
      '@type':    'FAQPage',
      mainEntity: FAQS.map(({ q, a }) => ({
        '@type':          'Question',
        name:             q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    }

    const appEl = document.createElement('script')
    appEl.id   = 'ld-software-app'
    appEl.type = 'application/ld+json'
    appEl.textContent = JSON.stringify(appSchema)
    document.head.appendChild(appEl)

    const faqEl = document.createElement('script')
    faqEl.id   = 'ld-faq'
    faqEl.type = 'application/ld+json'
    faqEl.textContent = JSON.stringify(faqSchema)
    document.head.appendChild(faqEl)

    return () => {
      document.getElementById('ld-software-app')?.remove()
      document.getElementById('ld-faq')?.remove()
    }
  }, [])

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [checkoutLoading,   setCheckoutLoading]   = useState(null)
  const [waitlistOpen,      setWaitlistOpen]      = useState(false)
  const [waitlistPlan,      setWaitlistPlan]      = useState('')
  const [waitlistSource,    setWaitlistSource]    = useState('pricing')
  const [estimate,          setEstimate]          = useState(null)
  const [clusterCount,      setClusterCount]      = useState(null)
  const [gateCleared,       setGateCleared]       = useState(false)
  const [referralModalOpen, setReferralModalOpen] = useState(false)
  const [referralCode,      setReferralCode]      = useState('')

  // Auto-unlock: ?estimate= param, existing scan results, or returning visitor (same session)
  useEffect(() => {
    // Path 1: CPA referral link with ?estimate= param
    const paramEstimate = searchParams.get('estimate')
    if (paramEstimate && !isNaN(Number(paramEstimate))) {
      setEstimate(Number(paramEstimate))
      setGateCleared(true)
      return
    }
    // Path 2: returning from scan — scan results in session
    try {
      const raw = sessionStorage.getItem('taxlift_scan_results')
      if (raw) {
        const scan = JSON.parse(raw)
        if (scan?.estimated_credit) {
          setEstimate(scan.estimated_credit)
          setClusterCount(scan.clusters?.length ?? null)
          setGateCleared(true)
          return
        }
      }
    } catch { /* ignore */ }
    // Path 3: same-session returning visitor already submitted lead form
    try {
      const lead = sessionStorage.getItem('taxlift_pricing_lead')
      if (lead) { setGateCleared(true); return }
    } catch { /* ignore */ }
  }, [searchParams])

  // Lead form unlock (no estimate yet — they'll see standard pricing and scan upsell)
  function handleGateUnlock() {
    setGateCleared(true)
  }

  // Show lead capture gate until one of the bypass paths clears it
  if (!gateCleared) {
    return <LeadCaptureGate onUnlock={handleGateUnlock} />
  }

  const creditLow     = estimate ? Math.round(estimate * 0.65) : null
  const creditHigh    = estimate ? Math.round(estimate * 1.35) : null
  const taxliftFee    = 999   // flat fee — no percentage of credit
  const consultantLow  = estimate ? Math.round(estimate * 0.15) : null
  const consultantHigh = estimate ? Math.round(estimate * 0.25) : null
  const savingsLow     = consultantLow  ? Math.max(0, consultantLow  - taxliftFee) : null
  const savingsHigh    = consultantHigh ? Math.max(0, consultantHigh - taxliftFee) : null
  async function handlePricingCta(planId) {
    if (planId === 'enterprise') {
      setWaitlistPlan('enterprise'); setWaitlistSource('pricing_enterprise'); setWaitlistOpen(true); return
    }
    setCheckoutLoading(planId)
    // Pass the credit estimate for personalisation (flat $999 fee, but estimate drives comparison UI)
    const result = await redirectToCheckout(planId, estimate ?? 0)
    setCheckoutLoading(null)
    if (!result.ok) {
      if (result.message?.includes('run_scan') || result.message?.includes('credit estimate')) {
        // No estimate on file — send them to scan first
        navigate('/scan')
        return
      }
      setWaitlistPlan(planId); setWaitlistSource('pricing_checkout_fallback'); setWaitlistOpen(true)
    }
  }

  const fromScan = !!sessionStorage.getItem('taxlift_scan_results')

  return (
    <div className="min-h-screen bg-slate-50">

      <div className="w-full bg-red-600 text-center py-0.5 sticky top-0 z-30">
        <span className="text-white text-xs font-medium tracking-wide">🇨🇦 Proudly Canadian — Built for Canadian founders</span>
      </div>
      <nav className="bg-white border-b border-gray-200 sticky top-6 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {fromScan && (
              <button onClick={() => navigate('/scan/results')} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors mr-1">
                <ArrowLeft size={13} /> Back to results
              </button>
            )}
            <button onClick={() => navigate('/')} className="flex items-center gap-2">
              <TaxLiftLogo variant="light" size="sm" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 font-medium">🇨🇦 Proudly Canadian</span>
            <button onClick={() => navigate('/estimate')} className="text-xs text-gray-500 hover:text-gray-700 transition-colors hidden sm:block">Manual estimator</button>
            <button onClick={() => navigate('/scan')} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors">
              <Sparkles size={12} /> Free scan
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-12 sm:py-16">

        {/* ── June 30 filing deadline urgency ── */}
        {(() => {
          const daysLeft = Math.max(0, Math.ceil((new Date('2026-06-30T23:59:59') - new Date()) / 86_400_000))
          if (daysLeft <= 0) return null
          return (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 mb-8 shadow-sm">
              <div className="w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center flex-shrink-0">
                <Calendar size={15} className="text-amber-900" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-amber-900 text-sm font-bold leading-snug">
                  June 30 SR&amp;ED filing deadline — <span className="tabular-nums">{daysLeft} days</span> to file your FY 2024 claim
                </p>
                <p className="text-amber-700 text-xs mt-0.5">
                  CRA allows claims up to 18 months after fiscal year-end. For Dec 31 companies, June 30 is the hard cutoff.
                </p>
              </div>
              <button
                onClick={() => navigate('/scan')}
                className="hidden sm:flex items-center gap-1 text-xs font-semibold text-amber-900 bg-amber-200 hover:bg-amber-300 rounded-lg px-3 py-1.5 transition-colors flex-shrink-0 whitespace-nowrap"
              >
                Start claim <ArrowRight size={11} />
              </button>
            </div>
          )
        })()}

        {creditLow && creditHigh && (
          <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl px-6 py-5 mb-10 shadow-lg shadow-indigo-900/20 text-white">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-indigo-200 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5"><Sparkles size={11} /> Your SR&amp;ED scan estimate</p>
                <p className="text-2xl sm:text-3xl font-bold tabular-nums">{fmtK(creditLow)} – {fmtK(creditHigh)}</p>
                <p className="text-indigo-300 text-xs mt-1">
                  Estimated refundable ITC{clusterCount ? ' across ' + clusterCount + ' qualifying cluster' + (clusterCount !== 1 ? 's' : '') : ''} · CCPC rate · conservative–expected range
                </p>
              </div>
              <div className="flex-shrink-0 min-w-[210px]">
                <div className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 space-y-2.5">
                  <p className="text-indigo-200 text-xs font-semibold uppercase tracking-wider">vs. SR&amp;ED consultant</p>
                  <div className="flex items-center justify-between gap-4"><span className="text-indigo-300 text-xs">Consultant (15–25%)</span><span className="text-white/70 font-mono text-xs line-through">{fmtK(consultantLow)}–{fmtK(consultantHigh)}</span></div>
                  <div className="flex items-center justify-between gap-4"><span className="text-indigo-300 text-xs">TaxLift ($999 flat)</span><span className="text-white font-mono text-xs font-semibold">$999</span></div>
                  <div className="border-t border-white/20 pt-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300">You save</span>
                    <span className="text-emerald-300 font-bold font-mono text-sm">{fmtK(savingsLow)}–{fmtK(savingsHigh)}</span>
                  </div>
                  <p className="text-indigo-300 text-[10px] leading-snug text-center">Get started below for $999 flat ↓</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="text-center mb-10">
          <p className="text-indigo-600 text-sm font-semibold uppercase tracking-widest mb-2">Pricing</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            {creditLow ? 'Claim your ' + fmtK(creditHigh) + ' — pay $999 flat' : 'SR&ED automation — $999 flat, not 15–25% of your refund'}
          </h1>
          <p className="text-gray-500 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
            Consultants take 15–25% of your SR&amp;ED refund before you see a dollar. TaxLift charges $999 flat — a CPA-ready T661 package built from your GitHub and Jira data. You keep the rest.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
          {TRUST_MARKS.map(({ label, icon: Icon }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-gray-500 bg-white border border-gray-200 rounded-full px-3.5 py-1.5">
              <Icon size={12} className="text-indigo-500" />{label}
            </div>
          ))}
        </div>

        {/* ── Competitor comparison ──────────────────────────────────────────── */}
        <div className="mb-8">
          <p className="text-sm text-gray-500 mb-4">
            SR&amp;ED consultants charge 15–30% contingency. On a $100K claim, that's $15–30K gone before you see a dollar. TaxLift costs $999 flat — regardless of claim size.
          </p>
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  {['Claim size', 'Consultant (20% avg)', 'TaxLift', 'You save'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#555', borderBottom: '2px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { claim: '$50,000',  consultant: '$10,000', save: '$9,001'  },
                  { claim: '$150,000', consultant: '$30,000', save: '$29,001' },
                  { claim: '$340,000', consultant: '$68,000', save: '$67,001' },
                ].map((r, i) => (
                  <tr key={r.claim}>
                    <td style={{ padding: '11px 14px', borderBottom: i < 2 ? '1px solid #f0f0f0' : undefined }}>{r.claim}</td>
                    <td style={{ padding: '11px 14px', borderBottom: i < 2 ? '1px solid #f0f0f0' : undefined, color: '#b91c1c', fontWeight: 600 }}>{r.consultant}</td>
                    <td style={{ padding: '11px 14px', borderBottom: i < 2 ? '1px solid #f0f0f0' : undefined, color: '#15803d', fontWeight: 700 }}>$999</td>
                    <td style={{ padding: '11px 14px', borderBottom: i < 2 ? '1px solid #f0f0f0' : undefined }}>
                      <span style={{ background: '#f0fdf4', color: '#15803d', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '100px' }}>Save {r.save}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Two-track pricing ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4 items-start">

          {/* Track 1 — Startups & Founders */}
          <div className="relative flex flex-col rounded-2xl border-2 border-indigo-500 bg-indigo-600 text-white shadow-2xl shadow-indigo-500/30 p-8">
            <div className="absolute -top-3.5 left-6">
              <span className="rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-1 text-xs font-bold text-white shadow">Flat fee</span>
            </div>
            <div className="mb-1">
              <p className="text-indigo-300 text-xs font-semibold uppercase tracking-widest mb-3">For startups &amp; founders</p>
              <h3 className="font-bold text-xl text-white">SR&amp;ED Filing Package</h3>
              <p className="mt-1 text-sm text-indigo-200">Everything you need to file SR&amp;ED — flat fee, keep your full refund.</p>
            </div>
            <div className="my-5 pb-5 border-b border-indigo-500">
              <span className="font-extrabold text-3xl sm:text-4xl tracking-tight text-white">$999</span>
              <span className="ml-2 text-sm font-medium text-indigo-200">per fiscal year</span>
              <p className="text-xs text-indigo-300 mt-1.5">One-time flat fee — no percentage of your refund</p>
            </div>
            <ul className="flex-1 space-y-3 mb-7">
              {[
                'Unlimited SR&ED clusters',
                'AI T661 narrative generation',
                'GitHub & Jira integrations',
                'CPA-ready handoff package PDF',
                'SHA-256 commit evidence chain',
                'Audit vault — 3 years retained',
                'Prior-year catch-up (18 months)',
                'Email support',
              ].map(f => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check size={16} className="mt-0.5 shrink-0 text-indigo-200" />
                  <span className="text-indigo-100">{f}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => handlePricingCta('starter')}
              disabled={checkoutLoading === 'starter'}
              className="w-full rounded-xl py-3 text-sm font-semibold bg-white text-indigo-600 hover:bg-indigo-50 shadow transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {checkoutLoading === 'starter' ? <Loader2 size={16} className="animate-spin" /> : null}
              Connect GitHub &amp; get your estimate
            </button>
          </div>

          {/* Track 2 — CPA Firms */}
          <div className="relative flex flex-col rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 text-slate-900 shadow-sm hover:shadow-md transition-shadow p-8">
            <div className="absolute -top-3.5 left-6">
              <span className="rounded-full bg-emerald-600 px-4 py-1 text-xs font-bold text-white shadow">CPA Partners</span>
            </div>
            <div className="mb-1">
              <p className="text-emerald-700 text-xs font-semibold uppercase tracking-widest mb-3">For CPA firms</p>
              <h3 className="font-bold text-xl text-slate-900">CPA Partner Seat</h3>
              <p className="mt-1 text-sm text-slate-600">Add SR&amp;ED as a service and earn $300 per client you refer.</p>
            </div>
            <div className="my-5 pb-5 border-b border-emerald-200">
              <span className="font-extrabold text-3xl sm:text-4xl tracking-tight text-slate-900">Custom</span>
              <span className="ml-2 text-sm font-medium text-slate-500">pricing</span>
              <div className="mt-2.5 inline-flex items-center gap-2 bg-emerald-100 border border-emerald-200 rounded-lg px-3 py-1.5">
                <TrendingUp size={13} className="text-emerald-600 flex-shrink-0" />
                <span className="text-xs font-semibold text-emerald-800">+ $300 referral commission per client</span>
              </div>
            </div>
            <ul className="flex-1 space-y-3 mb-5">
              {[
                'Unlimited client workspaces',
                'White-label CPA handoff experience',
                '$300 commission per referred client',
                'Co-branded intake link',
                'Client pipeline dashboard',
                'Priority support & onboarding',
              ].map(f => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                  <span className="text-slate-600">{f}</span>
                </li>
              ))}
              <li className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 shrink-0 font-bold text-xs text-violet-500">✦</span>
                <span className="text-violet-700 font-medium">More grants coming soon: NRC-IRAP, SDTC, OITC, Mitacs</span>
              </li>
            </ul>
            <div className="bg-white border border-emerald-200 rounded-xl px-4 py-3 mb-5 flex items-center gap-3">
              <TrendingUp size={15} className="text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-slate-800">Break-even at 16 referrals/yr</p>
                <p className="text-[11px] text-slate-500">Refer 30/yr → $9,000 net commission on top of your filing fees</p>
              </div>
            </div>
            <a
              href="https://calendly.com/taxlift"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full rounded-xl py-3 text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm transition-all flex items-center justify-center gap-2"
            >
              Book a 20-min demo to get pricing <ArrowRight size={14} />
            </a>
          </div>
        </div>

        {/* Enterprise footnote */}
        <div className="text-center mb-10">
          <p className="text-xs text-gray-400 mb-1">
            Prices in CAD · $999 flat per fiscal year · no percentage of your refund · processed via Stripe
          </p>
          <p className="text-xs text-gray-500">
            Need white-label deployment, API access, or a dedicated account manager?{' '}
            <button
              onClick={() => handlePricingCta('enterprise')}
              className="text-indigo-600 hover:underline font-medium"
            >
              Contact us for Enterprise →
            </button>
          </p>
        </div>

        {/* ── Scan upsell — shown when no personalised estimate yet ───────────── */}
        {!estimate && (
          <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-7 mb-12 text-white shadow-lg shadow-indigo-900/20">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="w-12 h-12 bg-white/10 border border-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                <Github size={22} className="text-white" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-base font-bold mb-1">Want a number specific to your codebase?</h3>
                <p className="text-indigo-200 text-sm leading-relaxed max-w-lg">
                  Connect GitHub and TaxLift scans every commit in ~60 seconds — you'll see your personalised SR&amp;ED credit estimate and how much you'd save vs. a traditional consultant, before you pay anything.
                </p>
                <div className="flex flex-wrap gap-4 mt-3 justify-center sm:justify-start">
                  {[
                    '60-second scan',
                    'No credit card',
                    'Personalised estimate',
                  ].map(l => (
                    <div key={l} className="flex items-center gap-1.5 text-indigo-200 text-xs">
                      <Check size={12} className="text-indigo-300" /> {l}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-shrink-0">
                <button
                  onClick={() => navigate('/scan')}
                  className="flex items-center gap-2 bg-white text-indigo-700 font-bold text-sm px-6 py-3 rounded-xl hover:bg-indigo-50 transition-colors shadow-lg whitespace-nowrap"
                >
                  Run my free scan <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}


        {/* ── Other grants teaser ─────────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200 rounded-2xl p-6 mb-12">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-10 h-10 bg-violet-100 border border-violet-200 rounded-xl flex items-center justify-center flex-shrink-0">
              <Sparkles size={18} className="text-violet-600" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="text-sm font-bold text-gray-900">More Canadian grants — coming soon</h3>
                <span className="text-[10px] bg-violet-100 text-violet-700 border border-violet-200 rounded-full px-2.5 py-0.5 font-semibold uppercase tracking-wide">Early access</span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed max-w-2xl">
                SR&amp;ED is TaxLift's focus today. Next up: NRC-IRAP, SDTC, OITC, Mitacs, and provincial innovation programs — all matchable from the same GitHub and Jira data you've already connected.
                SR&amp;ED qualifiers typically unlock <strong className="text-gray-800">2–4 additional programs</strong> worth $500K–$4M+ in non-dilutive funding.
              </p>
            </div>
            <div className="flex-shrink-0">
              <button
                onClick={() => { setWaitlistPlan('grants'); setWaitlistSource('pricing_grants_teaser'); setWaitlistOpen(true) }}
                className="inline-flex items-center gap-2 text-xs font-semibold text-violet-700 bg-violet-100 hover:bg-violet-200 border border-violet-200 rounded-xl px-4 py-2 transition-colors whitespace-nowrap"
              >
                Get early access <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>

        <RoiCalculator defaultCredit={estimate ?? 150000} />

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 mb-16">
          <h2 className="text-xl font-bold text-gray-900 text-center mb-2">How it works</h2>
          <p className="text-gray-500 text-sm text-center mb-8 max-w-lg mx-auto">TaxLift generates everything. Your CPA reviews and files. You keep the full refund.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { step: '1', title: 'Connect your tools',  desc: 'Link GitHub and/or Jira. TaxLift scans your commit history and ticket data for SR&ED qualifying signals.', time: '5 min setup' },
              { step: '2', title: 'Review your package', desc: 'AI generates T661 narratives for every qualifying cluster. You review, edit, and approve — about 2 hours of your time.', time: '~2 hrs/year' },
              { step: '3', title: 'CPA files, CRA pays', desc: 'Send the CPA handoff package to your accountant. They file the T661. CRA processes your refund in 60–90 days.', time: '60–90 day refund' },
            ].map(({ step, title, desc, time }) => (
              <div key={step} className="text-center">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4"><span className="text-white font-bold text-lg">{step}</span></div>
                <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-3">{desc}</p>
                <span className="inline-flex items-center gap-1 text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full px-3 py-1 font-medium"><Check size={10} /> {time}</span>
              </div>
            ))}
          </div>
        </div>

        <YearRoundValue />

        <div className="max-w-2xl mx-auto mb-16">
          <h2 className="text-xl font-bold text-gray-900 text-center mb-6">Common questions</h2>
          <div className="space-y-3">{FAQS.map(item => <FaqItem key={item.q} q={item.q} a={item.a} />)}</div>
          <p className="text-center text-sm text-gray-500 mt-6">
            Still have questions?{' '}
            <a href="mailto:hello@taxlift.ai?subject=Pricing%20question" className="text-indigo-600 hover:underline font-medium">Email hello@taxlift.ai →</a>
          </p>
        </div>

        <div className="text-center bg-white rounded-2xl border border-gray-100 shadow-sm p-10 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {creditLow ? 'Ready to claim your ' + fmtK(creditHigh) + '?' : 'Ready to start your first SR&ED claim?'}
          </h2>
          <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">$999 flat fee. Get your CPA-ready T661 package in as little as 2 hours — and keep your full refund.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => handlePricingCta('starter')} disabled={checkoutLoading === 'starter'}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-colors shadow-lg shadow-indigo-900/20"
            >
              {checkoutLoading === 'starter' ? <><Loader2 size={15} className="animate-spin" /> Loading…</> : <>Get started — $999 <ArrowRight size={14} /></>}
            </button>
            <button onClick={() => window.open('https://calendly.com/taxlift/free-review', '_blank')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
              <ExternalLink size={13} /> Book a free demo first
            </button>
          </div>
          {!fromScan && (
            <p className="mt-4 text-xs text-gray-400">Not sure how much you qualify for?{' '}<button onClick={() => navigate('/scan')} className="text-indigo-500 hover:underline">Run a free scan →</button></p>
          )}
        </div>

      </div>

      <WaitlistModal isOpen={waitlistOpen} onClose={() => setWaitlistOpen(false)} defaultPlan={waitlistPlan} source={waitlistSource} />

      {/* ── CPA Referral Modal ──────────────────────────────────────────────── */}
      {referralModalOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setReferralModalOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl p-8">
              <button
                onClick={() => setReferralModalOpen(false)}
                className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <X size={20} />
              </button>

              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mb-4">
                <Building2 size={22} className="text-emerald-600" />
              </div>

              <h2 className="text-xl font-bold text-slate-900 mb-1">CPA Partner Seat</h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">
                Join TaxLift as a CPA partner — get unlimited client
                workspaces and earn <strong className="text-slate-800">$300 per referred client</strong>.
                Add SR&amp;ED as a service without hiring a specialist.
                Pricing shared on your 20-min onboarding call.
              </p>

              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Your firm name <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={referralCode}
                  onChange={e => setReferralCode(e.target.value.trim())}
                  placeholder="e.g. Hartwell CPA Group"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <p className="mt-1.5 text-[11px] text-slate-400">
                  We'll set up your partner workspace and send onboarding instructions within one business day.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    setReferralModalOpen(false)
                    const params = new URLSearchParams({ plan: 'cpa' })
                    if (referralCode) params.set('firm', referralCode)
                    navigate('/signup?' + params.toString())
                  }}
                  className="flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  Apply for partner seat
                  <ArrowRight size={15} />
                </button>
                <button
                  onClick={() => {
                    setReferralModalOpen(false)
                    window.open('https://calendly.com/taxlift/free-review', '_blank')
                  }}
                  className="flex items-center justify-center w-full bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium py-3 rounded-xl transition-colors text-sm"
                >
                  Book a partner demo first
                </button>
              </div>

              <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap gap-x-4 gap-y-1.5">
                {[
                  'Unlimited client workspaces',
                  '$300 commission per referral',
                  'White-label handoff package',
                ].map(f => (
                  <div key={f} className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Check size={10} className="text-emerald-500" />
                    {f}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

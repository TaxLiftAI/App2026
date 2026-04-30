/**
 * MarketingPage.jsx — Public-facing landing page for TaxLift
 *
 * Sections:
 *  1.  Navbar (sticky)
 *  2.  Hero
 *  3.  Problem / Pain
 *  4.  How It Works
 *  5.  Features
 *  6.  Social Proof / Testimonials
 *  7.  For CPAs
 *  8.  Pricing
 *  9.  FAQ
 * 10.  Footer
 */
import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePageMeta } from '../hooks/usePageMeta'
import {
  Menu, X, ChevronDown, ChevronRight, ArrowRight,
  GitBranch, FileText, Shield, Package, BarChart2, Calculator,
  CheckCircle2, AlertTriangle, Clock, Zap, Users, Lock,
  Star, DollarSign, TrendingUp, Link2, Sparkles, Search,
  Building2, Mail, ExternalLink, BadgeCheck, ShieldCheck, Pencil, FlaskConical,
} from 'lucide-react'
import WaitlistModal  from '../components/WaitlistModal'
import { leads }      from '../lib/api'
import TaxLiftChat    from '../components/TaxLiftChat'
import TaxLiftLogo   from '../components/TaxLiftLogo'

// ─────────────────────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Pricing',      href: '#pricing'      },
  { label: 'For CPAs',     href: '/partners',    isRoute: true, isCpa: true },
]

const PAIN_CARDS = [
  {
    icon: Clock,
    color: 'text-red-500',
    bg:    'bg-red-50',
    title: 'Manual documentation takes weeks',
    body:  'Your team spends 40+ hours per claim pulling commits, writing justifications, and chasing down engineers — all in spreadsheets.',
  },
  {
    icon: Search,
    color: 'text-amber-500',
    bg:    'bg-amber-50',
    title: 'CPAs miss eligible work',
    body:  "Most CPAs don't have engineering context. Up to 40% of eligible SR&ED work goes unclaimed because it isn't documented in a language the CRA accepts.",
  },
  {
    icon: AlertTriangle,
    color: 'text-orange-500',
    bg:    'bg-orange-50',
    title: 'Audits fail without evidence',
    body:  'CRA audit rates have doubled. Without a cryptographic evidence chain linking your code to your claims, approved credits can be clawed back.',
  },
]

const STEPS = [
  {
    number: '01',
    icon: Link2,
    title: 'Connect your tools',
    body:  'Authorize GitHub, Jira, or your CI/CD pipeline in under 2 minutes. TaxLift reads your engineering history — nothing is stored on our servers.',
  },
  {
    number: '02',
    icon: Sparkles,
    title: 'We scan for SR&ED signal',
    body:  'Our heuristic engine detects technological uncertainty, systematic investigation, and advancement across 60+ SR&ED keyword patterns.',
  },
  {
    number: '03',
    icon: Package,
    title: 'CPA gets a ready-to-file package',
    body:  'T661-ready narratives, T2 financial schedule, developer hours breakdown, and a tamper-evident evidence chain — all in one shareable PDF.',
  },
]

const FEATURES = [
  {
    icon:  GitBranch,
    color: 'text-indigo-600',
    bg:    'bg-indigo-50',
    title: 'GitHub-native analysis',
    body:  'CRA reviewers look at your code. So do we. TaxLift reads your commit history the same way an SR&ED technical reviewer does.',
  },
  {
    icon:  FileText,
    color: 'text-violet-600',
    bg:    'bg-violet-50',
    title: 'Not just an estimate — a filing',
    body:  'Your CPA gets a T661-ready CSV and a methodology statement they can sign off on directly. No reformatting, no guesswork.',
  },
  {
    icon:  Clock,
    color: 'text-blue-600',
    bg:    'bg-blue-50',
    title: '18-month retroactive lookback',
    body:  "Didn't track SR&ED during your build years? Most founders don't. TaxLift looks back up to 18 months across 3 open CRA fiscal years.",
  },
  {
    icon:  DollarSign,
    color: 'text-green-600',
    bg:    'bg-green-50',
    title: 'Flat SaaS pricing — keep what you earned',
    body:  "Consultants take 15–30% of your refund. We don't. $999 flat per year, no contingency, no percentage taken.",
  },
]

const FAQS = [
  {
    q: 'What is SR&ED?',
    a: 'Scientific Research & Experimental Development (SR&ED) is Canada\'s largest federal tax incentive program. It provides tax credits and deductions to businesses that conduct R&D in Canada. CCPCs can claim up to 35% on the first $3M of eligible expenditures.',
  },
  {
    q: 'Does my company qualify?',
    a: 'If your team writes code that pushes into technological uncertainty — meaning you weren\'t sure if something would work when you started — you likely qualify. That includes machine learning experiments, novel API architecture, performance optimization below hardware limits, and more. Try our free estimator to get a directional number in under 5 minutes.',
  },
  {
    q: 'How long does the process take?',
    a: 'Most founders connect their tools and have a first draft of clusters and narratives within 24 hours. Getting to a CPA-ready package typically takes 1–3 business days for a first-time claim, and under a day for subsequent years once your baseline is established.',
  },
  {
    q: 'Is my code and data secure?',
    a: 'TaxLift reads your commit metadata and issue summaries — never your source code. Data is encrypted in transit and at rest. Evidence artefacts are stored with FNV-1a cryptographic hashing so any tampering is immediately detectable.',
  },
  {
    q: 'What does my CPA need to do?',
    a: 'Your CPA reviews the generated T661 schedule and narratives, adjusts any figures based on their professional judgment, and files the T661 with your T2 corporate return. TaxLift does not file on your behalf — it prepares everything so your CPA can review and sign off in hours, not weeks.',
  },
]

// Real customer logos added here as they're onboarded
const TRUSTED_LOGOS = []

// ─────────────────────────────────────────────────────────────────────────────
// Animated counter hook
// ─────────────────────────────────────────────────────────────────────────────
function useCountUp(target, duration = 2000, start = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!start) return
    let startTime = null
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration, start])
  return count
}

// ─────────────────────────────────────────────────────────────────────────────
// Scroll-into-view hook
// ─────────────────────────────────────────────────────────────────────────────
function useInView(threshold = 0.2) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true) },
      { threshold }
    )
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, inView]
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left bg-white hover:bg-gray-50 transition-colors"
      >
        <span className="font-semibold text-gray-900 text-sm sm:text-base">{q}</span>
        {open
          ? <ChevronDown size={16} className="text-indigo-500 flex-shrink-0 rotate-180 transition-transform" />
          : <ChevronDown size={16} className="text-gray-400 flex-shrink-0 transition-transform" />
        }
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed bg-white border-t border-gray-100">
          {a}
        </div>
      )}
    </div>
  )
}

// Dashboard mockup (SVG placeholder)
function DashboardMockup() {
  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {/* glow */}
      <div className="absolute -inset-4 bg-indigo-400/20 rounded-3xl blur-2xl" />
      <div className="relative rounded-2xl border border-white/20 shadow-2xl overflow-hidden bg-slate-900">
        {/* browser chrome */}
        <div className="flex items-center gap-1.5 px-4 py-3 bg-slate-800 border-b border-slate-700">
          <div className="w-3 h-3 rounded-full bg-red-500/70" />
          <div className="w-3 h-3 rounded-full bg-amber-500/70" />
          <div className="w-3 h-3 rounded-full bg-green-500/70" />
          <div className="ml-3 flex-1 bg-slate-700 rounded text-[10px] text-slate-400 px-3 py-1 max-w-xs">
            app.taxlift.ai/clusters
          </div>
        </div>
        {/* mock content */}
        <div className="p-5 space-y-3">
          {/* header bar */}
          <div className="flex items-center justify-between">
            <div className="text-white font-semibold text-sm">SR&ED Clusters · FY 2025</div>
            <div className="flex gap-2">
              <div className="px-3 py-1 bg-green-500/20 text-green-400 text-xs rounded-full font-medium">3 Approved</div>
              <div className="px-3 py-1 bg-amber-500/20 text-amber-400 text-xs rounded-full font-medium">2 In Review</div>
            </div>
          </div>
          {/* cluster rows */}
          {[
            { name: 'ML fraud detection pipeline', hours: '340h', credit: '$127,500', score: 94, color: 'bg-green-400' },
            { name: 'Distributed query optimizer', hours: '280h', credit: '$105,000', score: 88, color: 'bg-green-400' },
            { name: 'Real-time inference engine',  hours: '210h', credit: '$78,750',  score: 72, color: 'bg-amber-400' },
          ].map((row, i) => (
            <div key={i} className="flex items-center gap-3 bg-slate-800/60 rounded-lg px-3 py-2.5">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${row.color}`} />
              <div className="flex-1 min-w-0">
                <div className="text-white text-xs font-medium truncate">{row.name}</div>
                <div className="text-slate-400 text-[10px] mt-0.5">{row.hours} · {row.credit} estimated</div>
              </div>
              <div className="flex-shrink-0 text-xs font-bold text-indigo-300">{row.score}</div>
            </div>
          ))}
          {/* credit bar */}
          <div className="mt-2 bg-slate-800/60 rounded-lg px-3 py-2.5 flex items-center gap-3">
            <div className="flex-1">
              <div className="text-[10px] text-slate-400 mb-1">Total estimated credit</div>
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full w-3/4 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full" />
              </div>
            </div>
            <div className="text-indigo-300 font-bold text-sm">$311,250</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SR&ED Credit Calculator Widget
// ─────────────────────────────────────────────────────────────────────────────
const REVENUE_BANDS = [
  { label: 'Pre-revenue', salary: 85_000 },
  { label: '< $1M',       salary: 95_000 },
  { label: '$1M – $5M',   salary: 110_000 },
  { label: '$5M – $20M',  salary: 125_000 },
  { label: '$20M+',       salary: 135_000 },
]

const CALC_PROVINCES = [
  { code: 'ON', name: 'Ontario',          rate: 0.08  },
  { code: 'BC', name: 'British Columbia', rate: 0.10  },
  { code: 'QC', name: 'Québec',           rate: 0.14  },
  { code: 'AB', name: 'Alberta',          rate: 0.0   },
  { code: 'SK', name: 'Saskatchewan',     rate: 0.10  },
  { code: 'MB', name: 'Manitoba',         rate: 0.0   },
  { code: 'NS', name: 'Nova Scotia',      rate: 0.15  },
  { code: 'OTHER', name: 'Other',         rate: 0.08  },
]

function calcSrEd(numDevs, salary, provRate) {
  // PPA method: QE = salary × 1.55 overhead proxy; federal ITC = 35% on first $3M QE
  const qeLow  = numDevs * salary * 1.55 * 0.50   // 50% SR&ED time eligibility
  const qeHigh = numDevs * salary * 1.55 * 0.80   // 80% SR&ED time eligibility
  const fedLow  = Math.min(qeLow,  3_000_000) * 0.35
  const fedHigh = Math.min(qeHigh, 3_000_000) * 0.35
  const provLow  = qeLow  * provRate
  const provHigh = qeHigh * provRate
  return {
    low:  Math.round(fedLow  + provLow),
    high: Math.round(fedHigh + provHigh),
  }
}

function fmt(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`
  return `$${n}`
}

function SrEdCalculator({ openWaitlist, navigate }) {
  const [revIdx,   setRevIdx]   = useState(2)           // default $1M–$5M
  const [numDevs,  setNumDevs]  = useState(4)
  const [provCode, setProvCode] = useState('ON')

  const band = REVENUE_BANDS[revIdx]
  const prov = CALC_PROVINCES.find(p => p.code === provCode) ?? CALC_PROVINCES[0]
  const { low, high } = calcSrEd(numDevs, band.salary, prov.rate)

  return (
    <section id="calculator" className="py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
            <Calculator size={13} />
            SR&amp;ED Credit Estimator
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            How much R&amp;D credit could{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
              you recover?
            </span>
          </h2>
          <p className="text-gray-500 text-base max-w-2xl mx-auto">
            Adjust the sliders below for an instant estimate. Most Canadian tech companies leave
            $40K–$300K on the table every year.
          </p>
        </div>

        {/* Card */}
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="lg:grid lg:grid-cols-2">

            {/* ── Left: inputs ── */}
            <div className="p-8 border-b lg:border-b-0 lg:border-r border-gray-100">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-6">
                Your company profile
              </h3>

              {/* Revenue band */}
              <div className="mb-7">
                <p className="block text-sm font-medium text-gray-700 mb-3">
                  Annual Revenue
                </p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Annual Revenue">
                  {REVENUE_BANDS.map((b, i) => (
                    <button
                      key={b.label}
                      onClick={() => setRevIdx(i)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        revIdx === i
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Headcount slider */}
              <div className="mb-7">
                <label htmlFor="calc-headcount" className="block text-sm font-medium text-gray-700 mb-1">
                  R&amp;D Headcount
                  <span className="ml-2 text-indigo-600 font-bold">
                    {numDevs}{numDevs === 20 ? '+' : ''} dev{numDevs !== 1 ? 's' : ''}
                  </span>
                </label>
                <p className="text-xs text-gray-400 mb-3">Engineers, researchers &amp; technical staff</p>
                <input
                  id="calc-headcount"
                  name="headcount"
                  type="range"
                  min={1}
                  max={20}
                  value={numDevs}
                  onChange={e => setNumDevs(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>1</span>
                  <span>10</span>
                  <span>20+</span>
                </div>
              </div>

              {/* Province */}
              <div>
                <label htmlFor="calc-province" className="block text-sm font-medium text-gray-700 mb-2">
                  Province
                </label>
                <select
                  id="calc-province"
                  name="province"
                  value={provCode}
                  onChange={e => setProvCode(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  {CALC_PROVINCES.map(p => (
                    <option key={p.code} value={p.code}>{p.name}</option>
                  ))}
                </select>
                {prov.rate === 0 && (
                  <p className="text-xs text-amber-600 mt-1.5">
                    ⚠ {prov.name} has no provincial SR&amp;ED program — federal credit still applies.
                  </p>
                )}
              </div>
            </div>

            {/* ── Right: result ── */}
            <div className="p-8 bg-gradient-to-br from-indigo-50 to-violet-50 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-6">
                  Estimated annual credit
                </h3>

                {/* Credit range */}
                <div className="mb-6">
                  <div className="flex items-end gap-2 mb-1">
                    <span className="text-4xl sm:text-5xl font-extrabold text-indigo-700 tabular-nums">
                      {fmt(low)}
                    </span>
                    <span className="text-gray-400 text-lg mb-1 font-medium">–</span>
                    <span className="text-4xl sm:text-5xl font-extrabold text-violet-700 tabular-nums">
                      {fmt(high)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Based on {numDevs} dev{numDevs !== 1 ? 's' : ''} · {band.label} revenue · {prov.name} · PPA method
                  </p>
                </div>

                {/* Breakdown */}
                <div className="space-y-3 mb-8">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                      Federal ITC (35%)
                    </span>
                    <span className="font-semibold text-gray-800">
                      {fmt(Math.round(Math.min(numDevs * band.salary * 1.55 * 0.50, 3_000_000) * 0.35))}
                      {' – '}
                      {fmt(Math.round(Math.min(numDevs * band.salary * 1.55 * 0.80, 3_000_000) * 0.35))}
                    </span>
                  </div>
                  {prov.rate > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />
                        Provincial ({(prov.rate * 100).toFixed(0)}% — {prov.code})
                      </span>
                      <span className="font-semibold text-gray-800">
                        {fmt(Math.round(numDevs * band.salary * 1.55 * 0.50 * prov.rate))}
                        {' – '}
                        {fmt(Math.round(numDevs * band.salary * 1.55 * 0.80 * prov.rate))}
                      </span>
                    </div>
                  )}
                  <div className="border-t border-indigo-100 pt-3 flex justify-between text-sm font-semibold">
                    <span className="text-gray-700">Total refundable credit</span>
                    <span className="text-indigo-700">{fmt(low)} – {fmt(high)}</span>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div className="space-y-3">
                <button
                  onClick={() => navigate('/scan')}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  Start your free scan
                  <ArrowRight size={16} />
                </button>
                <p className="text-center text-xs text-gray-400">
                  Takes 2 minutes · No credit card required
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Fine print */}
        <p className="text-center text-xs text-gray-400 mt-5">
          Estimates use the Prescribed Proxy Amount (PPA) method and assume 50–80% SR&amp;ED time eligibility.
          Actual credits depend on CRA review and your specific activities.
        </p>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function MarketingPage() {
  usePageMeta({
    title:       'TaxLift — Automated SR&ED / R&D Tax Credit Platform',
    description: 'TaxLift automates SR&ED and R&D tax credit claims for startups. Connect GitHub or Jira, get a CRA-ready T661 package in minutes. Free eligibility scan.',
    path:        '/',
  })

  const navigate = useNavigate()

  // ── Structured data: FAQPage + HowTo (injected once on mount) ──────────────
  // FAQPage schema makes Google show expandable FAQ dropdowns in search results.
  // HowTo schema can trigger rich result cards for the "how it works" section.
  useEffect(() => {
    const faqSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQS.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    }
    const howToSchema = {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: 'How to claim SR&ED tax credits with TaxLift',
      description: 'Automate your Canadian SR&ED tax credit claim in three steps using TaxLift.',
      step: [
        { '@type': 'HowToStep', position: 1, name: 'Connect your tools',       text: 'Connect GitHub, Jira, or other version control systems via OAuth in under 2 minutes.' },
        { '@type': 'HowToStep', position: 2, name: 'Review AI-scored clusters', text: 'TaxLift scans every commit, scores against the 5 CRA SR&ED eligibility dimensions, and groups work into T661-ready clusters.' },
        { '@type': 'HowToStep', position: 3, name: 'Export your T661 package',  text: 'Download a CRA-compliant T661 claim package with narratives, expenditure calculations, and supporting evidence for your CPA to review and file.' },
      ],
      totalTime: 'PT10M',
      supply: [{ '@type': 'HowToSupply', name: 'GitHub or Jira account' }],
      tool:   [{ '@type': 'HowToTool',   name: 'TaxLift (free trial at taxlift.ai)' }],
    }
    const injectLd = (id, data) => {
      let el = document.getElementById(id)
      if (!el) {
        el = document.createElement('script')
        el.id = id
        el.type = 'application/ld+json'
        document.head.appendChild(el)
      }
      el.textContent = JSON.stringify(data)
    }
    injectLd('ld-faq',   faqSchema)
    injectLd('ld-howto', howToSchema)
    return () => {
      document.getElementById('ld-faq')?.remove()
      document.getElementById('ld-howto')?.remove()
    }
  }, [])

  const [mobileOpen, setMobileOpen]   = useState(false)
  const [scrolled, setScrolled]       = useState(false)
  const [waitlistOpen, setWaitlistOpen] = useState(false)
  const [waitlistPlan, setWaitlistPlan] = useState('')
  const [waitlistSource, setWaitlistSource] = useState('marketing')

  // ── June 30 filing deadline urgency banner ──────────────────────────────────
  const DEADLINE = new Date('2026-06-30T23:59:59')
  const daysLeft = Math.max(0, Math.ceil((DEADLINE - new Date()) / 86_400_000))
  const [bannerDismissed, setBannerDismissed] = useState(
    () => sessionStorage.getItem('deadline_banner_v1') === '1'
  )
  const showBanner = !bannerDismissed && daysLeft > 0
  function dismissBanner() {
    sessionStorage.setItem('deadline_banner_v1', '1')
    setBannerDismissed(true)
  }
  // Primary CTA: send founders to the free scan flow
  function openWaitlist(plan = '', source = 'marketing') {
    // Pricing & enterprise leads still go to the waitlist modal.
    // All general "Get started free" / navbar CTAs now go to /scan.
    if (!plan || plan === 'starter' || plan === 'plus') {
      navigate('/scan')
      return
    }
    setWaitlistPlan(plan)
    setWaitlistSource(source)
    setWaitlistOpen(true)
  }

  // Sticky nav shadow on scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Animated counter — starts when hero is in view
  const [heroRef, heroInView] = useInView(0.1)
  const creditCount = useCountUp(340, 1800, heroInView)

  // Smooth scroll for anchor links
  function handleAnchor(e, href) {
    e.preventDefault()
    setMobileOpen(false)
    const el = document.querySelector(href)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-screen bg-white font-sans antialiased">

      {/* ══════════════════════════════════════════════════════════════════════
          0. DEADLINE URGENCY BANNER
      ══════════════════════════════════════════════════════════════════════ */}
      {showBanner && (
        <div className="fixed top-0 inset-x-0 z-[60] h-10 bg-amber-500 flex items-center justify-between px-4 sm:px-6 gap-3">
          <Link to="/scan" className="flex items-center gap-2 min-w-0 flex-1">
            <Clock size={13} className="text-amber-900 flex-shrink-0" />
            <p className="text-amber-950 text-xs sm:text-sm font-semibold truncate">
              <span className="font-extrabold">{daysLeft} days left</span>
              {' '}to file your FY 2024 SR&amp;ED claim — June 30 deadline
            </p>
          </Link>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Link
              to="/scan"
              className="inline-flex items-center gap-1 text-xs font-bold text-amber-950 underline underline-offset-2 hover:no-underline"
            >
              Start your claim <ArrowRight size={11} />
            </Link>
            <button
              onClick={dismissBanner}
              aria-label="Dismiss deadline banner"
              className="text-amber-900 hover:text-amber-950 opacity-70 hover:opacity-100 transition-opacity"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          1. NAVBAR
      ══════════════════════════════════════════════════════════════════════ */}
      <header className={`fixed inset-x-0 z-50 transition-all duration-200 ${
        showBanner ? 'top-10' : 'top-0'
      } ${
        scrolled ? 'bg-white/95 backdrop-blur border-b border-gray-100 shadow-sm' : 'bg-transparent'
      }`}>
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <a href="#" onClick={e => handleAnchor(e, 'body')} className="flex items-center flex-shrink-0">
            <TaxLiftLogo variant={scrolled ? 'light' : 'dark'} size="sm" />
          </a>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map(l => l.isRoute ? (
              <Link
                key={l.label}
                to={l.href}
                className={`text-sm font-semibold transition-colors flex items-center gap-1 px-3 py-1 rounded-full ${
                  l.isCpa
                    ? 'text-emerald-700 hover:text-emerald-800 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
                    : 'text-indigo-600 hover:text-indigo-700 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100'
                }`}
              >
                {l.isCpa ? <BadgeCheck size={13} /> : <Calculator size={13} />}
                {l.label}
              </Link>
            ) : (
              <a
                key={l.label}
                href={l.href}
                onClick={e => handleAnchor(e, l.href)}
                className="text-sm text-gray-600 hover:text-indigo-600 font-medium transition-colors"
              >
                {l.label}
              </a>
            ))}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <span className="text-xs text-gray-400 font-medium px-2">🇨🇦 Proudly Canadian</span>
            <Link
              to="/login"
              className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors px-3 py-1.5"
            >
              Sign in
            </Link>
            <button
              onClick={() => openWaitlist('', 'navbar')}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
            >
              Get started free
              <ArrowRight size={14} />
            </button>
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100"
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </nav>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden bg-white border-b border-gray-100 shadow-lg px-4 pb-4">
            <div className="space-y-1 pt-2">
              {NAV_LINKS.map(l => l.isRoute ? (
                <Link
                  key={l.label}
                  to={l.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold ${l.isCpa ? 'text-emerald-700 hover:bg-emerald-50' : 'text-indigo-600 hover:bg-indigo-50'}`}
                >
                  {l.isCpa ? <BadgeCheck size={14} /> : <Calculator size={14} />}
                  {l.label}
                </Link>
              ) : (
                <a
                  key={l.label}
                  href={l.href}
                  onClick={e => handleAnchor(e, l.href)}
                  className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-600"
                >
                  {l.label}
                </a>
              ))}
              <div className="pt-2 flex flex-col gap-2">
                <Link to="/login" className="block text-center py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg">
                  Sign in
                </Link>
                <button
                  onClick={() => { setMobileOpen(false); openWaitlist('', 'navbar') }}
                  className="block w-full text-center py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg"
                >
                  Get started free
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ══════════════════════════════════════════════════════════════════════
          2. HERO
      ══════════════════════════════════════════════════════════════════════ */}
      <section
        ref={heroRef}
        className="relative pb-20 sm:pb-28 overflow-hidden bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-900"
        style={{ paddingTop: showBanner ? 'calc(7rem + 2.5rem)' : '7rem' }}
      >
        {/* Background grid */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: 'linear-gradient(rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        {/* Glow orb */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            {/* Deadline pill badge */}
            <div className="inline-flex items-center gap-2 bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
              <Clock size={11} className="text-amber-400" />
              FY 2024 SR&amp;ED filing deadline: June 30, 2026 · {daysLeft} days remaining
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight tracking-tight mb-6">
              Your GitHub commits are{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
                worth money.
              </span>
              <br />We'll prove it.
            </h1>

            {/* Sub-headline */}
            <p className="text-lg sm:text-xl text-slate-300 max-w-xl mx-auto leading-relaxed mb-3">
              TaxLift analyzes your commit history and generates a CRA-ready SR&amp;ED claim — no consultants, no contingency, no percentage of your refund taken.
            </p>

            {/* Pricing trust line */}
            <p className="text-sm text-indigo-300 font-medium mb-8">
              $999 flat fee · no % of your refund · average refund{' '}
              <span className="text-green-400 font-bold">${creditCount}K+</span>
              {' '}for a 10-person team
            </p>

            {/* CTAs — two only */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
              <button
                onClick={() => openWaitlist('', 'hero')}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-base px-7 py-3.5 rounded-xl transition-colors shadow-lg shadow-indigo-900/40"
              >
                Connect GitHub &amp; get your estimate
                <ArrowRight size={16} />
              </button>
              <Link
                to="/login?mode=demo"
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white font-semibold text-base px-7 py-3.5 rounded-xl border border-white/20 transition-colors"
              >
                <FlaskConical size={16} />
                See a live demo
              </Link>
            </div>

            {/* Process trust line */}
            <p style={{ textAlign: 'center', marginTop: '14px', marginBottom: '16px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#666', background: '#f1f5f9', borderRadius: '6px', padding: '6px 14px' }}>
                <span style={{ width: '7px', height: '7px', background: '#22c55e', borderRadius: '50%', flexShrink: 0 }} />
                TaxLift prepares the full package &nbsp;·&nbsp; your CPA reviews and files &nbsp;·&nbsp; you keep the refund
              </span>
            </p>

            {/* CPA self-selection strip — single clean link */}
            <div className="flex justify-center mb-14">
              <Link
                to="/partners"
                className="group inline-flex items-center gap-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/50 rounded-2xl px-5 py-3 transition-all"
              >
                <div className="w-7 h-7 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <BadgeCheck size={14} className="text-emerald-400" />
                </div>
                <div className="text-left">
                  <p className="text-emerald-300 text-xs font-semibold leading-none mb-0.5">Are you a CPA or accountant?</p>
                  <p className="text-emerald-400/70 text-xs leading-none">Earn $300 flat per client · Partner program →</p>
                </div>
                <ArrowRight size={13} className="text-emerald-500 group-hover:translate-x-0.5 transition-transform ml-1" />
              </Link>
            </div>

            {/* Dashboard mockup */}
            <DashboardMockup />

            {/* Founder trust signal */}
            <div className="mt-14 inline-flex flex-col sm:flex-row items-center justify-center gap-6 bg-white/5 border border-white/10 rounded-2xl px-8 py-5">
              <div className="text-left">
                <p className="text-white text-sm font-semibold mb-0.5">Built by founders, for founders</p>
                <p className="text-slate-400 text-xs leading-relaxed max-w-sm">
                  We're a small Canadian team frustrated by how much SR&ED money gets left on the table.
                  Questions? Email us directly at{' '}
                  <a href="mailto:hello@taxlift.ai" className="text-indigo-400 hover:underline">hello@taxlift.ai</a>
                </p>
              </div>
              <div className="flex-shrink-0 flex gap-2">
                {['P', 'S'].map((initial, i) => (
                  <div key={i} className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm ${i === 0 ? 'bg-indigo-600' : 'bg-violet-600'}`}>
                    {initial}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          3. PROBLEM / PAIN
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-indigo-600 text-sm font-semibold uppercase tracking-widest mb-2">The problem</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              The SR&ED process is broken for tech companies
            </h2>
            <p className="mt-3 text-gray-500 max-w-xl mx-auto">
              Billions in Canadian R&D credits go unclaimed every year. Here's why.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PAIN_CARDS.map(card => {
              const Icon = card.icon
              return (
                <div key={card.title} className="rounded-2xl border border-gray-100 p-7 shadow-sm hover:shadow-md transition-shadow">
                  <div className={`w-11 h-11 ${card.bg} rounded-xl flex items-center justify-center mb-4`}>
                    <Icon size={20} className={card.color} />
                  </div>
                  <h3 className="font-bold text-gray-900 text-base mb-2">{card.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{card.body}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          4. HOW IT WORKS
      ══════════════════════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-indigo-600 text-sm font-semibold uppercase tracking-widest mb-2">How it works</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              From code to credit in three steps
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* connecting line (desktop) */}
            <div className="hidden md:block absolute top-10 left-1/3 right-1/3 h-px bg-gradient-to-r from-indigo-200 via-indigo-400 to-indigo-200" />

            {STEPS.map((step, i) => {
              const Icon = step.icon
              return (
                <div key={step.number} className="relative flex flex-col items-center text-center">
                  {/* step number */}
                  <div className="relative z-10 w-20 h-20 bg-white border-2 border-indigo-200 rounded-2xl flex flex-col items-center justify-center shadow-md mb-5">
                    <span className="text-[10px] font-bold text-indigo-400 leading-none">{step.number}</span>
                    <Icon size={22} className="text-indigo-600 mt-1" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-base mb-2">{step.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed max-w-xs">{step.body}</p>
                  {/* arrow between steps (mobile) */}
                  {i < STEPS.length - 1 && (
                    <ChevronRight size={20} className="text-indigo-300 mt-4 md:hidden" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          5. FEATURES
      ══════════════════════════════════════════════════════════════════════ */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-indigo-600 text-sm font-semibold uppercase tracking-widest mb-2">Features</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Everything your CPA needs, automatically
            </h2>
            <p className="mt-3 text-gray-500 max-w-xl mx-auto">
              TaxLift is the only SR&ED platform built for engineering teams, not accountants.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => {
              const Icon = f.icon
              return (
                <div
                  key={f.title}
                  className="group rounded-2xl border border-gray-100 p-6 hover:border-indigo-200 hover:shadow-md transition-all"
                >
                  <div className={`w-10 h-10 ${f.bg} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon size={18} className={f.color} />
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm mb-1.5">{f.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.body}</p>
                </div>
              )
            })}
          </div>

          {/* Security trust row */}
          <div style={{ marginTop: '2.5rem', paddingTop: '2rem', borderTop: '1px solid #e2e8f0' }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#aaa', marginBottom: '14px' }}>Your code stays yours</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '14px' }}>
              {[
                { emoji: '🔒', title: 'Read-only GitHub access',        body: 'OAuth read-only scope only. We can never write to, fork, or modify your repositories.' },
                { emoji: '🚫', title: 'No code stored',                 body: 'Commit metadata and messages are analyzed in memory. Your source code is never stored on our servers.' },
                { emoji: '🔗', title: 'Tamper-evident audit chain',     body: 'Every claim is cryptographically hashed. If CRA audits you, your evidence chain is timestamped and unbreakable.' },
              ].map(({ emoji, title, body }) => (
                <div key={title} style={{ background: '#f8f9fa', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ fontSize: '1.25rem', marginBottom: '6px' }}>{emoji}</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '4px' }}>{title}</div>
                  <div style={{ fontSize: '0.8rem', color: '#666', lineHeight: 1.4 }}>{body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          6. EARLY ADOPTER SECTION (replaces fake testimonials)
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-indigo-600 text-sm font-semibold uppercase tracking-widest mb-3">Early access</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Be among the first 50 Canadian startups
          </h2>
          <p className="text-gray-500 text-base max-w-xl mx-auto mb-10 leading-relaxed">
            We're onboarding a small cohort of Canadian tech companies before our full launch.
            Early adopters get hands-on support, locked-in pricing, and a direct line to the founding team.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            {[
              { icon: Lock,         title: 'Locked-in $999',       body: 'Price guaranteed for your first 3 fiscal years. No increases.' },
              { icon: Users,        title: 'Founding team access',  body: 'Direct Slack channel with the team. Your feedback shapes the roadmap.' },
              { icon: ShieldCheck,  title: 'White-glove onboarding', body: 'We help you connect GitHub, run your first scan, and review clusters together.' },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm text-left">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mb-4">
                  <Icon size={18} className="text-indigo-600" />
                </div>
                <p className="font-bold text-gray-900 text-sm mb-1">{title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => openWaitlist('starter', 'early-adopter')}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors shadow-lg shadow-indigo-200"
          >
            Apply for early access <ArrowRight size={16} />
          </button>
          <p className="text-xs text-gray-400 mt-3">Free scan included · No credit card until you're ready to file</p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          7. SR&ED CREDIT CALCULATOR
      ══════════════════════════════════════════════════════════════════════ */}
      <SrEdCalculator openWaitlist={openWaitlist} navigate={navigate} />

      {/* ══════════════════════════════════════════════════════════════════════
          7b. FULL ESTIMATOR CTA BANNER
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-14 bg-gradient-to-r from-indigo-600 to-violet-600">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full mb-4">
                <Calculator size={13} />
                Free SR&amp;ED Estimator
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                Get a detailed credit breakdown — province, salary mix, contractor split & prior years
              </h2>
              <p className="text-indigo-100 text-sm leading-relaxed max-w-xl">
                The quick calculator above gives a headline number. The full estimator lets you model every variable:
                employee vs contractor split, fiscal year end, missed prior years, CCPC status, province-specific rates,
                university partnership bonuses, and a side-by-side comparison with traditional consultant costs.
                No signup required.
              </p>
              <div className="mt-5 flex flex-wrap gap-4 text-sm text-indigo-100">
                {['All 10 provinces', 'Prior year catch-up', 'Contractor split', 'Net ROI vs consultant fees', 'Eligibility quiz'].map(f => (
                  <span key={f} className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-indigo-300" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-4.121-4.121a1 1 0 011.414-1.414L8.414 12.172l6.879-6.879a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {f}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex-shrink-0 flex flex-col items-center gap-3">
              <Link
                to="/estimate"
                className="inline-flex items-center gap-2 bg-white text-indigo-700 hover:bg-indigo-50 font-bold text-sm px-7 py-3.5 rounded-xl shadow-lg transition-colors"
              >
                <Calculator size={17} />
                Open Full Estimator
                <ArrowRight size={15} />
              </Link>
              <span className="text-indigo-200 text-xs">Free · No signup · Instant results</span>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          8. FOR CPAs
      ══════════════════════════════════════════════════════════════════════ */}
      <section id="for-cpas" className="py-20 bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center">
            {/* Left: copy */}
            <div>
              <p className="text-indigo-400 text-sm font-semibold uppercase tracking-widest mb-3">For CPAs & SR&ED consultants</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-5">
                Turn every client into a{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
                  recurring revenue stream
                </span>
              </h2>
              <p className="text-slate-300 text-base leading-relaxed mb-8">
                Refer your tech clients to TaxLift and earn a <strong className="text-white">$300 flat commission</strong> per client — paid when the T661 package is delivered, not when CRA processes the claim. Your firm's name on every deliverable, independent CPA login, annotation rights, and a published methodology you can cite in any CRA audit.
              </p>

              <div className="space-y-4 mb-8">
                {[
                  { icon: Link2,      text: 'Your own CPA login — see all referred clients in one dashboard' },
                  { icon: DollarSign, text: '$300 flat commission per client — paid at T661 delivery, not CRA processing' },
                  { icon: Package,    text: 'Annotate, approve, or flag narratives before anything is filed' },
                  { icon: BarChart2,  text: 'Published SR&ED methodology (IC86-4R3 aligned) to defend any audit' },
                ].map(item => {
                  const Icon = item.icon
                  return (
                    <div key={item.text} className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon size={14} className="text-indigo-400" />
                      </div>
                      <p className="text-slate-300 text-sm leading-relaxed">{item.text}</p>
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => navigate('/partners')}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-lg shadow-indigo-900/40"
                >
                  View partner program
                  <ArrowRight size={15} />
                </button>
                <Link
                  to="/cpa/login?mode=demo"
                  className="inline-flex items-center gap-2 border border-slate-600 hover:border-emerald-500/50 text-slate-300 hover:text-emerald-300 font-medium px-5 py-3 rounded-xl transition-colors"
                >
                  <FlaskConical size={14} />
                  Try CPA portal demo
                </Link>
              </div>
            </div>

            {/* Right: commission card */}
            <div className="mt-12 lg:mt-0">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-4">Example partner earnings</p>

                <div className="space-y-3">
                  {[
                    { company: 'Zenith Biotech',  credit: '$312,000', fee: '$300', status: 'Paid',      statusColor: 'text-green-400 bg-green-400/10' },
                    { company: 'Pulse Commerce',  credit: '$142,000', fee: '$300', status: 'Paid',      statusColor: 'text-green-400 bg-green-400/10' },
                    { company: 'Atlas Network',   credit: '$67,000',  fee: '$300', status: 'Confirmed', statusColor: 'text-blue-400  bg-blue-400/10'  },
                    { company: 'Axiom Robotics',  credit: '$89,000',  fee: '$300', status: 'Pending',   statusColor: 'text-amber-400 bg-amber-400/10' },
                  ].map(row => (
                    <div key={row.company} className="flex items-center gap-3 bg-slate-900/60 rounded-xl px-4 py-3">
                      <Building2 size={14} className="text-slate-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-semibold truncate">{row.company}</p>
                        <p className="text-slate-500 text-[10px]">Credit: {row.credit}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-green-400 text-sm font-bold">{row.fee}</p>
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${row.statusColor}`}>
                          {row.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between">
                  <span className="text-slate-400 text-xs">Total referral fees</span>
                  <span className="text-white font-extrabold text-lg">$12,000</span>
                </div>
                <p className="text-slate-500 text-[10px] mt-1">4 referrals · flat $300 per client · paid at T661 delivery</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          8. PRICING
      ══════════════════════════════════════════════════════════════════════ */}
      <section id="pricing" className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-indigo-600 text-sm font-semibold uppercase tracking-widest mb-2">Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              $999 flat — not 15–25% of your refund.
            </h2>
            <p className="mt-3 text-gray-500 max-w-xl mx-auto">
              Consultants take a cut before you see a dollar. TaxLift charges a flat fee and you keep the rest.
            </p>
          </div>

          {/* Competitor comparison */}
          <div className="max-w-3xl mx-auto mb-8">
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

          {/* Two-track pricing */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8 max-w-3xl mx-auto">

            {/* Startups */}
            <div className="relative rounded-2xl border-2 border-indigo-500 bg-indigo-600 text-white shadow-xl shadow-indigo-500/20 p-6 flex flex-col">
              <div className="absolute -top-3.5 left-6">
                <span className="rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-1 text-xs font-bold text-white shadow">Flat fee</span>
              </div>
              <p className="text-indigo-300 text-xs font-semibold uppercase tracking-widest mb-2">For startups &amp; founders</p>
              <h3 className="font-bold text-lg text-white mb-1">SR&amp;ED Filing Package</h3>
              <p className="text-sm text-indigo-200 mb-4">Everything you need to file — keep your full refund.</p>
              <div className="mb-4">
                <span className="text-3xl font-extrabold text-white">$999</span>
                <span className="text-sm text-indigo-300 ml-2">per fiscal year</span>
              </div>
              <ul className="flex-1 space-y-2 mb-5">
                {['AI T661 narrative generation', 'GitHub & Jira integrations', 'CPA-ready handoff package', 'Audit vault — 3 years retained', 'Prior-year catch-up (18 months)'].map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-indigo-100">
                    <span className="mt-1 w-3.5 h-3.5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 text-[9px] font-bold text-white">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/pricing" className="w-full text-center rounded-xl py-2.5 text-sm font-semibold bg-white text-indigo-600 hover:bg-indigo-50 transition-colors">
                Get started — $999 →
              </Link>
            </div>

            {/* CPAs */}
            <div className="relative rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 text-gray-900 shadow-sm p-6 flex flex-col">
              <div className="absolute -top-3.5 left-6">
                <span className="rounded-full bg-emerald-600 px-4 py-1 text-xs font-bold text-white shadow">CPA Partners</span>
              </div>
              <p className="text-emerald-700 text-xs font-semibold uppercase tracking-widest mb-2">For CPA firms</p>
              <h3 className="font-bold text-lg text-gray-900 mb-1">CPA Partner Seat</h3>
              <p className="text-sm text-gray-500 mb-4">Add SR&amp;ED as a service. Earn $300 per client you refer.</p>
              <div className="mb-4">
                <span className="text-3xl font-extrabold text-gray-900">Custom</span>
                <span className="text-sm text-gray-500 ml-2">pricing</span>
              </div>
              <ul className="flex-1 space-y-2 mb-5">
                {['Unlimited client workspaces', 'White-label CPA handoff package', '$300 commission per referred client', 'Client pipeline dashboard', 'Priority support & onboarding'].map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="mt-1 w-3.5 h-3.5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 text-[9px] font-bold text-emerald-600">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a href="https://calendly.com/taxlift" target="_blank" rel="noopener noreferrer" className="w-full text-center rounded-xl py-2.5 text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-500 transition-colors">
                Book a demo to get pricing →
              </a>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mb-6">
            Need white-label deployment or API access?{' '}
            <Link to="/pricing" className="text-indigo-600 hover:underline font-medium">Contact us for Enterprise →</Link>
          </p>

          <div className="flex justify-center">
            <p>
              Not ready to connect GitHub?{' '}
              <Link to="/demo" className="text-indigo-600 hover:text-indigo-700 font-semibold hover:underline">
                Try the demo first →
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          9. FAQ
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-indigo-600 text-sm font-semibold uppercase tracking-widest mb-2">FAQ</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Common questions
            </h2>
          </div>

          <div className="space-y-3">
            {FAQS.map(item => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>

          <p className="text-center text-sm text-gray-500 mt-8">
            Still have questions?{' '}
            <a href="mailto:hello@taxlift.ai" className="text-indigo-600 hover:underline font-medium">
              Email us →
            </a>
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          CTA BAND
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 bg-gradient-to-r from-indigo-600 to-violet-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            Find every dollar of Canadian innovation funding you qualify for
          </h2>
          <p className="text-indigo-100 text-lg mb-8 max-w-xl mx-auto">
            Automate your SR&amp;ED claim from your existing engineering data.
            See your estimate in 5 minutes — no signup required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => openWaitlist('', 'cta_band')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-indigo-700 font-bold text-base px-8 py-3.5 rounded-xl hover:bg-indigo-50 transition-colors shadow-lg"
            >
              Connect GitHub &amp; get your estimate
              <ArrowRight size={16} />
            </button>
            <Link
              to="/demo"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-indigo-700/50 border border-white/30 text-white font-semibold text-base px-8 py-3.5 rounded-xl hover:bg-indigo-700 transition-colors"
            >
              See a live demo
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          10. FOOTER
      ══════════════════════════════════════════════════════════════════════ */}
      <footer className="bg-slate-950 py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <Zap size={14} className="text-white" />
                </div>
                <span className="font-bold text-white text-lg">TaxLift</span>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
                SR&ED automation for Canadian tech companies. Connect your tools, we handle the documentation.
              </p>
              <p className="mt-4 text-indigo-400 text-sm font-semibold">
                TaxLift prepares · Your CPA files
              </p>
            </div>

            {/* Product */}
            <div>
              <p className="text-slate-300 font-semibold text-sm mb-3">Product</p>
              <ul className="space-y-2">
                {[
                  { label: 'How it works',  href: '#how-it-works' },
                  { label: 'Features',      href: '#features'     },
                  { label: 'Pricing',       href: '#pricing'      },
                  { label: 'Free scan',     href: '/scan',        internal: true },
                  { label: 'Estimator',     href: '/estimate',    internal: true },
                  { label: 'For CPAs',      href: '#for-cpas'     },
                ].map(l => (
                  <li key={l.label}>
                    {l.internal
                      ? <Link to={l.href} className="text-slate-400 hover:text-white text-sm transition-colors">{l.label}</Link>
                      : <a href={l.href} className="text-slate-400 hover:text-white text-sm transition-colors">{l.label}</a>
                    }
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <p className="text-slate-300 font-semibold text-sm mb-3">Company</p>
              <ul className="space-y-2">
                {[
                  { label: 'Privacy Policy',   href: 'https://taxlift.ai/privacy', internal: false },
                  { label: 'Terms of Service', href: 'https://taxlift.ai/terms',   internal: false },
                  { label: 'Security',         href: '/security',                  internal: true  },
                  { label: 'Sign in',          href: '/login',                     internal: true  },
                ].map(l => (
                  <li key={l.label}>
                    {l.internal
                      ? <Link to={l.href} className="text-slate-400 hover:text-white text-sm transition-colors">{l.label}</Link>
                      : <a href={l.href} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white text-sm transition-colors">{l.label}</a>
                    }
                  </li>
                ))}
              </ul>

              {/* Contact */}
              <p className="text-slate-300 font-semibold text-sm mt-6 mb-3">Contact</p>
              <ul className="space-y-2">
                <li>
                  <a href="mailto:support@taxlift.ai" className="text-slate-400 hover:text-white text-sm transition-colors">
                    support@taxlift.ai
                  </a>
                  <span className="block text-slate-600 text-xs">Customer support</span>
                </li>
                <li>
                  <a href="mailto:hello@taxlift.ai" className="text-slate-400 hover:text-white text-sm transition-colors">
                    hello@taxlift.ai
                  </a>
                  <span className="block text-slate-600 text-xs">General inquiries</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-slate-500 text-xs">
              © {new Date().getFullYear()} TaxLift Technologies Inc. All rights reserved.
            </p>
            <p style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '1.5rem' }}>
              SR&amp;ED credit estimates are for planning purposes only. TaxLift prepares your documentation — a CPA or SR&amp;ED consultant reviews and files. We eliminate 95% of their prep work.
            </p>
          </div>
        </div>
      </footer>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <WaitlistModal
        isOpen={waitlistOpen}
        onClose={() => setWaitlistOpen(false)}
        defaultPlan={waitlistPlan}
        source={waitlistSource}
      />

      {/* ── Floating chatbot ────────────────────────────────────────────── */}
      <TaxLiftChat
        onLeadCapture={(email, estimateRange) => {
          leads.capture({ email, estimate_range: estimateRange, source: 'chat' }).catch(() => {})
        }}
      />

    </div>
  )
}

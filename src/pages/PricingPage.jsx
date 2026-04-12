/**
 * PricingPage — /pricing
 *
 * Two pricing tracks:
 *   Option A — Annual subscription (CPA-introduced / committed buyers)
 *   Option B — Pay-per-claim (self-serve SMBs, first-time filers)
 *
 * URL params:
 *   ?estimate=180000   — credit estimate in CAD (pre-fills hero banner)
 *   ?plan=plus         — pre-highlights a specific plan
 *   ?track=claim       — pre-selects the claim-based track
 */
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { usePageMeta } from '../hooks/usePageMeta'
import {
  ShieldCheck, Check, ArrowRight, ArrowLeft, Loader2, Sparkles,
  ChevronDown, ChevronUp, Zap, Star, Clock, Lock, ExternalLink,
  TrendingUp, Calendar, FileText, RefreshCw, AlertCircle, BadgeCheck,
} from 'lucide-react'
import PricingCard from '../components/PricingCard'
import { PLANS, CLAIM_PLANS, redirectToCheckout, getPlanForBilling } from '../lib/stripe'
import WaitlistModal from '../components/WaitlistModal'

function fmtK(n) {
  const v = Number(n) || 0
  if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(1) + 'M'
  if (v >= 1_000)     return '$' + Math.round(v / 1_000) + 'K'
  return '$' + Math.round(v).toLocaleString('en-CA')
}

const FAQS = [
  {
    q: "How does the fee work — and what if my actual CRA assessment is lower than the estimate?",
    a: "Starter is 3% of your scan estimate; Plus is 5%. The fee is charged when your CPA-ready package is complete and you are ready to file — before CRA processes your claim. Our scan estimate is intentionally conservative (we use a low hourly rate and a per-commit proxy that understates most real claims), so actual CRA assessments typically meet or exceed the estimate. That said, if your actual CRA assessment comes in more than 30% below the scan estimate, we will issue a partial refund for the difference. No one should pay more than they recover.",
  },
  {
    q: "What is the difference between Starter (3%) and Plus (5%)?",
    a: "Starter covers full SR&ED automation — AI T661 narratives, GitHub and Jira integration, CPA handoff package, audit vault, and 3 years of evidence retention. Plus adds the Grants module: automatic matching against 9 Canadian innovation funding programs including NRC-IRAP, OITC, NGen, and provincial programs, plus a gap-fill interview and AI section drafting. On a $150K SR&ED credit, Starter costs $4,500 and Plus costs $7,500 — the extra $3,000 gives you access to grant programs that can return $500K–$4M+ in non-dilutive funding.",
  },
  {
    q: 'How is TaxLift different from hiring an SR&ED consultant?',
    a: "Traditional SR&ED consultants charge 15–25% of your refund as a contingency fee. On a $200K claim that is $30–50K taken from your refund before you see a dollar. TaxLift charges 3% — roughly 5–8× less — and you get a CPA-ready package generated in hours, not weeks. Your CPA stays in the loop; they just skip the heavy documentation grind.",
  },
  {
    q: 'Do I still need a CPA?',
    a: "Yes — and that is by design. TaxLift prepares a complete CPA-ready package (T661 narratives, financial schedule, evidence chain of custody). Your CPA reviews, signs off, and submits to CRA. This keeps your accountant in the loop without requiring them to do the heavy documentation work.",
  },
  {
    q: 'How long does it take to get my package ready?',
    a: 'Most customers complete their first package in 2-4 hours — primarily reviewing and approving the AI-generated T661 narratives. After that, updates are continuous as you commit more code.',
  },
  {
    q: 'What if CRA audits my claim?',
    a: 'TaxLift generates an audit-ready evidence chain of custody — every qualifying commit is timestamped and linked to its CRA activity category. Annual plan subscribers have their vault updated continuously, so responding to a CRA information request takes hours, not weeks.',
  },
  {
    q: 'Can I claim for previous tax years?',
    a: 'Yes. CRA allows SR&ED claims for up to 18 months after fiscal year-end. The Plus annual plan includes a prior-years catch-up analysis.',
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
  { label: 'CRA Compliant',         icon: ShieldCheck },
  { label: '14-day free trial',     icon: Clock       },
  { label: '3% vs. 15–25% consult', icon: Lock        },
  { label: 'CPA-ready package',     icon: Star        },
  { label: 'Pay on results',        icon: BadgeCheck  },
]

function RoiCalculator({ defaultCredit = 150000 }) {
  const [credit, setCredit] = useState(defaultCredit)
  const c = Math.max(50000, Math.min(credit, 2000000))
  const consultantFee    = Math.round(c * 0.20)
  const taxliftFeeStarter = Math.round(c * 0.03)
  const taxliftFeePlus    = Math.round(c * 0.05)
  const taxliftFee        = taxliftFeeStarter
  const savings           = Math.max(0, consultantFee - taxliftFeeStarter)
  const roi               = taxliftFeeStarter > 0 ? Math.round((savings / taxliftFeeStarter) * 100) : 0
  const pct           = ((c - 50000) / (2000000 - 50000)) * 100

  return (
    <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-2xl p-8 mb-16 text-white">
      <div className="max-w-2xl mx-auto">
        <p className="text-indigo-300 text-xs font-semibold uppercase tracking-widest mb-1 text-center">ROI Calculator</p>
        <h2 className="text-2xl font-bold mb-1 text-center">How much does TaxLift save you?</h2>
        <p className="text-indigo-300 text-sm text-center mb-8">Drag to set your estimated SR&amp;ED credit</p>
        <div className="mb-8">
          <div className="flex justify-between items-baseline mb-3">
            <span className="text-indigo-300 text-sm">My estimated SR&amp;ED credit</span>
            <span className="text-3xl font-extrabold tabular-nums">{fmtK(c)}</span>
          </div>
          <input
            type="range" min={50000} max={2000000} step={10000}
            value={credit}
            onChange={e => setCredit(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{ background: 'linear-gradient(to right, #818cf8 0%, #818cf8 ' + pct + '%, #334155 ' + pct + '%, #334155 100%)', accentColor: '#818cf8' }}
          />
          <div className="flex justify-between text-xs text-indigo-500 mt-1">
            <span>$50K</span><span>$500K</span><span>$1M</span><span>$2M</span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'SR&ED consultant',        sub: '~20% contingency',      value: fmtK(consultantFee), note: 'taken from your refund', bad: true },
            { label: 'TaxLift fee',             sub: '3–5% of credit',        value: fmtK(taxliftFeeStarter) + '–' + fmtK(taxliftFeePlus), note: 'Starter vs Plus', bad: false },
            { label: 'Pay-per-Claim',           sub: 'No subscription',       value: '$1,997',            note: 'one fiscal year',        bad: false },
            { label: 'You save vs. consultant', sub: roi + 'x ROI on TaxLift', value: fmtK(savings),      note: 'back in your pocket', highlight: true },
          ].map(({ label, sub, value, note, bad, highlight }) => (
            <div key={label} className={'rounded-xl p-4 text-center ' + (highlight ? 'bg-indigo-600 border border-indigo-400' : bad ? 'bg-slate-800 border border-red-900/40' : 'bg-slate-800 border border-slate-700')}>
              <p className={'text-xs font-semibold mb-0.5 ' + (highlight ? 'text-indigo-200' : 'text-slate-400')}>{label}</p>
              <p className={'text-[10px] mb-2 ' + (highlight ? 'text-indigo-300' : 'text-slate-500')}>{sub}</p>
              <p className={'text-lg font-bold mb-1 ' + (bad ? 'text-red-400' : highlight ? 'text-white' : 'text-emerald-400')}>{value}</p>
              <p className={'text-[10px] ' + (highlight ? 'text-indigo-300' : 'text-slate-500')}>{note}</p>
            </div>
          ))}
        </div>
        <p className="text-indigo-500 text-[11px] text-center mt-4">Consultant fee estimated at 20% contingency midpoint. Actual rates vary 15–25%.</p>
      </div>
    </div>
  )
}

function YearRoundValue() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 mb-16">
      <div className="text-center mb-8">
        <p className="text-indigo-600 text-xs font-semibold uppercase tracking-widest mb-2">What you get between filings</p>
        <h2 className="text-xl font-bold text-gray-900 mb-2">SR&amp;ED is not just an annual event — and your subscription should not feel like one either</h2>
        <p className="text-gray-500 text-sm max-w-xl mx-auto">Annual plan subscribers get year-round value that compounds. By the time you file, most of the work is already done.</p>
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
          <strong>A note on Pay-per-Claim:</strong> You get a great T661 package — but no ongoing audit vault, no mid-year tracking, and no head start on next year's claim. That is fine for a first filing. For companies with continuous R&D programs, an annual plan pays for itself in the time saved on year two.
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
        <span className={'font-extrabold text-4xl tracking-tight ' + (highlighted ? 'text-white' : 'text-slate-900')}>{price}</span>
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

export default function PricingPage() {
  usePageMeta({
    title:       'Pricing — TaxLift SR&ED Tax Credit Platform',
    description: 'TaxLift charges 3% of your SR&ED credit — not 15–25% like consultants. CPA-ready T661 package from your GitHub and Jira data. 14-day free trial.',
    path:        '/pricing',
    breadcrumb:  [{ name: 'Home', path: '/' }, { name: 'Pricing', path: '/pricing' }],
  })

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [track,           setTrack]           = useState(searchParams.get('track') === 'claim' ? 'claim' : 'annual')
  const [checkoutLoading, setCheckoutLoading] = useState(null)
  const [waitlistOpen,    setWaitlistOpen]    = useState(false)
  const [waitlistPlan,    setWaitlistPlan]    = useState('')
  const [waitlistSource,  setWaitlistSource]  = useState('pricing')
  const [estimate,        setEstimate]        = useState(null)
  const [clusterCount,    setClusterCount]    = useState(null)

  useEffect(() => {
    const paramEstimate = searchParams.get('estimate')
    if (paramEstimate && !isNaN(Number(paramEstimate))) { setEstimate(Number(paramEstimate)); return }
    try {
      const raw = sessionStorage.getItem('taxlift_scan_results')
      if (raw) {
        const scan = JSON.parse(raw)
        if (scan?.estimated_credit) { setEstimate(scan.estimated_credit); setClusterCount(scan.clusters?.length ?? null) }
      }
    } catch { /* ignore */ }
  }, [searchParams])

  const creditLow     = estimate ? Math.round(estimate * 0.65) : null
  const creditHigh    = estimate ? Math.round(estimate * 1.35) : null
  const taxliftFeeLow  = estimate ? Math.round(estimate * 0.03) : null   // Starter (3%)
  const taxliftFeeHigh = estimate ? Math.round(estimate * 0.05) : null   // Plus (5%)
  const taxliftFee     = taxliftFeeLow  // used in comparison vs consultant (Starter baseline)
  const consultantLow  = estimate ? Math.round(estimate * 0.15) : null
  const consultantHigh = estimate ? Math.round(estimate * 0.25) : null
  const savingsLow     = consultantLow  && taxliftFeeHigh ? Math.max(0, consultantLow  - taxliftFeeHigh) : null
  const savingsHigh    = consultantHigh && taxliftFeeLow  ? Math.max(0, consultantHigh - taxliftFeeLow)  : null
  const highlightedPlan = searchParams.get('plan') || null

  const annualPlans = Object.values(PLANS).map(p => {
    const resolved = getPlanForBilling(p, 'annual')
    return {
      ...resolved,
      highlighted: highlightedPlan ? p.id === highlightedPlan : p.highlighted,
    }
  })

  async function handlePricingCta(planId) {
    if (planId === 'enterprise') {
      setWaitlistPlan('enterprise'); setWaitlistSource('pricing_enterprise'); setWaitlistOpen(true); return
    }
    setCheckoutLoading(planId)
    const result = await redirectToCheckout(planId)
    setCheckoutLoading(null)
    if (!result.ok) { setWaitlistPlan(planId); setWaitlistSource('pricing_checkout_fallback'); setWaitlistOpen(true) }
  }

  const fromScan = !!sessionStorage.getItem('taxlift_scan_results')

  return (
    <div className="min-h-screen bg-slate-50">

      <nav className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {fromScan && (
              <button onClick={() => navigate('/scan/results')} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors mr-1">
                <ArrowLeft size={13} /> Back to results
              </button>
            )}
            <button onClick={() => navigate('/')} className="flex items-center gap-2">
              <div className="w-7 h-7 bg-indigo-600 rounded-xl flex items-center justify-center"><Zap size={14} className="text-white" /></div>
              <span className="font-bold text-gray-900 tracking-tight text-sm">TaxLift</span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/estimate')} className="text-xs text-gray-500 hover:text-gray-700 transition-colors hidden sm:block">Manual estimator</button>
            <button onClick={() => navigate('/scan')} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors">
              <Sparkles size={12} /> Free scan
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-12 sm:py-16">

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
                  <div className="flex items-center justify-between gap-4"><span className="text-indigo-300 text-xs">TaxLift (3–5% fee)</span><span className="text-white font-mono text-xs font-semibold">{fmtK(taxliftFeeLow)}–{fmtK(taxliftFeeHigh)}</span></div>
                  <div className="border-t border-white/20 pt-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300">You save</span>
                    <span className="text-emerald-300 font-bold font-mono text-sm">{fmtK(savingsLow)}–{fmtK(savingsHigh)}</span>
                  </div>
                  <p className="text-indigo-300 text-[10px] leading-snug text-center">Pick a plan below to unlock your full package ↓</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="text-center mb-10">
          <p className="text-indigo-600 text-sm font-semibold uppercase tracking-widest mb-2">Pricing</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            {creditLow ? 'Claim your ' + fmtK(creditHigh) + ' — pay just 3%' : 'SR&ED automation — 3% of your credit, not 15–25%'}
          </h1>
          <p className="text-gray-500 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
            Consultants charge 15–25% contingency. TaxLift charges 3% of your estimated SR&amp;ED credit — a CPA-ready T661 package from your GitHub and Jira data, for a fraction of the cost. 14-day free trial included.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
          {TRUST_MARKS.map(({ label, icon: Icon }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-gray-500 bg-white border border-gray-200 rounded-full px-3.5 py-1.5">
              <Icon size={12} className="text-indigo-500" />{label}
            </div>
          ))}
        </div>

        {/* Track toggle */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex bg-white border border-gray-200 rounded-2xl p-1.5 shadow-sm gap-1">
            <button
              onClick={() => setTrack('annual')}
              className={'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ' + (track === 'annual' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:text-gray-700')}
            >
              <TrendingUp size={14} />
              Feature Plans (3% of credit)
              {track === 'annual' && <span className="text-[10px] bg-white/20 rounded-full px-2 py-0.5 font-medium">Starter · Plus · Enterprise</span>}
            </button>
            <button
              onClick={() => setTrack('claim')}
              className={'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ' + (track === 'claim' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:text-gray-700')}
            >
              <FileText size={14} />
              Pay per Claim
              {track === 'claim' && <span className="text-[10px] bg-white/20 rounded-full px-2 py-0.5 font-medium">First-time filers</span>}
            </button>
          </div>
        </div>

        {track === 'annual' ? (
          <div className="text-center mb-8">
            <p className="text-sm text-gray-500 max-w-xl mx-auto">
              Starter is <strong className="text-gray-700">3%</strong> of your estimated SR&amp;ED credit. Plus is <strong className="text-gray-700">5%</strong> and adds the Grants module — unlocking up to $4M+ in additional Canadian funding.
              {estimate ? <>{' '}Your fee range: <strong className="text-indigo-600">{fmtK(taxliftFeeLow)}–{fmtK(taxliftFeeHigh)}</strong> on a {fmtK(estimate)} credit estimate.</> : null}
            </p>
          </div>
        ) : (
          <div className="text-center mb-8">
            <p className="text-sm text-gray-500 max-w-xl mx-auto">Pay once, get your T661 package, file with your CPA. No subscription. Come back next year when you need us.</p>
          </div>
        )}

        {track === 'annual' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start mb-4">
            {annualPlans.map(plan => (
              <PricingCard key={plan.id} plan={plan} ctaLoading={checkoutLoading === plan.id} onCta={() => handlePricingCta(plan.id)} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start max-w-3xl mx-auto mb-4">
            {Object.values(CLAIM_PLANS).map(plan => (
              <ClaimCard key={plan.id} plan={plan} ctaLoading={checkoutLoading === plan.id} onCta={() => handlePricingCta(plan.id)} />
            ))}
          </div>
        )}

        <div className="text-center mb-12 space-y-2">
          <p className="text-xs text-gray-400">Prices in CAD · 3% of estimated SR&amp;ED credit · 14-day free trial on all plans · payment processed via Stripe</p>
          {track === 'claim' && (
            <p className="text-xs text-gray-400">Want year-round coverage?{' '}<button onClick={() => setTrack('annual')} className="text-indigo-500 hover:underline">See feature plans →</button></p>
          )}
        </div>

        {/* ── CPA Referral Pricing ─────────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-7 mb-12">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="w-12 h-12 bg-emerald-100 border border-emerald-200 rounded-2xl flex items-center justify-center flex-shrink-0">
              <BadgeCheck size={22} className="text-emerald-600" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="text-base font-bold text-gray-900">Referred by your CPA?</h3>
                <span className="text-[10px] bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full px-2.5 py-0.5 font-semibold uppercase tracking-wide">CPA Referral Pricing</span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed max-w-2xl">
                If your accountant or CPA firm sent you here, you qualify for a special one-time engagement fee:{' '}
                <strong className="text-gray-900">3% of your recovered SR&ED credits</strong>, with nothing due until CRA pays you.
                No subscription, no upfront payment — we succeed when you do.
              </p>
              <div className="flex flex-wrap gap-4 mt-3">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Check size={12} className="text-emerald-500" /> No payment until CRA refund received
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Check size={12} className="text-emerald-500" /> One-time fee — no ongoing subscription
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Check size={12} className="text-emerald-500" /> Full T661 package + audit vault included
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Check size={12} className="text-emerald-500" /> CPA keeps their relationship with the client
                </div>
              </div>
              {estimate && (
                <div className="mt-3 inline-flex items-center gap-2 bg-white border border-emerald-200 rounded-xl px-4 py-2 text-sm">
                  <TrendingUp size={14} className="text-emerald-600" />
                  <span className="text-gray-500">Your estimated 3% fee:</span>
                  <span className="font-bold text-gray-900">{fmtK(estimate * 0.03)}</span>
                  <span className="text-gray-400 text-xs">on {fmtK(estimate)} credit estimate</span>
                </div>
              )}
            </div>
            <div className="flex-shrink-0">
              <a
                href="mailto:hello@taxlift.ai?subject=CPA%20Referral%20Pricing%20Inquiry"
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors shadow-sm whitespace-nowrap"
              >
                Get referral pricing <ArrowRight size={14} />
              </a>
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
          <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">14-day free trial. No credit card required. Get your CPA-ready package in as little as 2 hours.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => handlePricingCta('plus')} disabled={checkoutLoading === 'plus'}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-colors shadow-lg shadow-indigo-900/20"
            >
              {checkoutLoading === 'plus' ? <><Loader2 size={15} className="animate-spin" /> Starting trial…</> : <>Start free trial <ArrowRight size={14} /></>}
            </button>
            <button onClick={() => window.open('https://calendly.com/taxlift/free-review', '_blank')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
              <ExternalLink size={13} /> Talk to a specialist first
            </button>
          </div>
          {!fromScan && (
            <p className="mt-4 text-xs text-gray-400">Not sure how much you qualify for?{' '}<button onClick={() => navigate('/scan')} className="text-indigo-500 hover:underline">Run a free scan →</button></p>
          )}
        </div>

      </div>

      <WaitlistModal isOpen={waitlistOpen} onClose={() => setWaitlistOpen(false)} defaultPlan={waitlistPlan} source={waitlistSource} />
    </div>
  )
}

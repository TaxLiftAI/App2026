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
import { PLANS, CLAIM_PLANS, redirectToCheckout } from '../lib/stripe'
import WaitlistModal from '../components/WaitlistModal'

function fmtK(n) {
  const v = Number(n) || 0
  if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(1) + 'M'
  if (v >= 1_000)     return '$' + Math.round(v / 1_000) + 'K'
  return '$' + Math.round(v).toLocaleString('en-CA')
}

const FAQS = [
  {
    q: "Why annual billing — can't I just pay month-to-month?",
    a: "You can — monthly is available at $499/mo (Starter) or $899/mo (Plus). Annual billing exists because SR&ED is a once-a-year filing: monthly subscribers often prepare their package and cancel, which means no ongoing support during a CRA review, no mid-year tracking, and no head start on next year's claim. Annual subscribers get year-round audit vault updates and ongoing SR&ED hygiene that genuinely protects the claim after filing.",
  },
  {
    q: "What is the difference between Option A (Annual) and Option B (Pay-per-Claim)?",
    a: "Annual Plans are for companies that want year-round SR&ED hygiene — continuous commit tracking, audit vault updates, and mid-year activity monitoring so next year's claim practically writes itself. Pay-per-Claim is for first-time filers or companies with sporadic R&D who want to pay once, prepare a T661 package, and come back next year. Both produce the same CPA-ready output.",
  },
  {
    q: 'How is TaxLift different from hiring an SR&ED consultant?',
    a: "Traditional SR&ED consultants charge 15-25% of your refund as a contingency fee. On a $200K claim that is $30-50K gone before you see a dollar. TaxLift is a flat fee — annual plans start at $2,988/yr and the Claim Package is $1,997 one-time. You keep the rest.",
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
  { label: 'CRA Compliant',              icon: ShieldCheck },
  { label: '14-day free trial',          icon: Clock       },
  { label: 'No contingency fee',         icon: Lock        },
  { label: 'CPA-ready package',          icon: Star        },
  { label: 'Annual commitment included', icon: BadgeCheck  },
]

function RoiCalculator({ defaultCredit = 150000 }) {
  const [credit, setCredit] = useState(defaultCredit)
  const c = Math.max(50000, Math.min(credit, 2000000))
  const consultantFee = Math.round(c * 0.20)
  const annualStarter = 2988
  const savings       = Math.max(0, consultantFee - annualStarter)
  const roi           = Math.round((savings / annualStarter) * 100)
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
            { label: 'SR&ED consultant',       sub: '~20% contingency', value: fmtK(consultantFee), note: 'taken from your refund',  bad: true },
            { label: 'TaxLift Starter',        sub: 'Annual plan',      value: '$2,988/yr',          note: 'flat — you keep the rest', bad: false },
            { label: 'Pay-per-Claim',          sub: 'No subscription',  value: '$1,997',             note: 'one fiscal year',          bad: false },
            { label: 'You save vs. consultant',sub: roi + 'x ROI on TaxLift', value: fmtK(savings), note: 'back in your pocket', highlight: true },
          ].map(({ label, sub, value, note, bad, highlight }) => (
            <div key={label} className={'rounded-xl p-4 text-center ' + (highlight ? 'bg-indigo-600 border border-indigo-400' : bad ? 'bg-slate-800 border border-red-900/40' : 'bg-slate-800 border border-slate-700')}>
              <p className={'text-xs font-semibold mb-0.5 ' + (highlight ? 'text-indigo-200' : 'text-slate-400')}>{label}</p>
              <p className={'text-[10px] mb-2 ' + (highlight ? 'text-indigo-300' : 'text-slate-500')}>{sub}</p>
              <p className={'text-lg font-bold mb-1 ' + (bad ? 'text-red-400' : highlight ? 'text-white' : 'text-emerald-400')}>{value}</p>
              <p className={'text-[10px] ' + (highlight ? 'text-indigo-300' : 'text-slate-500')}>{note}</p>
            </div>
          ))}
        </div>
        <p className="text-indigo-500 text-[11px] text-center mt-4">Consultant fee estimated at 20% contingency midpoint. Actual rates vary 15-25%.</p>
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
    description: 'Two ways to pay: annual subscription or pay-per-claim. No contingency fee — you keep the full SR&ED refund. 14-day free trial on all plans.',
    path:        '/pricing',
    breadcrumb:  [{ name: 'Home', path: '/' }, { name: 'Pricing', path: '/pricing' }],
  })

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [track,           setTrack]           = useState(searchParams.get('track') === 'claim' ? 'claim' : 'annual')
  const [billing,         setBilling]         = useState('annual')
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
  const STARTER_ANNUAL = 2988
  const consultantLow  = estimate ? Math.round(estimate * 0.15) : null
  const consultantHigh = estimate ? Math.round(estimate * 0.25) : null
  const savingsLow     = consultantLow  ? Math.max(0, consultantLow  - STARTER_ANNUAL) : null
  const savingsHigh    = consultantHigh ? Math.max(0, consultantHigh - STARTER_ANNUAL) : null
  const highlightedPlan = searchParams.get('plan') || null

  const annualPlans = Object.values(PLANS).map(p => ({
    ...p,
    highlighted: highlightedPlan ? p.id === highlightedPlan : p.highlighted,
    price:  billing === 'monthly' ? (p.priceMonthly  ?? p.price)  : p.price,
    period: billing === 'monthly' ? (p.periodMonthly ?? p.period) : p.period,
  }))

  async function handlePricingCta(planId) {
    if (planId === 'enterprise') {
      setWaitlistPlan('enterprise'); setWaitlistSource('pricing_enterprise'); setWaitlistOpen(true); return
    }
    setCheckoutLoading(planId)
    const result = await redirectToCheckout(planId, billing)
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
                  <div className="flex items-center justify-between gap-4"><span className="text-indigo-300 text-xs">Consultant (15-25%)</span><span className="text-white/70 font-mono text-xs line-through">{fmtK(consultantLow)}–{fmtK(consultantHigh)}</span></div>
                  <div className="flex items-center justify-between gap-4"><span className="text-indigo-300 text-xs">TaxLift annual plan</span><span className="text-white font-mono text-xs font-semibold">{fmtK(STARTER_ANNUAL)}/yr</span></div>
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
            {creditLow ? 'Claim your ' + fmtK(creditHigh) + ' — pay a flat fee' : 'SR&ED automation — flat fee, no contingency'}
          </h1>
          <p className="text-gray-500 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
            No 15–25% cut from your refund. Choose annual subscription or pay once per claim. All plans include a 14-day free trial and a complete CPA-ready T661 package from your GitHub and Jira data.
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
              Option A — Annual Plans
              {track === 'annual' && <span className="text-[10px] bg-white/20 rounded-full px-2 py-0.5 font-medium">CPA-introduced</span>}
            </button>
            <button
              onClick={() => setTrack('claim')}
              className={'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ' + (track === 'claim' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:text-gray-700')}
            >
              <FileText size={14} />
              Option B — Pay per Claim
              {track === 'claim' && <span className="text-[10px] bg-white/20 rounded-full px-2 py-0.5 font-medium">Self-serve SMBs</span>}
            </button>
          </div>
        </div>

        {track === 'annual' ? (
          <div className="text-center mb-8">
            <p className="text-sm text-gray-500 max-w-xl mx-auto mb-4">
              Annual billing aligns with SR&ED — year-round audit vault, mid-year tracking, and your next claim starts building automatically. Monthly available at a premium.
            </p>
            <div className="flex items-center justify-center gap-3">
              <span className={'text-sm font-medium ' + (billing === 'annual' ? 'text-gray-900' : 'text-gray-400')}>Annual</span>
              <button
                onClick={() => setBilling(b => b === 'annual' ? 'monthly' : 'annual')}
                className={'relative w-11 h-6 rounded-full transition-colors ' + (billing === 'annual' ? 'bg-indigo-600' : 'bg-gray-300')}
              >
                <span className={'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ' + (billing === 'annual' ? 'left-1' : 'left-6')} />
              </button>
              <span className={'text-sm font-medium ' + (billing === 'monthly' ? 'text-gray-900' : 'text-gray-400')}>Month-to-month</span>
              {billing === 'annual' && <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full px-2.5 py-0.5 font-semibold">Save ~40%</span>}
            </div>
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
          <p className="text-xs text-gray-400">Prices in CAD · 14-day free trial on all plans · SR&amp;ED credit recovery typically returns 80–200× the platform cost</p>
          {track === 'annual' && billing === 'monthly' && (
            <p className="text-xs text-amber-600">
              Month-to-month pricing is 40–80% higher than annual. If you plan to file SR&amp;ED annually, the annual plan pays for itself.{' '}
              <button onClick={() => setBilling('annual')} className="underline font-medium">Switch to annual →</button>
            </p>
          )}
          {track === 'claim' && (
            <p className="text-xs text-gray-400">Want year-round coverage?{' '}<button onClick={() => setTrack('annual')} className="text-indigo-500 hover:underline">See annual plans →</button></p>
          )}
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

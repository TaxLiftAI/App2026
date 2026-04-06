/**
 * PricingPage — /pricing
 *
 * Public standalone pricing page. Linked from:
 *   • ScanResultsPage "Get complete package →" CTA
 *   • MarketingPage navbar (future)
 *   • Email drip sequences
 *
 * URL params:
 *   ?estimate=180000   — credit estimate in CAD (pre-fills the hero banner)
 *   ?plan=plus         — pre-highlights a specific plan
 *
 * Session fallback:
 *   If ?estimate not in URL, reads taxlift_scan_results from sessionStorage.
 */
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { usePageMeta } from '../hooks/usePageMeta'
import {
  ShieldCheck, Check, ArrowRight, ArrowLeft, Loader2, Sparkles,
  ChevronDown, ChevronUp, Zap, Star, Clock, Lock, Mail, ExternalLink,
} from 'lucide-react'
import PricingCard from '../components/PricingCard'
import { PLANS, redirectToCheckout } from '../lib/stripe'
import WaitlistModal from '../components/WaitlistModal'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtK(n) {
  const v = Number(n) || 0
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `$${Math.round(v / 1_000)}K`
  return `$${Math.round(v).toLocaleString('en-CA')}`
}

// ── FAQ data ──────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: 'How is TaxLift different from hiring an SR&ED consultant?',
    a: 'Traditional SR&ED consultants charge 15–25% of your refund as a contingency fee. On a $200K claim that\'s $30–50K. TaxLift is a flat monthly fee — you keep the full refund. We generate the T661 narratives, evidence chains, and CPA handoff package automatically from your existing GitHub and Jira data.',
  },
  {
    q: 'Do I still need a CPA?',
    a: 'Yes — and that\'s by design. TaxLift prepares a complete CPA-ready package (T661 narratives, financial schedule, evidence chain of custody). Your CPA reviews, signs off, and submits to CRA. This keeps your accountant in the loop without requiring them to do the heavy documentation work.',
  },
  {
    q: 'How long does it take to get my package ready?',
    a: 'Most customers complete their first package in 2–4 hours of your time — primarily to review and approve the AI-generated T661 narratives. After that, updates are continuous as you add more commit history.',
  },
  {
    q: 'What if CRA audits my claim?',
    a: 'TaxLift generates an audit-ready evidence chain of custody — every qualifying commit is timestamped and linked to its CRA activity category. The Plus plan includes an audit readiness score and checklist so you\'re never caught off-guard.',
  },
  {
    q: 'Can I claim for previous tax years?',
    a: 'Yes. CRA allows SR&ED claims for up to 18 months after fiscal year-end. The Plus plan includes a prior-years catch-up analysis so you don\'t leave old credits on the table.',
  },
  {
    q: 'Is the 14-day trial really free?',
    a: 'Yes — no credit card required to start. You can connect your GitHub/Jira, generate your first T661 package, and see your complete audit-ready documentation before deciding to subscribe.',
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
          : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
        }
      </button>
      {open && (
        <div className="px-5 pb-4 bg-white">
          <p className="text-sm text-gray-600 leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  )
}

// ── Social proof logos ────────────────────────────────────────────────────────
const TRUST_MARKS = [
  { label: 'CRA Compliant',   icon: ShieldCheck },
  { label: '14-day free trial', icon: Clock },
  { label: 'Flat fee — no contingency', icon: Lock },
  { label: 'CPA-ready package', icon: Star },
]

// ── Main component ─────────────────────────────────────────────────────────────
export default function PricingPage() {
  usePageMeta({
    title:       'Pricing — TaxLift SR&ED Tax Credit Platform',
    description: 'Simple, transparent pricing for SR&ED claims. Start free with our eligibility scan. Paid plans charged as a percentage of credits recovered — no recovery, no fee.',
    path:        '/pricing',
    breadcrumb:  [
      { name: 'Home',    path: '/'        },
      { name: 'Pricing', path: '/pricing' },
    ],
  })

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [checkoutLoading, setCheckoutLoading] = useState(null)
  const [waitlistOpen,    setWaitlistOpen]    = useState(false)
  const [waitlistPlan,    setWaitlistPlan]    = useState('')
  const [waitlistSource,  setWaitlistSource]  = useState('pricing')

  // Resolve credit estimate — URL param takes precedence, then sessionStorage
  const [estimate, setEstimate] = useState(null)
  const [clusterCount, setClusterCount] = useState(null)

  useEffect(() => {
    const paramEstimate = searchParams.get('estimate')
    if (paramEstimate && !isNaN(Number(paramEstimate))) {
      setEstimate(Number(paramEstimate))
      return
    }
    // Fall back to sessionStorage from a recent scan
    try {
      const raw = sessionStorage.getItem('taxlift_scan_results')
      if (raw) {
        const scan = JSON.parse(raw)
        if (scan?.estimated_credit) {
          setEstimate(scan.estimated_credit)
          setClusterCount(scan.clusters?.length ?? null)
        }
      }
    } catch { /* ignore */ }
  }, [searchParams])

  const creditLow  = estimate ? Math.round(estimate * 0.65) : null
  const creditHigh = estimate ? Math.round(estimate * 1.35) : null

  const highlightedPlan = searchParams.get('plan') || null

  // Build plans — optionally override highlighted based on URL param
  const plans = Object.values(PLANS).map(p => ({
    ...p,
    highlighted: highlightedPlan ? p.id === highlightedPlan : p.highlighted,
  }))

  async function handlePricingCta(planId) {
    if (planId === 'enterprise') {
      setWaitlistPlan('enterprise')
      setWaitlistSource('pricing_enterprise')
      setWaitlistOpen(true)
      return
    }
    setCheckoutLoading(planId)
    const result = await redirectToCheckout(planId)
    setCheckoutLoading(null)
    if (!result.ok) {
      // Stripe not configured — capture lead via waitlist modal
      setWaitlistPlan(planId)
      setWaitlistSource('pricing_checkout_fallback')
      setWaitlistOpen(true)
    }
  }

  const fromScan = !!sessionStorage.getItem('taxlift_scan_results')

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {fromScan && (
              <button
                onClick={() => navigate('/scan/results')}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors mr-1"
              >
                <ArrowLeft size={13} /> Back to results
              </button>
            )}
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2"
            >
              <div className="w-7 h-7 bg-indigo-600 rounded-xl flex items-center justify-center">
                <Zap size={14} className="text-white" />
              </div>
              <span className="font-bold text-gray-900 tracking-tight text-sm">TaxLift</span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/estimate')}
              className="text-xs text-gray-500 hover:text-gray-700 transition-colors hidden sm:block"
            >
              Manual estimator
            </button>
            <button
              onClick={() => navigate('/scan')}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors"
            >
              <Sparkles size={12} /> Free scan
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-12 sm:py-16">

        {/* ── Personalized scan banner ─────────────────────────────────────── */}
        {creditLow && creditHigh && (
          <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl px-6 py-5 mb-10 shadow-lg shadow-indigo-900/20 text-white">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-indigo-200 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Sparkles size={11} /> Your SR&ED scan estimate
                </p>
                <p className="text-2xl sm:text-3xl font-bold tabular-nums">
                  {fmtK(creditLow)} – {fmtK(creditHigh)}
                </p>
                <p className="text-indigo-300 text-xs mt-1">
                  Estimated refundable ITC
                  {clusterCount ? ` across ${clusterCount} qualifying cluster${clusterCount !== 1 ? 's' : ''}` : ''}
                  {' '}· CCPC rate · conservative–expected range
                </p>
              </div>
              <div className="flex-shrink-0">
                <div className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-center">
                  <p className="text-white font-bold text-sm">Pick a plan below</p>
                  <p className="text-indigo-200 text-xs mt-0.5">to unlock your full package</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div className="text-center mb-12">
          <p className="text-indigo-600 text-sm font-semibold uppercase tracking-widest mb-2">
            Pricing
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            {creditLow
              ? `Claim your ${fmtK(creditHigh)} — for a flat fee`
              : 'SR&ED automation — flat fee, no surprises'}
          </h1>
          <p className="text-gray-500 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
            No 15–25% contingency cut. All plans include a 14-day free trial and a CPA-ready
            package generated from your existing GitHub and Jira data.
          </p>
        </div>

        {/* ── Trust marks ──────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-12">
          {TRUST_MARKS.map(({ label, icon: Icon }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-gray-500 bg-white border border-gray-200 rounded-full px-3.5 py-1.5">
              <Icon size={12} className="text-indigo-500" />
              {label}
            </div>
          ))}
        </div>

        {/* ── Plan cards ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start mb-6">
          {plans.map(plan => (
            <PricingCard
              key={plan.id}
              plan={plan}
              ctaLoading={checkoutLoading === plan.id}
              onCta={() => handlePricingCta(plan.id)}
            />
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 mb-16">
          Prices in CAD. SR&ED credit recovery typically returns 80–200× the platform cost.
          Grants module available on Plus &amp; Enterprise.
          {' '}
          <a href="mailto:hello@taxlift.ai" className="text-indigo-500 hover:underline">
            Questions? Email us →
          </a>
        </p>

        {/* ── ROI comparison band ──────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-2xl p-8 mb-16 text-white">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-indigo-300 text-xs font-semibold uppercase tracking-widest mb-3">
              The math
            </p>
            <h2 className="text-2xl font-bold mb-6">
              {creditLow
                ? `${fmtK(creditHigh)} refund vs. $299/mo platform cost`
                : 'A $200K refund vs. a $299/mo platform cost'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  label: 'Traditional consultant',
                  cost:  creditLow ? `${fmtK(Math.round(creditHigh * 0.20))} fee` : '$30–50K fee',
                  note:  '20% contingency on refund',
                  bad:   true,
                },
                {
                  label: 'TaxLift Starter',
                  cost:  '$3,588/yr',
                  note:  'Flat fee — you keep the rest',
                  bad:   false,
                },
                {
                  label: 'Net savings vs. consultant',
                  cost:  creditLow ? fmtK(Math.round(creditHigh * 0.20) - 3588) : '~$26–46K',
                  note:  'Back in your pocket',
                  bad:   false,
                  highlight: true,
                },
              ].map(({ label, cost, note, bad, highlight }) => (
                <div
                  key={label}
                  className={`rounded-xl p-5 text-center ${
                    highlight
                      ? 'bg-indigo-600 border border-indigo-500'
                      : bad
                        ? 'bg-slate-800 border border-slate-700'
                        : 'bg-slate-800 border border-slate-700'
                  }`}
                >
                  <p className={`text-xs font-medium mb-2 ${highlight ? 'text-indigo-200' : 'text-slate-400'}`}>{label}</p>
                  <p className={`text-xl font-bold mb-1 ${bad ? 'text-red-400' : highlight ? 'text-white' : 'text-emerald-400'}`}>{cost}</p>
                  <p className={`text-[11px] ${highlight ? 'text-indigo-300' : 'text-slate-500'}`}>{note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── What TaxLift does / CPA workflow ─────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 mb-16">
          <h2 className="text-xl font-bold text-gray-900 text-center mb-2">How it works</h2>
          <p className="text-gray-500 text-sm text-center mb-8 max-w-lg mx-auto">
            TaxLift generates everything. Your CPA reviews and files. You keep the full refund.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                step: '1',
                title: 'Connect your tools',
                desc:  'Link GitHub and/or Jira. TaxLift scans your commit history and ticket data for SR&ED qualifying signals.',
                time:  '5 min setup',
              },
              {
                step: '2',
                title: 'Review your package',
                desc:  'AI generates T661 narratives for every qualifying cluster. You review, edit, and approve — about 2 hours of your time.',
                time:  '~2 hrs/year',
              },
              {
                step: '3',
                title: 'CPA files, CRA pays',
                desc:  'Send the CPA handoff package to your accountant. They file the T661. CRA processes your refund in 60–90 days.',
                time:  '60–90 day refund',
              },
            ].map(({ step, title, desc, time }) => (
              <div key={step} className="text-center">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold text-lg">{step}</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-3">{desc}</p>
                <span className="inline-flex items-center gap-1 text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full px-3 py-1 font-medium">
                  <Check size={10} /> {time}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <div className="max-w-2xl mx-auto mb-16">
          <h2 className="text-xl font-bold text-gray-900 text-center mb-6">Common questions</h2>
          <div className="space-y-3">
            {FAQS.map(item => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
          <p className="text-center text-sm text-gray-500 mt-6">
            Still have questions?{' '}
            <a href="mailto:hello@taxlift.ai" className="text-indigo-600 hover:underline font-medium">
              Email hello@taxlift.ai →
            </a>
          </p>
        </div>

        {/* ── Bottom CTA ───────────────────────────────────────────────────── */}
        <div className="text-center bg-white rounded-2xl border border-gray-100 shadow-sm p-10 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {creditLow
              ? `Ready to claim your ${fmtK(creditHigh)}?`
              : 'Ready to start your first SR&ED claim?'}
          </h2>
          <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
            14-day free trial. No credit card required. Get your CPA-ready package in as little as 2 hours.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => handlePricingCta('plus')}
              disabled={checkoutLoading === 'plus'}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-colors shadow-lg shadow-indigo-900/20"
            >
              {checkoutLoading === 'plus'
                ? <><Loader2 size={15} className="animate-spin" /> Starting trial…</>
                : <>Start free trial <ArrowRight size={14} /></>
              }
            </button>
            <button
              onClick={() => window.open('https://calendly.com/taxlift/free-review', '_blank')}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ExternalLink size={13} /> Talk to a specialist first
            </button>
          </div>
          {!fromScan && (
            <p className="mt-4 text-xs text-gray-400">
              Not sure how much you qualify for?{' '}
              <button
                onClick={() => navigate('/scan')}
                className="text-indigo-500 hover:underline"
              >
                Run a free scan →
              </button>
            </p>
          )}
        </div>

      </div>

      {/* ── Waitlist/lead capture modal ─────────────────────────────────────── */}
      <WaitlistModal
        isOpen={waitlistOpen}
        onClose={() => setWaitlistOpen(false)}
        defaultPlan={waitlistPlan}
        source={waitlistSource}
      />
    </div>
  )
}

/**
 * WelcomePage — post-onboarding "aha moment"
 *
 * Shown immediately after a new user completes onboarding or quick-connect.
 * Computes a credible SR&ED credit estimate from their company profile and
 * surfaces potential grant funding if they're on a free/starter plan.
 *
 * #7 enhancement: "30-minute aha moment" — progress bar, time-to-value
 * indicator, and specific step CTAs so users see exactly what to do next
 * and how close they are to a real T661 draft.
 *
 * Route: /welcome
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2, ArrowRight, TrendingUp, Award, Zap,
  Building2, MapPin, Users, ChevronRight, Sparkles, Crown,
  Clock, GitBranch, FileText, AlertCircle,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { auth as authApi, grants as grantsApi } from '../lib/api'

const PROVINCIAL_RATES = {
  ON: { rate: 0.08,  label: 'Ontario',             program: 'OITC'        },
  QC: { rate: 0.14,  label: 'Quebec',               program: 'CRSNG-QC'   },
  BC: { rate: 0.10,  label: 'British Columbia',     program: 'BC SBVC'    },
  AB: { rate: 0.10,  label: 'Alberta',              program: 'AB Innovates'},
  SK: { rate: 0.075, label: 'Saskatchewan',         program: 'Sask Innov' },
  MB: { rate: 0.075, label: 'Manitoba',             program: 'MB R&D'     },
  NS: { rate: 0.15,  label: 'Nova Scotia',          program: 'NS NSBI'    },
  NB: { rate: 0.15,  label: 'New Brunswick',        program: 'NB Innovation'},
  NL: { rate: 0.15,  label: 'Newfoundland',         program: 'NL RDTC'    },
  PE: { rate: 0.10,  label: 'Prince Edward Island', program: 'PEI IRTI'   },
  NT: { rate: 0.00,  label: 'Northwest Territories',program: null         },
  NU: { rate: 0.00,  label: 'Nunavut',              program: null         },
  YT: { rate: 0.00,  label: 'Yukon',                program: null         },
}

const INDUSTRY_RD_PCT = {
  software: 0.40, ai_ml: 0.45, biotech: 0.50, cleantech: 0.40,
  advanced_mfg: 0.30, agritech: 0.30, fintech: 0.35, medtech: 0.40,
  materials: 0.35, aerospace: 0.35, other: 0.20, '': 0.25,
}

const AVG_SALARY_CAD  = 105_000
const FEDERAL_CCPC_RATE = 0.35

function computeEstimate(profile) {
  const employees  = Math.max(parseInt(profile?.employee_count ?? 10, 10), 1)
  const province   = profile?.province ?? 'ON'
  const industry   = profile?.industry_domain ?? ''
  const rdPct      = INDUSTRY_RD_PCT[industry] ?? 0.25
  const provInfo   = PROVINCIAL_RATES[province] ?? PROVINCIAL_RATES.ON
  const provRate   = provInfo.rate
  const qualifyingRD     = employees * AVG_SALARY_CAD * rdPct
  const federalCredit    = qualifyingRD * FEDERAL_CCPC_RATE
  const provincialCredit = qualifyingRD * provRate
  const totalCredit      = federalCredit + provincialCredit
  return {
    low:  Math.round(totalCredit * 0.75 / 1000) * 1000,
    mid:  Math.round(totalCredit / 1000) * 1000,
    high: Math.round(totalCredit * 1.25 / 1000) * 1000,
    federalCredit:    Math.round(federalCredit),
    provincialCredit: Math.round(provincialCredit),
    qualifyingRD:     Math.round(qualifyingRD),
    employees, province, industry, provInfo, rdPct,
  }
}

function formatCAD(n) {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return '$' + Math.round(n / 1000) + 'K'
  return '$' + n.toLocaleString()
}

function AnimatedNumber({ target, duration = 1400 }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    if (!target) return
    const start = Date.now()
    const tick  = () => {
      const elapsed  = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased    = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(target * eased))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration])
  return <span>{formatCAD(display)}</span>
}

function AssumptionPill({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm">
      <Icon size={13} className="text-indigo-400 flex-shrink-0" />
      <span className="text-gray-500 text-xs">{label}</span>
      <span className="font-semibold text-gray-800 text-xs ml-auto">{value}</span>
    </div>
  )
}

// ── Onboarding steps with time estimates ──────────────────────────────────────
const ONBOARDING_STEPS = [
  {
    id:    'account',
    label: 'Account created',
    sub:   'Your TaxLift workspace is ready',
    time:  null,
    icon:  CheckCircle2,
    alwaysDone: true,
  },
  {
    id:    'profile',
    label: 'Company profile set',
    sub:   'Province, industry & headcount confirmed',
    time:  null,
    icon:  Building2,
    doneWhen: (profile) => !!(profile?.province),
  },
  {
    id:    'integration',
    label: 'Connect GitHub or Jira',
    sub:   'TaxLift scans your commit history for SR&ED signals',
    time:  '~5 min',
    icon:  GitBranch,
    cta:   'Connect now',
    ctaPath: '/integrations',
    doneWhen: () => false,
  },
  {
    id:    'clusters',
    label: 'First SR&ED clusters detected',
    sub:   'AI identifies qualifying R&D work from your codebase',
    time:  '~10 min',
    icon:  Sparkles,
    doneWhen: () => false,
  },
  {
    id:    'narratives',
    label: 'T661 narratives generated',
    sub:   'Review and approve AI-drafted CRA narratives',
    time:  '~15 min',
    icon:  FileText,
    doneWhen: () => false,
  },
]

function OnboardingChecklist({ profile }) {
  const navigate  = useNavigate()

  const steps = ONBOARDING_STEPS.map(s => ({
    ...s,
    done: s.alwaysDone || (s.doneWhen ? s.doneWhen(profile) : false),
  }))

  const doneCount    = steps.filter(s => s.done).length
  const totalCount   = steps.length
  const pct          = Math.round((doneCount / totalCount) * 100)
  const nextStep     = steps.find(s => !s.done)
  const minutesLeft  = steps
    .filter(s => !s.done && s.time)
    .reduce((acc, s) => acc + parseInt(s.time, 10), 0)

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header bar */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-gray-900">
            Your first T661 draft is {minutesLeft > 0 ? `~${minutesLeft} minutes away` : 'ready to review'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{doneCount} of {totalCount} steps complete</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Clock size={13} className="text-indigo-400" />
          <span className="text-xs font-semibold text-indigo-600">{minutesLeft > 0 ? `~${minutesLeft} min left` : 'All set!'}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700"
          style={{ width: pct + '%' }}
        />
      </div>

      {/* Steps */}
      <div className="px-6 py-4 space-y-3">
        {steps.map((step, i) => {
          const Icon = step.icon
          const isNext = step.id === nextStep?.id
          return (
            <div
              key={step.id}
              className={'flex items-start gap-3 p-3 rounded-xl transition-colors ' + (isNext ? 'bg-indigo-50 border border-indigo-100' : '')}
            >
              <div className={'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ' + (step.done ? 'bg-green-100' : isNext ? 'bg-indigo-100' : 'bg-gray-100')}>
                {step.done
                  ? <CheckCircle2 size={14} className="text-green-500" />
                  : <Icon size={14} className={isNext ? 'text-indigo-600' : 'text-gray-400'} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={'text-sm font-semibold ' + (step.done ? 'text-gray-500 line-through' : isNext ? 'text-indigo-900' : 'text-gray-400')}>{step.label}</p>
                  {step.done && <span className="text-[10px] text-green-600 font-bold uppercase bg-green-50 border border-green-200 rounded-full px-2 py-0.5">Done</span>}
                  {!step.done && step.time && <span className="text-[10px] text-gray-400 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5">{step.time}</span>}
                  {isNext && <span className="text-[10px] text-indigo-600 font-bold bg-indigo-100 border border-indigo-200 rounded-full px-2 py-0.5">Next step</span>}
                </div>
                <p className={'text-xs mt-0.5 ' + (step.done ? 'text-gray-400' : isNext ? 'text-indigo-600' : 'text-gray-400')}>{step.sub}</p>
              </div>
              {isNext && step.cta && (
                <button
                  onClick={() => navigate(step.ctaPath)}
                  className="flex items-center gap-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
                >
                  {step.cta} <ArrowRight size={11} />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function WelcomePage() {
  const navigate        = useNavigate()
  const { currentUser } = useAuth()

  const [profile,       setProfile]       = useState(null)
  const [grants,        setGrants]        = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [showBreakdown, setShowBreakdown] = useState(false)

  const isPlusUser = ['plus', 'pro', 'enterprise'].includes(
    currentUser?.subscription_tier?.toLowerCase()
  ) || ['admin', 'cpa'].includes(currentUser?.role?.toLowerCase())

  useEffect(() => {
    Promise.all([
      authApi.getProfile().catch(() => ({})),
      grantsApi.eligibility().catch(() => null),
    ]).then(([prof, elig]) => {
      setProfile(prof)
      setGrants(elig)
      setLoading(false)
    })
  }, [])

  const estimate           = profile ? computeEstimate(profile) : null
  const grantPotential     = grants?.total_potential_funding ?? 700_000
  const recommendedGrants  = (grants?.grants ?? []).filter(g => g.recommended).length || 3
  const firstName          = (currentUser?.name ?? currentUser?.display_name ?? 'there').split(' ')[0]

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-950 via-indigo-900 to-slate-900 flex flex-col items-center justify-start px-4 py-16 pb-24">

      {/* Header */}
      <div className="text-center mb-8 max-w-xl">
        <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          <Sparkles size={12} /> Account ready
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
          Welcome to TaxLift, {firstName}.
        </h1>
        <p className="text-indigo-200 mt-3 text-base">
          Based on your company profile, here is what we estimate you qualify for — and your first T661 draft is about 30 minutes away.
        </p>
      </div>

      {/* Credit estimate card */}
      <div className="w-full max-w-lg mb-5">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">

          {/* SR&ED credit hero */}
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 px-8 py-8 text-center">
            <p className="text-indigo-200 text-sm font-medium mb-2 uppercase tracking-wide">Estimated Annual SR&amp;ED Credit</p>
            {loading ? (
              <div className="text-5xl font-extrabold text-white/40">Computing…</div>
            ) : (
              <>
                <div className="text-5xl sm:text-6xl font-extrabold text-white"><AnimatedNumber target={estimate?.mid ?? 0} /></div>
                <p className="text-indigo-200 text-sm mt-2">Range: {formatCAD(estimate?.low ?? 0)} – {formatCAD(estimate?.high ?? 0)}</p>
              </>
            )}
          </div>

          <div className="px-6 py-5 space-y-4">

            {!loading && estimate && (
              <div className="grid grid-cols-3 gap-2">
                <AssumptionPill icon={Users}    label="Employees"    value={estimate.employees} />
                <AssumptionPill icon={MapPin}   label="Province"     value={estimate.province} />
                <AssumptionPill icon={Building2} label="R&D intensity" value={Math.round(estimate.rdPct * 100) + '%'} />
              </div>
            )}

            {!loading && estimate && (
              <div>
                <button
                  onClick={() => setShowBreakdown(v => !v)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                >
                  {showBreakdown ? 'Hide' : 'Show'} calculation breakdown
                  <ChevronRight size={12} className={'transition-transform ' + (showBreakdown ? 'rotate-90' : '')} />
                </button>
                {showBreakdown && (
                  <div className="mt-3 bg-gray-50 rounded-xl p-4 text-xs space-y-2 text-gray-600">
                    <div className="flex justify-between"><span>Estimated qualifying R&D salaries</span><span className="font-semibold text-gray-800">{formatCAD(estimate.qualifyingRD)}</span></div>
                    <div className="flex justify-between"><span>Federal SR&ED credit (35% CCPC refundable)</span><span className="font-semibold text-green-700">+{formatCAD(estimate.federalCredit)}</span></div>
                    {estimate.provincialCredit > 0 && (
                      <div className="flex justify-between"><span>{estimate.provInfo.label} top-up ({estimate.provInfo.program})</span><span className="font-semibold text-green-700">+{formatCAD(estimate.provincialCredit)}</span></div>
                    )}
                    <div className="border-t border-gray-200 pt-2 flex justify-between font-semibold text-gray-800">
                      <span>Total estimated credit</span>
                      <span>{formatCAD((estimate.federalCredit ?? 0) + (estimate.provincialCredit ?? 0))}</span>
                    </div>
                    <p className="text-gray-400 italic pt-1">Assumes CCPC status. Actual credit depends on CRA review, eligible salary, and contractor costs. TaxLift will refine this once your code history is scanned.</p>
                  </div>
                )}
              </div>
            )}

            <div className="border-t border-gray-100" />

            {/* Savings callout vs. consultant */}
            {!loading && estimate && estimate.mid > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2.5">
                <TrendingUp size={14} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-800">
                  A traditional SR&ED consultant would charge ~<strong>{formatCAD(Math.round(estimate.mid * 0.20))}</strong> for this claim (20% contingency).
                  TaxLift costs <strong>$2,988/yr</strong> — you keep the difference.
                </p>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Onboarding checklist — the aha-moment driver */}
      <div className="w-full max-w-lg mb-5">
        {!loading && <OnboardingChecklist profile={profile} />}
      </div>

      {/* Grants upsell — only for non-Plus users */}
      {!isPlusUser && (
        <div className="w-full max-w-lg mb-5">
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center flex-shrink-0"><Award size={15} className="text-white" /></div>
              <div>
                <p className="text-sm font-bold text-gray-900">Plus: {formatCAD(grantPotential)}+ in additional Canadian grants</p>
                <p className="text-xs text-gray-500 mt-0.5">{recommendedGrants} programs pre-matched to your profile — IRAP, SDTC, Mitacs and more.</p>
              </div>
            </div>
            <button onClick={() => navigate('/settings')} className="flex items-center gap-2 text-xs font-semibold text-amber-700 hover:text-amber-900">
              <Crown size={12} /> Upgrade to unlock grants <ArrowRight size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Primary CTA */}
      <div className="w-full max-w-lg space-y-3">
        <button
          onClick={() => navigate('/integrations')}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-white text-indigo-700 rounded-xl text-sm font-bold hover:bg-indigo-50 transition-colors shadow-sm"
        >
          <GitBranch size={16} />
          Connect GitHub or Jira — start detecting SR&ED
          <ArrowRight size={15} />
        </button>
        <button
          onClick={() => navigate('/dashboard')}
          className="w-full py-3 text-indigo-200 hover:text-white text-sm font-medium transition-colors"
        >
          Go to Dashboard
        </button>
      </div>

      <p className="text-indigo-400/60 text-xs text-center mt-8 max-w-sm">
        Estimate is illustrative and based on industry averages. TaxLift will compute your actual SR&ED credit once your code repositories are scanned and clusters are validated.
      </p>
    </div>
  )
}

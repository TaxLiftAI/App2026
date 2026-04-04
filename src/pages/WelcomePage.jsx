/**
 * WelcomePage — post-onboarding "aha moment"
 *
 * Shown immediately after a new user completes onboarding or quick-connect.
 * Computes a credible SR&ED credit estimate from their company profile and
 * surfaces potential grant funding if they're on a free/starter plan.
 *
 * Route: /welcome
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2, ArrowRight, TrendingUp, Award, Zap,
  Building2, MapPin, Users, ChevronRight, Sparkles, Crown,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { auth as authApi, grants as grantsApi } from '../lib/api'

// ── Provincial SR&ED top-up rates ─────────────────────────────────────────────
const PROVINCIAL_RATES = {
  ON: { rate: 0.08,  label: 'Ontario',                    program: 'OITC'       },
  QC: { rate: 0.14,  label: 'Quebec',                     program: 'CRSNG-QC'   },
  BC: { rate: 0.10,  label: 'British Columbia',           program: 'BC SBVC'    },
  AB: { rate: 0.10,  label: 'Alberta',                    program: 'AB Innovates'},
  SK: { rate: 0.075, label: 'Saskatchewan',               program: 'Sask Innov' },
  MB: { rate: 0.075, label: 'Manitoba',                   program: 'MB R&D'     },
  NS: { rate: 0.15,  label: 'Nova Scotia',                program: 'NS NSBI'    },
  NB: { rate: 0.15,  label: 'New Brunswick',              program: 'NB Innovation'},
  NL: { rate: 0.15,  label: 'Newfoundland',               program: 'NL RDTC'    },
  PE: { rate: 0.10,  label: 'Prince Edward Island',       program: 'PEI IRTI'   },
  NT: { rate: 0.00,  label: 'Northwest Territories',      program: null         },
  NU: { rate: 0.00,  label: 'Nunavut',                    program: null         },
  YT: { rate: 0.00,  label: 'Yukon',                      program: null         },
}

// ── Industry R&D intensity (% of salaries that qualify) ───────────────────────
const INDUSTRY_RD_PCT = {
  software:      0.40,
  ai_ml:         0.45,
  biotech:       0.50,
  cleantech:     0.40,
  advanced_mfg:  0.30,
  agritech:      0.30,
  fintech:       0.35,
  medtech:       0.40,
  materials:     0.35,
  aerospace:     0.35,
  other:         0.20,
  '':            0.25,
}

const INDUSTRY_LABELS = {
  software:      'Software / SaaS',
  ai_ml:         'AI / Machine Learning',
  biotech:       'Biotech / Life Sciences',
  cleantech:     'Clean Technology',
  advanced_mfg:  'Advanced Manufacturing',
  agritech:      'Agriculture Technology',
  fintech:       'Fintech',
  medtech:       'Medical Devices',
  materials:     'Materials Science',
  aerospace:     'Aerospace / Defence',
  other:         'Other',
  '':            'Technology',
}

const AVG_SALARY_CAD = 105_000   // blended tech salary across Canada
const FEDERAL_CCPC_RATE = 0.35   // refundable for qualified small businesses

function computeEstimate(profile) {
  const employees  = Math.max(parseInt(profile?.employee_count ?? 10, 10), 1)
  const province   = profile?.province ?? 'ON'
  const industry   = profile?.industry_domain ?? ''

  const rdPct       = INDUSTRY_RD_PCT[industry] ?? 0.25
  const provInfo    = PROVINCIAL_RATES[province] ?? PROVINCIAL_RATES.ON
  const provRate    = provInfo.rate

  // Qualifying R&D expenditure estimate
  const annualSalaries = employees * AVG_SALARY_CAD
  const qualifyingRD   = annualSalaries * rdPct

  // Credits
  const federalCredit   = qualifyingRD * FEDERAL_CCPC_RATE
  const provincialCredit = qualifyingRD * provRate
  const totalCredit      = federalCredit + provincialCredit

  // Conservative (75%) and optimistic (125%) range
  const low  = Math.round(totalCredit * 0.75 / 1000) * 1000
  const high = Math.round(totalCredit * 1.25 / 1000) * 1000
  const mid  = Math.round(totalCredit / 1000) * 1000

  return {
    low, mid, high,
    federalCredit:    Math.round(federalCredit),
    provincialCredit: Math.round(provincialCredit),
    qualifyingRD:     Math.round(qualifyingRD),
    employees,
    province,
    industry,
    provInfo,
    rdPct,
  }
}

function formatCAD(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${Math.round(n / 1000)}K`
  return `$${n.toLocaleString()}`
}

// ── Animated counter ──────────────────────────────────────────────────────────
function AnimatedNumber({ target, duration = 1400 }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (!target) return
    const start = Date.now()
    const tick  = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(target * eased))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration])

  return <span>{formatCAD(display)}</span>
}

// ── Assumption pill ───────────────────────────────────────────────────────────
function AssumptionPill({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm">
      <Icon size={13} className="text-indigo-400 flex-shrink-0" />
      <span className="text-gray-500 text-xs">{label}</span>
      <span className="font-semibold text-gray-800 text-xs ml-auto">{value}</span>
    </div>
  )
}

export default function WelcomePage() {
  const navigate          = useNavigate()
  const { currentUser }   = useAuth()

  const [profile,   setProfile]   = useState(null)
  const [grants,    setGrants]    = useState(null)
  const [loading,   setLoading]   = useState(true)
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

  const estimate = profile ? computeEstimate(profile) : null
  const grantPotential = grants?.total_potential_funding ?? 700_000
  const recommendedGrants = (grants?.grants ?? []).filter(g => g.recommended).length || 3

  const firstName = (currentUser?.name ?? currentUser?.display_name ?? 'there').split(' ')[0]

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-950 via-indigo-900 to-slate-900 flex flex-col items-center justify-start px-4 py-16 pb-24">

      {/* Header */}
      <div className="text-center mb-10 max-w-xl">
        <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          <Sparkles size={12} />
          Account ready
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
          Welcome to TaxLift, {firstName}.
        </h1>
        <p className="text-indigo-200 mt-3 text-base">
          Based on your company profile, here's what we estimate you may qualify for.
        </p>
      </div>

      {/* Main estimate card */}
      <div className="w-full max-w-lg mb-6">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">

          {/* SR&ED credit hero */}
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 px-8 py-8 text-center">
            <p className="text-indigo-200 text-sm font-medium mb-2 uppercase tracking-wide">
              Estimated Annual SR&ED Credit
            </p>
            {loading ? (
              <div className="text-5xl font-extrabold text-white/40">Computing…</div>
            ) : (
              <>
                <div className="text-5xl sm:text-6xl font-extrabold text-white">
                  <AnimatedNumber target={estimate?.mid ?? 0} />
                </div>
                <p className="text-indigo-200 text-sm mt-2">
                  Range: {formatCAD(estimate?.low ?? 0)} – {formatCAD(estimate?.high ?? 0)}
                </p>
              </>
            )}
          </div>

          {/* Breakdown */}
          <div className="px-6 py-5 space-y-4">

            {/* Assumptions */}
            {!loading && estimate && (
              <div className="grid grid-cols-3 gap-2">
                <AssumptionPill
                  icon={Users}
                  label="Employees"
                  value={estimate.employees}
                />
                <AssumptionPill
                  icon={MapPin}
                  label="Province"
                  value={estimate.province}
                />
                <AssumptionPill
                  icon={Building2}
                  label="R&D intensity"
                  value={`${Math.round(estimate.rdPct * 100)}%`}
                />
              </div>
            )}

            {/* Breakdown toggle */}
            {!loading && estimate && (
              <div>
                <button
                  onClick={() => setShowBreakdown(v => !v)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                >
                  {showBreakdown ? 'Hide' : 'Show'} calculation breakdown
                  <ChevronRight size={12} className={`transition-transform ${showBreakdown ? 'rotate-90' : ''}`} />
                </button>

                {showBreakdown && (
                  <div className="mt-3 bg-gray-50 rounded-xl p-4 text-xs space-y-2 text-gray-600">
                    <div className="flex justify-between">
                      <span>Estimated qualifying R&D salaries</span>
                      <span className="font-semibold text-gray-800">{formatCAD(estimate.qualifyingRD)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Federal SR&ED credit (35% CCPC refundable)</span>
                      <span className="font-semibold text-green-700">+{formatCAD(estimate.federalCredit)}</span>
                    </div>
                    {estimate.provincialCredit > 0 && (
                      <div className="flex justify-between">
                        <span>{estimate.provInfo.label} top-up ({estimate.provInfo.program})</span>
                        <span className="font-semibold text-green-700">+{formatCAD(estimate.provincialCredit)}</span>
                      </div>
                    )}
                    <div className="border-t border-gray-200 pt-2 flex justify-between font-semibold text-gray-800">
                      <span>Total estimated credit</span>
                      <span>{formatCAD((estimate.federalCredit ?? 0) + (estimate.provincialCredit ?? 0))}</span>
                    </div>
                    <p className="text-gray-400 italic pt-1">
                      Assumes CCPC status. Actual credit depends on CRA review, eligible salary, and contractor costs.
                      TaxLift will refine this once your code history is scanned.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="border-t border-gray-100" />

            {/* What's next checklist */}
            <div className="space-y-2">
              {[
                { icon: CheckCircle2, text: 'Account created', done: true },
                { icon: CheckCircle2, text: 'Company profile set',  done: !!(profile?.province) },
                { icon: CheckCircle2, text: 'Integration connected', done: false },
                { icon: CheckCircle2, text: 'First SR&ED clusters detected', done: false },
              ].map(({ icon: Icon, text, done }, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm">
                  <Icon size={15} className={done ? 'text-green-500' : 'text-gray-300'} />
                  <span className={done ? 'text-gray-800 font-medium' : 'text-gray-400'}>{text}</span>
                  {done && <span className="ml-auto text-[10px] text-green-600 font-semibold uppercase">Done</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Grants upsell — only shown to non-Plus users */}
      {!isPlusUser && (
        <div className="w-full max-w-lg mb-6">
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center flex-shrink-0">
                <Award size={15} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">
                  Plus: {formatCAD(grantPotential)}+ in additional Canadian grants
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {recommendedGrants} programs pre-matched to your profile — IRAP, SDTC, Mitacs and more.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/settings')}
              className="flex items-center gap-2 text-xs font-semibold text-amber-700 hover:text-amber-900"
            >
              <Crown size={12} /> Upgrade to unlock grants
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
      )}

      {/* CTAs */}
      <div className="w-full max-w-lg space-y-3">
        <button
          onClick={() => navigate('/integrations')}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-white text-indigo-700 rounded-xl text-sm font-bold hover:bg-indigo-50 transition-colors shadow-sm"
        >
          <Zap size={16} />
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

      {/* Disclaimer */}
      <p className="text-indigo-400/60 text-xs text-center mt-8 max-w-sm">
        Estimate is illustrative and based on industry averages. TaxLift will compute your actual SR&ED
        credit once your code repositories are scanned and clusters are validated.
      </p>
    </div>
  )
}

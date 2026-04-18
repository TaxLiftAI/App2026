/**
 * CheckoutSuccessPage — shown after a successful Stripe Checkout.
 * URL: /success?plan=starter&session_id=cs_...
 *
 * Steps are dynamic — we query the user's actual state so completed
 * steps are checked off automatically if they've already done them
 * (e.g. GitHub connected before payment).
 *
 * Activation steps:
 *   1. Connect GitHub or Jira          — checks /api/v1/integrations
 *   2. See your first SR&ED clusters   — checks /api/v1/clusters
 *   3. Invite your CPA                 — always pending (manual action)
 *   4. Download CPA handoff package    — only shown for Plus plan
 */
import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import {
  CheckCircle2, ArrowRight, GitBranch, Users, Package,
  UserPlus, Clock, Zap, FileText, Loader2, Circle,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { integrations as intApi, clusters as clusterApi } from '../lib/api'

const PLAN_LABELS = {
  starter:    'SR&ED Filing Package',
  plus:       'CPA Partner Seat',
  enterprise: 'Enterprise',
}

// ── Activation step row ───────────────────────────────────────────────────────
function StepRow({ number, icon: Icon, title, description, done, loading, cta, ctaTo, ctaOnClick, primary }) {
  const navigate = useNavigate()

  function handleCta() {
    if (ctaOnClick) { ctaOnClick(); return }
    if (ctaTo) navigate(ctaTo)
  }

  return (
    <div className={`rounded-2xl p-5 flex items-center gap-5 transition-all ${
      done    ? 'bg-slate-800/60 border border-slate-700/50'
      : primary ? 'bg-indigo-600 border border-indigo-500 shadow-lg shadow-indigo-900/30'
               : 'bg-slate-800 border border-slate-700'
    }`}>
      {/* Step icon / check */}
      <div className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl ${
        done    ? 'bg-emerald-500/20'
        : primary ? 'bg-white/20'
                 : 'bg-indigo-500/10'
      }`}>
        {loading ? (
          <Loader2 size={16} className="text-slate-400 animate-spin" />
        ) : done ? (
          <CheckCircle2 size={18} className="text-emerald-400" />
        ) : (
          <Icon size={18} className={primary ? 'text-white' : 'text-indigo-400'} />
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-sm mb-0.5 ${done ? 'text-slate-400 line-through' : primary ? 'text-white' : 'text-white'}`}>
          <span className={`mr-2 ${primary ? 'text-indigo-200' : 'text-indigo-400'}`}>{String(number).padStart(2, '0')}</span>
          {title}
        </p>
        <p className={`text-xs leading-relaxed ${done ? 'text-slate-500' : primary ? 'text-indigo-200' : 'text-slate-400'}`}>
          {done ? '✓ Done' : description}
        </p>
      </div>

      {/* CTA */}
      {!done && cta && (
        <button
          onClick={handleCta}
          className={`flex-shrink-0 flex items-center gap-1.5 font-bold text-xs px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
            primary
              ? 'bg-white text-indigo-700 hover:bg-indigo-50'
              : 'text-indigo-400 hover:text-indigo-300'
          }`}
        >
          {cta} {primary && <ArrowRight size={12} />}
        </button>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CheckoutSuccessPage() {
  const [params]       = useSearchParams()
  const { currentUser } = useAuth()
  const plan      = params.get('plan') ?? 'starter'
  const planLabel = PLAN_LABELS[plan] ?? 'your plan'

  // ── Dynamic step state ────────────────────────────────────────────────────
  const [checking,        setChecking]        = useState(true)
  const [hasIntegration,  setHasIntegration]  = useState(false)
  const [hasClusters,     setHasClusters]     = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
    if (!currentUser) { setChecking(false); return }

    // Check integrations and clusters in parallel
    Promise.all([
      intApi.list().catch(() => []),
      clusterApi.list({ limit: 1 }).catch(() => ({ clusters: [] })),
    ]).then(([ints, clusterRes]) => {
      const intList     = Array.isArray(ints) ? ints : (ints?.integrations ?? [])
      const clusterList = Array.isArray(clusterRes) ? clusterRes : (clusterRes?.clusters ?? [])
      setHasIntegration(intList.some(i => i.status === 'healthy'))
      setHasClusters(clusterList.length > 0)
    }).finally(() => setChecking(false))
  }, [currentUser])

  // ── Derive which step is "primary" (next to do) ───────────────────────────
  const steps = [
    {
      icon:        GitBranch,
      title:       'Connect your code repos',
      description: 'Authorize GitHub or Jira so TaxLift auto-detects SR&ED-qualifying work.',
      done:        hasIntegration,
      cta:         'Connect GitHub →',
      ctaTo:       '/integrations',
    },
    {
      icon:        Package,
      title:       'See your first SR&ED clusters',
      description: 'Once connected, TaxLift scans commits and groups qualifying R&D into clusters.',
      done:        hasClusters,
      cta:         'View clusters',
      ctaTo:       '/clusters',
    },
    {
      icon:        Users,
      title:       'Invite your CPA',
      description: 'Share your CPA portal link so your accountant can review narratives and access the handoff package.',
      done:        false,
      cta:         'Invite CPA',
      ctaTo:       '/settings',
    },
    ...(plan === 'plus' ? [{
      icon:        FileText,
      title:       'Explore the Grants module',
      description: 'Match against 9 Canadian innovation programs — NRC-IRAP, OITC, NGen, and more.',
      done:        false,
      cta:         'Open Grants',
      ctaTo:       '/grants',
    }] : []),
  ]

  // First incomplete step is primary
  const primaryIdx = steps.findIndex(s => !s.done)
  const doneCount  = steps.filter(s => s.done).length
  const totalSteps = steps.length
  const allDone    = doneCount === totalSteps

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 flex flex-col items-center justify-start pt-16 px-4 pb-16">
      <div className="w-full max-w-2xl">

        {/* ── Success card ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-3xl shadow-2xl p-10 text-center mb-6">
          <div className="flex justify-center mb-5">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle2 size={40} className="text-emerald-500" />
            </div>
          </div>

          <h1 className="text-3xl font-extrabold text-slate-900 mb-2">
            You're in! Welcome to TaxLift
          </h1>
          <p className="text-slate-500 text-base mb-1">
            Your <span className="font-semibold text-indigo-600">{planLabel}</span> plan is now active.
          </p>
          <p className="text-slate-400 text-sm mb-6">
            A confirmation receipt has been sent to your email.
          </p>

          {currentUser ? (
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-3.5 rounded-xl transition-colors shadow-md"
            >
              Go to dashboard <ArrowRight size={16} />
            </Link>
          ) : (
            <div className="space-y-3">
              <Link
                to={`/signup?plan=${plan}&from=checkout`}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-3.5 rounded-xl transition-colors shadow-md"
              >
                <UserPlus size={16} /> Create your account
              </Link>
              <p className="text-slate-400 text-xs text-center">
                Already have an account?{' '}
                <Link to="/login" className="text-indigo-400 hover:underline">Sign in →</Link>
              </p>
            </div>
          )}
        </div>

        {/* ── Activation steps (authenticated users only) ───────────────── */}
        {currentUser && (
          <>
            {/* Trial urgency banner */}
            <div className="bg-indigo-600 rounded-2xl px-6 py-4 flex items-center gap-4 mb-6">
              <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Clock size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-white font-bold text-sm">Your 14-day free trial has started</p>
                <p className="text-indigo-200 text-xs mt-0.5">
                  Connect your code repos now — the sooner TaxLift scans, the more SR&amp;ED it finds before your trial ends.
                </p>
              </div>
              <Link
                to="/integrations"
                className="flex-shrink-0 flex items-center gap-1.5 bg-white text-indigo-700 font-bold text-xs px-4 py-2 rounded-lg hover:bg-indigo-50 transition-colors whitespace-nowrap"
              >
                <Zap size={12} /> Start now
              </Link>
            </div>

            {/* Section header + progress */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-lg">Activate your account</h2>
              <div className="flex items-center gap-2">
                {checking ? (
                  <Loader2 size={13} className="text-slate-500 animate-spin" />
                ) : (
                  <span className="text-slate-400 text-xs font-medium">
                    {doneCount}/{totalSteps} complete
                  </span>
                )}
                {/* Mini progress bar */}
                <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-700"
                    style={{ width: `${(doneCount / totalSteps) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {allDone ? (
              <div className="bg-emerald-600 rounded-2xl p-6 text-center">
                <CheckCircle2 size={28} className="text-white mx-auto mb-2" />
                <p className="text-white font-bold text-base mb-1">All steps complete — you're fully set up!</p>
                <p className="text-emerald-200 text-sm mb-4">Your SR&ED claim is ready to build. Head to the dashboard to see your clusters.</p>
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-2 bg-white text-emerald-700 font-bold text-sm px-6 py-3 rounded-xl hover:bg-emerald-50 transition-colors"
                >
                  Go to dashboard <ArrowRight size={14} />
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {steps.map((step, i) => (
                  <StepRow
                    key={step.title}
                    number={i + 1}
                    icon={step.icon}
                    title={step.title}
                    description={step.description}
                    done={step.done}
                    loading={checking && !step.done}
                    cta={step.cta}
                    ctaTo={step.ctaTo}
                    ctaOnClick={step.ctaOnClick}
                    primary={!step.done && i === primaryIdx}
                  />
                ))}
              </div>
            )}
          </>
        )}

        <p className="text-center text-slate-500 text-xs mt-8">
          Need help?{' '}
          <a href="mailto:hello@taxlift.ai" className="text-indigo-400 hover:underline">
            hello@taxlift.ai
          </a>{' '}
          · join our{' '}
          <a href="https://taxlift.ai/slack" className="text-indigo-400 hover:underline">
            Slack community
          </a>
        </p>
      </div>
    </div>
  )
}

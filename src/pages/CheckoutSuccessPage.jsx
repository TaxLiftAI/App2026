/**
 * CheckoutSuccessPage — shown after a successful Stripe Checkout.
 * URL: /success?plan=starter&session_id=cs_...
 *
 * Enhancements:
 *  - Trial start urgency banner (14-day clock)
 *  - Connect GitHub is the bold primary CTA for step 1
 *  - Support email fixed to hello@taxlift.ai
 */
import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, ArrowRight, GitBranch, Users, Package, UserPlus, Clock, Zap } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const PLAN_LABELS = {
  starter:    'Starter',
  plus:       'Plus',
  enterprise: 'Enterprise',
}

export default function CheckoutSuccessPage() {
  const [params] = useSearchParams()
  const { currentUser } = useAuth()
  const plan      = params.get('plan') ?? 'starter'
  const planLabel = PLAN_LABELS[plan] ?? 'your plan'

  // Scroll to top
  useEffect(() => { window.scrollTo(0, 0) }, [])

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 flex flex-col items-center justify-start pt-20 px-4">
      <div className="w-full max-w-2xl">

        {/* Success card */}
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

        {/* Trial urgency banner */}
        {currentUser && (
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
        )}

        {/* Next steps */}
        {currentUser && (
          <>
            <h2 className="text-white font-bold text-lg mb-4 text-center">
              Here's what to do next
            </h2>
            <div className="space-y-3">

              {/* Step 1 — Connect GitHub (primary, highlighted) */}
              <div className="bg-indigo-600 border border-indigo-500 rounded-2xl p-5 flex items-center gap-5">
                <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 bg-white/20 rounded-xl">
                  <GitBranch size={18} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm mb-0.5">
                    <span className="text-indigo-200 mr-2">01</span>
                    Connect your code repos
                  </p>
                  <p className="text-indigo-200 text-xs leading-relaxed">
                    Authorize GitHub or Jira so TaxLift can detect SR&amp;ED-qualifying work automatically.
                  </p>
                </div>
                <Link
                  to="/integrations"
                  className="flex-shrink-0 flex items-center gap-1.5 bg-white text-indigo-700 font-bold text-xs px-4 py-2 rounded-lg hover:bg-indigo-50 transition-colors whitespace-nowrap"
                >
                  Connect GitHub →
                </Link>
              </div>

              {/* Step 2 — Invite CPA */}
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 flex items-center gap-5">
                <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 bg-indigo-500/10 rounded-xl">
                  <Users size={18} className="text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm mb-0.5">
                    <span className="text-indigo-400 mr-2">02</span>
                    Invite your CPA
                  </p>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Share your CPA portal link so your accountant can review narratives and access the handoff package.
                  </p>
                </div>
                <Link
                  to="/settings"
                  className="flex-shrink-0 text-xs font-semibold text-indigo-400 hover:text-indigo-300 whitespace-nowrap"
                >
                  Invite CPA →
                </Link>
              </div>

              {/* Step 3 — Review clusters */}
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 flex items-center gap-5">
                <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 bg-indigo-500/10 rounded-xl">
                  <Package size={18} className="text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm mb-0.5">
                    <span className="text-indigo-400 mr-2">03</span>
                    Review your first clusters
                  </p>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Head to the dashboard to see SR&amp;ED clusters detected from your engineering history.
                  </p>
                </div>
                <Link
                  to="/dashboard"
                  className="flex-shrink-0 text-xs font-semibold text-indigo-400 hover:text-indigo-300 whitespace-nowrap"
                >
                  Go to dashboard →
                </Link>
              </div>
            </div>
          </>
        )}

        <p className="text-center text-slate-500 text-xs mt-8">
          Need help?{' '}
          <a href="mailto:hello@taxlift.ai" className="text-indigo-400 hover:underline">
            hello@taxlift.ai
          </a>{' '}
          or join our{' '}
          <a href="https://taxlift.ai/slack" className="text-indigo-400 hover:underline">
            Slack community
          </a>.
        </p>
      </div>
    </div>
  )
}

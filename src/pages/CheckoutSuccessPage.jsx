/**
 * CheckoutSuccessPage — shown after a successful Stripe Checkout.
 * URL: /success?plan=starter&session_id=cs_...
 */
import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, ArrowRight, GitBranch, Users, Package, UserPlus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const PLAN_LABELS = {
  starter:    'Starter',
  plus:       'Plus',
  enterprise: 'Enterprise',
}

const NEXT_STEPS = [
  {
    icon:  GitBranch,
    title: 'Connect your code repos',
    body:  'Authorize GitHub or Jira so TaxLift can detect SR&ED-qualifying work automatically.',
    href:  '/integrations',
    cta:   'Connect GitHub',
  },
  {
    icon:  Users,
    title: 'Invite your CPA',
    body:  'Share your CPA portal link so your accountant can review narratives and access the handoff package.',
    href:  '/settings',
    cta:   'Invite CPA',
  },
  {
    icon:  Package,
    title: 'Review your first clusters',
    body:  'Head to the dashboard to see SR&ED clusters detected from your engineering history.',
    href:  '/dashboard',
    cta:   'Go to dashboard',
  },
]

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
        <div className="bg-white rounded-3xl shadow-2xl p-10 text-center mb-8">
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
          <p className="text-slate-400 text-sm mb-8">
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

        {/* Next steps */}
        {currentUser && (
        <><h2 className="text-white font-bold text-lg mb-4 text-center">
          Here\u2019s what to do next
        </h2>
        <div className="space-y-3">
          {NEXT_STEPS.map((step, i) => {
            const Icon = step.icon
            return (
              <div
                key={step.title}
                className="bg-slate-800 border border-slate-700 rounded-2xl p-5 flex items-center gap-5"
              >
                <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 bg-indigo-500/10 rounded-xl">
                  <Icon size={18} className="text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm mb-0.5">
                    <span className="text-indigo-400 mr-2">0{i + 1}</span>
                    {step.title}
                  </p>
                  <p className="text-slate-400 text-xs leading-relaxed">{step.body}</p>
                </div>
                <Link
                  to={step.href}
                  className="flex-shrink-0 text-xs font-semibold text-indigo-400 hover:text-indigo-300 whitespace-nowrap"
                >
                  {step.cta} →
                </Link>
              </div>
            )
          })}
        </div></>
        )}

        <p className="text-center text-slate-500 text-xs mt-8">
          Need help?{' '}
          <a href="mailto:support@taxlift.ai" className="text-indigo-400 hover:underline">
            support@taxlift.ai
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

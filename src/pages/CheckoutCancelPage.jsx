/**
 * CheckoutCancelPage — shown when the user cancels out of Stripe Checkout.
 * URL: /cancel?plan=growth
 */
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, HelpCircle } from 'lucide-react'
import WaitlistModal from '../components/WaitlistModal'

const PLAN_LABELS = {
  starter:    'Starter',
  plus:       'Plus',
  enterprise: 'Enterprise',
}

const FAQS = [
  {
    q: 'Is there a free trial?',
    a: 'Yes — all paid plans include a 14-day free trial. No credit card required during the trial.',
  },
  {
    q: 'What if I need more time to decide?',
    a: "Join the waitlist and we'll hold your spot. No commitment, no spam — just an early-access invitation when you're ready.",
  },
  {
    q: 'Can I talk to someone first?',
    a: "Absolutely. Book a 30-minute demo call and we'll walk through exactly how TaxLift fits your situation.",
  },
]

export default function CheckoutCancelPage() {
  const [params]  = useSearchParams()
  const plan      = params.get('plan') ?? ''
  const planLabel = PLAN_LABELS[plan] ?? ''

  const [waitlistOpen, setWaitlistOpen] = useState(false)

  useEffect(() => { window.scrollTo(0, 0) }, [])

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-start pt-16 px-4">
      <div className="w-full max-w-lg text-center">

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
            <HelpCircle size={32} className="text-slate-400" />
          </div>
        </div>

        <h1 className="text-2xl font-extrabold text-slate-900 mb-2">
          No problem — take your time
        </h1>
        <p className="text-slate-500 text-sm mb-8 leading-relaxed">
          {planLabel
            ? `Your ${planLabel} plan selection is saved. Come back whenever you're ready, or join our waitlist to lock in your spot.`
            : "Come back whenever you're ready. Or join our waitlist to secure early access."}
        </p>

        {/* Primary CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
          <button
            onClick={() => setWaitlistOpen(true)}
            className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-sm text-sm"
          >
            Join the waitlist
            <ArrowRight size={15} />
          </button>
          <Link
            to="/#pricing"
            className="inline-flex items-center justify-center gap-2 border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
          >
            <ArrowLeft size={15} />
            Back to pricing
          </Link>
        </div>

        {/* Mini FAQ */}
        <div className="text-left space-y-4 border-t border-slate-100 pt-8">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
            Common questions
          </p>
          {FAQS.map(item => (
            <div key={item.q}>
              <p className="text-sm font-semibold text-slate-800 mb-1">{item.q}</p>
              <p className="text-sm text-slate-500 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-400 mt-10">
          Questions?{' '}
          <a href="mailto:support@taxlift.ai" className="text-indigo-500 hover:underline">
            support@taxlift.ai
          </a>
        </p>
      </div>

      <WaitlistModal
        isOpen={waitlistOpen}
        onClose={() => setWaitlistOpen(false)}
        defaultPlan={plan}
        source="cancel_page"
      />
    </div>
  )
}

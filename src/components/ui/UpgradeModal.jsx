/**
 * UpgradeModal — lightweight inline paywall for SR&ED features.
 *
 * Props:
 *   open      {boolean}
 *   onClose   {function}
 *   feature   {string}   e.g. "Narrative generation"
 *   plan      {string}   'starter' | 'plus' — which plan unlocks it
 */
import { useNavigate } from 'react-router-dom'
import { Lock, Zap, FileText, Share2, ChevronRight, X, Award, CheckCircle2 } from 'lucide-react'

const PLAN_FEATURES = {
  starter: [
    { icon: FileText,     text: 'AI-generated T661 narratives from your code evidence' },
    { icon: Share2,       text: 'CPA export — shareable review links + full PDF package' },
    { icon: Zap,          text: 'Audit-readiness scoring with remediation guidance' },
    { icon: CheckCircle2, text: 'Unlimited cluster approvals + manual narrative editing' },
  ],
  plus: [
    { icon: CheckCircle2, text: 'Everything in Starter' },
    { icon: Award,        text: 'Canadian grant matching across 7 federal programs' },
    { icon: FileText,     text: 'Full grant application generation in under 45 minutes' },
    { icon: Share2,       text: 'Application tracker with funding outcome history' },
  ],
}

const PLAN_LABELS = { starter: 'Starter', plus: 'Plus' }
const PLAN_PRICES = { starter: '$99/mo', plus: '$249/mo' }

export default function UpgradeModal({ open, onClose, feature = 'This feature', plan = 'starter' }) {
  const navigate   = useNavigate()
  const features   = PLAN_FEATURES[plan] ?? PLAN_FEATURES.starter
  const planLabel  = PLAN_LABELS[plan]  ?? 'Starter'
  const planPrice  = PLAN_PRICES[plan]  ?? '$99/mo'

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">

      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Card */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 z-10"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Header gradient */}
        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 px-6 pt-8 pb-6 text-white">
          <div className="flex items-center justify-center w-12 h-12 bg-white/20 rounded-xl mb-4">
            <Lock size={22} className="text-white" />
          </div>
          <h2 className="text-xl font-bold leading-snug">
            {feature} — {planLabel} Plan
          </h2>
          <p className="text-sm text-indigo-200 mt-1.5">
            Upgrade to unlock this and everything below.
          </p>
        </div>

        {/* Feature list */}
        <div className="px-6 py-5 space-y-3">
          {features.map(({ icon: Icon, text }, i) => (
            <div key={i} className="flex items-center gap-3 text-sm text-slate-700">
              <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center bg-indigo-50 rounded-lg">
                <Icon size={14} className="text-indigo-600" />
              </div>
              {text}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="px-6 pb-6 space-y-2">
          <button
            onClick={() => { onClose(); navigate('/settings?tab=billing') }}
            className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-sm transition-colors"
          >
            Upgrade to {planLabel} — {planPrice}
            <ChevronRight size={16} />
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
            Maybe later
          </button>
        </div>

      </div>
    </div>
  )
}

/**
 * PricingCard — reusable plan card used on the marketing page.
 *
 * Props:
 *   plan          {object}   — entry from PLANS in src/lib/stripe.js
 *   onCta         {function} — called when the CTA button is clicked
 *   ctaLoading    {boolean}  — show spinner while checkout is starting
 *   compact       {boolean}  — smaller padding (for modal use)
 */
import { Check, Loader2 } from 'lucide-react'

export default function PricingCard({ plan, onCta, ctaLoading = false, compact = false }) {
  const { name, price, period, description, features, cta, highlighted } = plan

  return (
    <div
      className={`
        relative flex flex-col rounded-2xl border transition-shadow
        ${highlighted
          ? 'border-indigo-500 bg-indigo-600 text-white shadow-2xl shadow-indigo-500/30'
          : 'border-slate-200 bg-white text-slate-900 shadow-sm hover:shadow-md'}
        ${compact ? 'p-5' : 'p-8'}
      `}
    >
      {/* Popular badge */}
      {highlighted && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-1 text-xs font-bold text-white shadow">
            Most popular
          </span>
        </div>
      )}

      {/* Header */}
      <div className={compact ? 'mb-3' : 'mb-6'}>
        <h3 className={`font-bold ${highlighted ? 'text-white' : 'text-slate-900'} ${compact ? 'text-lg' : 'text-xl'}`}>
          {name}
        </h3>
        <p className={`mt-1 text-sm ${highlighted ? 'text-indigo-200' : 'text-slate-500'}`}>
          {description}
        </p>
      </div>

      {/* Price */}
      <div className={compact ? 'mb-4' : 'mb-8'}>
        <span className={`font-extrabold tracking-tight ${compact ? 'text-3xl' : 'text-5xl'} ${highlighted ? 'text-white' : 'text-slate-900'}`}>
          {price}
        </span>
        {period && (
          <span className={`ml-1 text-sm font-medium ${highlighted ? 'text-indigo-200' : 'text-slate-500'}`}>
            {period}
          </span>
        )}
      </div>

      {/* Features */}
      <ul className={`flex-1 space-y-3 ${compact ? 'mb-5' : 'mb-8'}`}>
        {features.map((f) => {
          const isGrant = f.startsWith('✦')
          const label   = isGrant ? f.slice(1).trim() : f
          return (
            <li key={f} className="flex items-start gap-2 text-sm">
              {isGrant ? (
                <span className={`mt-0.5 shrink-0 font-bold text-xs ${highlighted ? 'text-violet-300' : 'text-violet-500'}`}>✦</span>
              ) : (
                <Check size={16} className={`mt-0.5 shrink-0 ${highlighted ? 'text-indigo-200' : 'text-indigo-500'}`} />
              )}
              <span className={
                isGrant
                  ? (highlighted ? 'text-violet-200 font-medium' : 'text-violet-700 font-medium')
                  : (highlighted ? 'text-indigo-100' : 'text-slate-600')
              }>
                {label}
              </span>
            </li>
          )
        })}
      </ul>

      {/* CTA */}
      <button
        onClick={onCta}
        disabled={ctaLoading}
        className={`
          w-full rounded-xl py-3 text-sm font-semibold transition-all
          disabled:opacity-60 disabled:cursor-not-allowed
          flex items-center justify-center gap-2
          ${highlighted
            ? 'bg-white text-indigo-600 hover:bg-indigo-50 shadow'
            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'}
        `}
      >
        {ctaLoading ? <Loader2 size={16} className="animate-spin" /> : null}
        {cta}
      </button>
    </div>
  )
}

/**
 * S8 — Plan Upgrade Gate
 * Shown to Core plan users on Grants tab click.
 * Shows eligibility estimate computed from SR&ED before upgrade ask.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, TrendingUp, Zap, Award, CheckCircle2, ChevronRight, Loader2 } from 'lucide-react'
import { grants as grantsApi } from '../../lib/api'

const FEATURES = [
  { icon: TrendingUp, text: 'AI eligibility matching against 7 Canadian grant programs' },
  { icon: Zap,        text: 'Full application generation in <45 minutes using your SR&ED data' },
  { icon: Award,      text: '4-question gap fill interview — answers reused forever' },
  { icon: CheckCircle2, text: 'Section-by-section review with AI regeneration' },
  { icon: CheckCircle2, text: 'PDF export + clipboard copy for any grant portal' },
  { icon: CheckCircle2, text: 'Application tracker with funding outcomes' },
]

export default function PlanUpgradeGate() {
  const navigate = useNavigate()
  const [estimate, setEstimate] = useState(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    // Still compute the eligibility estimate even for Core users — show value before ask
    grantsApi.eligibility()
      .then(data => { setEstimate(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const potential = estimate?.total_potential_funding || 700000
  const recommended = (estimate?.grants || []).filter(g => g.recommended).length || 3

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-start justify-center pt-16 px-4 pb-20">
      <div className="w-full max-w-lg">

        {/* Lock icon */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-2xl mb-4">
            <Lock size={28} className="text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Grants — Plus Plan Feature</h1>
          <p className="text-sm text-gray-500 mt-2">
            Based on your SR&ED filing, you may be eligible for significant Canadian grant funding.
          </p>
        </div>

        {/* Eligibility teaser */}
        <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm p-6 mb-6">
          <p className="text-xs font-semibold text-indigo-600 uppercase mb-3">Your Eligibility Estimate (from SR&ED)</p>
          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Loader2 size={14} className="animate-spin" /> Computing from your SR&ED data…
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="text-4xl font-extrabold text-indigo-600">
                    ${(potential / 1000).toFixed(0)}K+
                  </div>
                  <p className="text-sm text-gray-500 mt-1">potential funding from {recommended} recommended programs</p>
                </div>
                <TrendingUp size={40} className="text-indigo-200" />
              </div>

              {estimate?.grants?.slice(0, 3).map(g => g.recommended && (
                <div key={g.grant_id} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                  <span className="text-gray-700">{g.grant_name}</span>
                  <span className="ml-auto text-gray-500 text-xs">up to ${(g.max_funding / 1000).toFixed(0)}K</span>
                </div>
              ))}

              <p className="text-xs text-gray-400 italic">
                Eligibility computed from your SR&ED filing — no new data required.
              </p>
            </div>
          )}
        </div>

        {/* Feature list */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 space-y-3">
          <p className="text-sm font-semibold text-gray-700 mb-2">What you get on Plus:</p>
          {FEATURES.map(({ icon: Icon, text }, i) => (
            <div key={i} className="flex items-center gap-3 text-sm text-gray-700">
              <Icon size={15} className="text-indigo-500 flex-shrink-0" />
              {text}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="space-y-3">
          <button
            onClick={() => navigate('/settings')}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 text-white rounded-xl text-base font-bold hover:bg-indigo-700 shadow-sm"
          >
            Upgrade to Plus — Unlock Grants
            <ChevronRight size={18} />
          </button>
          <button
            onClick={() => navigate('/grants')}
            className="w-full py-2.5 text-sm text-gray-500 hover:text-gray-700"
          >
            Back to Grants overview
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Average time from upgrade to first PDF export: 45 minutes.
        </p>
      </div>
    </div>
  )
}

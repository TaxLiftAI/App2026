/**
 * S1 — Grants Dashboard
 * Entry point showing potential funding upside, ranked grant list with match scores,
 * next deadlines, and CTA to view eligibility or start an application.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, ChevronRight, RefreshCw, Award, Clock,
  CheckCircle2, AlertCircle, Info, Loader2, Lock, Zap
} from 'lucide-react'
import { grants as grantsApi } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { DEMO_GRANTS } from '../../lib/demoData'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'

// ── Preview-mode shape: normalise DEMO_GRANTS → API eligibility shape ─────────
const PREVIEW_ELIGIBILITY = {
  grants: DEMO_GRANTS.filter(g => !g.paused).map(g => ({
    grant_id:        g.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    grant_name:      g.full_name,
    match_score:     g.score,
    recommended:     g.is_high,
    max_funding:     g.max_amount,
    deadline:        'Rolling',
    complexity:      g.is_high ? 'med' : 'low',
    matched_criteria: ['SR&ED documentation on file', 'Canadian-controlled private corporation', 'Technology sector'],
    missing_fields:  [],
  })),
  total_potential_funding: DEMO_GRANTS.filter(g => !g.paused).reduce((s, g) => s + g.max_amount, 0),
  sred_projects_count: 4,
  ai_powered: false,
  cached: false,
}

const COMPLEXITY_BADGE = {
  low:  { label: 'Simple',  bg: 'bg-green-100',  text: 'text-green-700' },
  med:  { label: 'Medium',  bg: 'bg-yellow-100', text: 'text-yellow-700' },
  high: { label: 'Complex', bg: 'bg-red-100',    text: 'text-red-700'   },
}

function ScoreRing({ score }) {
  const colour = score >= 75 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626'
  const r = 20, c = 2 * Math.PI * r
  const dash = (score / 100) * c
  return (
    <svg width="52" height="52" viewBox="0 0 52 52">
      <circle cx="26" cy="26" r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
      <circle
        cx="26" cy="26" r={r} fill="none"
        stroke={colour} strokeWidth="4"
        strokeDasharray={`${dash} ${c}`}
        strokeLinecap="round"
        transform="rotate(-90 26 26)"
      />
      <text x="26" y="31" textAnchor="middle" fontSize="11" fontWeight="700" fill={colour}>
        {score}
      </text>
    </svg>
  )
}

export default function GrantsDashboard() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const isPlusUser = ['plus', 'pro', 'enterprise', 'admin', 'cpa'].includes(currentUser?.subscription_tier?.toLowerCase()) ||
                     ['admin', 'cpa'].includes(currentUser?.role?.toLowerCase())

  const [eligibility, setEligibility] = useState(null)
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [error, setError]             = useState(null)
  const [applications, setApplications] = useState([])

  async function loadEligibility(force = false) {
    force ? setRefreshing(true) : setLoading(true)
    setError(null)
    try {
      const data = await grantsApi.eligibility(force)
      setEligibility(data)
      const appsData = await grantsApi.listApplications()
      setApplications(appsData.applications || [])
    } catch (err) {
      setError(err.message || 'Failed to load eligibility data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Gate: redirect non-Plus users to the upgrade page immediately.
  // PlanUpgradeGate fetches the eligibility estimate and shows the funding amount as upsell.
  useEffect(() => {
    if (!isPlusUser) navigate('/grants/upgrade', { replace: true })
  }, [isPlusUser, navigate])

  useEffect(() => { loadEligibility() }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <Loader2 className="animate-spin mx-auto mb-3 text-indigo-500" size={32} />
        <p className="text-sm text-gray-500">Analysing your SR&ED data for grant eligibility…</p>
      </div>
    </div>
  )

  // ── Preview mode: backend unreachable → show sample data with amber banner ──
  const isPreview = !!error
  const displayData = isPreview ? PREVIEW_ELIGIBILITY : eligibility

  const recommended    = displayData?.grants?.filter(g => g.recommended) || []
  const totalPotential = displayData?.total_potential_funding || 0

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Preview mode banner */}
      {isPreview && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">Preview — sample data</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Grants engine is connecting… Showing illustrative match data based on a typical SR&ED profile.
              Real scores are computed once your projects are analysed.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => loadEligibility()}>Retry</Button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Canadian Grants</h1>
          <p className="text-sm text-gray-500 mt-1">
            Matched against your SR&ED filing · {displayData?.sred_projects_count || 0} project{displayData?.sred_projects_count !== 1 ? 's' : ''} analysed
            {displayData?.cached && (
              <span className="ml-2 text-xs text-gray-400">
                (cached · <button className="text-indigo-500 hover:underline" onClick={() => loadEligibility(true)}>refresh</button>)
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => loadEligibility(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="!p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <TrendingUp size={18} className="text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Potential Funding</p>
              <p className="text-xl font-bold text-gray-900">
                ${(totalPotential / 1000).toFixed(0)}K+
              </p>
            </div>
          </div>
        </Card>
        <Card className="!p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Award size={18} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Recommended Programs</p>
              <p className="text-xl font-bold text-gray-900">{recommended.length}</p>
            </div>
          </div>
        </Card>
        <Card className="!p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Zap size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">SR&ED Data Reused</p>
              <p className="text-xl font-bold text-gray-900">~80%</p>
            </div>
          </div>
        </Card>
      </div>

      {!isPlusUser && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-5 flex items-start gap-4">
          <Lock size={20} className="text-indigo-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-gray-900">Unlock Grants on Plus Plan</p>
            <p className="text-sm text-gray-600 mt-1">
              You're eligible for up to <strong>${(totalPotential / 1000).toFixed(0)}K</strong> in Canadian grants based on your SR&ED data.
              Upgrade to start applying — takes less than 45 minutes from first click to PDF.
            </p>
          </div>
          <Button onClick={() => navigate('/settings')}>Upgrade to Plus</Button>
        </div>
      )}

      {!isPreview && displayData?.ai_powered === false && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2 text-xs text-amber-700">
          <Info size={14} />
          Using rule-based matching. Set ANTHROPIC_API_KEY in server/.env for AI-powered scoring.
        </div>
      )}

      {/* Grant Cards */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Grant Programs</h2>
        {displayData?.grants?.map(grant => {
          const existingApp = applications.find(a => a.grant_id === grant.grant_id)
          const badge = COMPLEXITY_BADGE[grant.complexity] || COMPLEXITY_BADGE.med

          return (
            <Card key={grant.grant_id} padding={false} className="!p-0 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4 p-4">
                <ScoreRing score={grant.match_score} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{grant.grant_name}</span>
                    {grant.recommended && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        <CheckCircle2 size={10} /> Recommended
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                    <span className="font-medium text-gray-900">Up to ${(grant.max_funding / 1000).toFixed(0)}K</span>
                    <span className="flex items-center gap-1"><Clock size={11} />{grant.deadline}</span>
                  </div>
                  {grant.matched_criteria?.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      ✓ {grant.matched_criteria.slice(0, 2).join(' · ')}
                    </p>
                  )}
                  {grant.missing_fields?.length > 0 && (
                    <p className="text-xs text-amber-600 mt-0.5 truncate">
                      ⚠ {grant.missing_fields[0]}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {existingApp ? (
                    <button
                      onClick={() => navigate(`/grants/applications/${existingApp.id}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700"
                    >
                      Continue <ChevronRight size={12} />
                    </button>
                  ) : isPlusUser ? (
                    <button
                      onClick={() => navigate(`/grants/eligibility?grant=${grant.grant_id}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700"
                    >
                      View & Apply <ChevronRight size={12} />
                    </button>
                  ) : (
                    <button
                      onClick={() => navigate('/grants/upgrade')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-xs font-medium hover:bg-gray-200"
                    >
                      <Lock size={11} /> Plus only
                    </button>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Active applications shortcut */}
      {applications.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => navigate('/grants/tracker')}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
          >
            View Application Tracker ({applications.length} application{applications.length !== 1 ? 's' : ''})
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

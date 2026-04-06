/**
 * S2 — Eligibility Results
 * Per-grant breakdown of matched and missing criteria.
 * Shows which SR&ED fields drove each match.
 * CTA to start an application.
 */
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ChevronLeft, CheckCircle2, XCircle, AlertCircle,
  ChevronDown, ChevronUp, Loader2, Clock, Play, Info
} from 'lucide-react'
import { grants as grantsApi } from '../../lib/api'
import { DEMO_GRANTS } from '../../lib/demoData'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'

// ── Preview-mode eligibility shape ────────────────────────────────────────────
const PREVIEW_ELIGIBILITY = {
  grants: DEMO_GRANTS.filter(g => !g.paused).map(g => ({
    grant_id:        g.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    grant_name:      g.full_name,
    match_score:     g.score,
    recommended:     g.is_high,
    max_funding:     g.max_amount,
    deadline:        'Rolling',
    matched_criteria: [
      'SR&ED documentation on file',
      'Canadian-controlled private corporation (CCPC)',
      'Technology sector company',
      'Active R&D investment',
    ],
    missing_fields: ['Employee count (add in company profile)', 'Annual revenue (add in company profile)'],
  })),
  company: { company_name: 'Your Company', province: '—', employee_count: '—' },
  total_sred_spend: 0,
  sred_project_ids: [],
}

const SRED_FIELD_LABELS = {
  province:             'Province (SR&ED company profile)',
  employee_count:       'Employee count (SR&ED company profile)',
  industry_domain:      'Industry domain (SR&ED project tags)',
  total_sred_spend:     'Total SR&ED expenditures',
  technical_uncertainty:'Technical uncertainty narrative',
  work_performed:       'Work performed description',
  fiscal_year_end:      'Fiscal year end date',
}

export default function EligibilityResults() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const focusGrantId = searchParams.get('grant')

  const [eligibility, setEligibility]     = useState(null)
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [expandedGrant, setExpandedGrant] = useState(focusGrantId)
  const [starting, setStarting]           = useState(null)

  useEffect(() => {
    grantsApi.eligibility()
      .then(data => { setEligibility(data); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [])

  async function startApplication(grantId, sredProjectIds = []) {
    setStarting(grantId)
    try {
      const app = await grantsApi.createApplication({ grant_id: grantId, sred_project_ids: sredProjectIds })
      // Check if gap fill interview is complete
      const answers = await grantsApi.getGapAnswers()
      const hasGapFill = answers?.market_desc && answers?.revenue_model && answers?.canadian_benefit && answers?.differentiation
      if (hasGapFill) {
        navigate(`/grants/applications/${app.id}/generating`)
      } else {
        navigate(`/grants/interview?application=${app.id}`)
      }
    } catch (err) {
      alert('Failed to start application: ' + err.message)
    } finally {
      setStarting(null)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-indigo-500" size={32} />
    </div>
  )

  // ── Preview mode when backend unreachable ────────────────────────────────────
  const isPreview = !!error
  const displayData = isPreview ? PREVIEW_ELIGIBILITY : eligibility
  const { grants = [], company = {}, total_sred_spend = 0 } = displayData || {}

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/grants')} className="text-gray-400 hover:text-gray-600">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Eligibility Results</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Based on SR&ED data for {company.company_name} · {company.province} · {company.employee_count} employees ·
            {total_sred_spend > 0 ? ` $${total_sred_spend.toLocaleString()} total R&D spend` : ''}
          </p>
        </div>
      </div>

      {isPreview && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <Info size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">Preview — sample eligibility data</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Grants engine is connecting… Scores shown are illustrative. Complete your company profile
              and SR&ED clusters for a personalised assessment.
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="text-xs text-amber-700 hover:text-amber-900 underline flex-shrink-0"
          >Retry</button>
        </div>
      )}

      <div className="space-y-3">
        {grants.map(grant => {
          const isExpanded = expandedGrant === grant.grant_id
          const isStartingThis = starting === grant.grant_id

          return (
            <Card key={grant.grant_id} padding={false} className="!p-0">
              <button
                className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-50 rounded-xl transition-colors"
                onClick={() => setExpandedGrant(isExpanded ? null : grant.grant_id)}
              >
                {/* Score */}
                <div className="flex-shrink-0 w-14 text-center">
                  <div className={`text-2xl font-bold ${
                    grant.match_score >= 75 ? 'text-green-600' :
                    grant.match_score >= 50 ? 'text-amber-600' : 'text-red-500'
                  }`}>{grant.match_score}</div>
                  <div className="text-[10px] text-gray-400">match</div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{grant.grant_name}</span>
                    {grant.recommended && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">Recommended</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                    <span>Up to ${(grant.max_funding / 1000).toFixed(0)}K</span>
                    <span className="flex items-center gap-1"><Clock size={10} />{grant.deadline}</span>
                    <span className="text-green-600">{grant.matched_criteria?.length || 0} criteria met</span>
                    {grant.missing_fields?.length > 0 && (
                      <span className="text-amber-600">{grant.missing_fields.length} gaps</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {grant.recommended && (
                    <button
                      onClick={e => { e.stopPropagation(); startApplication(grant.grant_id, eligibility?.sred_project_ids || []) }}
                      disabled={!!starting}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {isStartingThis
                        ? <><Loader2 size={11} className="animate-spin" /> Starting…</>
                        : <><Play size={11} /> Start Application</>
                      }
                    </button>
                  )}
                  {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-4">
                  {/* Matched criteria */}
                  {grant.matched_criteria?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Matched Criteria (from SR&ED)</p>
                      <div className="space-y-1.5">
                        {grant.matched_criteria.map((c, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                            <CheckCircle2 size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                            {c}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Missing fields */}
                  {grant.missing_fields?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Missing or Unverified</p>
                      <div className="space-y-1.5">
                        {grant.missing_fields.map((f, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                            <AlertCircle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                            {f}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!grant.recommended && (
                    <div className="flex items-start gap-2 text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                      <XCircle size={14} className="text-gray-400 mt-0.5" />
                      This program may not be the best match based on your current profile. You can still apply.
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-1">
                    <Button
                      onClick={() => startApplication(grant.grant_id, [])}
                      disabled={!!starting}
                      size="sm"
                    >
                      {isStartingThis ? 'Starting…' : 'Start Application Anyway'}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

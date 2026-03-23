/**
 * S4 — Generating Sections
 * Progress screen while Claude generates 6–8 sections in the background.
 * Per-section status indicators. Polls until all complete.
 */
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CheckCircle2, Loader2, AlertCircle, Zap, FileText,
  Users, DollarSign, Globe, TrendingUp, Lightbulb, FlaskConical
} from 'lucide-react'
import { grants as grantsApi } from '../../lib/api'

const SECTION_ICONS = {
  project_desc: FileText,
  innovation:   Lightbulb,
  methodology:  FlaskConical,
  market:       TrendingUp,
  commercial:   DollarSign,
  cdn_benefit:  Globe,
  budget:       DollarSign,
  team:         Users,
}

const SOURCE_BADGE = {
  sred_only: { label: '80% SR&ED', bg: 'bg-blue-100',  text: 'text-blue-700' },
  gap_fill:  { label: 'Gap fill',  bg: 'bg-purple-100', text: 'text-purple-700' },
  mixed:     { label: 'Mixed',     bg: 'bg-indigo-100', text: 'text-indigo-700' },
}

export default function GeneratingSections() {
  const navigate = useNavigate()
  const { id: applicationId } = useParams()

  const [status, setStatus]       = useState(null)
  const [error, setError]         = useState(null)
  const [progress, setProgress]   = useState(0)
  const intervalRef               = useRef(null)
  const hasTriggeredRef           = useRef(false)

  // Trigger generation and start polling
  useEffect(() => {
    async function startAndPoll() {
      // Trigger generation (idempotent — server handles if already running)
      if (!hasTriggeredRef.current) {
        hasTriggeredRef.current = true
        try {
          await grantsApi.triggerGeneration(applicationId)
        } catch (err) {
          // May already be generating — continue polling
        }
      }

      // Poll status every 2 seconds
      intervalRef.current = setInterval(async () => {
        try {
          const data = await grantsApi.getGenerationStatus(applicationId)
          setStatus(data)

          const { counts } = data
          if (counts) {
            const done = (counts.ready || 0) + (counts.approved || 0)
            const pct = counts.total > 0 ? Math.round((done / counts.total) * 100) : 0
            setProgress(pct)

            // All done (no pending, no generating) → navigate to review
            if (counts.pending === 0 && counts.generating === 0) {
              clearInterval(intervalRef.current)
              setTimeout(() => navigate(`/grants/applications/${applicationId}/review`), 800)
            }
          }
        } catch (err) {
          setError(err.message)
          clearInterval(intervalRef.current)
        }
      }, 2000)
    }

    startAndPoll()
    return () => clearInterval(intervalRef.current)
  }, [applicationId])

  const sections = status?.sections || []
  const appStatus = status?.status || 'generating'

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-2xl mb-4">
            <Zap size={28} className="text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Generating Your Application</h1>
          <p className="text-sm text-gray-500 mt-2">
            Writing 6–8 grant sections from your SR&ED data.
            This usually takes 30–60 seconds.
          </p>
        </div>

        {/* Progress bar */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-700">Overall Progress</span>
            <span className="text-sm font-bold text-indigo-600">{progress}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {error && (
            <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertCircle size={14} />
              {error} — <button className="underline" onClick={() => window.location.reload()}>retry</button>
            </div>
          )}
        </div>

        {/* Per-section status */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Section Status</p>
          {sections.length === 0
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
              ))
            : sections.map(section => {
                const Icon = SECTION_ICONS[section.section_key] || FileText
                const srcBadge = SOURCE_BADGE[section.data_source] || SOURCE_BADGE.sred_only

                return (
                  <div key={section.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50">
                    <Icon size={14} className="text-gray-400 flex-shrink-0" />
                    <span className="flex-1 text-sm text-gray-700">{section.section_name}</span>

                    {section.data_source && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${srcBadge.bg} ${srcBadge.text}`}>
                        {srcBadge.label}
                      </span>
                    )}

                    {section.status === 'pending' && (
                      <span className="text-xs text-gray-400">Queued…</span>
                    )}
                    {section.status === 'generating' && (
                      <Loader2 size={14} className="text-indigo-500 animate-spin" />
                    )}
                    {(section.status === 'ready' || section.status === 'approved') && (
                      <CheckCircle2 size={15} className="text-green-500" />
                    )}
                    {section.status === 'error' && (
                      <AlertCircle size={14} className="text-red-400" />
                    )}
                  </div>
                )
              })
          }
        </div>

        {/* SR&ED note */}
        <div className="mt-4 text-center text-xs text-gray-400">
          80% of content is drawn directly from your SR&ED filing · SR&ED sections generate first
        </div>

        {/* Manual advance (fallback) */}
        {progress === 100 && (
          <div className="text-center mt-6">
            <button
              onClick={() => navigate(`/grants/applications/${applicationId}/review`)}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700"
            >
              Review Sections →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

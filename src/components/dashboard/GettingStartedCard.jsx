/**
 * GettingStartedCard — focused 3-step onboarding.
 *
 * Steps drive the primary "Connect → scan → see credit" journey:
 *   1. Connect a data source (GitHub / Jira)
 *   2. R&D clusters detected
 *   3. Export your T661 package
 *
 * The card auto-dismisses once all 3 steps are complete.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plug, GitMerge, FileText, CheckCircle2, ArrowRight, X } from 'lucide-react'
import { CLUSTERS, INTEGRATIONS } from '../../data/mockData'

const STEPS = [
  {
    key:         'connect',
    icon:        Plug,
    iconBg:      'bg-blue-50',
    iconColor:   'text-blue-500',
    label:       'Connect a data source',
    detail:      'Link GitHub or Jira so TaxLift auto-detects your R&D activity.',
    ctaLabel:    'Connect now',
    ctaTo:       '/integrations',
  },
  {
    key:         'clusters',
    icon:        GitMerge,
    iconBg:      'bg-indigo-50',
    iconColor:   'text-indigo-500',
    label:       'R&D clusters detected',
    detail:      'TaxLift groups qualifying work into SR&ED-eligible clusters automatically.',
    ctaLabel:    'View clusters',
    ctaTo:       '/clusters',
  },
  {
    key:         'export',
    icon:        FileText,
    iconBg:      'bg-violet-50',
    iconColor:   'text-violet-500',
    label:       'Export your T661 package',
    detail:      'Generate CPA-ready narratives and a financial schedule for filing.',
    ctaLabel:    'See pricing',
    ctaTo:       '/pricing',
  },
]

export default function GettingStartedCard({
  clusters:     clustersLive     = null,
  integrations: integrationsLive = null,
}) {
  const navigate   = useNavigate()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const clusters     = clustersLive     ?? CLUSTERS
  const integrations = integrationsLive ?? INTEGRATIONS

  const done = {
    connect:  integrations.some(i => i.status === 'healthy'),
    clusters: clusters.length > 0,
    export:   clusters.some(c => ['Drafted', 'Approved'].includes(c.status)),
  }

  const completedCount = Object.values(done).filter(Boolean).length
  const allDone        = completedCount === 3
  const pct            = Math.round((completedCount / 3) * 100)

  // Find the current active step (first incomplete)
  const activeIndex = STEPS.findIndex(s => !done[s.key])

  if (allDone) return null  // card disappears once user is fully onboarded

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold text-gray-900">
                Step {activeIndex + 1} of 3 —{' '}
                <span className="text-indigo-600">{STEPS[activeIndex]?.label}</span>
              </h3>
            </div>
            {/* Progress bar */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[180px]">
                <div
                  className="h-1.5 bg-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs text-gray-400 tabular-nums">{completedCount}/3</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-300 hover:text-gray-500 transition-colors ml-4 flex-shrink-0"
          title="Dismiss"
        >
          <X size={15} />
        </button>
      </div>

      {/* Steps row */}
      <div className="grid grid-cols-3 divide-x divide-gray-100">
        {STEPS.map((step, i) => {
          const Icon       = step.icon
          const isDone     = done[step.key]
          const isActive   = i === activeIndex
          const isPast     = i < activeIndex

          return (
            <div
              key={step.key}
              className={`px-5 py-4 flex flex-col gap-2 transition-colors ${
                isActive ? 'bg-indigo-50/50' : ''
              }`}
            >
              {/* Icon + status */}
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isDone ? 'bg-green-50' : step.iconBg
                }`}>
                  {isDone
                    ? <CheckCircle2 size={14} className="text-green-500" />
                    : <Icon size={14} className={step.iconColor} />
                  }
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                  isDone    ? 'text-green-500' :
                  isActive  ? 'text-indigo-600' :
                              'text-gray-300'
                }`}>
                  {isDone ? 'Done' : isActive ? 'Now' : `Step ${i + 1}`}
                </span>
              </div>

              {/* Label + detail */}
              <div>
                <p className={`text-xs font-semibold leading-snug ${
                  isDone ? 'text-gray-400 line-through' : 'text-gray-800'
                }`}>
                  {step.label}
                </p>
                {!isDone && (
                  <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{step.detail}</p>
                )}
              </div>

              {/* CTA — only on active step */}
              {isActive && (
                <button
                  onClick={() => navigate(step.ctaTo)}
                  className="self-start mt-1 flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors whitespace-nowrap"
                >
                  {step.ctaLabel} <ArrowRight size={11} />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

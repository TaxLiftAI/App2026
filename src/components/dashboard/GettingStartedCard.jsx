import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plug, GitMerge, Mic, FolderOpen, ShieldAlert, HelpCircle,
  CheckCircle2, Circle, ChevronDown, ChevronUp, X,
  Sparkles, ArrowRight, PartyPopper,
} from 'lucide-react'
import { CLUSTERS, INTEGRATIONS, DOCUMENTS } from '../../data/mockData'

// ─── Auto-detect completion from existing mock data ───────────────────────────
function detectSteps() {
  const hasIntegration = INTEGRATIONS.some(i => i.status === 'healthy')
  const hasCluster     = CLUSTERS.length > 0
  const hasInterview   = CLUSTERS.some(c => ['Interviewed', 'Drafted', 'Approved'].includes(c.status))
  const hasDocuments   = DOCUMENTS.length > 0
  return { hasIntegration, hasCluster, hasInterview, hasDocuments }
}

const detected = detectSteps()

// ─── Step row ─────────────────────────────────────────────────────────────────
function Step({ icon: Icon, iconBg, iconColor, title, description, done, ctaLabel, onCta, isLast }) {
  return (
    <div className={`flex items-start gap-4 py-4 ${!isLast ? 'border-b border-gray-50' : ''}`}>
      {/* Left: check / icon */}
      <div className="flex flex-col items-center gap-1 flex-shrink-0">
        {done ? (
          <CheckCircle2 size={20} className="text-green-500" />
        ) : (
          <Circle size={20} className="text-gray-300" />
        )}
        {!isLast && <div className="w-px flex-1 bg-gray-100 min-h-[8px]" />}
      </div>

      {/* Middle: icon + text */}
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className={`flex-shrink-0 w-8 h-8 rounded-lg ${done ? 'bg-green-50' : iconBg} flex items-center justify-center`}>
          <Icon size={14} className={done ? 'text-green-400' : iconColor} />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <p className={`text-sm font-medium leading-snug ${done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
            {title}
          </p>
          <p className="text-xs text-gray-400 mt-0.5 leading-snug">{description}</p>
        </div>
      </div>

      {/* Right: CTA */}
      {!done && ctaLabel && (
        <button
          onClick={onCta}
          className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors whitespace-nowrap"
        >
          {ctaLabel} <ArrowRight size={11} />
        </button>
      )}
      {done && (
        <span className="flex-shrink-0 text-[10px] text-green-500 font-medium">Done</span>
      )}
    </div>
  )
}

// ─── Celebration state ────────────────────────────────────────────────────────
function AllDone({ onDismiss }) {
  return (
    <div className="flex items-center gap-4 py-4 px-2">
      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
        <PartyPopper size={18} className="text-green-500" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-gray-900">You're all set!</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Your workspace is fully configured. Head to the <strong>Clusters</strong> page to manage your SR&amp;ED filing.
        </p>
      </div>
      <button
        onClick={onDismiss}
        className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        Dismiss
      </button>
    </div>
  )
}

// ─── Main card ────────────────────────────────────────────────────────────────
export default function GettingStartedCard() {
  const navigate = useNavigate()
  const [collapsed, setCollapsed]   = useState(false)
  const [dismissed, setDismissed]   = useState(false)
  const [quizDone, setQuizDone]     = useState(false)
  const [readinessDone, setReadinessDone] = useState(false)

  if (dismissed) return null

  const STEPS = [
    {
      icon: Plug,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-500',
      title: 'Connect your data sources',
      description: 'Link GitHub, Jira, or other tools so TaxLift can auto-detect R&D activity.',
      done: detected.hasIntegration,
      ctaLabel: 'Connect',
      onCta: () => navigate('/integrations'),
    },
    {
      icon: GitMerge,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-500',
      title: 'Create your first activity cluster',
      description: 'Group related commits, tickets, and work into an SR&ED-eligible cluster.',
      done: detected.hasCluster,
      ctaLabel: 'View Clusters',
      onCta: () => navigate('/clusters'),
    },
    {
      icon: Mic,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-500',
      title: 'Run a developer interview',
      description: 'Capture technical context from your engineers to strengthen the narrative.',
      done: detected.hasInterview,
      ctaLabel: 'Go to Clusters',
      onCta: () => navigate('/clusters'),
    },
    {
      icon: FolderOpen,
      iconBg: 'bg-teal-50',
      iconColor: 'text-teal-500',
      title: 'Upload evidence to the Document Vault',
      description: 'Attach T4 slips, commit logs, and technical documents to support your claim.',
      done: detected.hasDocuments,
      ctaLabel: 'Open Vault',
      onCta: () => navigate('/vault'),
    },
    {
      icon: HelpCircle,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-500',
      title: 'Take the SR&ED Eligibility Quiz',
      description: 'Confirm your work qualifies under CRA criteria before investing in a full claim.',
      done: quizDone,
      ctaLabel: 'Start Quiz',
      onCta: () => { setQuizDone(true); navigate('/quiz') },
    },
    {
      icon: ShieldAlert,
      iconBg: 'bg-red-50',
      iconColor: 'text-red-500',
      title: 'Review your Audit Readiness score',
      description: 'Ensure each cluster scores above 70/100 before your CRA filing deadline.',
      done: readinessDone,
      ctaLabel: 'Check Score',
      onCta: () => { setReadinessDone(true); navigate('/audit-readiness') },
    },
  ]

  const completedCount = STEPS.filter(s => s.done).length
  const totalCount     = STEPS.length
  const allDone        = completedCount === totalCount
  const pct            = Math.round((completedCount / totalCount) * 100)

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Sparkles size={15} className="text-indigo-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Getting Started</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {allDone
                ? 'All steps complete — your workspace is ready'
                : `${completedCount} of ${totalCount} steps complete`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Progress pill */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-28 bg-gray-100 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-500 ${allDone ? 'bg-green-500' : 'bg-indigo-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={`text-xs font-semibold tabular-nums ${allDone ? 'text-green-600' : 'text-gray-600'}`}>
              {pct}%
            </span>
          </div>

          <button
            onClick={() => setCollapsed(c => !c)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="px-5">
          {allDone ? (
            <AllDone onDismiss={() => setDismissed(true)} />
          ) : (
            STEPS.map((step, i) => (
              <Step key={step.title} {...step} isLast={i === STEPS.length - 1} />
            ))
          )}
        </div>
      )}

      {/* Collapsed summary bar */}
      {collapsed && !allDone && (
        <div className="px-5 py-2.5 flex items-center gap-3">
          <div className="flex -space-x-1">
            {STEPS.map((s, i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full border-2 border-white ${s.done ? 'bg-green-400' : 'bg-gray-200'}`}
              />
            ))}
          </div>
          <span className="text-xs text-gray-500">{completedCount}/{totalCount} complete</span>
          <button
            onClick={() => setCollapsed(false)}
            className="ml-auto text-xs text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Show steps
          </button>
        </div>
      )}
    </div>
  )
}

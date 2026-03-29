import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, GitCommit, Ticket, Hammer, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Pencil, Link2, AlertTriangle, Clock,
  Shield, Cpu, Zap, GitBranch, BarChart2, Lock,
  MessageSquare, Star, PenLine, Timer, GitMerge, Search, Scissors,
  History, Save, GitCompare, RotateCcw,
} from 'lucide-react'
import { EVIDENCE_SNAPSHOTS, USERS, DEVELOPER_INTERVIEWS, COMMENTS } from '../data/mockData'
import { formatDate, formatDateTime, formatCurrency, formatHours, formatPercent, canDo } from '../lib/utils'
import { useAuth } from '../context/AuthContext'
import { useCluster, useApproveCluster, useRejectCluster, useNarrative } from '../hooks'
import { FlaskConical } from 'lucide-react'
import { StatusBadge } from '../components/ui/Badge'
import RiskScore from '../components/ui/RiskScore'
import Card, { CardHeader } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import CommentThread from '../components/ui/CommentThread'
import NarrativeQualityCard from '../components/NarrativeQualityCard'

// ── Heuristic icon map ─────────────────────────────────────────────────────────
const HEURISTIC_ICONS = {
  HighCodeChurn:          GitCommit,
  RefactoringPattern:     Cpu,
  BuildExperimentation:   Hammer,
  BlockedStatus:          Lock,
  ExperimentalBranches:   GitBranch,
  PerformanceOptimization: Zap,
}

// ── Build status pill ──────────────────────────────────────────────────────────
function BuildStatus({ status }) {
  const map = {
    success:   'bg-green-100 text-green-700',
    failure:   'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-600',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}

// ── Quality tag badge ──────────────────────────────────────────────────────────
function QualityTag({ tag }) {
  const map = {
    High:   'bg-green-100 text-green-700',
    Medium: 'bg-amber-100 text-amber-700',
    Low:    'bg-red-100 text-red-700',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${map[tag] ?? 'bg-gray-100 text-gray-600'}`}>
      <Star size={9} />
      {tag} Quality
    </span>
  )
}

// ── Evidence Tabs ──────────────────────────────────────────────────────────────
function EvidenceTabs({ snapshot }) {
  const [tab, setTab] = useState('commits')
  const tabs = [
    { id: 'commits', label: `Commits (${snapshot.git_commits?.length ?? 0})`,  icon: GitCommit },
    { id: 'tickets', label: `Jira (${snapshot.jira_tickets?.length ?? 0})`,     icon: Ticket },
    { id: 'builds',  label: `Builds (${snapshot.build_logs?.length ?? 0})`,     icon: Hammer },
  ]

  return (
    <div>
      <div className="flex border-b border-gray-200 mb-4">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'commits' && (
        <div className="space-y-2">
          {snapshot.git_commits?.map(c => (
            <div key={c.sha} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-indigo-200 transition-colors">
              <code className="text-[10px] font-mono bg-slate-200 text-slate-700 px-2 py-1 rounded mt-0.5 flex-shrink-0">{c.sha.slice(0, 7)}</code>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 font-medium leading-snug">{c.message}</p>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400">
                  <span className="font-medium text-gray-500">@{c.author}</span>
                  <span>{formatDate(c.committed_at)}</span>
                  {c.files_changed != null && <span>{c.files_changed} files</span>}
                  {c.lines_added != null && <span className="text-green-600">+{c.lines_added}</span>}
                  {c.lines_deleted != null && <span className="text-red-500">−{c.lines_deleted}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'tickets' && (
        <div className="space-y-2">
          {snapshot.jira_tickets?.map(t => (
            <div key={t.ticket_id} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-xs font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{t.ticket_id}</code>
                    <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded">{t.status}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">{t.summary}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-2 text-[11px] text-gray-500">
                {t.worklog_hours != null && (
                  <span className="flex items-center gap-1"><Clock size={10} /> {t.worklog_hours}h logged</span>
                )}
                {t.story_points != null && <span>{t.story_points} SP</span>}
                {t.blocked_duration_hours != null && t.blocked_duration_hours > 0 && (
                  <span className="flex items-center gap-1 text-amber-600"><AlertTriangle size={10} /> {t.blocked_duration_hours}h blocked</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'builds' && (
        <div className="space-y-2">
          {snapshot.build_logs?.map(b => (
            <div key={b.build_id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <BuildStatus status={b.status} />
              <code className="text-[10px] font-mono text-gray-500">{b.build_id}</code>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <GitBranch size={11} />
                <span className="font-mono">{b.branch}</span>
              </div>
              <span className="text-xs text-gray-400 ml-auto">{formatDate(b.started_at)}</span>
              {b.duration_seconds && <span className="text-xs text-gray-400">{b.duration_seconds}s</span>}
              {b.failure_stage && <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded">{b.failure_stage}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── #11  Interview Status Panel ────────────────────────────────────────────────
function InterviewStatusPanel({ clusterId }) {
  const interview = DEVELOPER_INTERVIEWS[clusterId]
  const developer = interview ? USERS.find(u => u.id === interview.developer_id) : null

  if (!interview) {
    return (
      <Card>
        <CardHeader title="Developer Interview" subtitle="Interviewer agent status" />
        <div className="flex flex-col items-center justify-center py-6 text-center text-gray-400">
          <MessageSquare size={24} className="mb-2 opacity-30" />
          <p className="text-sm font-medium text-gray-500">Interview not yet sent</p>
          <p className="text-xs mt-1">The Interviewer agent will send a Slack message once the cluster is ready.</p>
        </div>
      </Card>
    )
  }

  const responseTimeMinutes = interview.responded_at
    ? Math.round((new Date(interview.responded_at) - new Date(interview.slack_sent_at)) / 60000)
    : null

  return (
    <Card>
      <CardHeader
        title="Developer Interview"
        subtitle={`Sent via Slack · ${formatDateTime(interview.slack_sent_at)}`}
      />
      <div className="space-y-4">
        {/* Status row */}
        <div className="flex items-center gap-3 flex-wrap">
          <QualityTag tag={interview.quality_tag} />
          {developer && (
            <span className="flex items-center gap-1.5 text-xs text-gray-600">
              <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-[9px] font-bold text-white">
                {developer.display_name?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
              {developer.display_name}
            </span>
          )}
          {responseTimeMinutes != null && (
            <span className="flex items-center gap-1 text-xs text-gray-400 ml-auto">
              <Timer size={11} />
              Responded in {responseTimeMinutes >= 60
                ? `${Math.floor(responseTimeMinutes / 60)}h ${responseTimeMinutes % 60}m`
                : `${responseTimeMinutes}m`}
            </span>
          )}
        </div>

        {/* Response excerpt */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Developer Response Excerpt</p>
          <blockquote className="relative border-l-2 border-indigo-300 pl-3 bg-indigo-50 rounded-r-lg p-3 text-xs text-gray-700 leading-relaxed italic">
            "{interview.response_excerpt}"
          </blockquote>
          <p className="text-[10px] text-gray-400 mt-1.5">{interview.response_word_count} words · {formatDateTime(interview.responded_at)}</p>
        </div>

        {/* Timestamps */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="bg-gray-50 rounded-lg p-2.5">
            <p className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">Slack Sent</p>
            <p className="text-xs font-medium text-gray-700">{formatDateTime(interview.slack_sent_at)}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-2.5">
            <p className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">Response Received</p>
            <p className="text-xs font-medium text-green-700">{formatDateTime(interview.responded_at)}</p>
          </div>
        </div>
      </div>
    </Card>
  )
}

// ── #8  Guided Narrative Template ─────────────────────────────────────────────
function GuidedNarrativeTemplate({ cluster, onDraftSaved }) {
  const SECTIONS = [
    {
      id: 'uncertainty',
      label: 'Technological Uncertainty',
      placeholder: 'Describe the specific technological uncertainty the team faced. What was unknown or unknowable at the start? Why couldn\'t this be resolved by standard practice or existing knowledge?',
      hint: 'SR&ED requires: uncertainty that could not be resolved without systematic investigation.',
    },
    {
      id: 'work',
      label: 'Work Performed',
      placeholder: 'Describe the systematic investigation and experimental development work performed. Reference specific commits, build failures, Jira tickets, and blocked periods where relevant.',
      hint: 'Include: hypotheses tested, experiments run, failures encountered, and how they informed next steps.',
    },
    {
      id: 'advancement',
      label: 'Technological Advancement',
      placeholder: 'Describe what new knowledge or capability was achieved. How did the outcome advance the state of technology for this business component?',
      hint: 'SR&ED requires: advancement of general scientific or technological knowledge.',
    },
  ]

  const [values, setValues] = useState({ uncertainty: '', work: '', advancement: '' })
  const [saving, setSaving] = useState(false)

  const isComplete = Object.values(values).every(v => v.trim().length >= 50)

  function handleSave() {
    setSaving(true)
    // Simulate a brief save delay
    setTimeout(() => {
      const now = new Date().toISOString()
      const draft = {
        id: `narr-draft-${cluster.id}`,
        cluster_id: cluster.id,
        tenant_id: cluster.tenant_id,
        version: 1,
        format: 'T661',
        content_text: [
          `Business Component: ${cluster.business_component}`,
          '',
          'Technological Uncertainty:',
          values.uncertainty.trim(),
          '',
          'Work Performed:',
          values.work.trim(),
          '',
          'Technological Advancement:',
          values.advancement.trim(),
        ].join('\n'),
        llm_model_version: 'manual-template-v1',
        prompt_hash: null,
        quality_score: 0.72,
        quality_passed: true,
        quality_failure_reasons: [],
        citations: [],
        approved_by: null,
        approved_at: null,
        edit_history: [],
        _manual: true,
        created_at: now,
      }
      onDraftSaved(draft)
      setSaving(false)
    }, 600)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 pb-1">
        <div className="p-1.5 bg-indigo-50 rounded-lg">
          <PenLine size={13} className="text-indigo-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800">Manual Narrative Entry</p>
          <p className="text-[10px] text-gray-400">Phase 1 template · T661 SR&ED format</p>
        </div>
      </div>

      {/* Three sections */}
      {SECTIONS.map(section => (
        <div key={section.id}>
          <div className="flex items-baseline justify-between mb-1">
            <label className="text-xs font-semibold text-gray-700">{section.label}</label>
            <span className={`text-[10px] ${values[section.id].trim().length >= 50 ? 'text-green-600' : 'text-gray-400'}`}>
              {values[section.id].trim().length} chars
            </span>
          </div>
          <p className="text-[10px] text-gray-400 mb-1.5 leading-snug">{section.hint}</p>
          <textarea
            value={values[section.id]}
            onChange={e => setValues(v => ({ ...v, [section.id]: e.target.value }))}
            rows={5}
            placeholder={section.placeholder}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-xs text-gray-800 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-300 placeholder-gray-300 transition-colors"
          />
        </div>
      ))}

      {/* Save button */}
      <div className="flex items-center gap-3 pt-1 border-t border-gray-100">
        {!isComplete && (
          <p className="text-[10px] text-gray-400 flex-1">Each section needs at least 50 characters.</p>
        )}
        <Button
          onClick={handleSave}
          disabled={!isComplete || saving}
          size="sm"
          icon={saving ? undefined : PenLine}
          className="ml-auto"
        >
          {saving ? 'Saving…' : 'Save Draft Narrative'}
        </Button>
      </div>
    </div>
  )
}

// ── Diff engine (LCS line-level) ──────────────────────────────────────────────
function computeDiff(original, edited) {
  const origLines = original.split('\n')
  const editLines = edited.split('\n')
  const m = origLines.length, n = editLines.length
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = origLines[i - 1] === editLines[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }
  const result = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origLines[i - 1] === editLines[j - 1]) {
      result.unshift({ type: 'unchanged', text: origLines[i - 1] })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'added', text: editLines[j - 1] })
      j--
    } else {
      result.unshift({ type: 'removed', text: origLines[i - 1] })
      i--
    }
  }
  return result
}

function DiffViewer({ original, edited }) {
  const diff = computeDiff(original, edited)
  const added   = diff.filter(d => d.type === 'added').length
  const removed = diff.filter(d => d.type === 'removed').length
  const hasChanges = added > 0 || removed > 0

  if (!hasChanges) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-3 border border-gray-200">
        <CheckCircle2 size={13} className="text-green-500" />
        No changes — text is identical to the previous version.
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-2 text-[11px]">
        <span className="text-green-600 font-medium">+{added} line{added !== 1 ? 's' : ''} added</span>
        <span className="text-red-500 font-medium">−{removed} line{removed !== 1 ? 's' : ''} removed</span>
      </div>
      <div className="font-mono text-xs rounded-lg border border-gray-200 overflow-hidden max-h-72 overflow-y-auto">
        {diff.map((line, idx) => (
          <div
            key={idx}
            className={`px-3 py-0.5 flex gap-2 leading-5 ${
              line.type === 'added'   ? 'bg-green-50 text-green-800' :
              line.type === 'removed' ? 'bg-red-50 text-red-700 line-through opacity-70' :
              'bg-white text-gray-700'
            }`}
          >
            <span className={`flex-shrink-0 w-3 select-none ${
              line.type === 'added'   ? 'text-green-500' :
              line.type === 'removed' ? 'text-red-400' :
              'text-gray-300'
            }`}>
              {line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ' '}
            </span>
            <span className="whitespace-pre-wrap break-all">{line.text || '\u00a0'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Narrative Panel ────────────────────────────────────────────────────────────
function NarrativePanel({ narrative, cluster, onApprove, onReject, canEdit, onStartManual, onNarrativeGenerated }) {
  const [mode, setMode] = useState('view')   // 'view' | 'edit' | 'diff' | 'history'
  const [editText, setEditText] = useState(narrative?.content_text ?? '')
  const [citationsOpen, setCitationsOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiError, setAiError] = useState(null)

  // Mutable current text and version log
  const [liveText, setLiveText] = useState(narrative?.content_text ?? '')
  const [versions, setVersions] = useState(() =>
    narrative ? [{ ver: narrative.version, label: narrative._manual ? 'Manual Entry' : 'AI Generated', text: narrative.content_text, savedAt: narrative.created_at }] : []
  )
  const latestVer = versions.length > 0 ? versions[versions.length - 1] : null
  const prevVer   = versions.length > 1 ? versions[versions.length - 2] : null

  async function handleAiGenerate() {
    setAiGenerating(true)
    setAiError(null)
    try {
      const { agents } = await import('../lib/api')
      const result = await agents.generateNarrative(cluster.id)
      onNarrativeGenerated?.({
        ...result,
        version: 1,
        format: 'T661',
        _stub: result.stub_mode,
      })
    } catch (err) {
      // Fallback: call the stub directly via a mock-like local generation
      const stubNarrative = {
        id: `narr-ai-${cluster.id}`,
        cluster_id: cluster.id,
        version: 1,
        format: 'T661',
        content_text: [
          `SR&ED T661 Technical Narrative — ${cluster.business_component ?? 'Business Component'}`,
          '═'.repeat(60),
          '',
          'A. TECHNOLOGICAL UNCERTAINTY',
          '',
          `The development of ${cluster.business_component ?? 'this component'} presented significant technological uncertainty. The team could not determine at the outset whether the chosen architectural approach would achieve the required performance and reliability characteristics. Standard engineering practice did not provide an established solution.`,
          '',
          'B. SYSTEMATIC INVESTIGATION',
          '',
          `The team conducted systematic experimental development over approximately ${cluster.aggregate_time_hours?.toFixed(1) ?? '0'} hours. The investigation involved iterative hypothesis testing, analysis of failure modes, and progressive refinement of the solution approach. Each iteration yielded new knowledge that informed subsequent experiments.`,
          '',
          'C. TECHNOLOGICAL ADVANCEMENT',
          '',
          'The work performed advanced the organisation\'s technical knowledge by establishing novel methods for [describe specific advancement]. The resulting techniques are directly applicable to future R&D initiatives and represent a measurable advancement beyond the state of technology at project inception.',
          '',
          '⚠  STUB MODE — This narrative was generated locally (backend unavailable). Replace bracketed placeholders before filing.',
        ].join('\n'),
        llm_model_version: 'stub-template-local-v1',
        quality_score: 0.65,
        quality_passed: true,
        created_at: new Date().toISOString(),
        _stub: true,
      }
      onNarrativeGenerated?.(stubNarrative)
    } finally {
      setAiGenerating(false)
    }
  }

  if (!narrative) {
    return (
      <div className="space-y-4">
        {aiError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs text-red-700">
            <AlertTriangle size={13} className="shrink-0" /> {aiError}
          </div>
        )}
        {canEdit ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200 p-5">
            <PenLine size={24} className="mb-2 opacity-40" />
            <p className="text-sm font-medium text-gray-500">No narrative yet</p>
            <p className="text-xs mt-1 mb-4 max-w-xs">Generate a T661 SR&ED narrative from evidence using AI, or write manually using the guided template.</p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                icon={Zap}
                onClick={handleAiGenerate}
                disabled={aiGenerating}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {aiGenerating ? 'Generating…' : 'AI Generate'}
              </Button>
              <Button size="sm" variant="secondary" icon={PenLine} onClick={onStartManual}>
                Manual Template
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200 p-6">
            <BarChart2 size={28} className="mb-2 opacity-40" />
            <p className="text-sm font-medium text-gray-500">No narrative generated yet</p>
            <p className="text-xs mt-1">The Compliance Writer agent will generate one after the developer interview is complete.</p>
          </div>
        )}
      </div>
    )
  }

  const isApproved = !!narrative.approved_at

  function handleSaveEdit() {
    if (editText === liveText) { setMode('view'); return }
    setSaving(true)
    setTimeout(() => {
      const newVer = {
        ver: (latestVer?.ver ?? 1) + 1,
        label: `Edited v${(latestVer?.ver ?? 1) + 1}`,
        text: editText,
        savedAt: new Date().toISOString(),
        _prevText: liveText,
      }
      setVersions(v => [...v, newVer])
      setLiveText(editText)
      setSaving(false)
      setMode('diff')
    }, 400)
  }

  function handleRestoreVersion(ver) {
    setEditText(ver.text)
    setLiveText(ver.text)
    setMode('view')
  }

  const TABS = [
    { id: 'view',    label: 'View',    icon: BarChart2  },
    { id: 'edit',    label: 'Edit',    icon: Pencil     },
    { id: 'diff',    label: 'Changes', icon: GitCompare },
    { id: 'history', label: 'History', icon: History    },
  ]

  return (
    <div className="space-y-4">
      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded font-medium">{narrative.format}</span>
        <span>v{latestVer?.ver ?? narrative.version}</span>
        <span>·</span>
        <span className="font-mono text-[10px]">{narrative.llm_model_version}</span>
        {narrative._manual && (
          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-medium">Manual</span>
        )}
        {versions.length > 1 && (
          <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded text-[10px] font-medium">{versions.length - 1} edit{versions.length > 2 ? 's' : ''}</span>
        )}
        <span className="ml-auto flex items-center gap-1">
          Quality: <span className={`font-semibold ${narrative.quality_score >= 0.85 ? 'text-green-600' : 'text-amber-600'}`}>{(narrative.quality_score * 100).toFixed(0)}%</span>
          {narrative.quality_passed ? <CheckCircle2 size={12} className="text-green-500" /> : <XCircle size={12} className="text-red-500" />}
        </span>
      </div>

      {/* Approved banner */}
      {isApproved && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700">
          <CheckCircle2 size={13} />
          <span>Approved {formatDateTime(narrative.approved_at)}</span>
          <Lock size={11} className="ml-auto" />
        </div>
      )}

      {/* Stale warning */}
      {cluster.stale_context && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
          <AlertTriangle size={13} />
          Jira context updated after snapshot — reviewer should verify narrative accuracy.
        </div>
      )}

      {/* Mode tabs (only when can edit and not approved) */}
      {canEdit && !isApproved && (
        <div className="flex border-b border-gray-200">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => {
                if (t.id === 'edit') setEditText(liveText)
                setMode(t.id)
              }}
              className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium border-b-2 transition-colors -mb-px ${
                mode === t.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <t.icon size={11} />
              {t.label}
              {t.id === 'history' && versions.length > 1 && (
                <span className="ml-0.5 text-[9px] bg-indigo-100 text-indigo-600 px-1 rounded-full">{versions.length}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── VIEW mode ─────────────────────────────────────────────────────── */}
      {mode === 'view' && (
        <div className="space-y-3">
          <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-lg p-3 border border-gray-100 max-h-72 overflow-y-auto">
            {liveText}
          </pre>
          <NarrativeQualityCard text={liveText} cluster={cluster} />
        </div>
      )}

      {/* ── EDIT mode ─────────────────────────────────────────────────────── */}
      {mode === 'edit' && canEdit && !isApproved && (
        <div className="space-y-2">
          <textarea
            value={editText}
            onChange={e => setEditText(e.target.value)}
            rows={12}
            className="w-full border border-indigo-300 rounded-lg p-3 text-xs font-mono text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
            placeholder="Edit the narrative text…"
          />
          {/* Live quality score — updates as user types */}
          <NarrativeQualityCard text={editText} cluster={cluster} />
          <div className="flex items-center gap-2 justify-end">
            <span className="text-[10px] text-gray-400 mr-auto">{editText.length} chars</span>
            <Button variant="secondary" size="sm" onClick={() => { setEditText(liveText); setMode('view') }}>
              Discard
            </Button>
            <Button size="sm" icon={saving ? undefined : Save} onClick={handleSaveEdit} disabled={saving || editText === liveText}>
              {saving ? 'Saving…' : 'Save Version'}
            </Button>
          </div>
        </div>
      )}

      {/* ── DIFF mode ─────────────────────────────────────────────────────── */}
      {mode === 'diff' && (
        <div className="space-y-2">
          {prevVer ? (
            <>
              <div className="flex items-center gap-2 text-[10px] text-gray-400 mb-1">
                <span>Comparing <strong className="text-gray-600">{prevVer.label}</strong> → <strong className="text-gray-600">{latestVer?.label}</strong></span>
                <span className="ml-auto">{formatDateTime(latestVer?.savedAt)}</span>
              </div>
              <DiffViewer original={prevVer.text} edited={latestVer?.text ?? ''} />
            </>
          ) : (
            <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3 border border-gray-100">
              No edits yet. Switch to <strong>Edit</strong> tab to make changes.
            </div>
          )}
        </div>
      )}

      {/* ── HISTORY mode ──────────────────────────────────────────────────── */}
      {mode === 'history' && (
        <div className="space-y-2">
          {versions.slice().reverse().map((ver, idx) => {
            const isLatest = idx === 0
            return (
              <div key={ver.savedAt} className={`rounded-lg border p-3 ${isLatest ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${isLatest ? 'text-indigo-800' : 'text-gray-700'}`}>
                      {ver.label}
                    </span>
                    {isLatest && <span className="text-[9px] bg-indigo-200 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">Current</span>}
                  </div>
                  <span className="text-[10px] text-gray-400">{formatDateTime(ver.savedAt)}</span>
                </div>
                <pre className="text-[10px] text-gray-600 whitespace-pre-wrap leading-relaxed max-h-20 overflow-hidden line-clamp-3">
                  {ver.text.slice(0, 200)}{ver.text.length > 200 ? '…' : ''}
                </pre>
                {!isLatest && canEdit && !isApproved && (
                  <button
                    onClick={() => handleRestoreVersion(ver)}
                    className="mt-2 flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800"
                  >
                    <RotateCcw size={10} />
                    Restore this version
                  </button>
                )}
              </div>
            )
          })}
          {versions.length === 1 && (
            <p className="text-xs text-gray-400 text-center py-3">No edits yet — version history will appear here.</p>
          )}
        </div>
      )}

      {/* Citations (shown in view mode only) */}
      {mode === 'view' && (narrative.citations?.length ?? 0) > 0 && (
        <div>
          <button
            onClick={() => setCitationsOpen(o => !o)}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900"
          >
            <Link2 size={12} />
            {narrative.citations.length} Evidence Citations
            {citationsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {citationsOpen && (
            <div className="mt-2 space-y-2">
              {narrative.citations.map((c, i) => (
                <div key={i} className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-xs">
                  <p className="font-medium text-indigo-800 mb-1">"{c.claim_text}"</p>
                  <p className="text-indigo-600 font-mono">{c.evidence_field} = <span className="text-indigo-900 font-semibold">"{c.evidence_value}"</span></p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {canEdit && !isApproved && cluster.status === 'Drafted' && (
        <div className="flex gap-2 pt-2 border-t border-gray-100">
          <Button variant="success" size="sm" icon={CheckCircle2} onClick={onApprove} className="flex-1 justify-center">
            Approve Narrative
          </Button>
          <Button variant="danger" size="sm" icon={XCircle} onClick={onReject}>
            Reject
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function ClusterDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()

  // ── API hooks ───────────────────────────────────────────────────────────────
  const { data: fetchedCluster, loading: clusterLoading, usingMock } = useCluster(id)
  const { data: fetchedNarrative } = useNarrative(id)
  const { mutate: approveCluster } = useApproveCluster()
  const { mutate: rejectCluster }  = useRejectCluster()

  const cluster  = fetchedCluster
  const snapshot = cluster ? EVIDENCE_SNAPSHOTS[cluster.evidence_snapshot_id] : null
  const canEdit  = canDo('editClusters', currentUser?.role)

  // Core state — local overrides for optimistic updates
  const [clusterState, setClusterState]     = useState(null)
  const [narrativeState, setNarrativeState] = useState(null)

  // Seed local state from API/mock data on first load
  useEffect(() => { if (fetchedCluster)   setClusterState(c  => c  ?? fetchedCluster)  }, [fetchedCluster])
  useEffect(() => { if (fetchedNarrative) setNarrativeState(n => n ?? fetchedNarrative) }, [fetchedNarrative])

  // Modal state
  const [showApproveModal, setShowApproveModal]   = useState(false)
  const [showRejectModal, setShowRejectModal]     = useState(false)
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [showTimeModal, setShowTimeModal]         = useState(false)  // #5
  const [showMergeModal, setShowMergeModal]       = useState(false)  // #9
  const [showSplitModal, setShowSplitModal]       = useState(false)  // #10

  // Modal field state
  const [rejectReason, setRejectReason]     = useState('')
  const [overridePct, setOverridePct]       = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [manualHours, setManualHours]       = useState('')          // #5
  const [manualNote, setManualNote]         = useState('')          // #5
  const [mergeTargetId, setMergeTargetId]   = useState('')          // #9
  const [mergeQuery, setMergeQuery]         = useState('')          // #9
  const [splitSelectedCommits, setSplitSelectedCommits] = useState(new Set())  // #10
  const [splitSelectedTickets, setSplitSelectedTickets] = useState(new Set())  // #10
  const [splitNewName, setSplitNewName]     = useState('')          // #10
  const [splitChild, setSplitChild]         = useState(null)        // #10 resulting child cluster

  // #8: show guided narrative template instead of empty state
  const [showNarrativeTemplate, setShowNarrativeTemplate] = useState(false)

  if (clusterLoading && !clusterState) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!cluster && !clusterState) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        <p>Cluster not found.</p>
      </div>
    )
  }

  // ── Event handlers ───────────────────────────────────────────────────────────
  function handleApprove() {
    setClusterState(c => ({ ...c, status: 'Approved' }))
    setNarrativeState(n => n ? ({ ...n, approved_by: currentUser?.id, approved_at: new Date().toISOString() }) : n)
    setShowApproveModal(false)
    approveCluster(id).catch(() => {}) // optimistic — ignore error
  }

  function handleReject() {
    setClusterState(c => ({ ...c, status: 'Rejected' }))
    setShowRejectModal(false)
    rejectCluster(id, rejectReason).catch(() => {})
    setRejectReason('')
  }

  function handleOverride() {
    const pct = parseFloat(overridePct)
    setClusterState(c => ({ ...c, manual_override_pct: pct, manual_override_reason: overrideReason }))
    setShowOverrideModal(false)
    setOverridePct('')
    setOverrideReason('')
  }

  // #5 — Manual time entry submit
  function handleManualTimeEntry() {
    const hours = parseFloat(manualHours)
    setClusterState(c => ({
      ...c,
      aggregate_time_hours: hours,
      proxy_used: true,
      proxy_confidence: 'Low',
      manual_time_note: manualNote,
    }))
    setShowTimeModal(false)
    setManualHours('')
    setManualNote('')
  }

  // #9 — Merge cluster into target
  function handleMerge() {
    setClusterState(prev => ({
      ...prev,
      merged_into_cluster_id: mergeTargetId,
      status: 'Merged',
    }))
    setShowMergeModal(false)
    setMergeTargetId('')
    setMergeQuery('')
  }

  // #10 — Split cluster
  function handleSplit() {
    const snap = EVIDENCE_SNAPSHOTS[c.evidence_snapshot_id]
    const childCommits = snap?.git_commits?.filter(cm => splitSelectedCommits.has(cm.sha)) ?? []
    const childTickets = snap?.jira_tickets?.filter(t => splitSelectedTickets.has(t.ticket_id)) ?? []
    const childHours = childCommits.length && c.aggregate_time_hours
      ? Math.round((childCommits.length / (snap?.git_commits?.length ?? 1)) * c.aggregate_time_hours * 10) / 10
      : null

    // New child cluster (mock)
    const child = {
      id: `clus-split-${Date.now().toString(36)}`,
      tenant_id: c.tenant_id,
      status: 'New',
      created_at: new Date().toISOString(),
      business_component: splitNewName.trim(),
      trigger_rules: c.trigger_rules,
      risk_score: c.risk_score,
      aggregate_time_hours: childHours,
      eligibility_percentage: null,
      estimated_credit_cad: null,
      estimated_credit_usd: null,
      evidence_snapshot_id: null,
      narrative_id: null,
      eligibility_rule_version_id: c.eligibility_rule_version_id,
      merged_into_cluster_id: null,
      manual_override_pct: null,
      manual_override_reason: null,
      stale_context: false,
      proxy_used: false,
      proxy_confidence: null,
      _split_commits: childCommits,
      _split_tickets: childTickets,
      _split_from: c.id,
    }

    // Remaining commits / tickets stay in original
    const remainingCommitCount = (snap?.git_commits?.length ?? 0) - childCommits.length
    const remainHours = c.aggregate_time_hours && snap?.git_commits?.length
      ? Math.round((remainingCommitCount / snap.git_commits.length) * c.aggregate_time_hours * 10) / 10
      : c.aggregate_time_hours

    setSplitChild(child)
    setClusterState(prev => ({
      ...prev,
      aggregate_time_hours: remainHours,
      _split_child_id: child.id,
      _split_child_name: splitNewName.trim(),
    }))
    setShowSplitModal(false)
    setSplitSelectedCommits(new Set())
    setSplitSelectedTickets(new Set())
    setSplitNewName('')
  }

  // #8 — Narrative template draft saved
  function handleNarrativeDraftSaved(draft) {
    setNarrativeState(draft)
    setShowNarrativeTemplate(false)
    // Advance cluster status to Drafted
    setClusterState(c => ({ ...c, status: 'Drafted', narrative_id: draft.id }))
  }

  const c = clusterState ?? cluster
  const n = narrativeState ?? narrative
  const interview = DEVELOPER_INTERVIEWS[c.id]

  return (
    <div className="space-y-4">
      {/* Demo mode banner */}
      {usingMock && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
          <FlaskConical size={13} />
          <span>Using demo data — backend not connected.</span>
        </div>
      )}

      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/clusters')}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-gray-900 leading-tight">{c.business_component ?? 'Unnamed Cluster'}</h2>
          <p className="text-xs text-gray-400 mt-0.5 font-mono">{c.id}</p>
        </div>
        <StatusBadge status={c.status} />
      </div>

      {/* #10 — Split child banner */}
      {splitChild && (
        <div className="flex items-start gap-3 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl">
          <Scissors size={16} className="text-indigo-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-indigo-900">Cluster split successfully</p>
            <p className="text-xs text-indigo-700 mt-0.5">
              <strong>{splitChild.business_component}</strong> was created as a new cluster
              ({splitChild._split_commits.length} commit{splitChild._split_commits.length !== 1 ? 's' : ''},
              {splitChild._split_tickets.length} ticket{splitChild._split_tickets.length !== 1 ? 's' : ''},
              {splitChild.aggregate_time_hours != null ? ` ~${splitChild.aggregate_time_hours}h` : ''}).
              It will appear in the Clusters list once saved to the server.
            </p>
          </div>
        </div>
      )}

      {/* #9 — Merged banner */}
      {c.status === 'Merged' && c.merged_into_cluster_id && (() => {
        const target = CLUSTERS.find(cl => cl.id === c.merged_into_cluster_id)
        return (
          <div className="flex items-start gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl">
            <GitMerge size={16} className="text-slate-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-800">This cluster has been merged</p>
              <p className="text-xs text-slate-600 mt-0.5">
                Evidence and eligible time absorbed into{' '}
                <strong>{target?.business_component ?? c.merged_into_cluster_id}</strong>.
                This cluster is excluded from the credit calculation.
              </p>
            </div>
          </div>
        )
      })()}

      {/* Summary cards row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Risk Score',        value: <RiskScore score={c.risk_score} showBar={false} />, icon: Shield },
          { label: 'Eligible Hours',    value: formatHours(c.aggregate_time_hours), icon: Clock },
          { label: 'Eligibility %',     value: c.eligibility_percentage != null ? `${c.eligibility_percentage}%${c.manual_override_pct ? ` (+${c.manual_override_pct}%)` : ''}` : '—', icon: BarChart2 },
          { label: 'Est. Credit (CAD)', value: formatCurrency(c.estimated_credit_cad), icon: CheckCircle2 },
        ].map(item => (
          <div key={item.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg"><item.icon size={15} className="text-indigo-600" /></div>
            <div>
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{item.label}</p>
              <div className="text-sm font-semibold text-gray-900 mt-0.5">{item.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main content: 3/5 evidence + 2/5 narrative */}
      <div className="grid grid-cols-5 gap-4">
        {/* Left: Evidence */}
        <div className="col-span-3 space-y-4">
          {/* Trigger Rules */}
          <Card>
            <CardHeader
              title="Detection Signals"
              subtitle={`${c.trigger_rules.length} heuristic${c.trigger_rules.length !== 1 ? 's' : ''} triggered`}
            />
            <div className="space-y-3">
              {c.trigger_rules.map(rule => {
                const Icon = HEURISTIC_ICONS[rule.heuristic] ?? Zap
                const pct = Math.min(rule.fired_value / 1, 1)
                return (
                  <div key={rule.heuristic} className="flex items-center gap-3">
                    <div className="p-1.5 bg-indigo-50 rounded-lg flex-shrink-0"><Icon size={13} className="text-indigo-600" /></div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700">{rule.heuristic.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <span className="text-[10px] text-gray-400">{(rule.fired_value * 100).toFixed(0)}% / threshold {(rule.threshold * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct * 100}%` }} />
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-400 w-8 text-right">w={rule.weight}</span>
                  </div>
                )
              })}
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-500">
              <span>Detected: <strong>{formatDate(c.created_at)}</strong></span>
              <span>Rules version: <strong>{c.eligibility_rule_version_id}</strong></span>
              {c.proxy_used && <span className="text-blue-600">Proxy time: <strong>{c.proxy_confidence}</strong> confidence</span>}
              {c.manual_override_pct && <span className="text-amber-600">Override: +{c.manual_override_pct}%</span>}
            </div>
          </Card>

          {/* Evidence Snapshot */}
          {snapshot ? (
            <Card>
              <CardHeader
                title="Evidence Snapshot"
                subtitle={`Captured ${formatDateTime(snapshot.snapshot_date)} · SHA-256 verified`}
              />
              <EvidenceTabs snapshot={snapshot} />
            </Card>
          ) : (
            <Card>
              <p className="text-sm text-gray-400 text-center py-6">No evidence snapshot available.</p>
            </Card>
          )}

          {/* #11 — Interview Status Panel (Interviewed clusters) */}
          {(c.status === 'Interviewed' || interview) && (
            <InterviewStatusPanel clusterId={c.id} />
          )}

          {/* Reviewer controls */}
          {canEdit && ['Drafted', 'Interviewed', 'New'].includes(c.status) && (
            <Card>
              <CardHeader title="Reviewer Actions" />
              <div className="flex flex-wrap gap-2">
                {c.status === 'Drafted' && (
                  <>
                    <Button variant="success" size="sm" icon={CheckCircle2} onClick={() => setShowApproveModal(true)}>Approve Cluster</Button>
                    <Button variant="danger"  size="sm" icon={XCircle}      onClick={() => setShowRejectModal(true)}>Reject Cluster</Button>
                  </>
                )}
                <Button variant="secondary" size="sm" icon={BarChart2} onClick={() => setShowOverrideModal(true)}>Eligibility Override</Button>

                {/* #5 — Manual time entry button (only when no hours recorded) */}
                {c.aggregate_time_hours == null && (
                  <Button variant="secondary" size="sm" icon={Timer} onClick={() => setShowTimeModal(true)}>
                    Log Time Manually
                  </Button>
                )}

                {/* #9 — Merge cluster */}
                <Button variant="secondary" size="sm" icon={GitMerge} onClick={() => setShowMergeModal(true)}>
                  Merge into…
                </Button>

                {/* #10 — Split cluster (only when there are ≥2 commits) */}
                {snapshot && (snapshot.git_commits?.length ?? 0) >= 2 && (
                  <Button variant="secondary" size="sm" icon={Scissors} onClick={() => setShowSplitModal(true)}>
                    Split Cluster
                  </Button>
                )}
              </div>
              {c.manual_override_reason && (
                <p className="mt-3 text-xs text-amber-700 bg-amber-50 rounded-lg p-2">
                  <strong>Override reason:</strong> {c.manual_override_reason}
                </p>
              )}
              {c.proxy_used && c.proxy_confidence === 'Low' && c.manual_time_note && (
                <p className="mt-2 text-xs text-blue-700 bg-blue-50 rounded-lg p-2">
                  <strong>Manual time note:</strong> {c.manual_time_note}
                </p>
              )}
            </Card>
          )}
        </div>

        {/* Right: Narrative */}
        <div className="col-span-2">
          {/* #8 — Show guided template or narrative panel */}
          {showNarrativeTemplate && canEdit ? (
            <Card>
              <GuidedNarrativeTemplate cluster={c} onDraftSaved={handleNarrativeDraftSaved} />
            </Card>
          ) : (
            <Card>
              <CardHeader title="Compliance Narrative" subtitle="SR&ED documentation" />
              <NarrativePanel
                narrative={n}
                cluster={c}
                canEdit={canEdit}
                onApprove={() => setShowApproveModal(true)}
                onReject={() => setShowRejectModal(true)}
                onStartManual={() => setShowNarrativeTemplate(true)}
                onNarrativeGenerated={(generated) => {
                  setNarrativeState(generated)
                  setClusterState(prev => ({ ...prev, status: 'Drafted', narrative_id: generated.id }))
                }}
              />
            </Card>
          )}
        </div>
      </div>

      {/* ── Comment Thread ─────────────────────────────────────────────────── */}
      <Card>
        <CommentThread
          clusterId={c.id}
          initialComments={COMMENTS[c.id] ?? []}
        />
      </Card>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}

      {/* Approve */}
      <Modal open={showApproveModal} onClose={() => setShowApproveModal(false)} title="Approve Narrative">
        <p className="text-sm text-gray-600 mb-4">
          Approving this narrative will lock it for audit purposes and trigger the Accountant agent to compute the final financial calculation.
        </p>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-800 mb-5">
          <strong>Cluster:</strong> {c.business_component}<br />
          <strong>Quality score:</strong> {n ? `${(n.quality_score * 100).toFixed(0)}%` : '—'}<br />
          <strong>Estimated hours:</strong> {formatHours(c.aggregate_time_hours)}
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setShowApproveModal(false)}>Cancel</Button>
          <Button variant="success" icon={CheckCircle2} onClick={handleApprove}>Confirm Approval</Button>
        </div>
      </Modal>

      {/* Reject */}
      <Modal open={showRejectModal} onClose={() => setShowRejectModal(false)} title="Reject Cluster">
        <p className="text-sm text-gray-600 mb-3">This cluster will be marked as Rejected and removed from the credit calculation.</p>
        <label className="block text-xs font-medium text-gray-700 mb-1">Reason (optional)</label>
        <textarea
          value={rejectReason}
          onChange={e => setRejectReason(e.target.value)}
          rows={3}
          placeholder="e.g. Activity does not meet SR&ED technological uncertainty criteria."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
        />
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setShowRejectModal(false)}>Cancel</Button>
          <Button variant="danger" icon={XCircle} onClick={handleReject}>Confirm Rejection</Button>
        </div>
      </Modal>

      {/* Override */}
      <Modal open={showOverrideModal} onClose={() => setShowOverrideModal(false)} title="Eligibility Override">
        <p className="text-sm text-gray-600 mb-4">Adjusts the calculated eligibility percentage by ±20%. Requires a justification of at least 20 characters.</p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Override % (−20 to +20)</label>
            <input
              type="number" min={-20} max={20} step={1}
              value={overridePct}
              onChange={e => setOverridePct(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. 10"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Justification</label>
            <textarea
              value={overrideReason}
              onChange={e => setOverrideReason(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Minimum 20 characters — document the basis for adjustment."
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="secondary" onClick={() => setShowOverrideModal(false)}>Cancel</Button>
          <Button onClick={handleOverride} disabled={!overridePct || overrideReason.length < 20}>
            Apply Override
          </Button>
        </div>
      </Modal>

      {/* #10 — Split Cluster Modal */}
      {showSplitModal && (() => {
        const snap = EVIDENCE_SNAPSHOTS[c.evidence_snapshot_id]
        const commits  = snap?.git_commits  ?? []
        const tickets  = snap?.jira_tickets ?? []
        const selCount = splitSelectedCommits.size + splitSelectedTickets.size
        const totalCount = commits.length + tickets.length
        const canConfirm = splitNewName.trim().length >= 5 && selCount > 0 && selCount < totalCount

        function toggleCommit(sha) {
          setSplitSelectedCommits(prev => {
            const next = new Set(prev)
            next.has(sha) ? next.delete(sha) : next.add(sha)
            return next
          })
        }
        function toggleTicket(tid) {
          setSplitSelectedTickets(prev => {
            const next = new Set(prev)
            next.has(tid) ? next.delete(tid) : next.add(tid)
            return next
          })
        }

        const childHours = commits.length && c.aggregate_time_hours
          ? Math.round((splitSelectedCommits.size / commits.length) * c.aggregate_time_hours * 10) / 10
          : null
        const remainHours = c.aggregate_time_hours != null && childHours != null
          ? Math.round((c.aggregate_time_hours - childHours) * 10) / 10
          : null

        return (
          <Modal
            open={showSplitModal}
            onClose={() => {
              setShowSplitModal(false)
              setSplitSelectedCommits(new Set())
              setSplitSelectedTickets(new Set())
              setSplitNewName('')
            }}
            title="Split Cluster"
          >
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Assign commits and tickets to a new child cluster. Items you select will move to the new cluster; the rest stay here.
              </p>

              {/* New cluster name */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  New cluster name <span className="text-gray-400">(required · min 5 chars)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Payment Auth — PKCE Hardening"
                  value={splitNewName}
                  onChange={e => setSplitNewName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Commits */}
              {commits.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">
                    Commits <span className="text-gray-400 font-normal">({splitSelectedCommits.size} of {commits.length} selected → new cluster)</span>
                  </p>
                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-40 overflow-y-auto">
                    {commits.map(cm => (
                      <label key={cm.sha} className="flex items-start gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={splitSelectedCommits.has(cm.sha)}
                          onChange={() => toggleCommit(cm.sha)}
                          className="mt-0.5 accent-indigo-600 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono text-gray-500">{cm.sha.slice(0, 7)}</p>
                          <p className="text-xs text-gray-700 truncate">{cm.message}</p>
                          <p className="text-[10px] text-gray-400">{cm.author} · +{cm.lines_added}/−{cm.lines_deleted}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Jira tickets */}
              {tickets.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">
                    Jira Tickets <span className="text-gray-400 font-normal">({splitSelectedTickets.size} of {tickets.length} selected → new cluster)</span>
                  </p>
                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                    {tickets.map(t => (
                      <label key={t.ticket_id} className="flex items-start gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={splitSelectedTickets.has(t.ticket_id)}
                          onChange={() => toggleTicket(t.ticket_id)}
                          className="mt-0.5 accent-indigo-600 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-mono text-indigo-600">{t.ticket_id}</span>
                          <p className="text-xs text-gray-700">{t.summary}</p>
                          <p className="text-[10px] text-gray-400">{t.worklog_hours}h · {t.story_points} SP · {t.status}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview */}
              {selCount > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Original keeps</p>
                    <p className="text-xs font-medium text-gray-800">{commits.length - splitSelectedCommits.size} commits · {tickets.length - splitSelectedTickets.size} tickets</p>
                    {remainHours != null && <p className="text-xs text-gray-500">~{remainHours}h</p>}
                  </div>
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2.5">
                    <p className="text-[10px] font-semibold text-indigo-500 uppercase mb-1">New cluster gets</p>
                    <p className="text-xs font-medium text-indigo-800">{splitSelectedCommits.size} commits · {splitSelectedTickets.size} tickets</p>
                    {childHours != null && <p className="text-xs text-indigo-600">~{childHours}h</p>}
                  </div>
                </div>
              )}

              {selCount === totalCount && totalCount > 0 && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  You must leave at least one item in the original cluster.
                </p>
              )}

              <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  The original cluster is archived as the parent. The new child cluster starts at <strong>New</strong> status and must be reviewed independently.
                </p>
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <Button variant="secondary" onClick={() => {
                  setShowSplitModal(false)
                  setSplitSelectedCommits(new Set())
                  setSplitSelectedTickets(new Set())
                  setSplitNewName('')
                }}>Cancel</Button>
                <Button
                  variant="primary"
                  icon={Scissors}
                  onClick={handleSplit}
                  disabled={!canConfirm}
                >
                  Confirm Split
                </Button>
              </div>
            </div>
          </Modal>
        )
      })()}

      {/* #9 — Merge Cluster Modal */}
      {showMergeModal && (() => {
        const mergeTargets = CLUSTERS.filter(cl =>
          cl.id !== c.id &&
          !cl.merged_into_cluster_id &&
          cl.status !== 'Rejected' &&
          cl.status !== 'Merged'
        )
        const filtered = mergeTargets.filter(cl =>
          mergeQuery.trim() === '' ||
          cl.business_component.toLowerCase().includes(mergeQuery.toLowerCase()) ||
          cl.id.toLowerCase().includes(mergeQuery.toLowerCase())
        )
        const targetCluster = CLUSTERS.find(cl => cl.id === mergeTargetId)
        const targetSnap = targetCluster ? EVIDENCE_SNAPSHOTS[targetCluster.evidence_snapshot_id] : null
        const mySnap = EVIDENCE_SNAPSHOTS[c.evidence_snapshot_id]
        const absorbedCommits = (mySnap?.git_commits?.length ?? 0) + (targetSnap?.git_commits?.length ?? 0)
        const absorbedHours = (c.aggregate_time_hours ?? 0) + (targetCluster?.aggregate_time_hours ?? 0)

        return (
          <Modal open={showMergeModal} onClose={() => { setShowMergeModal(false); setMergeTargetId(''); setMergeQuery('') }} title="Merge Cluster">
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Select a target cluster to absorb this cluster's evidence and eligible hours.
                The current cluster will be archived and excluded from the credit calculation.
              </p>

              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search clusters…"
                  value={mergeQuery}
                  onChange={e => setMergeQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Cluster list */}
              <div className="max-h-52 overflow-y-auto space-y-1 border border-gray-200 rounded-lg p-1">
                {filtered.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No matching clusters found.</p>
                ) : filtered.map(cl => (
                  <button
                    key={cl.id}
                    onClick={() => setMergeTargetId(cl.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      mergeTargetId === cl.id
                        ? 'bg-indigo-50 border border-indigo-200'
                        : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-gray-800 truncate text-xs">{cl.business_component}</span>
                      <StatusBadge status={cl.status} />
                    </div>
                    <div className="flex gap-3 text-[10px] text-gray-400 mt-0.5">
                      <span className="font-mono">{cl.id}</span>
                      {cl.aggregate_time_hours != null && <span>{cl.aggregate_time_hours}h</span>}
                    </div>
                  </button>
                ))}
              </div>

              {/* Preview what gets absorbed */}
              {mergeTargetId && targetCluster && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2.5 space-y-1">
                  <p className="text-xs font-semibold text-indigo-800">After merge, target cluster will absorb:</p>
                  <div className="flex gap-4 text-xs text-indigo-700">
                    <span>⏱ ~{absorbedHours > 0 ? `${absorbedHours}h` : '—'} total hours</span>
                    <span>⌥ ~{absorbedCommits} commits</span>
                    {mySnap?.jira_issues?.length > 0 && <span>📋 {mySnap.jira_issues.length} Jira tickets</span>}
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  This action is irreversible in a production system. The current cluster will be marked as Merged and removed from all credit calculations.
                </p>
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <Button variant="secondary" onClick={() => { setShowMergeModal(false); setMergeTargetId(''); setMergeQuery('') }}>Cancel</Button>
                <Button
                  variant="primary"
                  icon={GitMerge}
                  onClick={handleMerge}
                  disabled={!mergeTargetId}
                >
                  Confirm Merge
                </Button>
              </div>
            </div>
          </Modal>
        )
      })()}

      {/* #5 — Manual Time Entry Modal */}
      <Modal open={showTimeModal} onClose={() => setShowTimeModal(false)} title="Log Time Manually">
        <p className="text-sm text-gray-600 mb-1">
          No worklog or story-point data was found for this cluster. Enter hours manually.
        </p>
        <p className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mb-4">
          This will set <strong>proxy_used = true</strong> and <strong>proxy_confidence = Low</strong>. The Accountant agent will flag this cluster for CPA review.
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Hours worked <span className="text-gray-400">(total eligible R&D time)</span>
            </label>
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={manualHours}
              onChange={e => setManualHours(e.target.value)}
              placeholder="e.g. 48"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Justification <span className="text-gray-400">(required · min 20 chars)</span>
            </label>
            <textarea
              value={manualNote}
              onChange={e => setManualNote(e.target.value)}
              rows={3}
              placeholder="Describe why worklog data is unavailable and how you estimated the hours. This note is audit-logged."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[10px] text-gray-400 mt-1">{manualNote.length} / 20 chars minimum</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="secondary" onClick={() => { setShowTimeModal(false); setManualHours(''); setManualNote('') }}>Cancel</Button>
          <Button
            icon={Timer}
            onClick={handleManualTimeEntry}
            disabled={!manualHours || parseFloat(manualHours) <= 0 || manualNote.length < 20}
          >
            Save Hours
          </Button>
        </div>
      </Modal>
    </div>
  )
}

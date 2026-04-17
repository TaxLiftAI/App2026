/**
 * CPAOversightPage — /cpa-portal/oversight/:clientId
 *
 * CPA oversight controls + technical narrative editor.
 * Allows a CPA to:
 *   • See all SR&ED clusters for a client with AI-generated narratives
 *   • EDIT each technological uncertainty narrative inline
 *   • Approve or flag each cluster for revision
 *   • Add internal CPA notes per cluster
 *   • Bulk-approve all pending clusters
 *   • Download the CPA audit package PDF with edited narratives
 *   • Track real-time readiness score
 */
import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  CheckCircle2, XCircle, AlertTriangle, ChevronLeft,
  Edit3, Save, Download, RefreshCw, FileText,
  Clock, DollarSign, GitMerge, MessageSquare, Sparkles,
  Check, ChevronDown, ChevronUp, Shield, Users,
} from 'lucide-react'

const fmt = n => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n)

// ── Default narratives keyed by theme ─────────────────────────────────────────
const DEFAULT_NARRATIVES = {
  'ML / AI Development':
    'At the outset of this project, technological uncertainty existed regarding whether the proposed ' +
    'machine learning architecture could achieve the required accuracy and inference latency targets ' +
    'without relying on standard, commercially available pre-trained models. The team conducted ' +
    'systematic experimentation across transformer architectures, training regimes, and data pipeline ' +
    'designs. No standard practice or technique readily available to competent ML practitioners could ' +
    'resolve these uncertainties without the experimental work undertaken.',

  'Algorithm Research & Optimization':
    'Technological uncertainty existed regarding whether a novel algorithmic approach could satisfy ' +
    'the performance and correctness constraints within the operational environment at production scale. ' +
    'The work involved iterative hypothesis formation and empirical testing against measurable benchmarks. ' +
    'Standard algorithmic approaches were evaluated and found insufficient, necessitating systematic ' +
    'investigation to advance the state of knowledge within the company.',

  'Distributed Systems Research':
    'The project faced uncertainty around whether the proposed distributed architecture could achieve ' +
    'the required consistency guarantees, fault tolerance, and sub-100ms latency targets simultaneously. ' +
    'Existing distributed systems literature did not address the specific combination of requirements. ' +
    'Systematic investigation involved building and stress-testing prototype implementations under ' +
    'failure scenarios not covered by CAP theorem alone.',

  'Security & Cryptography R&D':
    'Technological uncertainty existed regarding the feasibility of implementing the proposed ' +
    'cryptographic protocol while meeting both security and performance objectives on consumer hardware. ' +
    'The work involved systematic investigation of known attack vectors, edge cases in protocol design, ' +
    'and implementation strategies to achieve the required security properties without unacceptable ' +
    'computational overhead.',

  'Performance Engineering Research':
    'Uncertainty existed whether the proposed optimization techniques could achieve the target ' +
    'performance improvements — a 10× reduction in p99 latency — without introducing correctness ' +
    'regressions. The team conducted systematic profiling, hypothesis-driven micro-benchmark ' +
    'experiments, and comparative testing across hardware configurations to identify and resolve ' +
    'the underlying performance bottlenecks.',
}

function defaultNarrative(theme) {
  for (const [k, v] of Object.entries(DEFAULT_NARRATIVES)) {
    if (theme?.includes(k.split(' ')[0])) return v
  }
  return (
    `At the outset of this project (${theme}), technological uncertainty existed regarding whether ` +
    `the proposed technical approach could meet the required functional and performance objectives. ` +
    `Standard techniques available to competent practitioners in the field were evaluated and found ` +
    `insufficient. The team conducted systematic investigation through iterative experimentation, ` +
    `producing measurable evidence of advancement at each stage.`
  )
}

function mockClusters(clientId) {
  const items = [
    { theme: 'ML / AI Development',               hours: 320, commits: 87, credit: 52000 },
    { theme: 'Algorithm Research & Optimization', hours: 180, commits: 54, credit: 28000 },
    { theme: 'Distributed Systems Research',      hours: 140, commits: 41, credit: 22000 },
    { theme: 'Security & Cryptography R&D',       hours: 90,  commits: 28, credit: 14000 },
    { theme: 'Performance Engineering Research',  hours: 70,  commits: 22, credit: 11000 },
  ]
  const n = 3 + (parseInt(clientId?.replace(/\D/g,'') || '1', 10) % 2)
  return items.slice(0, n).map((t, i) => ({
    id:        `${clientId}-cl-${i}`,
    theme:     t.theme,
    hours:     t.hours,
    commits:   t.commits,
    credit:    t.credit,
    narrative: defaultNarrative(t.theme),
    status:    i === 0 ? 'approved' : 'pending',
    cpaNotes:  '',
    aiScore:   75 + i * 4,
  }))
}

// ── Narrative editor ───────────────────────────────────────────────────────────
function NarrativeEditor({ cluster, onSave, onCancel }) {
  const [text, setText] = useState(cluster.narrative)
  const words = text.trim().split(/\s+/).filter(Boolean).length
  const ok    = words >= 80

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700">Edit Technological Uncertainty Narrative</p>
        <span className={`text-[10px] font-medium ${ok ? 'text-emerald-600' : 'text-amber-600'}`}>
          {words} words {ok ? '✓' : `(${80 - words} more recommended)`}
        </span>
      </div>
      <textarea
        className="w-full border border-indigo-300 rounded-xl px-3 py-2.5 text-xs text-gray-700 leading-relaxed
                   focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        rows={9}
        value={text}
        onChange={e => setText(e.target.value)}
        autoFocus
      />
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-gray-400">
          CRA requires evidence that uncertainty could not be resolved by standard practice (T4088 §2.1.1)
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(text)}
            disabled={!text.trim()}
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700
                       disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Save size={11} /> Save narrative
          </button>
        </div>
      </div>
    </div>
  )
}

// ── CPA notes ─────────────────────────────────────────────────────────────────
function CpaNotesEditor({ value, onSave }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(value)
  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-indigo-600 mt-1 transition-colors"
    >
      <MessageSquare size={10} />
      {value ? `CPA note: "${value.slice(0,40)}…"` : 'Add CPA note (internal only)'}
    </button>
  )
  return (
    <div className="mt-2 space-y-1.5">
      <textarea
        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 resize-none
                   focus:outline-none focus:ring-2 focus:ring-indigo-400"
        rows={2} value={text} onChange={e => setText(e.target.value)}
        placeholder="Internal CPA note — not included in client-facing PDF…"
        autoFocus
      />
      <div className="flex gap-2 justify-end">
        <button onClick={() => setOpen(false)} className="text-[10px] text-gray-400 hover:text-gray-600">Cancel</button>
        <button
          onClick={() => { onSave(text); setOpen(false) }}
          className="text-[10px] text-white bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1 rounded font-semibold"
        >Save</button>
      </div>
    </div>
  )
}

// ── Cluster card ──────────────────────────────────────────────────────────────
function ClusterCard({ cluster, onApprove, onFlag, onSaveNarrative, onSaveNotes }) {
  const [editing,  setEditing]  = useState(false)
  const [expanded, setExpanded] = useState(cluster.status === 'pending')

  const STATUS = {
    approved: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', label: 'Approved' },
    flagged:  { icon: XCircle,      color: 'text-red-500',     bg: 'bg-red-50 border-red-200',         label: 'Needs revision' },
    pending:  { icon: Clock,        color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200',     label: 'Pending review' },
  }
  const meta   = STATUS[cluster.status] ?? STATUS.pending
  const SIcon  = meta.icon

  return (
    <div className={`rounded-2xl border overflow-hidden bg-white ${
      cluster.status === 'approved' ? 'border-emerald-200' :
      cluster.status === 'flagged'  ? 'border-red-200' : 'border-gray-200'
    }`}>
      {/* Header */}
      <div
        className="flex items-start gap-3 px-4 py-3.5 cursor-pointer"
        onClick={() => !editing && setExpanded(v => !v)}
      >
        <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Sparkles size={14} className="text-indigo-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900">{cluster.theme}</p>
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${meta.bg} ${meta.color}`}>
              <SIcon size={9} /> {meta.label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
            <span><Clock size={9} className="inline mr-0.5" />{cluster.hours}h</span>
            <span><GitMerge size={9} className="inline mr-0.5" />{cluster.commits} commits</span>
            <span><DollarSign size={9} className="inline mr-0.5" />{fmt(cluster.credit)} est.</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
            cluster.aiScore >= 80 ? 'bg-emerald-50 text-emerald-700' :
            cluster.aiScore >= 60 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
          }`}>AI {cluster.aiScore}%</span>
          {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-3">
          {/* Narrative */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <FileText size={12} className="text-indigo-400" />
                Technological Uncertainty Narrative
              </p>
              {!editing && (
                <button
                  onClick={e => { e.stopPropagation(); setEditing(true) }}
                  className="flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  <Edit3 size={10} /> Edit narrative
                </button>
              )}
            </div>
            {editing ? (
              <NarrativeEditor
                cluster={cluster}
                onSave={t => { onSaveNarrative(cluster.id, t); setEditing(false) }}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                {cluster.narrative}
              </p>
            )}
          </div>

          {/* CPA notes */}
          <CpaNotesEditor value={cluster.cpaNotes} onSave={t => onSaveNotes(cluster.id, t)} />

          {/* Approve / Flag */}
          {!editing && (
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => onApprove(cluster.id)}
                disabled={cluster.status === 'approved'}
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-xl border transition-colors
                  ${cluster.status === 'approved'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700 cursor-default'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700'}`}
              >
                <CheckCircle2 size={13} />
                {cluster.status === 'approved' ? 'Approved ✓' : 'Approve cluster'}
              </button>
              <button
                onClick={() => onFlag(cluster.id)}
                disabled={cluster.status === 'flagged'}
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-xl border transition-colors
                  ${cluster.status === 'flagged'
                    ? 'bg-red-50 border-red-300 text-red-700 cursor-default'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-red-50 hover:border-red-300 hover:text-red-700'}`}
              >
                <AlertTriangle size={13} />
                {cluster.status === 'flagged' ? 'Flagged for revision' : 'Flag for revision'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CPAOversightPage() {
  const { clientId } = useParams()
  const navigate     = useNavigate()

  const [clusters,  setClusters]  = useState(() => mockClusters(clientId))
  const [pdfBusy,   setPdfBusy]   = useState(false)
  const [saved,     setSaved]     = useState(false)

  const approved    = clusters.filter(c => c.status === 'approved').length
  const flagged     = clusters.filter(c => c.status === 'flagged').length
  const pending     = clusters.filter(c => c.status === 'pending').length
  const approvedCr  = clusters.filter(c => c.status === 'approved').reduce((s, c) => s + c.credit, 0)
  const totalCr     = clusters.reduce((s, c) => s + c.credit, 0)
  const readiness   = Math.round((approved / clusters.length) * 100)
  const allApproved = approved === clusters.length

  const handleApprove       = useCallback(id => setClusters(cs => cs.map(c => c.id === id ? { ...c, status: 'approved' } : c)), [])
  const handleFlag          = useCallback(id => setClusters(cs => cs.map(c => c.id === id ? { ...c, status: 'flagged'  } : c)), [])
  const handleSaveNarrative = useCallback((id, t) => setClusters(cs => cs.map(c => c.id === id ? { ...c, narrative: t } : c)), [])
  const handleSaveNotes     = useCallback((id, t) => setClusters(cs => cs.map(c => c.id === id ? { ...c, cpaNotes: t } : c)), [])
  const handleBulkApprove   = () => setClusters(cs => cs.map(c => c.status === 'pending' ? { ...c, status: 'approved' } : c))
  const handleSave          = () => { setSaved(true); setTimeout(() => setSaved(false), 2500) }

  async function handleDownload() {
    setPdfBusy(true)
    try {
      const payload = {
        repos:      [`client-${clientId}/platform`],
        clusters:   clusters.filter(c => c.status === 'approved').map(c => ({
          _theme:               c.theme,
          _commitCount:         c.commits,
          aggregate_time_hours: c.hours,
          estimated_credit_cad: c.credit,
          _topCommits:          [],
        })),
        credit:     approvedCr,
        creditLow:  Math.round(approvedCr * 0.65),
        creditHigh: Math.round(approvedCr * 1.35),
        commitCount: clusters.reduce((s, c) => s + c.commits, 0),
        hoursTotal:  clusters.reduce((s, c) => s + c.hours, 0),
        isCcpc:  true,
        province:'ON',
      }
      const res = await fetch('/api/v1/audit/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('PDF failed')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = `taxlift-cpa-package-${clientId}.pdf`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { console.error(e) } finally { setPdfBusy(false) }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 sticky top-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate('/cpa-portal')}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 flex-shrink-0">
            <ChevronLeft size={14} /> All clients
          </button>
          <span className="text-gray-300 text-sm">|</span>
          <div className="flex items-center gap-2">
            <Shield size={13} className="text-indigo-500 flex-shrink-0" />
            <p className="text-sm font-semibold text-gray-900 truncate">SR&amp;ED Review — Client {clientId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {saved && <span className="text-xs text-emerald-600 font-medium flex items-center gap-1"><Check size={11} /> Saved</span>}
          <button onClick={handleSave}
            className="text-xs font-semibold text-gray-700 border border-gray-200 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors">
            Save progress
          </button>
          <button
            onClick={handleDownload}
            disabled={pdfBusy || !allApproved}
            title={!allApproved ? 'Approve all clusters first' : ''}
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700
                       disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg transition-colors">
            {pdfBusy ? <><RefreshCw size={11} className="animate-spin" /> Generating…</> : <><Download size={11} /> Download CPA Package</>}
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">

        {/* Progress card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-900">Review progress</p>
                <span className={`text-sm font-bold ${readiness === 100 ? 'text-emerald-600' : readiness >= 50 ? 'text-amber-600' : 'text-gray-500'}`}>
                  {readiness}%
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
                <div className={`h-2 rounded-full transition-all duration-500 ${readiness === 100 ? 'bg-emerald-500' : readiness >= 50 ? 'bg-amber-400' : 'bg-indigo-500'}`}
                  style={{ width: `${readiness}%` }} />
              </div>
              <div className="flex items-center gap-4 text-[11px] text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />{approved} approved</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />{pending} pending</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" />{flagged} flagged</span>
              </div>
            </div>
            <div className="sm:border-l sm:border-gray-100 sm:pl-4 text-right flex-shrink-0">
              <p className="text-[10px] text-gray-400">Approved credit</p>
              <p className="text-xl font-bold text-indigo-700">{fmt(approvedCr)}</p>
              <p className="text-[10px] text-gray-400">of {fmt(totalCr)} total</p>
            </div>
          </div>

          {pending > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500">{pending} cluster{pending !== 1 ? 's' : ''} pending review</p>
              <button onClick={handleBulkApprove}
                className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100
                           border border-emerald-200 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors">
                <CheckCircle2 size={11} /> Approve all pending
              </button>
            </div>
          )}

          {allApproved && (
            <div className="mt-4 pt-3 border-t border-emerald-100 flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2">
              <CheckCircle2 size={13} />
              All clusters approved — download your CPA package above.
            </div>
          )}
        </div>

        {/* CRA guidance */}
        <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
          <Shield size={14} className="text-indigo-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-indigo-700 leading-relaxed">
            <strong>CPA review checklist:</strong> Each narrative should describe (1) the specific technological
            uncertainty at project outset, (2) why standard techniques were insufficient, and (3) the systematic
            investigation method. Minimum ~80 words per narrative recommended (T4088 §2.1).
          </p>
        </div>

        {/* Cluster cards */}
        <div className="space-y-3">
          {clusters.map(cluster => (
            <ClusterCard key={cluster.id} cluster={cluster}
              onApprove={handleApprove} onFlag={handleFlag}
              onSaveNarrative={handleSaveNarrative} onSaveNotes={handleSaveNotes} />
          ))}
        </div>

        <div className="flex items-center gap-2 text-[11px] text-gray-400 pt-1">
          <Users size={11} />
          <span>Changes saved locally. Use "Save progress" to persist, download package when all approved.</span>
        </div>
      </div>
    </div>
  )
}

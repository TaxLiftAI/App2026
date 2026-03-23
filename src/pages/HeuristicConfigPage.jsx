import { useState } from 'react'
import {
  Sliders, Save, ChevronDown, ChevronUp, History,
  GitCommit, Cpu, Hammer, Lock, GitBranch, Zap, Users2,
  CheckCircle2, AlertTriangle, Info,
} from 'lucide-react'
import { HEURISTIC_CONFIGS, RULE_VERSIONS, USERS } from '../data/mockData'
import { formatDateTime } from '../lib/utils'
import Card, { CardHeader } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import { useAuth } from '../context/AuthContext'

// ── Icon map ───────────────────────────────────────────────────────────────
const HEURISTIC_ICONS = {
  HighCodeChurn:          GitCommit,
  RefactoringPattern:     Cpu,
  BuildExperimentation:   Hammer,
  BlockedStatus:          Lock,
  ExperimentalBranches:   GitBranch,
  PerformanceOptimization: Zap,
  CrossTeamDependency:    Users2,
}

// ── Category colour ────────────────────────────────────────────────────────
const CATEGORY_COLORS = {
  'Code Activity':       'bg-indigo-50 text-indigo-700 border-indigo-100',
  'CI / Pipeline':       'bg-blue-50   text-blue-700   border-blue-100',
  'Project Management':  'bg-purple-50 text-purple-700 border-purple-100',
}

// ── Slider input ───────────────────────────────────────────────────────────
function SliderField({ label, value, onChange, min = 0, max = 1, step = 0.05, hint }) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-700">{label}</label>
        <span className="text-xs font-mono font-semibold text-indigo-700 w-10 text-right">
          {value.toFixed(2)}
        </span>
      </div>
      <div className="relative h-6 flex items-center">
        <div className="w-full h-1.5 bg-gray-200 rounded-full relative">
          <div
            className="absolute left-0 top-0 h-1.5 bg-indigo-500 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="absolute w-full h-6 opacity-0 cursor-pointer"
          style={{ WebkitAppearance: 'none' }}
        />
        <div
          className="absolute w-4 h-4 bg-white border-2 border-indigo-500 rounded-full shadow pointer-events-none transition-all"
          style={{ left: `calc(${pct}% - 8px)` }}
        />
      </div>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

// ── Heuristic row card ─────────────────────────────────────────────────────
function HeuristicRow({ heuristic, localWeight, localThreshold, onWeightChange, onThresholdChange, isDirty }) {
  const [expanded, setExpanded] = useState(false)
  const Icon = HEURISTIC_ICONS[heuristic.name] ?? Sliders
  const catClass = CATEGORY_COLORS[heuristic.category] ?? 'bg-gray-50 text-gray-700 border-gray-200'

  return (
    <div className={`border rounded-xl transition-all ${isDirty ? 'border-indigo-300 bg-indigo-50/30' : 'border-gray-200 bg-white'}`}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
          <Icon size={15} className="text-gray-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">{heuristic.label}</span>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${catClass}`}>
              {heuristic.category}
            </span>
            {isDirty && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                Modified
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-6 flex-shrink-0">
          <div className="text-center hidden sm:block">
            <p className="text-[10px] text-gray-500">Weight</p>
            <p className="text-sm font-mono font-bold text-gray-800">{localWeight.toFixed(2)}</p>
          </div>
          <div className="text-center hidden sm:block">
            <p className="text-[10px] text-gray-500">Threshold</p>
            <p className="text-sm font-mono font-bold text-gray-800">{localThreshold.toFixed(2)}</p>
          </div>
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-gray-400 hover:text-gray-700 p-1"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Expanded sliders */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
          <p className="text-xs text-gray-500 italic">{heuristic.description}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <SliderField
              label="Weight (signal importance)"
              value={localWeight}
              onChange={onWeightChange}
              hint="How much this heuristic contributes to the overall risk score. All weights are normalised at scoring time."
            />
            <SliderField
              label="Threshold (minimum fire value)"
              value={localThreshold}
              onChange={onThresholdChange}
              hint="A cluster must reach at least this value for this heuristic to fire. Lower = more sensitive."
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Version history panel ─────────────────────────────────────────────────
function VersionHistory({ versions }) {
  const sorted = [...versions].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  return (
    <div className="divide-y divide-gray-100">
      {sorted.map(v => {
        const author = USERS.find(u => u.id === v.created_by)
        return (
          <div key={v.id} className="px-4 py-3 flex items-start gap-3">
            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${v.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-semibold text-gray-800">{v.id}</span>
                {v.is_active && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-medium">
                    Active
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600 mt-0.5">{v.note}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {formatDateTime(v.created_at)} by {author?.display_name ?? v.created_by}
                &nbsp;·&nbsp;{v.snapshot.length} heuristics
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Save confirmation modal ────────────────────────────────────────────────
function SaveModal({ isOpen, onClose, onConfirm, changes }) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  function handleConfirm() {
    setSaving(true)
    setTimeout(() => {
      onConfirm(note)
      setSaving(false)
      setNote('')
      onClose()
    }, 700)
  }

  if (!isOpen) return null
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Publish New Rule Version">
      <div className="space-y-4">
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle size={15} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-800">
            Saving will create a new rule version. All future cluster detections will use the new thresholds.
            Previously approved clusters will retain their original rule version for audit purposes.
          </p>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-700 mb-2">Changes summary ({changes.length} heuristic{changes.length !== 1 ? 's' : ''} modified)</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {changes.map(ch => (
              <div key={ch.name} className="flex items-center justify-between text-xs bg-gray-50 rounded px-3 py-1.5">
                <span className="font-medium text-gray-700">{ch.label}</span>
                <div className="flex gap-4 text-gray-500 font-mono">
                  {ch.weightChanged && (
                    <span>w: <span className="text-gray-400">{ch.origWeight.toFixed(2)}</span> → <span className="text-indigo-600 font-semibold">{ch.newWeight.toFixed(2)}</span></span>
                  )}
                  {ch.thresholdChanged && (
                    <span>t: <span className="text-gray-400">{ch.origThreshold.toFixed(2)}</span> → <span className="text-indigo-600 font-semibold">{ch.newThreshold.toFixed(2)}</span></span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Version note (required)</label>
          <input
            type="text"
            placeholder="e.g. Adjusted thresholds after Q1 pilot review"
            value={note}
            onChange={e => setNote(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={saving || note.trim().length < 5}
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Publish Version'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function HeuristicConfigPage() {
  const { currentUser } = useAuth()

  // Local editable state — keyed by heuristic id
  const [localConfig, setLocalConfig] = useState(() =>
    Object.fromEntries(
      HEURISTIC_CONFIGS.map(h => [
        h.id,
        { weight: h.weight, threshold: h.threshold },
      ])
    )
  )
  const [versions, setVersions] = useState(RULE_VERSIONS)
  const [showHistory, setShowHistory] = useState(false)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [savedToast, setSavedToast] = useState(false)

  // Compute dirty set
  const dirtyIds = HEURISTIC_CONFIGS
    .filter(h =>
      localConfig[h.id].weight !== h.weight ||
      localConfig[h.id].threshold !== h.threshold
    )
    .map(h => h.id)

  const changes = HEURISTIC_CONFIGS
    .filter(h => dirtyIds.includes(h.id))
    .map(h => ({
      name: h.name,
      label: h.label,
      origWeight: h.weight,
      newWeight: localConfig[h.id].weight,
      origThreshold: h.threshold,
      newThreshold: localConfig[h.id].threshold,
      weightChanged: localConfig[h.id].weight !== h.weight,
      thresholdChanged: localConfig[h.id].threshold !== h.threshold,
    }))

  function handleSave(note) {
    const newVersion = {
      id: `rule-v${versions.length + 1}.0`,
      created_at: new Date().toISOString(),
      created_by: currentUser?.id ?? 'u-001',
      note,
      snapshot: HEURISTIC_CONFIGS.map(h => ({
        name: h.name,
        weight: localConfig[h.id].weight,
        threshold: localConfig[h.id].threshold,
      })),
      is_active: true,
    }
    setVersions(prev => [
      ...prev.map(v => ({ ...v, is_active: false })),
      newVersion,
    ])
    setSavedToast(true)
    setTimeout(() => setSavedToast(false), 3000)
  }

  const activeVersion = versions.find(v => v.is_active)

  // Group heuristics by category
  const categories = [...new Set(HEURISTIC_CONFIGS.map(h => h.category))]

  return (
    <div className="p-6 space-y-5 max-w-4xl">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500 mt-0.5">
            Adjust weights and fire thresholds for each detection heuristic.
            Changes create a new auditable rule version.
          </p>
          {activeVersion && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Active: <span className="font-mono font-medium text-gray-700">{activeVersion.id}</span>
              &nbsp;·&nbsp;published {formatDateTime(activeVersion.created_at)}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="secondary"
            onClick={() => setShowHistory(h => !h)}
          >
            <History size={14} />
            {showHistory ? 'Hide History' : 'Version History'}
          </Button>
          <Button
            variant="primary"
            onClick={() => setSaveModalOpen(true)}
            disabled={dirtyIds.length === 0}
          >
            <Save size={14} />
            Publish Changes {dirtyIds.length > 0 && `(${dirtyIds.length})`}
          </Button>
        </div>
      </div>

      {/* Version history panel */}
      {showHistory && (
        <Card>
          <CardHeader
            title="Rule Version History"
            subtitle={`${versions.length} versions — most recent first`}
          />
          <VersionHistory versions={versions} />
        </Card>
      )}

      {/* Info callout */}
      <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl">
        <Info size={14} className="text-blue-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-800">
          <strong>Weight</strong> controls how much each heuristic contributes to the composite risk score (0.00–1.00).
          <strong className="ml-2">Threshold</strong> is the minimum fired value needed for the heuristic to count (0.00–1.00).
          Weights are normalised at scoring time so they don't need to sum to 1.
        </p>
      </div>

      {/* Heuristics grouped by category */}
      {categories.map(cat => {
        const group = HEURISTIC_CONFIGS.filter(h => h.category === cat)
        return (
          <div key={cat} className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">{cat}</h3>
            {group.map(h => (
              <HeuristicRow
                key={h.id}
                heuristic={h}
                localWeight={localConfig[h.id].weight}
                localThreshold={localConfig[h.id].threshold}
                isDirty={dirtyIds.includes(h.id)}
                onWeightChange={val =>
                  setLocalConfig(prev => ({
                    ...prev,
                    [h.id]: { ...prev[h.id], weight: val },
                  }))
                }
                onThresholdChange={val =>
                  setLocalConfig(prev => ({
                    ...prev,
                    [h.id]: { ...prev[h.id], threshold: val },
                  }))
                }
              />
            ))}
          </div>
        )
      })}

      <SaveModal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        onConfirm={handleSave}
        changes={changes}
      />

      {/* Toast */}
      {savedToast && (
        <div className="fixed bottom-6 right-6 flex items-center gap-2 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-xl z-50">
          <CheckCircle2 size={15} className="text-green-400" />
          New rule version published successfully.
        </div>
      )}
    </div>
  )
}

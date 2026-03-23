/**
 * NarrativeQualityCard.jsx
 *
 * Compact CRA-compliance quality card for a T661 narrative.
 * Shows:
 *   - Circular score ring (green ≥80 / amber 60–79 / red <60) with label
 *   - 5-row dimension checklist (pass ✓ / partial ⚠ / fail ✗) with improvement tips
 *   - "Improve with AI" button that surfaces the weakest-dimension patch
 *
 * Props:
 *   text      {string}  — current narrative text (scored live)
 *   cluster   {object}  — cluster object for patch context (optional)
 *   compact   {boolean} — if true, hide dimension tips and patch panel (default false)
 */
import { useState, useMemo } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, Sparkles, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react'
import { scoreNarrative } from '../lib/narrativeScorer'

// ── Score ring (SVG circle) ───────────────────────────────────────────────────
function ScoreRing({ score, color }) {
  const R = 28
  const C = 2 * Math.PI * R
  const pct = Math.min(100, Math.max(0, score)) / 100
  const dash = pct * C

  const strokeColor = color === 'green' ? '#16a34a'
    : color === 'amber' ? '#d97706'
    : color === 'red'   ? '#dc2626'
    : '#9ca3af'

  const bgColor = color === 'green' ? '#dcfce7'
    : color === 'amber' ? '#fef3c7'
    : color === 'red'   ? '#fee2e2'
    : '#f3f4f6'

  return (
    <div className="relative flex-shrink-0" style={{ width: 72, height: 72 }}>
      <svg width={72} height={72} viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
        {/* track */}
        <circle cx={36} cy={36} r={R} fill="none" stroke="#e5e7eb" strokeWidth={6} />
        {/* progress */}
        <circle
          cx={36} cy={36} r={R}
          fill="none"
          stroke={strokeColor}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${C}`}
          style={{ transition: 'stroke-dasharray 0.4s ease' }}
        />
      </svg>
      {/* centre label */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center rounded-full"
        style={{ background: bgColor + '80' }}
      >
        <span className="text-[15px] font-bold leading-none" style={{ color: strokeColor }}>
          {score}
        </span>
        <span className="text-[8px] font-medium text-gray-400 leading-none mt-0.5">/100</span>
      </div>
    </div>
  )
}

// ── Dimension row ─────────────────────────────────────────────────────────────
function DimensionRow({ dim, showTip }) {
  const [open, setOpen] = useState(false)

  const { icon: Icon, iconClass, pillClass, pillText } = dim.status === 'pass'
    ? { icon: CheckCircle2, iconClass: 'text-green-500',  pillClass: 'bg-green-100 text-green-700',  pillText: `${dim.score}/20` }
    : dim.status === 'partial'
    ? { icon: AlertTriangle, iconClass: 'text-amber-500', pillClass: 'bg-amber-100 text-amber-700',  pillText: `${dim.score}/20` }
    : { icon: XCircle,       iconClass: 'text-red-400',   pillClass: 'bg-red-100 text-red-600',      pillText: `0/20` }

  const hasTip = showTip && dim.suggestion && dim.status !== 'pass'

  return (
    <div className={`rounded-md transition-colors ${hasTip && open ? 'bg-gray-50' : ''}`}>
      <button
        onClick={() => hasTip && setOpen(o => !o)}
        className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left ${hasTip ? 'cursor-pointer hover:bg-gray-50 rounded-md' : 'cursor-default'}`}
        disabled={!hasTip}
      >
        <Icon size={13} className={`flex-shrink-0 ${iconClass}`} />
        <span className="flex-1 text-xs text-gray-700 font-medium">{dim.name}</span>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${pillClass}`}>{pillText}</span>
        {hasTip && (
          open
            ? <ChevronUp size={11} className="text-gray-400 flex-shrink-0" />
            : <ChevronDown size={11} className="text-gray-400 flex-shrink-0" />
        )}
      </button>

      {hasTip && open && (
        <div className="mx-2.5 mb-2 mt-0.5 px-2.5 py-2 bg-amber-50 border border-amber-100 rounded text-[10px] text-amber-800 leading-relaxed">
          <span className="font-semibold block mb-0.5">Suggestion</span>
          {dim.suggestion}
        </div>
      )}
    </div>
  )
}

// ── Patch panel ───────────────────────────────────────────────────────────────
function PatchPanel({ patch, onClose }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(patch.patch).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="mt-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Sparkles size={12} className="text-indigo-500" />
          <span className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wide">
            AI Suggestion — {patch.dimensionName}
          </span>
        </div>
        <button onClick={onClose} className="text-[10px] text-indigo-400 hover:text-indigo-600">✕</button>
      </div>

      <p className="text-[11px] text-indigo-900 leading-relaxed whitespace-pre-wrap bg-white border border-indigo-100 rounded p-2 mb-2">
        {patch.patch}
      </p>

      <div className="flex items-center gap-2">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] font-medium text-indigo-600 hover:text-indigo-800 bg-white border border-indigo-200 rounded px-2 py-1 transition-colors"
        >
          {copied ? <Check size={10} /> : <Copy size={10} />}
          {copied ? 'Copied!' : 'Copy text'}
        </button>
        <span className="text-[9px] text-indigo-400">Paste into the narrative editor above and refine</span>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function NarrativeQualityCard({ text = '', cluster = null, compact = false }) {
  const [showPatch, setShowPatch] = useState(false)

  const result = useMemo(
    () => scoreNarrative(text, cluster),
    [text, cluster]
  )

  const { totalScore, label, color, dimensions, patch } = result

  const labelColor = color === 'green' ? 'text-green-700'
    : color === 'amber' ? 'text-amber-700'
    : color === 'red'   ? 'text-red-600'
    : 'text-gray-500'

  const borderColor = color === 'green' ? 'border-green-200'
    : color === 'amber' ? 'border-amber-200'
    : color === 'red'   ? 'border-red-200'
    : 'border-gray-200'

  return (
    <div className={`rounded-lg border ${borderColor} bg-white shadow-sm overflow-hidden`}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-100">
        <ScoreRing score={totalScore} color={color} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-bold ${labelColor}`}>{label}</span>
            <span className="text-[10px] text-gray-400 font-medium">CRA Quality Score</span>
          </div>
          <div className="mt-1 flex gap-1 flex-wrap">
            {dimensions.map(d => (
              <span
                key={d.code}
                title={d.name}
                className={`text-[9px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wide ${
                  d.status === 'pass'    ? 'bg-green-100 text-green-600'
                  : d.status === 'partial' ? 'bg-amber-100 text-amber-600'
                  : 'bg-red-100 text-red-500'
                }`}
              >
                {d.code.toUpperCase()}
              </span>
            ))}
          </div>
        </div>

        {!compact && patch && (
          <button
            onClick={() => setShowPatch(p => !p)}
            className="flex-shrink-0 flex items-center gap-1.5 text-[11px] font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md px-2.5 py-1.5 transition-colors"
          >
            <Sparkles size={11} />
            {showPatch ? 'Hide' : 'Improve'}
          </button>
        )}
      </div>

      {/* Dimensions checklist */}
      {!compact && (
        <div className="px-1 py-1 divide-y divide-gray-50">
          {dimensions.map(d => (
            <DimensionRow key={d.code} dim={d} showTip={true} />
          ))}
        </div>
      )}

      {/* Patch panel */}
      {!compact && showPatch && patch && (
        <div className="px-3 pb-3">
          <PatchPanel patch={patch} onClose={() => setShowPatch(false)} />
        </div>
      )}

      {/* Empty state */}
      {!text || text.trim().length === 0 ? (
        <div className="px-3 py-2 text-[10px] text-gray-400 italic border-t border-gray-100">
          Start typing a narrative above to see quality feedback.
        </div>
      ) : null}
    </div>
  )
}

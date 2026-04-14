/**
 * AuditReadinessScore — rule-based 0–100 audit readiness score.
 *
 * Scoring dimensions:
 *   Integration connected    20 pts  — GitHub or Jira linked and healthy
 *   Clusters exist           10 pts  — at least 1 SR&ED cluster detected
 *   Cluster approval rate    25 pts  — proportion of clusters approved (scaled)
 *   Narrative completion     20 pts  — proportion with Drafted or Approved status
 *   Documents uploaded       15 pts  — at least 1 supporting doc in the vault
 *   Company profile complete 10 pts  — company name + fiscal year set on account
 *
 * Total: 100 pts
 *
 * Usage:
 *   <AuditReadinessScore clusters={clusters} integrations={integrations} currentUser={user} />
 */
import { useDocuments } from '../../hooks'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheck, Github, Package, FileCheck, FolderOpen,
  Building2, ChevronRight, CheckCircle2, Circle,
} from 'lucide-react'

// ── Score calculation ─────────────────────────────────────────────────────────
export function calcAuditScore({ clusters = [], integrations = [], documents = [], currentUser = {} }) {
  const cl   = clusters     ?? []
  const ints = integrations ?? []
  const docs = documents    ?? []

  const hasIntegration = ints.some(i => i.status === 'healthy')
  const clusterCount   = cl.length
  const approved       = cl.filter(c => c.status === 'Approved').length
  const narrated       = cl.filter(c => ['Drafted', 'Approved'].includes(c.status)).length
  const hasDoc         = docs.length > 0
  const profileDone    = !!(currentUser?.company_name && (currentUser?.fiscal_year_end || currentUser?.fiscal_year))

  const integrationPts  = hasIntegration ? 20 : 0
  const clusterPts      = clusterCount > 0 ? 10 : 0
  const approvalPts     = clusterCount > 0 ? Math.round((approved  / clusterCount) * 25) : 0
  const narrativePts    = clusterCount > 0 ? Math.round((narrated  / clusterCount) * 20) : 0
  const docPts          = hasDoc ? 15 : 0
  const profilePts      = profileDone ? 10 : 0

  const total = integrationPts + clusterPts + approvalPts + narrativePts + docPts + profilePts

  return {
    total,
    breakdown: [
      {
        key:   'integration',
        label: 'Data source connected',
        desc:  hasIntegration
          ? 'GitHub or Jira linked and healthy'
          : 'Connect GitHub or Jira to start scanning',
        pts:   integrationPts,
        max:   20,
        done:  hasIntegration,
        cta:   '/integrations',
        icon:  Github,
      },
      {
        key:   'clusters',
        label: 'SR&ED clusters detected',
        desc:  clusterCount > 0
          ? `${clusterCount} cluster${clusterCount !== 1 ? 's' : ''} found`
          : 'No clusters yet — run a scan to detect qualifying R&D',
        pts:   clusterPts,
        max:   10,
        done:  clusterCount > 0,
        cta:   '/clusters',
        icon:  Package,
      },
      {
        key:   'narratives',
        label: 'T661 narratives drafted',
        desc:  narrated > 0
          ? `${narrated} of ${clusterCount} cluster${clusterCount !== 1 ? 's' : ''} have narratives`
          : 'Generate AI narratives for your SR&ED clusters',
        pts:   narrativePts,
        max:   20,
        done:  narrated > 0 && clusterCount > 0 && narrated === clusterCount,
        partial: narrated > 0 && narrated < clusterCount,
        cta:   '/clusters',
        icon:  FileCheck,
      },
      {
        key:   'approvals',
        label: 'Clusters approved',
        desc:  approved > 0
          ? `${approved} of ${clusterCount} cluster${clusterCount !== 1 ? 's' : ''} approved`
          : 'Review and approve your SR&ED clusters',
        pts:   approvalPts,
        max:   25,
        done:  approved > 0 && approved === clusterCount,
        partial: approved > 0 && approved < clusterCount,
        cta:   '/clusters?status=Drafted',
        icon:  ShieldCheck,
      },
      {
        key:   'documents',
        label: 'Supporting documents uploaded',
        desc:  hasDoc
          ? `${docs.length} document${docs.length !== 1 ? 's' : ''} in your audit vault`
          : 'Upload contracts, invoices, or technical specs',
        pts:   docPts,
        max:   15,
        done:  hasDoc,
        cta:   '/vault',
        icon:  FolderOpen,
      },
      {
        key:   'profile',
        label: 'Company profile complete',
        desc:  profileDone
          ? 'Company name and fiscal year set'
          : 'Add your company name and fiscal year-end in Settings',
        pts:   profilePts,
        max:   10,
        done:  profileDone,
        cta:   '/settings',
        icon:  Building2,
      },
    ],
  }
}

// ── Score colour helpers ───────────────────────────────────────────────────────
function scoreColor(pct) {
  if (pct >= 80) return { ring: 'text-emerald-500', bg: 'bg-emerald-500', label: 'text-emerald-700', badge: 'bg-emerald-50 border-emerald-200 text-emerald-700', word: 'Audit-ready' }
  if (pct >= 50) return { ring: 'text-indigo-500',  bg: 'bg-indigo-500',  label: 'text-indigo-700',  badge: 'bg-indigo-50 border-indigo-200 text-indigo-700',   word: 'In progress' }
  return              { ring: 'text-amber-500',   bg: 'bg-amber-500',   label: 'text-amber-700',   badge: 'bg-amber-50 border-amber-200 text-amber-700',     word: 'Getting started' }
}

// ── Radial SVG gauge ──────────────────────────────────────────────────────────
function RadialGauge({ score, color }) {
  const r   = 42
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ

  return (
    <svg viewBox="0 0 100 100" className="w-24 h-24 -rotate-90">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
      <circle
        cx="50" cy="50" r={r} fill="none"
        stroke="currentColor"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        className={color.ring}
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AuditReadinessScore({ clusters, integrations, currentUser }) {
  const { data: documents } = useDocuments()
  const navigate = useNavigate()

  const { total, breakdown } = calcAuditScore({
    clusters:     clusters     ?? [],
    integrations: integrations ?? [],
    documents:    documents    ?? [],
    currentUser:  currentUser  ?? {},
  })

  const color   = scoreColor(total)
  const nextTodo = breakdown.find(d => !d.done)

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex items-start gap-4">
        {/* Radial gauge */}
        <div className="relative flex-shrink-0">
          <RadialGauge score={total} color={color} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-2xl font-extrabold leading-none ${color.label}`}>{total}</span>
            <span className="text-[10px] text-gray-400 leading-none mt-0.5">/ 100</span>
          </div>
        </div>

        {/* Title + badge */}
        <div className="flex-1 min-w-0 pt-1">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Audit Readiness</p>
          <h3 className="text-base font-bold text-gray-900 mb-1">
            {total >= 80 ? 'Your claim is audit-ready 🎉' : total >= 50 ? 'Good progress — keep going' : 'A few steps to go'}
          </h3>
          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold border rounded-full px-2.5 py-0.5 ${color.badge}`}>
            <ShieldCheck size={10} /> {color.word}
          </span>
          {nextTodo && (
            <p className="text-xs text-gray-500 mt-2 leading-snug">
              Next: <button onClick={() => navigate(nextTodo.cta)} className="text-indigo-600 hover:underline font-medium">{nextTodo.label}</button>
            </p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-5 pb-3">
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${color.bg}`}
            style={{ width: `${total}%` }}
          />
        </div>
      </div>

      {/* Breakdown rows */}
      <div className="border-t border-gray-100 divide-y divide-gray-50">
        {breakdown.map(({ key, label, desc, pts, max, done, partial, cta, icon: Icon }) => (
          <div key={key} className="flex items-center gap-3 px-5 py-3">
            {/* Status icon */}
            <div className="flex-shrink-0">
              {done
                ? <CheckCircle2 size={16} className="text-emerald-500" />
                : partial
                  ? <div className="w-4 h-4 rounded-full border-2 border-indigo-400 bg-indigo-50" />
                  : <Circle size={16} className="text-gray-300" />}
            </div>

            {/* Icon + text */}
            <Icon size={14} className={`flex-shrink-0 ${done ? 'text-gray-400' : 'text-gray-300'}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-semibold ${done ? 'text-gray-600' : 'text-gray-900'}`}>{label}</p>
              <p className="text-[11px] text-gray-400 leading-snug truncate">{desc}</p>
            </div>

            {/* Points + CTA */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`text-xs font-bold tabular-nums ${done || partial ? color.label : 'text-gray-300'}`}>
                {pts}/{max}
              </span>
              {!done && (
                <button
                  onClick={() => navigate(cta)}
                  className="flex items-center gap-0.5 text-[11px] font-semibold text-indigo-500 hover:text-indigo-700 transition-colors"
                >
                  Fix <ChevronRight size={11} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      {total >= 80 && (
        <div className="px-5 py-3 border-t border-gray-100 bg-emerald-50">
          <p className="text-xs text-emerald-700 font-medium text-center">
            ✓ Your claim is ready to share with your CPA
          </p>
        </div>
      )}
    </div>
  )
}

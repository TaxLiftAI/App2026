import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheck, ShieldAlert, Shield, CheckCircle2, XCircle,
  AlertTriangle, ChevronDown, ChevronUp, ArrowRight, TrendingUp,
  Clock, FileText, Users, GitCommit,
} from 'lucide-react'
import {
  CLUSTERS, EVIDENCE_SNAPSHOTS, NARRATIVES, DEVELOPER_INTERVIEWS,
  getClusterReadinessScore,
} from '../data/mockData'
import { formatCurrency } from '../lib/utils'
import Card from '../components/ui/Card'

// ── Score ring ─────────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 120 }) {
  const r = (size / 2) - 10
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'
  const trackColor = score >= 80 ? '#d1fae5' : score >= 60 ? '#fef3c7' : '#fee2e2'

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={10} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
    </svg>
  )
}

// ── Score badge ────────────────────────────────────────────────────────────────
function ScoreLabel({ score, size = 'md' }) {
  const color = score >= 80 ? 'text-green-600 bg-green-50' : score >= 60 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50'
  const label = score >= 80 ? 'Ready' : score >= 60 ? 'At Risk' : 'Not Ready'
  const text = size === 'sm' ? 'text-xs' : 'text-sm'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${text} ${color}`}>
      {score >= 80 ? <ShieldCheck size={12} /> : score >= 60 ? <ShieldAlert size={12} /> : <Shield size={12} />}
      {label}
    </span>
  )
}

// ── Check row ──────────────────────────────────────────────────────────────────
function CheckRow({ check }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className="flex-shrink-0 mt-0.5">
        {check.pass
          ? <CheckCircle2 size={16} className="text-green-500" />
          : <XCircle size={16} className="text-red-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm font-medium ${check.pass ? 'text-gray-700' : 'text-gray-900'}`}>
            {check.label}
          </span>
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
            check.pass ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-100'
          }`}>
            {check.pass ? `+${check.weight}` : `0 / ${check.weight}`} pts
          </span>
        </div>
        {!check.pass && check.fix && (
          <p className="text-xs text-red-600 mt-0.5 flex items-start gap-1">
            <ArrowRight size={11} className="mt-0.5 flex-shrink-0" />
            {check.fix}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Cluster row in table ───────────────────────────────────────────────────────
function ClusterReadinessRow({ cluster, readiness, onExpand, expanded }) {
  const navigate = useNavigate()
  const failCount = readiness.checks.filter(c => !c.pass).length
  const credit = cluster.estimated_credit_cad

  return (
    <>
      <tr
        className="hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={() => onExpand()}
      >
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-2">
            <button
              className="text-gray-400 hover:text-gray-600 transition-colors"
              onClick={e => { e.stopPropagation(); onExpand() }}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <span
              className="text-sm font-medium text-gray-900 hover:text-indigo-600 transition-colors"
              onClick={e => { e.stopPropagation(); navigate(`/clusters/${cluster.id}`) }}
            >
              {cluster.business_component}
            </span>
          </div>
        </td>
        <td className="px-5 py-3.5">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            cluster.status === 'Approved' ? 'bg-green-100 text-green-700' :
            cluster.status === 'Rejected' ? 'bg-red-100 text-red-700' :
            cluster.status === 'Drafted'  ? 'bg-amber-100 text-amber-700' :
            'bg-gray-100 text-gray-600'
          }`}>{cluster.status}</span>
        </td>
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  readiness.score >= 80 ? 'bg-green-500' :
                  readiness.score >= 60 ? 'bg-amber-500' : 'bg-red-400'
                }`}
                style={{ width: `${readiness.score}%` }}
              />
            </div>
            <span className="text-sm font-bold tabular-nums text-gray-900">{readiness.score}%</span>
            <ScoreLabel score={readiness.score} size="sm" />
          </div>
        </td>
        <td className="px-5 py-3.5">
          {failCount === 0
            ? <span className="text-xs text-green-600 font-medium">All clear</span>
            : <span className="text-xs text-red-500 font-medium">{failCount} issue{failCount !== 1 ? 's' : ''}</span>}
        </td>
        <td className="px-5 py-3.5 text-sm font-medium text-gray-700 tabular-nums">
          {credit ? formatCurrency(credit) : <span className="text-gray-300">—</span>}
        </td>
      </tr>

      {/* Expanded checks */}
      {expanded && (
        <tr>
          <td colSpan={5} className="px-0 pb-2">
            <div className="mx-5 mb-2 rounded-xl border border-gray-100 bg-gray-50 px-4 py-1">
              {readiness.checks.map(check => (
                <CheckRow key={check.key} check={check} />
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function AuditReadinessPage() {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(new Set())
  const [filter, setFilter] = useState('All')

  // Compute readiness for every cluster
  const clusterScores = useMemo(() => {
    return CLUSTERS
      .filter(c => c.status !== 'Rejected' && c.status !== 'Merged')
      .map(cluster => ({
        cluster,
        readiness: getClusterReadinessScore(cluster, EVIDENCE_SNAPSHOTS, NARRATIVES, DEVELOPER_INTERVIEWS),
      }))
      .sort((a, b) => a.readiness.score - b.readiness.score)
  }, [])

  // Overall tenant score (weighted by potential credit)
  const overallScore = useMemo(() => {
    if (!clusterScores.length) return 0
    return Math.round(
      clusterScores.reduce((sum, { readiness }) => sum + readiness.score, 0) / clusterScores.length
    )
  }, [clusterScores])

  // Aggregate action items (failing checks across all clusters, deduped by key, sorted by weight)
  const topActions = useMemo(() => {
    const actionMap = {}
    clusterScores.forEach(({ cluster, readiness }) => {
      readiness.checks.filter(c => !c.pass).forEach(check => {
        if (!actionMap[check.key]) {
          actionMap[check.key] = { ...check, affectedClusters: [] }
        }
        actionMap[check.key].affectedClusters.push(cluster.business_component)
      })
    })
    return Object.values(actionMap).sort((a, b) => b.weight - a.weight || b.affectedClusters.length - a.affectedClusters.length)
  }, [clusterScores])

  // Filing countdown
  const daysToDeadline = useMemo(() => {
    const deadline = new Date('2026-06-30T00:00:00Z')
    return Math.max(0, Math.floor((deadline - new Date()) / (1000 * 60 * 60 * 24)))
  }, [])

  const readyClusters   = clusterScores.filter(({ readiness }) => readiness.score >= 80).length
  const atRiskClusters  = clusterScores.filter(({ readiness }) => readiness.score >= 60 && readiness.score < 80).length
  const notReadyClusters = clusterScores.filter(({ readiness }) => readiness.score < 60).length

  const filtered = filter === 'All' ? clusterScores
    : filter === 'Ready'     ? clusterScores.filter(({ readiness }) => readiness.score >= 80)
    : filter === 'At Risk'   ? clusterScores.filter(({ readiness }) => readiness.score >= 60 && readiness.score < 80)
    : clusterScores.filter(({ readiness }) => readiness.score < 60)

  function toggleExpand(id) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const urgencyColor = daysToDeadline < 60 ? 'red' : daysToDeadline < 120 ? 'amber' : 'green'
  const urgencyClasses = {
    red:   'bg-red-50 border-red-200 text-red-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    green: 'bg-green-50 border-green-200 text-green-700',
  }

  return (
    <div className="space-y-5">

      {/* Deadline banner */}
      <div className={`rounded-xl border px-5 py-4 flex items-center gap-4 ${urgencyClasses[urgencyColor]}`}>
        <Clock size={20} />
        <div className="flex-1">
          <p className="text-sm font-semibold">SR&ED Filing Deadline: June 30, 2026</p>
          <p className="text-xs opacity-75 mt-0.5">Resolve all readiness issues before filing — CRA auditors increasingly request contemporaneous digital evidence.</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-3xl font-bold tabular-nums">{daysToDeadline}</p>
          <p className="text-xs font-medium">days remaining</p>
        </div>
      </div>

      {/* Top row: overall score + stat cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

        {/* Overall score */}
        <Card className="lg:col-span-1 flex flex-col items-center justify-center py-6">
          <div className="relative">
            <ScoreRing score={overallScore} size={130} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-gray-900">{overallScore}%</span>
              <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Overall</span>
            </div>
          </div>
          <div className="mt-3">
            <ScoreLabel score={overallScore} />
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">Across {clusterScores.length} active clusters</p>
        </Card>

        {/* Breakdown */}
        <div className="lg:col-span-3 grid grid-cols-3 gap-4">
          {[
            { label: 'Ready',      count: readyClusters,    color: 'text-green-600 bg-green-50', icon: ShieldCheck, desc: 'Score ≥ 80%' },
            { label: 'At Risk',    count: atRiskClusters,   color: 'text-amber-600 bg-amber-50', icon: ShieldAlert, desc: 'Score 60–79%' },
            { label: 'Not Ready',  count: notReadyClusters, color: 'text-red-600 bg-red-50',    icon: Shield,      desc: 'Score < 60%' },
          ].map(({ label, count, color, icon: Icon, desc }) => (
            <Card key={label}>
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                  <Icon size={17} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{count}</p>
                  <p className="text-xs font-medium text-gray-600">{label}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{desc}</p>
                </div>
              </div>
            </Card>
          ))}

          {/* Top action items */}
          <Card className="col-span-3" padding={false}>
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-500" />
                Priority Actions to Improve Readiness
              </h3>
              <span className="text-xs text-gray-400">{topActions.length} issue types across all clusters</span>
            </div>
            <div className="divide-y divide-gray-50">
              {topActions.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <ShieldCheck size={28} className="text-green-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-green-700">All clusters are audit-ready!</p>
                </div>
              ) : topActions.slice(0, 5).map(action => (
                <div key={action.key} className="px-5 py-3 flex items-start gap-3">
                  <XCircle size={15} className="text-red-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-900">{action.label}</span>
                      <span className="text-xs font-semibold text-red-500 flex-shrink-0">
                        {action.affectedClusters.length} cluster{action.affectedClusters.length !== 1 ? 's' : ''} · {action.weight} pts each
                      </span>
                    </div>
                    {action.fix && (
                      <p className="text-xs text-gray-500 mt-0.5 flex items-start gap-1">
                        <ArrowRight size={10} className="mt-0.5 flex-shrink-0 text-indigo-400" />
                        {action.fix}
                      </p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-1 truncate">
                      Affects: {action.affectedClusters.slice(0, 3).join(', ')}{action.affectedClusters.length > 3 ? ` +${action.affectedClusters.length - 3} more` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Per-cluster table */}
      <Card padding={false}>
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-gray-900">Cluster-by-Cluster Readiness</h3>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            {['All', 'Ready', 'At Risk', 'Not Ready'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  filter === f ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Business Component', 'Status', 'Readiness Score', 'Issues', 'Credit (CAD)'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400">No clusters match this filter.</td>
                </tr>
              ) : filtered.map(({ cluster, readiness }) => (
                <ClusterReadinessRow
                  key={cluster.id}
                  cluster={cluster}
                  readiness={readiness}
                  expanded={expanded.has(cluster.id)}
                  onExpand={() => toggleExpand(cluster.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

    </div>
  )
}

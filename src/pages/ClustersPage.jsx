import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Filter, SortDesc, ChevronUp, ChevronDown, CheckSquare, Square, CheckCheck, X, ThumbsUp, ThumbsDown, Layers, GitMerge, AlertTriangle, FlaskConical, ArrowRight } from 'lucide-react'
import { useClusters, useBulkClusters, useIntegrations } from '../hooks'
import { formatCurrency, formatHours, formatDate, canDo } from '../lib/utils'
import { StatusBadge } from '../components/ui/Badge'
import RiskScore from '../components/ui/RiskScore'
import Card from '../components/ui/Card'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import { QualificationBadges, qualifyCluster } from '../components/SREDQualificationPanel'
import { EVIDENCE_SNAPSHOTS } from '../data/mockData'

const STATUSES = ['All', 'New', 'Interviewed', 'Drafted', 'Approved', 'Rejected']

function SortIcon({ field, current, dir }) {
  if (current !== field) return <span className="w-4" />
  return dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
}

export default function ClustersPage() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [searchParams] = useSearchParams()

  const [status, setStatus] = useState(searchParams.get('status') ?? 'All')
  const [riskMin, setRiskMin] = useState('')
  const [sortBy, setSortBy] = useState('risk_score')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)

  // ── API data ─────────────────────────────────────────────────────────────────
  const { data: apiClusters, loading, usingMock, refetch } = useClusters()
  const { data: integrations = [] }                        = useIntegrations()
  const { mutate: bulkMutate }                             = useBulkClusters(() => refetch())

  // ── Bulk review state ───────────────────────────────────────────────────────
  const [bulkMode, setBulkMode] = useState(false)
  const [selected, setSelected] = useState(new Set())
  // Optimistic status overrides applied on top of API data
  const [statusOverrides, setStatusOverrides] = useState({})
  const [bulkResult, setBulkResult] = useState(null) // { action, count }

  // ── Merge modal state ────────────────────────────────────────────────────────
  const [showMergeModal, setShowMergeModal] = useState(false)
  const [mergePrimaryId, setMergePrimaryId] = useState('')

  const canEdit = currentUser && canDo('editClusters', currentUser.role)

  const PAGE_SIZE = 10

  function toggleSort(field) {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(field); setSortDir('desc') }
    setPage(1)
  }

  const filtered = useMemo(() => {
    let list = (apiClusters ?? []).map(c => ({ ...c, status: statusOverrides[c.id] ?? c.status }))
    if (status !== 'All') list = list.filter(c => c.status === status)
    if (riskMin !== '') list = list.filter(c => c.risk_score >= parseFloat(riskMin))

    list.sort((a, b) => {
      let av, bv
      switch (sortBy) {
        case 'risk_score': av = a.risk_score; bv = b.risk_score; break
        case 'created_at': av = new Date(a.created_at); bv = new Date(b.created_at); break
        case 'aggregate_time_hours': av = a.aggregate_time_hours ?? -1; bv = b.aggregate_time_hours ?? -1; break
        case 'estimated_credit': av = a.estimated_credit_cad ?? -1; bv = b.estimated_credit_cad ?? -1; break
        default: av = a.risk_score; bv = b.risk_score
      }
      return sortDir === 'desc' ? (av < bv ? 1 : -1) : (av > bv ? 1 : -1)
    })
    return list
  }, [apiClusters, status, riskMin, sortBy, sortDir, statusOverrides])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const pagedIds = paged.map(c => c.id)

  // Bulk helpers
  const allPageSelected = pagedIds.length > 0 && pagedIds.every(id => selected.has(id))
  const somePageSelected = pagedIds.some(id => selected.has(id))

  function toggleSelectAll() {
    setSelected(prev => {
      const next = new Set(prev)
      if (allPageSelected) pagedIds.forEach(id => next.delete(id))
      else pagedIds.forEach(id => next.add(id))
      return next
    })
  }

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function exitBulkMode() {
    setBulkMode(false)
    setSelected(new Set())
  }

  function applyBulkAction(action) {
    const ids = [...selected]
    const newStatus = action === 'approve' ? 'Approved' : 'Rejected'
    const count = selected.size
    // Optimistic update
    setStatusOverrides(prev => {
      const next = { ...prev }
      ids.forEach(id => { next[id] = newStatus })
      return next
    })
    // Real API call (falls back to no-op on network error since there's no mockFn here)
    bulkMutate(ids, action, undefined).catch(() => {})
    setBulkResult({ action, count })
    setSelected(new Set())
    setBulkMode(false)
    setTimeout(() => setBulkResult(null), 4000)
  }

  function handleMergeConfirm() {
    const primaryId = mergePrimaryId
    const toMerge = [...selected].filter(id => id !== primaryId)
    // Optimistic update
    setStatusOverrides(prev => {
      const next = { ...prev }
      toMerge.forEach(id => { next[id] = 'Merged' })
      return next
    })
    // Real API merge calls
    toMerge.forEach(id => bulkMutate([id], 'merge', undefined).catch(() => {}))
    setBulkResult({ action: 'merge', count: toMerge.length, primaryId })
    setShowMergeModal(false)
    setMergePrimaryId('')
    setSelected(new Set())
    setBulkMode(false)
    setTimeout(() => setBulkResult(null), 5000)
  }

  // Keyboard shortcuts in bulk mode
  const handleKeyDown = useCallback((e) => {
    if (!bulkMode) return
    if (e.key === 'Escape') { exitBulkMode(); return }
    if (selected.size === 0) return
    if (e.key === 'a' && !e.ctrlKey && !e.metaKey) applyBulkAction('approve')
    if (e.key === 'r' && !e.ctrlKey && !e.metaKey) applyBulkAction('reject')
  }, [bulkMode, selected])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const columns = [
    { key: 'select',               label: '',              sortable: false, hidden: !bulkMode },
    { key: 'business_component',   label: 'Business Component', sortable: false },
    { key: 'status',               label: 'Status',        sortable: false },
    { key: 'risk_score',           label: 'Risk Score',    sortable: true  },
    { key: 'aggregate_time_hours', label: 'Hours',         sortable: true  },
    { key: 'estimated_credit',     label: 'Credit (CAD)',  sortable: true  },
    { key: 'created_at',           label: 'Detected',      sortable: true  },
  ]

  return (
    <div className="space-y-4">

      {/* Demo mode banner */}
      {usingMock && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 bg-indigo-600 rounded-xl text-xs text-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <FlaskConical size={13} className="text-indigo-200 flex-shrink-0" />
            <span className="font-medium">This is a demo — connect a data source to see your real R&amp;D clusters.</span>
          </div>
          <button
            onClick={() => navigate('/quick-connect')}
            className="flex-shrink-0 bg-white text-indigo-700 font-semibold px-3 py-1 rounded-lg hover:bg-indigo-50 transition-colors whitespace-nowrap"
          >
            Connect now
          </button>
        </div>
      )}

      {/* Scanning-in-progress empty state — real user, connected, but no clusters yet */}
      {!usingMock && !loading && (apiClusters ?? []).length === 0 && integrations.some(i => i.status === 'healthy') && (
        <div className="border border-indigo-200 bg-indigo-50 rounded-2xl px-6 py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-indigo-100 border-4 border-indigo-200 flex items-center justify-center mx-auto mb-4">
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <h3 className="text-base font-bold text-indigo-900 mb-1">Scanning your repository…</h3>
          <p className="text-sm text-indigo-700 max-w-md mx-auto mb-5">
            TaxLift is analysing your commit history for SR&ED signals. First clusters
            typically appear within <strong>2–4 hours</strong> of connecting.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto mb-5">
            {[
              { step: '1', label: 'Indexing commits',    done: true  },
              { step: '2', label: 'Detecting R&D signals', done: false },
              { step: '3', label: 'Forming clusters',    done: false },
            ].map(({ step, label, done }) => (
              <div key={step} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium ${
                done ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-white text-indigo-600 border border-indigo-200'
              }`}>
                {done
                  ? <CheckCheck size={13} className="text-green-500 flex-shrink-0" />
                  : <div className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />}
                {label}
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline"
          >
            ← Back to dashboard
          </button>
        </div>
      )}

      {/* No integration connected yet — real user, zero clusters, no integration */}
      {!usingMock && !loading && (apiClusters ?? []).length === 0 && !integrations.some(i => i.status === 'healthy') && (
        <div className="border border-gray-200 bg-gray-50 rounded-2xl px-6 py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-4">
            <GitMerge size={22} className="text-indigo-500" />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">Connect a data source to see clusters</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto mb-4">
            TaxLift needs access to your GitHub commits or Jira tickets to detect SR&ED activity.
            It takes about 2 minutes and we only read metadata — no source code is stored.
          </p>
          <button
            onClick={() => navigate('/onboarding')}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            Connect GitHub or Jira <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Bulk result toast */}
      {bulkResult && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium shadow-sm ${
          bulkResult.action === 'approve' ? 'bg-green-50 text-green-700 border border-green-200' :
          bulkResult.action === 'merge'   ? 'bg-slate-50 text-slate-700 border border-slate-200' :
          'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {bulkResult.action === 'approve' ? <ThumbsUp size={15} /> :
           bulkResult.action === 'merge'   ? <GitMerge size={15} /> :
           <ThumbsDown size={15} />}
          {bulkResult.action === 'merge'
            ? `${bulkResult.count} cluster${bulkResult.count !== 1 ? 's' : ''} merged into ${(apiClusters ?? []).find(c => c.id === bulkResult.primaryId)?.business_component ?? bulkResult.primaryId}.`
            : `${bulkResult.count} cluster${bulkResult.count !== 1 ? 's' : ''} ${bulkResult.action === 'approve' ? 'approved' : 'rejected'} successfully.`}
        </div>
      )}

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          {/* Status tabs */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {STATUSES.map(s => (
              <button
                key={s}
                onClick={() => { setStatus(s); setPage(1) }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  status === s ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Risk min */}
          <div className="flex items-center gap-2 text-sm">
            <Filter size={13} className="text-gray-400" />
            <label className="text-xs text-gray-500 font-medium">Min risk</label>
            <select
              value={riskMin}
              onChange={e => { setRiskMin(e.target.value); setPage(1) }}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Any</option>
              <option value="0.5">≥ 50%</option>
              <option value="0.65">≥ 65%</option>
              <option value="0.75">≥ 75%</option>
              <option value="0.85">≥ 85%</option>
            </select>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <SortDesc size={13} className="text-gray-400" />
            <label className="text-xs text-gray-500 font-medium">Sort by</label>
            <select
              value={sortBy}
              onChange={e => { setSortBy(e.target.value); setPage(1) }}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="risk_score">Risk Score</option>
              <option value="created_at">Date Detected</option>
              <option value="aggregate_time_hours">Hours</option>
              <option value="estimated_credit">Estimated Credit</option>
            </select>
            <button
              onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
              className="p-1.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
            >
              {sortDir === 'desc' ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
            </button>
          </div>

          {/* Bulk Review toggle */}
          {canEdit && (
            <div className="ml-auto">
              {bulkMode ? (
                <button
                  onClick={exitBulkMode}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  <X size={13} /> Exit Bulk Review
                </button>
              ) : (
                <button
                  onClick={() => setBulkMode(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                >
                  <Layers size={13} /> Bulk Review
                </button>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Bulk mode instructions */}
      {bulkMode && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-700">
          <CheckCheck size={14} />
          <span>Select clusters below, then approve or reject them in bulk. Keyboard shortcuts: <kbd className="px-1 py-0.5 bg-white border border-indigo-200 rounded font-mono">A</kbd> approve · <kbd className="px-1 py-0.5 bg-white border border-indigo-200 rounded font-mono">R</kbd> reject · <kbd className="px-1 py-0.5 bg-white border border-indigo-200 rounded font-mono">Esc</kbd> cancel</span>
        </div>
      )}

      {/* Results header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          <span className="font-medium text-gray-900">{filtered.length}</span> cluster{filtered.length !== 1 ? 's' : ''}
          {status !== 'All' && ` with status "${status}"`}
          {bulkMode && selected.size > 0 && <span className="ml-2 text-indigo-600 font-medium">· {selected.size} selected</span>}
        </p>
      </div>

      {/* Table */}
      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {/* Checkbox select-all */}
                {bulkMode && (
                  <th className="px-4 py-3 w-10">
                    <button onClick={toggleSelectAll} className="text-gray-400 hover:text-indigo-600 transition-colors">
                      {allPageSelected
                        ? <CheckSquare size={15} className="text-indigo-600" />
                        : somePageSelected
                          ? <CheckSquare size={15} className="text-gray-400" />
                          : <Square size={15} />}
                    </button>
                  </th>
                )}
                {columns.filter(c => c.key !== 'select').map(col => (
                  <th
                    key={col.key}
                    className={`px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${col.sortable ? 'cursor-pointer hover:text-gray-700 select-none' : ''}`}
                    onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {col.sortable && <SortIcon field={col.key} current={sortBy} dir={sortDir} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={bulkMode ? 7 : 6} className="px-5 py-12 text-center text-sm text-gray-400">No clusters match the current filters.</td>
                </tr>
              ) : paged.map(cluster => {
                const isSelected = selected.has(cluster.id)
                return (
                  <tr
                    key={cluster.id}
                    onClick={() => bulkMode ? toggleSelect(cluster.id) : navigate(`/clusters/${cluster.id}`)}
                    className={`transition-colors cursor-pointer group ${
                      isSelected ? 'bg-indigo-50' : 'hover:bg-indigo-50/40'
                    }`}
                  >
                    {bulkMode && (
                      <td className="px-4 py-3" onClick={e => { e.stopPropagation(); toggleSelect(cluster.id) }}>
                        {isSelected
                          ? <CheckSquare size={15} className="text-indigo-600" />
                          : <Square size={15} className="text-gray-300 group-hover:text-gray-400" />}
                      </td>
                    )}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm font-medium transition-colors ${isSelected ? 'text-indigo-700' : 'text-gray-900 group-hover:text-indigo-700'}`}>
                          {cluster.business_component ?? <span className="italic text-gray-400">Unnamed</span>}
                        </span>
                        {cluster.stale_context && (
                          <span className="px-1.5 py-0.5 bg-orange-100 text-orange-600 text-[10px] font-semibold rounded">STALE</span>
                        )}
                        {cluster.proxy_used && (
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 text-[10px] font-semibold rounded" title={`Proxy time estimate · Confidence: ${cluster.proxy_confidence}`}>PROXY</span>
                        )}
                      </div>
                      <QualificationBadges
                        cluster={cluster}
                        commits={EVIDENCE_SNAPSHOTS[cluster.evidence_snapshot_id]?.git_commits ?? []}
                        onClick={e => { e.stopPropagation(); navigate(`/clusters/${cluster.id}`) }}
                      />
                    </td>
                    <td className="px-5 py-3.5"><StatusBadge status={cluster.status} /></td>
                    <td className="px-5 py-3.5"><RiskScore score={cluster.risk_score} /></td>
                    <td className="px-5 py-3.5 text-sm text-gray-600 tabular-nums">{formatHours(cluster.aggregate_time_hours)}</td>
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-900 tabular-nums">{formatCurrency(cluster.estimated_credit_cad)}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-500">{formatDate(cluster.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1.5 text-xs border rounded-lg transition-colors ${
                    p === page ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Bulk action bar — sticky bottom */}
      {bulkMode && selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700">
          <span className="text-sm font-medium text-slate-300">
            {selected.size} cluster{selected.size !== 1 ? 's' : ''} selected
          </span>
          <div className="w-px h-5 bg-slate-600" />
          <button
            onClick={() => applyBulkAction('approve')}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-500 hover:bg-green-400 rounded-xl text-sm font-semibold transition-colors"
          >
            <ThumbsUp size={14} /> Approve All
          </button>
          <button
            onClick={() => applyBulkAction('reject')}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-400 rounded-xl text-sm font-semibold transition-colors"
          >
            <ThumbsDown size={14} /> Reject All
          </button>
          {selected.size >= 2 && (
            <button
              onClick={() => { setMergePrimaryId(''); setShowMergeModal(true) }}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-semibold transition-colors"
            >
              <GitMerge size={14} /> Merge…
            </button>
          )}
          <button
            onClick={exitBulkMode}
            className="p-2 text-slate-400 hover:text-white transition-colors"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Merge Modal */}
      {showMergeModal && (() => {
        const selectedClusters = (apiClusters ?? []).filter(c => selected.has(c.id))
        const primaryCluster = (apiClusters ?? []).find(c => c.id === mergePrimaryId)
        const secondaryCount = selected.size - 1
        const combinedHours = selectedClusters.reduce((s, c) => s + (c.aggregate_time_hours ?? 0), 0)
        const combinedCredit = selectedClusters.reduce((s, c) => s + (c.estimated_credit_cad ?? 0), 0)

        return (
          <Modal
            open={showMergeModal}
            onClose={() => { setShowMergeModal(false); setMergePrimaryId('') }}
            title="Merge Clusters"
          >
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Select the <strong>primary cluster</strong> to absorb all evidence and hours into.
                The other {secondaryCount} cluster{secondaryCount !== 1 ? 's' : ''} will be marked <strong>Merged</strong> and excluded from credit calculations.
              </p>

              {/* Combined summary */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-center">
                  <p className="text-[10px] font-semibold text-indigo-500 uppercase mb-0.5">Combined Hours</p>
                  <p className="text-base font-bold text-indigo-800">{combinedHours.toFixed(1)}h</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center">
                  <p className="text-[10px] font-semibold text-emerald-500 uppercase mb-0.5">Combined Credit</p>
                  <p className="text-base font-bold text-emerald-800">{formatCurrency(combinedCredit)}</p>
                </div>
              </div>

              {/* Cluster picker */}
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">Select primary cluster (kept)</p>
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-56 overflow-y-auto">
                  {selectedClusters.map(c => (
                    <label
                      key={c.id}
                      className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 ${mergePrimaryId === c.id ? 'bg-indigo-50' : ''}`}
                    >
                      <input
                        type="radio"
                        name="merge-primary"
                        value={c.id}
                        checked={mergePrimaryId === c.id}
                        onChange={() => setMergePrimaryId(c.id)}
                        className="mt-1 accent-indigo-600"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${mergePrimaryId === c.id ? 'text-indigo-800' : 'text-gray-800'}`}>
                          {c.business_component ?? 'Unnamed'}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-gray-400">
                          <span>{c.aggregate_time_hours != null ? `${c.aggregate_time_hours}h` : '—'}</span>
                          <span>{formatCurrency(c.estimated_credit_cad)}</span>
                          <StatusBadge status={c.status} />
                        </div>
                      </div>
                      {mergePrimaryId === c.id && (
                        <span className="text-[9px] bg-indigo-200 text-indigo-700 px-1.5 py-0.5 rounded-full font-semibold self-center">PRIMARY</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {mergePrimaryId && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800">
                  <AlertTriangle size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>{secondaryCount} cluster{secondaryCount !== 1 ? 's' : ''}</strong> will be archived as Merged.
                    Their evidence references are preserved but they will not contribute to credit calculations.
                  </span>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-1 border-t border-gray-100">
                <Button variant="secondary" onClick={() => { setShowMergeModal(false); setMergePrimaryId('') }}>
                  Cancel
                </Button>
                <Button
                  icon={GitMerge}
                  onClick={handleMergeConfirm}
                  disabled={!mergePrimaryId}
                >
                  Confirm Merge
                </Button>
              </div>
            </div>
          </Modal>
        )
      })()}
    </div>
  )
}

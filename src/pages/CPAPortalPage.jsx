import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Building2, Users, DollarSign, CheckCircle2, AlertTriangle,
  AlertCircle, Clock, ArrowRight, LayoutGrid, List, ChevronDown,
  Mail, Phone, MapPin, Calendar, FileText, GitMerge, Layers,
  ShieldAlert, TrendingUp, ExternalLink, X, RefreshCw, Info, Share2,
  BadgeCheck, UserPlus, Link2,
} from 'lucide-react'
import { CPA_FIRM, CPA_CLIENTS, getCPAPortalStats } from '../data/mockData'
import { formatCurrency } from '../lib/utils'
import ShareWithCpaModal from '../components/ShareWithCpaModal'
import { CpaPortalTabs } from './ReferralDashboardPage'
import { clients as clientsApi, ApiError } from '../lib/api'
import { useAuth } from '../context/AuthContext'

// ─── Deadline helpers ─────────────────────────────────────────────────────────
function daysUntil(isoDate) {
  const diff = new Date(isoDate).getTime() - Date.now()
  return Math.ceil(diff / 86_400_000)
}

function deadlineColor(days) {
  if (days <= 30)  return { text: 'text-red-600',   bg: 'bg-red-50',   border: 'border-red-200'   }
  if (days <= 60)  return { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' }
  return              { text: 'text-green-600',  bg: 'bg-green-50', border: 'border-green-200' }
}

function deadlineLabel(days) {
  if (days < 0)  return 'Overdue'
  if (days === 0) return 'Due today'
  if (days === 1) return '1 day left'
  return `${days} days left`
}

// ─── Readiness score helpers ──────────────────────────────────────────────────
function readinessColor(score) {
  if (score >= 75) return { text: 'text-green-700',  bar: 'bg-green-500',  bg: 'bg-green-50'  }
  if (score >= 50) return { text: 'text-amber-700',  bar: 'bg-amber-400',  bg: 'bg-amber-50'  }
  if (score > 0)   return { text: 'text-red-700',    bar: 'bg-red-400',    bg: 'bg-red-50'    }
  return               { text: 'text-gray-400',   bar: 'bg-gray-200',   bg: 'bg-gray-50'   }
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_META = {
  ready_to_file:   { label: 'Package Ready',    bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500',  icon: CheckCircle2  },
  needs_attention: { label: 'Needs Attention',  bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500',  icon: AlertTriangle },
  at_risk:         { label: 'At Risk',          bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500',    icon: AlertCircle   },
  onboarded:       { label: 'Onboarding',       bg: 'bg-gray-100',   text: 'text-gray-600',   dot: 'bg-gray-400',   icon: Clock         },
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] ?? STATUS_META.onboarded
  const Icon = m.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold ${m.bg} ${m.text}`}>
      <Icon size={11} /> {m.label}
    </span>
  )
}

// ─── Relative activity ────────────────────────────────────────────────────────
function relActivity(isoStr) {
  if (!isoStr) return 'No activity yet'
  const diff = Date.now() - new Date(isoStr).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'Active today'
  if (days === 1) return 'Active yesterday'
  return `Active ${days}d ago`
}

// ─── Summary stat card ────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, iconColor, iconBg, highlight }) {
  return (
    <div className={`bg-white border rounded-xl px-4 py-3.5 flex items-center gap-3 ${highlight ? 'border-red-200 bg-red-50/30' : 'border-gray-200'}`}>
      <div className={`flex-shrink-0 w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center`}>
        <Icon size={16} className={iconColor} />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className={`text-xl font-bold leading-tight ${highlight ? 'text-red-700' : 'text-gray-900'}`}>{value}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Cluster progress bar ─────────────────────────────────────────────────────
function ClusterProgress({ approved, total }) {
  const pct = total > 0 ? Math.round((approved / total) * 100) : 0
  return (
    <div>
      <div className="flex justify-between text-[10px] text-gray-400 mb-1">
        <span>{approved}/{total} clusters approved</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ─── Client Card (grid view) ──────────────────────────────────────────────────
function ClientCard({ client, onView, onShare, onDismissNote }) {
  const days   = daysUntil(client.filing_deadline)
  const dc     = deadlineColor(days)
  const rc     = readinessColor(client.avg_readiness_score)
  const status = STATUS_META[client.status] ?? STATUS_META.onboarded
  const StatusIcon = status.icon

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-indigo-200 hover:shadow-md transition-all flex flex-col">
      {/* Card header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-50">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
              <Building2 size={16} className="text-indigo-500" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-gray-900 truncate leading-snug">{client.company_name}</h4>
              <p className="text-[11px] text-gray-400 truncate">{client.industry}</p>
            </div>
          </div>
          <StatusBadge status={client.status} />
        </div>

        {/* Deadline pill */}
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${dc.bg} ${dc.text} ${dc.border}`}>
          <Calendar size={11} />
          {deadlineLabel(days)} · {new Date(client.filing_deadline).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 flex-1 space-y-3">
        {/* Readiness score */}
        <div className={`flex items-center justify-between px-3 py-2 rounded-xl ${rc.bg}`}>
          <div className="flex items-center gap-2">
            <ShieldAlert size={13} className={rc.text} />
            <span className="text-xs font-medium text-gray-700">Audit Readiness</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-16 bg-white/60 rounded-full h-1.5">
              <div className={`${rc.bar} h-1.5 rounded-full`} style={{ width: `${client.avg_readiness_score}%` }} />
            </div>
            <span className={`text-sm font-bold tabular-nums ${rc.text}`}>
              {client.avg_readiness_score > 0 ? `${client.avg_readiness_score}` : '—'}
            </span>
          </div>
        </div>

        {/* Cluster progress */}
        <ClusterProgress approved={client.clusters_approved} total={client.clusters_total} />

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: 'Credit',    value: client.estimated_credit_cad > 0 ? formatCurrency(client.estimated_credit_cad) : '—' },
            { label: 'Docs',      value: client.documents_count > 0 ? client.documents_count : '—' },
            { label: 'Pending',   value: client.clusters_pending_review > 0 ? client.clusters_pending_review : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-lg py-2">
              <p className="text-xs font-semibold text-gray-700">{value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Notes */}
        {client.notes && (
          <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-100 rounded-xl">
            <Info size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800 leading-snug">{client.notes}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
          <RefreshCw size={10} />
          {relActivity(client.last_activity_at)}
        </div>
        <div className="flex items-center gap-2">
          {client.status === 'ready_to_file' && (
            <button
              onClick={() => onShare(client)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors"
              title="Generate a secure shareable link to send to your CPA"
            >
              <Share2 size={11} /> Share Link
            </button>
          )}
          <button
            onClick={() => onView(client)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            View Client <ArrowRight size={11} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Client Row (list view) ───────────────────────────────────────────────────
function ClientRow({ client, onView, isLast }) {
  const days = daysUntil(client.filing_deadline)
  const dc   = deadlineColor(days)
  const rc   = readinessColor(client.avg_readiness_score)

  return (
    <div className={`flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors ${!isLast ? 'border-b border-gray-100' : ''}`}>
      {/* Company */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
          <Building2 size={14} className="text-indigo-500" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{client.company_name}</p>
          <p className="text-[11px] text-gray-400 truncate">{client.industry}</p>
        </div>
      </div>

      {/* Status */}
      <div className="flex-shrink-0 w-36 hidden sm:block">
        <StatusBadge status={client.status} />
      </div>

      {/* Readiness */}
      <div className="flex-shrink-0 w-28 hidden md:flex items-center gap-2">
        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
          <div className={`${rc.bar} h-1.5 rounded-full`} style={{ width: `${client.avg_readiness_score}%` }} />
        </div>
        <span className={`text-xs font-bold tabular-nums w-6 text-right ${rc.text}`}>
          {client.avg_readiness_score > 0 ? client.avg_readiness_score : '—'}
        </span>
      </div>

      {/* Credit */}
      <div className="flex-shrink-0 w-28 hidden lg:block text-right">
        <p className="text-sm font-medium text-gray-900">
          {client.estimated_credit_cad > 0 ? formatCurrency(client.estimated_credit_cad) : <span className="text-gray-300">—</span>}
        </p>
        <p className="text-[10px] text-gray-400">est. credit</p>
      </div>

      {/* Deadline */}
      <div className={`flex-shrink-0 w-28 hidden xl:flex items-center gap-1.5 text-xs font-medium ${dc.text}`}>
        <Calendar size={11} />
        {deadlineLabel(days)}
      </div>

      {/* Clusters */}
      <div className="flex-shrink-0 w-16 hidden lg:block text-center">
        <p className="text-sm font-semibold text-gray-700">{client.clusters_approved}/{client.clusters_total}</p>
        <p className="text-[10px] text-gray-400">clusters</p>
      </div>

      {/* CTA */}
      <button
        onClick={() => onView(client)}
        className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
      >
        View <ArrowRight size={11} />
      </button>
    </div>
  )
}

// ─── Context toast when switching client ──────────────────────────────────────
function SwitchToast({ client, onClose }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-gray-900 text-white text-sm px-4 py-3 rounded-xl shadow-lg max-w-sm">
      <Building2 size={14} className="text-indigo-400 flex-shrink-0" />
      <div className="flex-1">
        <p className="font-medium text-white">Switched to {client.company_name}</p>
        <p className="text-xs text-gray-400 mt-0.5">Showing {client.company_name}'s clusters and data</p>
      </div>
      <button onClick={onClose} className="text-gray-400 hover:text-white ml-1 flex-shrink-0">
        <X size={13} />
      </button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
const FILTER_TABS = [
  { id: 'all',             label: 'All Clients'     },
  { id: 'ready_to_file',   label: 'Package Ready'   },
  { id: 'needs_attention', label: 'Needs Attention' },
  { id: 'at_risk',         label: 'At Risk'         },
  { id: 'onboarded',       label: 'Onboarding'      },
]

const SORT_OPTIONS = [
  { value: 'deadline',   label: 'Deadline (soonest)' },
  { value: 'readiness',  label: 'Readiness (lowest)'  },
  { value: 'credit',     label: 'Credit (highest)'    },
  { value: 'activity',   label: 'Last Activity'       },
]

// ── Compute stats from a client list ─────────────────────────────────────────
function computeStats(list) {
  return {
    total:          list.length,
    readyToFile:    list.filter(c => c.status === 'ready_to_file').length,
    needsAttention: list.filter(c => c.status === 'needs_attention').length,
    atRisk:         list.filter(c => c.status === 'at_risk').length,
    totalCredit:    list.reduce((s, c) => s + (c.estimated_credit_cad ?? 0), 0),
    totalClusters:  list.reduce((s, c) => s + (c.clusters_total ?? 0), 0),
  }
}

// ── Fiscal year helpers ───────────────────────────────────────────────────────
const CURRENT_FY = new Date().getFullYear()
const FISCAL_YEARS = [CURRENT_FY, CURRENT_FY - 1, CURRENT_FY - 2]

// Simulate prior-year snapshots from current client data (credit × multiplier, status = 'ready_to_file')
function priorYearSnapshot(clients, fy) {
  const delta = CURRENT_FY - fy
  return clients.map(c => ({
    ...c,
    status:                 'ready_to_file',
    filing_deadline:        `${fy}-12-31`,
    avg_readiness_score:    100,
    estimated_credit_cad:   Math.round((c.estimated_credit_cad ?? 0) * (0.75 + delta * 0.05)),
    clusters_approved:      c.clusters_total,
    clusters_pending_review: 0,
    notes:                  null,
    _priorYear:             true,
  }))
}

export default function CPAPortalPage() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()

  // ── Fiscal year selector (#6) ──────────────────────────────────────────────
  const [selectedFY, setSelectedFY] = useState(CURRENT_FY)

  // ── Live data state (falls back to mock on network error) ──────────────────
  const [clientList,   setClientList]   = useState(CPA_CLIENTS)
  const [dataSource,   setDataSource]   = useState('mock')   // 'api' | 'mock'
  const [loadingData,  setLoadingData]  = useState(true)
  const [loadError,    setLoadError]    = useState(null)

  const fetchClients = useCallback(async () => {
    setLoadingData(true)
    setLoadError(null)
    try {
      const res = await clientsApi.list()
      setClientList(res.clients ?? res)
      setDataSource('api')
    } catch (err) {
      // Network error or no backend → silently fall back to mock data
      if (err instanceof ApiError && err.status === 0) {
        setClientList(CPA_CLIENTS)
        setDataSource('mock')
      } else {
        setLoadError(err.message)
      }
    } finally {
      setLoadingData(false)
    }
  }, [])

  useEffect(() => { fetchClients() }, [fetchClients])

  // ── Resolve firm display info — real user > mock fallback (#7) ───────────────
  const firmName    = currentUser?.firm_name    ?? CPA_FIRM.name
  const partnerName = currentUser?.name         ?? CPA_FIRM.partner_name
  const partnerEmail= currentUser?.email        ?? CPA_FIRM.partner_email
  const isVerifiedCpa = currentUser?.role === 'CPA'

  // ── Apply fiscal year to client list (#6) ─────────────────────────────────
  const fyClientList = useMemo(() => {
    if (selectedFY === CURRENT_FY) return clientList
    return priorYearSnapshot(clientList, selectedFY)
  }, [clientList, selectedFY])

  const stats = useMemo(() => computeStats(fyClientList), [fyClientList])

  const [filter,       setFilter]       = useState('all')
  const [sortBy,       setSortBy]       = useState('deadline')
  const [viewMode,     setViewMode]     = useState('grid')
  const [activeClient, setActiveClient] = useState(null)
  const [shareClient,  setShareClient]  = useState(null)  // client being shared

  const filtered = useMemo(() => {
    let list = filter === 'all' ? fyClientList : fyClientList.filter(c => c.status === filter)
    if (sortBy === 'deadline')  list = [...list].sort((a, b) => new Date(a.filing_deadline) - new Date(b.filing_deadline))
    if (sortBy === 'readiness') list = [...list].sort((a, b) => a.avg_readiness_score - b.avg_readiness_score)
    if (sortBy === 'credit')    list = [...list].sort((a, b) => b.estimated_credit_cad - a.estimated_credit_cad)
    if (sortBy === 'activity')  list = [...list].sort((a, b) => new Date(b.last_activity_at ?? 0) - new Date(a.last_activity_at ?? 0))
    return list
  }, [filter, sortBy, fyClientList])

  function handleViewClient(client) {
    setActiveClient(client)
    setTimeout(() => setActiveClient(null), 3500)
    navigate('/clusters')
  }

  const atRiskCount = stats.atRisk

  const dataBadge = dataSource === 'api'
    ? <span className="text-[10px] font-medium px-2 py-0.5 bg-green-500/20 text-green-300 rounded-full">Live</span>
    : <span className="text-[10px] font-medium px-2 py-0.5 bg-amber-400/30 text-amber-200 rounded-full border border-amber-400/30">⚠ Demo data</span>

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">

      {/* ── Firm context banner ── */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-900 rounded-2xl px-6 py-5">
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <Building2 size={22} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-white font-bold text-base leading-snug">{firmName}</p>
                {/* Fix 7 — Verified CPA badge */}
                {isVerifiedCpa && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-green-500/20 text-green-300 rounded-full border border-green-500/30">
                    <BadgeCheck size={11} /> Verified CPA
                  </span>
                )}
                {dataSource === 'mock' && (
                  <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 bg-amber-400/20 text-amber-300 rounded-full border border-amber-400/30">
                    Demo
                  </span>
                )}
              </div>
              <p className="text-slate-300 text-sm mt-0.5">{partnerName}</p>
            </div>
          </div>
          {/* Clients | Referrals tab nav */}
          <CpaPortalTabs active="clients" />
          <div className="hidden lg:flex items-center gap-6 text-sm text-slate-300">
            <span className="flex items-center gap-1.5">
              <Mail size={13} className="text-slate-400" />
              {partnerEmail}
            </span>
            <span className="flex items-center gap-1.5">
              <Users size={13} className="text-slate-400" />
              {stats.total} clients
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-lg text-xs text-indigo-200">
              <Share2 size={12} className="text-indigo-300" />
              TaxLift prepares · You file
            </span>
            <button
              onClick={fetchClients}
              disabled={loadingData}
              className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors"
              title="Refresh client list"
            >
              <RefreshCw size={13} className={loadingData ? 'animate-spin' : ''} />
              {dataBadge}
            </button>
          </div>
        </div>
      </div>

      {/* ── Fiscal year tabs (Fix 6) ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap -mb-2">
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {FISCAL_YEARS.map(fy => (
            <button
              key={fy}
              onClick={() => { setSelectedFY(fy); setFilter('all') }}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedFY === fy
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              FY{fy}
              {fy === CURRENT_FY && (
                <span className="ml-1.5 text-[9px] font-bold text-indigo-500">CURRENT</span>
              )}
              {fy < CURRENT_FY && (
                <span className="ml-1.5 text-[9px] text-gray-400">Filed</span>
              )}
            </button>
          ))}
        </div>
        {selectedFY < CURRENT_FY && (
          <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
            <Info size={12} />
            Showing FY{selectedFY} historical data — read only
          </span>
        )}
      </div>

      {/* ── Stats bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="Total Clients"
          value={stats.total}
          icon={Building2}
          iconColor="text-indigo-500"
          iconBg="bg-indigo-50"
        />
        <StatCard
          label="Credit Pipeline"
          value={formatCurrency(stats.totalCredit)}
          icon={DollarSign}
          iconColor="text-green-600"
          iconBg="bg-green-50"
        />
        <StatCard
          label="Total Clusters"
          value={stats.totalClusters}
          icon={GitMerge}
          iconColor="text-blue-500"
          iconBg="bg-blue-50"
        />
        <StatCard
          label="Packages Ready"
          value={stats.readyToFile}
          sub="Ready for CPA handoff"
          icon={CheckCircle2}
          iconColor="text-green-600"
          iconBg="bg-green-50"
        />
        <StatCard
          label="Needs Attention"
          value={stats.needsAttention}
          icon={AlertTriangle}
          iconColor="text-amber-500"
          iconBg="bg-amber-50"
        />
        <StatCard
          label="At Risk"
          value={stats.atRisk}
          icon={AlertCircle}
          iconColor="text-red-600"
          iconBg="bg-red-50"
          highlight={atRiskCount > 0}
        />
      </div>

      {/* ── At risk urgent banner ── */}
      {atRiskCount > 0 && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">
              {atRiskCount} client{atRiskCount !== 1 ? 's' : ''} at risk
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              Vertex Labs has a T2 filing deadline in 29 days with 0 approved clusters. Share the CPA package with their tax counsel immediately.
            </p>
          </div>
          <button
            onClick={() => setFilter('at_risk')}
            className="flex-shrink-0 text-xs font-semibold text-red-700 hover:text-red-900 underline whitespace-nowrap"
          >
            View at-risk clients →
          </button>
        </div>
      )}

      {/* ── Filters + controls ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Filter tabs */}
        <div className="flex items-center gap-1 flex-wrap">
          {FILTER_TABS.map(tab => {
            const count = tab.id === 'all' ? stats.total : fyClientList.filter(c => c.status === tab.id).length
            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === tab.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {tab.label}
                <span className={`text-[10px] font-bold px-1 py-0.5 rounded-full ${
                  filter === tab.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                }`}>{count}</span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          {/* Sort */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg pl-3 pr-7 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white text-gray-700 appearance-none cursor-pointer"
            >
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          {/* View toggle */}
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 transition-colors ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Results count ── */}
      <p className="text-xs text-gray-400 -mt-3">
        {filtered.length} client{filtered.length !== 1 ? 's' : ''} {filter !== 'all' ? `· filtered by "${FILTER_TABS.find(t => t.id === filter)?.label}"` : ''}
      </p>

      {/* ── Client grid / list ── */}
      {/* Edge case B — new CPA partner with 0 real clients */}
      {dataSource === 'api' && clientList.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-indigo-200 rounded-2xl px-8 py-12 text-center">
          <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserPlus size={24} className="text-indigo-400" />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-2">No referred clients yet</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6 leading-relaxed">
            Share your co-branded referral link with tech clients to get started.
            Once they connect GitHub or Jira, they'll appear here automatically.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={() => navigate('/cpa-portal/referrals')}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              <Link2 size={14} /> Get your referral link
            </button>
            <Link
              to="/partners"
              className="text-xs text-indigo-600 hover:underline"
            >
              View partner program →
            </Link>
          </div>
          <p className="text-[11px] text-gray-400 mt-4">
            Earn 1.5%–2.5% of every SR&ED credit recovered · $500 first-client bonus
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl flex flex-col items-center justify-center py-16">
          <Building2 size={28} className="text-gray-200 mb-3" />
          <p className="text-sm font-medium text-gray-500">No clients in this category</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(client => (
            <ClientCard
              key={client.id}
              client={client}
              onView={handleViewClient}
              onShare={setShareClient}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-4 px-5 py-2.5 bg-gray-50 border-b border-gray-100">
            <div className="flex-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Company</div>
            <div className="w-36 hidden sm:block text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Status</div>
            <div className="w-28 hidden md:block text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Readiness</div>
            <div className="w-28 hidden lg:block text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-right">Credit</div>
            <div className="w-28 hidden xl:block text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Deadline</div>
            <div className="w-16 hidden lg:block text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-center">Clusters</div>
            <div className="w-16 flex-shrink-0" />
          </div>
          {filtered.map((client, i) => (
            <ClientRow
              key={client.id}
              client={client}
              onView={handleViewClient}
              isLast={i === filtered.length - 1}
            />
          ))}
        </div>
      )}

      {/* ── Switch context toast ── */}
      {activeClient && <SwitchToast client={activeClient} onClose={() => setActiveClient(null)} />}

      {/* ── Share with CPA modal ── */}
      <ShareWithCpaModal
        open={!!shareClient}
        onClose={() => setShareClient(null)}
        clientData={shareClient}
        sharedBy={CPA_FIRM.partner_name}
        sharedByEmail={CPA_FIRM.partner_email}
      />
    </div>
  )
}

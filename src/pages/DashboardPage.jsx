import { useMemo, useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { GitMerge, Clock, CheckCircle2, DollarSign, AlertTriangle, TrendingUp, FlaskConical, Zap } from 'lucide-react'
import { getCreditTrend, INTEGRATIONS } from '../data/mockData'
import { formatCurrency, formatHours, STATUS_COLORS } from '../lib/utils'
import { useClusters } from '../hooks'
import { useAuth } from '../context/AuthContext'
import { StatusBadge, IntegrationBadge } from '../components/ui/Badge'
import RiskScore from '../components/ui/RiskScore'
import Card, { CardHeader } from '../components/ui/Card'
import GettingStartedCard from '../components/dashboard/GettingStartedCard'
import { ShareButton } from './ShareableSummaryPage'

const PIE_COLORS = {
  New: '#94a3b8', Interviewed: '#60a5fa', Drafted: '#f59e0b', Approved: '#22c55e', Rejected: '#f87171',
}

function StatCard({ label, value, sub, icon: Icon, iconColor = 'text-indigo-600', iconBg = 'bg-indigo-50' }) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${iconBg}`}>
          <Icon size={18} className={iconColor} />
        </div>
      </div>
    </Card>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const { data: clusters, usingMock } = useClusters()
  const trend = getCreditTrend()

  // Derive stats from live cluster data
  const stats = useMemo(() => {
    if (!clusters) return { total: 0, approved: 0, pending: 0, totalHours: 0, totalCreditCAD: 0 }
    const approved = clusters.filter(c => c.status === 'Approved')
    return {
      total: clusters.length,
      approved: approved.length,
      pending: clusters.filter(c => !['Approved','Rejected','Merged'].includes(c.status)).length,
      totalHours: approved.reduce((s, c) => s + (c.aggregate_time_hours ?? 0), 0),
      totalCreditCAD: approved.reduce((s, c) => s + (c.estimated_credit_cad ?? 0), 0),
    }
  }, [clusters])

  // Pending free scan — load from sessionStorage, then auto-associate with account
  const [pendingScan, setPendingScan] = useState(null)
  const associatedRef = useRef(false) // prevent double-fire in StrictMode

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('taxlift_scan_results')
      if (!raw) return
      const scan = JSON.parse(raw)
      if (scan?.clusters?.length > 0) setPendingScan(scan)
    } catch { /* ignore */ }
  }, [])

  // When a real (non-demo) user lands on the dashboard with a pending scan,
  // associate the scan with their account so it appears in the admin view.
  useEffect(() => {
    if (!pendingScan?.scanId) return
    if (!currentUser?.id || !currentUser?._fromApi) return // real API user only
    if (associatedRef.current) return
    associatedRef.current = true

    fetch(`/api/scan/free/${pendingScan.scanId}/associate`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: currentUser.id }),
    }).catch(() => { /* fire-and-forget */ })
  }, [pendingScan, currentUser])

  const breakdown = useMemo(() => {
    if (!clusters) return []
    const counts = {}
    clusters.forEach(c => { counts[c.status] = (counts[c.status] ?? 0) + 1 })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [clusters])

  const recentClusters = useMemo(() =>
    [...(clusters ?? [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 6),
    [clusters]
  )
  const stale = useMemo(() =>
    (clusters ?? []).filter(c => c.stale_context && ['New','Interviewed','Drafted'].includes(c.status)),
    [clusters]
  )
  const needsReview = useMemo(() =>
    (clusters ?? []).filter(c => c.status === 'Drafted'),
    [clusters]
  )

  return (
    <div className="space-y-6">
      {/* Demo mode banner */}
      {usingMock && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
          <FlaskConical size={13} />
          <span>Using demo data — backend not connected.</span>
        </div>
      )}

      {/* Pending free scan banner */}
      {pendingScan && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl">
          <div className="flex items-start gap-3 min-w-0">
            <Zap size={15} className="text-indigo-600 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-indigo-900">
                You have a pending scan — {pendingScan.clusters?.length} qualifying cluster{pendingScan.clusters?.length !== 1 ? 's' : ''} found
              </p>
              <p className="text-[11px] text-indigo-600 mt-0.5 truncate">
                Repos: {(pendingScan.repos ?? []).join(', ') || 'demo repos'} · Complete setup to generate your CPA-ready package
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => navigate('/scan/results')}
              className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 transition-colors whitespace-nowrap"
            >
              View results →
            </button>
            <button
              onClick={() => { sessionStorage.removeItem('taxlift_scan_results'); setPendingScan(null) }}
              className="text-xs text-indigo-400 hover:text-indigo-600 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Page header with action buttons */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-xs text-gray-400 mt-0.5">Welcome back, {currentUser?.name?.split(' ')[0] ?? 'there'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/quick-connect')}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            <Zap size={13} /> Quick Connect
          </button>
          <ShareButton
            clusters={clusters}
            companyName={currentUser?.tenant_id ? 'Your Company' : 'Acme Corp'}
          />
        </div>
      </div>

      {/* Getting Started checklist */}
      <GettingStartedCard />

      {/* Alert banner */}
      {(stale.length > 0 || needsReview.length > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            <strong>{needsReview.length} cluster{needsReview.length !== 1 ? 's' : ''}</strong> awaiting narrative review
            {stale.length > 0 && <> · <strong>{stale.length}</strong> with stale context flags</>}
          </p>
          <button onClick={() => navigate('/clusters?status=Drafted')} className="ml-auto text-xs font-medium text-amber-700 hover:text-amber-900 underline whitespace-nowrap">
            Review now →
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Clusters"
          value={stats.total}
          sub={`${stats.pending} pending review`}
          icon={GitMerge}
        />
        <StatCard
          label="Approved Q1 2026"
          value={stats.approved}
          sub="clusters fully processed"
          icon={CheckCircle2}
          iconColor="text-green-600"
          iconBg="bg-green-50"
        />
        <StatCard
          label="Total Eligible Hours"
          value={formatHours(stats.totalHours)}
          sub="across approved clusters"
          icon={Clock}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <StatCard
          label="Estimated Credit (CAD)"
          value={formatCurrency(stats.totalCreditCAD)}
          sub="approved & calculated"
          icon={DollarSign}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Credit trend */}
        <Card padding={false} className="col-span-2 p-6">
          <CardHeader
            title="Credit Pipeline (CAD)"
            subtitle="Estimated R&D credits by month, Oct 2025 – Mar 2026"
            action={<TrendingUp size={16} className="text-gray-400" />}
          />
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trend} margin={{ top: 0, right: 0, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="creditGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => v > 0 ? `$${(v/1000).toFixed(0)}k` : '$0'} />
              <Tooltip
                formatter={(v) => [formatCurrency(v, 'CAD'), 'Estimated Credit']}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <Area type="monotone" dataKey="credit" stroke="#6366f1" strokeWidth={2} fill="url(#creditGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Status breakdown */}
        <Card padding={false} className="p-6">
          <CardHeader title="Cluster Status" subtitle="All-time distribution" />
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={breakdown} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={65} strokeWidth={2}>
                {breakdown.map(entry => (
                  <Cell key={entry.name} fill={PIE_COLORS[entry.name]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(v) => <span style={{ fontSize: 11, color: '#64748b' }}>{v}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Recent clusters */}
      <Card padding={false}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Recent Clusters</h3>
            <p className="text-xs text-gray-500 mt-0.5">Latest detected R&D activity clusters</p>
          </div>
          <button onClick={() => navigate('/clusters')} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
            View all →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Business Component', 'Status', 'Risk Score', 'Hours', 'Est. Credit (CAD)', 'Detected'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentClusters.map(cluster => (
                <tr
                  key={cluster.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/clusters/${cluster.id}`)}
                >
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{cluster.business_component ?? '—'}</span>
                      {cluster.stale_context && (
                        <span title="Stale context" className="px-1.5 py-0.5 bg-orange-100 text-orange-600 text-[10px] font-medium rounded">STALE</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3.5"><StatusBadge status={cluster.status} /></td>
                  <td className="px-6 py-3.5"><RiskScore score={cluster.risk_score} /></td>
                  <td className="px-6 py-3.5 text-sm text-gray-600">{formatHours(cluster.aggregate_time_hours)}</td>
                  <td className="px-6 py-3.5 text-sm font-medium text-gray-900">{formatCurrency(cluster.estimated_credit_cad)}</td>
                  <td className="px-6 py-3.5 text-sm text-gray-500">
                    {new Date(cluster.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Integration health */}
      <Card>
        <CardHeader title="Integration Health" subtitle="Live status of connected data sources" />
        <div className="grid grid-cols-3 gap-4">
          {INTEGRATIONS.map(intg => (
            <div key={intg.integration} className="border border-gray-100 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900 capitalize">{intg.integration}</span>
                <IntegrationBadge status={intg.status} />
              </div>
              {intg.error_detail && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2 mt-2">{intg.error_detail}</p>
              )}
              {intg.last_sync_at && (
                <p className="text-xs text-gray-400 mt-2">
                  Last sync: {new Date(intg.last_sync_at).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

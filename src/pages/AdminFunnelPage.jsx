/**
 * AdminFunnelPage — Sales funnel dashboard for TaxLift admins.
 * Route: /admin/funnel  (protected, role = 'admin')
 *
 * Shows the full acquisition funnel:
 *   Free Scans → Email Leads → Signups → Paid
 *
 * Features:
 *  - 4 stat tiles with sparkline + conversion rates
 *  - Free Scans tab: sortable table with drip status + manual trigger
 *  - All Leads tab: marketing leads table
 *  - CSV export of free scans
 */
import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, Download, RefreshCw, Loader2,
  Users, Mail, CreditCard, ArrowRight,
  ChevronUp, ChevronDown, ExternalLink, Send,
  ScanLine, TrendingUp, BarChart2, CheckCircle2, Clock,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { admin as adminApi, BASE_URL, token } from '../lib/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

function formatCredit(amount) {
  if (!amount) return '$0'
  const low  = Math.round(amount * 0.8).toLocaleString('en-CA')
  const high = Math.round(amount * 1.2).toLocaleString('en-CA')
  return `$${low}–$${high}`
}

function convRate(numerator, denominator) {
  if (!denominator || denominator === 0) return '0%'
  return `${Math.round((numerator / denominator) * 100)}%`
}

// ── Sparkline SVG ─────────────────────────────────────────────────────────────

function Sparkline({ data, color = '#6366f1' }) {
  // data: [{ day: 'YYYY-MM-DD', n: number }]
  // Fill any missing days in the last 7
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const day = d.toISOString().slice(0, 10)
    const found = data?.find(r => r.day === day)
    days.push(found ? found.n : 0)
  }

  const max = Math.max(...days, 1)
  const W = 80, H = 32
  const pts = days.map((n, i) => {
    const x = (i / (days.length - 1)) * W
    const y = H - (n / max) * (H - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ── Drip step badge ───────────────────────────────────────────────────────────

function DripBadge({ step, dripData }) {
  const info = dripData[step]
  if (!info) {
    return (
      <span className="inline-flex items-center text-[10px] text-slate-300 px-1.5 py-0.5 rounded border border-slate-100">
        E{step}
      </span>
    )
  }
  const sentColors = ['', 'bg-green-100 text-green-700', 'bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700']
  const cls = info.status === 'sent'
    ? (sentColors[step] ?? 'bg-green-100 text-green-700')
    : info.status === 'failed'
      ? 'bg-red-100 text-red-600'
      : 'bg-amber-50 text-amber-600'

  const label = info.status === 'sent' ? `E${step} ✓` : `E${step}`

  return (
    <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded ${cls}`} title={info.sent_at ? `Sent ${relativeTime(info.sent_at)}` : info.status}>
      {label}
    </span>
  )
}

// ── Stat tile ─────────────────────────────────────────────────────────────────

function StatTile({ icon: Icon, label, value, sub, sparkData, color, footnote }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex-1 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-1.5 rounded-lg ${color.bg}`}>
              <Icon size={14} className={color.icon} />
            </div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
          </div>
          <div className="text-3xl font-bold text-slate-900 tabular-nums">{value}</div>
          {sub      && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
          {footnote && <div className="text-xs text-indigo-500 mt-1.5">{footnote}</div>}
        </div>
        {sparkData && (
          <div className="flex-shrink-0 pt-1">
            <Sparkline data={sparkData} color={color.spark} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sortable column header ────────────────────────────────────────────────────

function SortTh({ col, label, sort, onSort, className = '' }) {
  const active = sort.col === col
  return (
    <th
      className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-slate-700 ${className}`}
      onClick={() => onSort(col)}
    >
      <span className="flex items-center gap-1">
        {label}
        {active
          ? sort.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
          : <ChevronDown size={12} className="opacity-20" />
        }
      </span>
    </th>
  )
}

// ── Plan badge (reused from AdminLeadsPage) ───────────────────────────────────

function PlanBadge({ plan }) {
  const colors = {
    starter:    'bg-blue-50 text-blue-700',
    growth:     'bg-indigo-50 text-indigo-700',
    enterprise: 'bg-violet-50 text-violet-700',
  }
  if (!plan) return <span className="text-slate-400 text-xs">—</span>
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${colors[plan] ?? 'bg-slate-100 text-slate-600'}`}>
      {plan}
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminFunnelPage() {
  const [data,       setData]       = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [tab,        setTab]        = useState('daily')   // 'daily' | 'scans' | 'leads' | 'users'
  const [sort,       setSort]       = useState({ col: 'created_at', dir: 'desc' })
  const [triggering, setTriggering] = useState({})        // { [scanId]: bool }

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await adminApi.funnel()
      setData(result)
    } catch (err) {
      setError(err?.message ?? 'Failed to load funnel data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function triggerDrip(scan) {
    setTriggering(t => ({ ...t, [scan.id]: true }))
    try {
      await adminApi.triggerDrip({ email: scan.email, scanId: scan.id, step: 1 })
      await fetchData()
    } catch {
      setError('Failed to trigger drip email')
    } finally {
      setTriggering(t => ({ ...t, [scan.id]: false }))
    }
  }

  function handleSort(col) {
    setSort(s => ({
      col,
      dir: s.col === col && s.dir === 'asc' ? 'desc' : 'asc',
    }))
  }

  function sortedScans(scans) {
    return [...scans].sort((a, b) => {
      let va = sort.col === 'estimated_credit' ? Number(a[sort.col] ?? 0) : String(a[sort.col] ?? '')
      let vb = sort.col === 'estimated_credit' ? Number(b[sort.col] ?? 0) : String(b[sort.col] ?? '')
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }

  function handleExport() {
    const tok = token.get()
    setLoading(true)
    fetch(`${BASE_URL}/api/v1/admin/funnel/export`, {
      credentials: 'include',
    })
      .then(r => r.blob())
      .then(blob => {
        const href = URL.createObjectURL(blob)
        const a    = document.createElement('a')
        a.href     = href
        a.download = `taxlift-funnel-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(href)
      })
      .catch(() => setError('CSV export failed'))
      .finally(() => setLoading(false))
  }

  // ── Computed stats ──────────────────────────────────────────────────────────
  const scanCount  = data?.freeScans?.length ?? 0
  const emailLeads = data?.emailLeads?.total ?? 0
  const dripSent   = data?.emailLeads?.dripSentCount ?? 0
  const totalUsers = data?.users?.total ?? 0
  const paidCount  = data?.paidCount ?? 0
  const sparkline  = data?.scanSparkline ?? []
  const dripPct    = emailLeads > 0 ? Math.round((dripSent / emailLeads) * 100) : 0

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ScanLine size={18} className="text-indigo-500" />
                Sales Funnel
              </h1>
              <p className="text-xs text-slate-400">Free scans → Email leads → Signups → Paid customers</p>
            </div>
            <Link
              to="/admin/leads"
              className="ml-2 text-xs text-slate-400 hover:text-indigo-600 hover:underline"
            >
              Lead Capture →
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleExport}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              <Download size={14} />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">

        {error && (
          <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ── Funnel stat tiles ─────────────────────────────────────────────── */}
        <div className="flex items-stretch gap-2 mb-6">

          <StatTile
            icon={ScanLine}
            label="Free Scans"
            value={scanCount.toLocaleString()}
            sub="Total scans run"
            sparkData={sparkline}
            color={{ bg: 'bg-indigo-50', icon: 'text-indigo-500', spark: '#6366f1' }}
          />

          <div className="flex flex-col items-center justify-center px-1 gap-0.5">
            <ArrowRight size={18} className="text-slate-300" />
            <span className="text-[11px] font-semibold text-slate-400 tabular-nums">
              {convRate(emailLeads, scanCount)}
            </span>
          </div>

          <StatTile
            icon={Mail}
            label="Email Leads"
            value={emailLeads.toLocaleString()}
            sub={`${dripPct}% drip sent`}
            color={{ bg: 'bg-sky-50', icon: 'text-sky-500', spark: '#0ea5e9' }}
          />

          <div className="flex flex-col items-center justify-center px-1 gap-0.5">
            <ArrowRight size={18} className="text-slate-300" />
            <span className="text-[11px] font-semibold text-slate-400 tabular-nums">
              {convRate(totalUsers, emailLeads)}
            </span>
          </div>

          <StatTile
            icon={Users}
            label="Signups"
            value={totalUsers.toLocaleString()}
            sub="Registered users"
            color={{ bg: 'bg-emerald-50', icon: 'text-emerald-500', spark: '#10b981' }}
          />

          <div className="flex flex-col items-center justify-center px-1 gap-0.5">
            <ArrowRight size={18} className="text-slate-300" />
            <span className="text-[11px] font-semibold text-slate-400 tabular-nums">
              {convRate(paidCount, totalUsers)}
            </span>
          </div>

          <StatTile
            icon={CreditCard}
            label="Paid"
            value={paidCount.toLocaleString()}
            sub="Active subscribers"
            footnote="Connect Stripe to track billing events"
            color={{ bg: 'bg-violet-50', icon: 'text-violet-500', spark: '#8b5cf6' }}
          />
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <div className="flex gap-0 mb-4 bg-white rounded-xl border border-slate-200 p-1 w-fit">
          {[
            { key: 'daily', label: 'Daily Activity' },
            { key: 'scans', label: `Free Scans (${scanCount})` },
            { key: 'leads', label: `All Leads (${data?.leads?.length ?? 0})` },
            { key: 'users', label: `Users (${data?.users?.total ?? 0})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === key
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Loading skeleton ──────────────────────────────────────────────── */}
        {loading && !data && (
          <div className="flex items-center justify-center py-20 gap-2 text-slate-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Loading funnel data…</span>
          </div>
        )}

        {/* ── Daily Activity tab ───────────────────────────────────────────── */}
        {!loading && data && tab === 'daily' && (
          <div className="space-y-5">

            {/* Headline stats for the window */}
            <div className="grid grid-cols-3 gap-4">
              {[
                {
                  label: 'Scans (30d)',
                  value: (data.daily ?? []).reduce((s, d) => s + d.scans, 0),
                  icon: ScanLine,
                  color: 'text-indigo-600',
                  bg:    'bg-indigo-50',
                },
                {
                  label: 'Signups (30d)',
                  value: (data.daily ?? []).reduce((s, d) => s + d.signups, 0),
                  icon: Users,
                  color: 'text-emerald-600',
                  bg:    'bg-emerald-50',
                },
                {
                  label: 'Scan → Signup rate',
                  value: (() => {
                    const s = (data.daily ?? []).reduce((a, d) => a + d.scans, 0)
                    const u = (data.daily ?? []).reduce((a, d) => a + d.signups, 0)
                    return s > 0 ? `${Math.round((u / s) * 100)}%` : '—'
                  })(),
                  icon: TrendingUp,
                  color: 'text-violet-600',
                  bg:    'bg-violet-50',
                },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <div key={label} className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`p-1.5 rounded-lg ${bg}`}>
                      <Icon size={14} className={color} />
                    </div>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
                  </div>
                  <div className="text-3xl font-bold text-slate-900 tabular-nums">{value}</div>
                </div>
              ))}
            </div>

            {/* Bar chart */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">Scans &amp; Signups — Last 30 Days</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Daily new free scans vs registered signups</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-indigo-400 inline-block" />
                    Free scans
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-emerald-400 inline-block" />
                    Signups
                  </span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={data.daily ?? []}
                  margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                  barGap={2}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="day"
                    tickFormatter={d => {
                      const dt = new Date(d + 'T00:00:00')
                      return dt.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
                    }}
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    interval={4}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    labelFormatter={d => new Date(d + 'T00:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })}
                  />
                  <Bar dataKey="scans"   fill="#818cf8" radius={[3, 3, 0, 0]} name="Free scans" />
                  <Bar dataKey="signups" fill="#34d399" radius={[3, 3, 0, 0]} name="Signups" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Conversion hint */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-sm text-amber-800">
              <strong>Tip:</strong> Paid upgrade events aren't timestamped yet — install Stripe webhooks to track upgrade-by-day. The Users tab shows current subscription tiers.
            </div>
          </div>
        )}

        {/* ── Free Scans tab ────────────────────────────────────────────────── */}
        {!loading && data && tab === 'scans' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {data.freeScans.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <ScanLine size={32} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">No free scans yet</p>
                <p className="text-xs mt-1">Free scans will appear here when users run them.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-left">
                      <SortTh col="email"            label="Email"    sort={sort} onSort={handleSort} />
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Repos</th>
                      <SortTh col="estimated_credit" label="Estimate" sort={sort} onSort={handleSort} />
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Top Cluster</th>
                      <SortTh col="created_at"       label="Scanned"  sort={sort} onSort={handleSort} className="hidden md:table-cell" />
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Drip</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sortedScans(data.freeScans).map(scan => {
                      const repos      = JSON.parse(scan.repos_json    || '[]')
                      const clusters   = JSON.parse(scan.clusters_json || '[]')
                      const topCluster = clusters[0]
                      const step1Sent  = scan.drip[1]?.status === 'sent'

                      return (
                        <tr key={scan.id} className="hover:bg-slate-50 transition-colors">

                          {/* Email */}
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {scan.email
                              ? <a href={`mailto:${scan.email}`} className="hover:text-indigo-600 hover:underline">{scan.email}</a>
                              : <span className="text-slate-300">—</span>
                            }
                          </td>

                          {/* Repos */}
                          <td className="px-4 py-3 text-slate-500 max-w-[160px]">
                            <span
                              className="block text-xs truncate"
                              title={repos.map(r => String(r)).join(', ')}
                            >
                              {repos.length > 0
                                ? repos.map(r => String(r).split('/').pop()).join(', ')
                                : <span className="text-slate-300">—</span>
                              }
                            </span>
                          </td>

                          {/* Credit estimate */}
                          <td className="px-4 py-3 font-semibold text-indigo-600 whitespace-nowrap">
                            {scan.estimated_credit > 0 ? formatCredit(scan.estimated_credit) : <span className="text-slate-300 font-normal">—</span>}
                          </td>

                          {/* Top cluster */}
                          <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell max-w-[160px] truncate">
                            {topCluster
                              ? (topCluster.name || topCluster.theme || '—')
                              : <span className="text-slate-300">—</span>
                            }
                          </td>

                          {/* Scanned at */}
                          <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell whitespace-nowrap">
                            {relativeTime(scan.created_at)}
                          </td>

                          {/* Drip status */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <DripBadge step={1} dripData={scan.drip} />
                              <DripBadge step={2} dripData={scan.drip} />
                              <DripBadge step={3} dripData={scan.drip} />
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {scan.email && !step1Sent && (
                                <button
                                  onClick={() => triggerDrip(scan)}
                                  disabled={!!triggering[scan.id]}
                                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 border border-indigo-200 rounded hover:bg-indigo-50 disabled:opacity-50 whitespace-nowrap"
                                  title="Send Email 1 now"
                                >
                                  {triggering[scan.id]
                                    ? <Loader2 size={10} className="animate-spin" />
                                    : <Send size={10} />
                                  }
                                  Send now
                                </button>
                              )}
                              <Link
                                to={`/scan/results?id=${scan.id}`}
                                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 whitespace-nowrap"
                                title="View scan results"
                              >
                                <ExternalLink size={11} />
                                View
                              </Link>
                            </div>
                          </td>

                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── All Leads tab ─────────────────────────────────────────────────── */}
        {!loading && data && tab === 'leads' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {data.leads.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <Mail size={32} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">No leads yet</p>
                <p className="text-xs mt-1">Marketing leads will appear here when people submit a form.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Company</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Plan</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Source</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Captured</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.leads.map(row => (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {row.name || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <a href={`mailto:${row.email}`} className="hover:text-indigo-600 hover:underline">
                          {row.email}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                        {row.company || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <PlanBadge plan={row.plan_interest} />
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell capitalize">
                        {row.source?.replace(/_/g, ' ') || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell whitespace-nowrap">
                        {relativeTime(row.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Users tab ─────────────────────────────────────────────────────── */}
        {!loading && data && tab === 'users' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {(data.allUsers ?? []).length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <Users size={32} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">No registered users yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-left">
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Company</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Plan</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Onboarded</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Signed up</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(data.allUsers ?? []).map(user => {
                      const tier   = user.subscription_tier ?? 'free'
                      const isPaid = !['free', ''].includes(tier)
                      const tierColors = {
                        free:       'bg-slate-100 text-slate-500',
                        starter:    'bg-blue-50 text-blue-700',
                        plus:       'bg-indigo-50 text-indigo-700',
                        enterprise: 'bg-violet-50 text-violet-700',
                      }
                      return (
                        <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900 truncate max-w-[180px]">
                              {user.full_name || <span className="text-slate-400">—</span>}
                            </div>
                            <div className="text-xs text-slate-400 truncate max-w-[180px]">
                              <a href={`mailto:${user.email}`} className="hover:text-indigo-600 hover:underline">
                                {user.email}
                              </a>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-xs truncate max-w-[140px]">
                            {user.firm_name || <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${tierColors[tier] ?? 'bg-slate-100 text-slate-600'}`}>
                              {tier}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            {user.onboarding_completed
                              ? <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 size={12} /> Done</span>
                              : <span className="flex items-center gap-1 text-xs text-amber-500"><Clock size={12} /> Pending</span>
                            }
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell whitespace-nowrap">
                            {relativeTime(user.created_at)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

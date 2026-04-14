/**
 * Admin Sales CRM  —  /admin/sales
 *
 * Shows every registered user ranked by lead score (credit estimate ×
 * activity × plan). Gives the founder a daily "call list" — who to reach
 * out to, why, and a one-click mailto link.
 */
import { useState, useEffect, useMemo } from 'react'
import { Mail, RefreshCw, TrendingUp, Users, DollarSign, Zap, ChevronUp, ChevronDown } from 'lucide-react'
import { apiFetch } from '../lib/api'
import Card, { CardHeader } from '../components/ui/Card'

const TIER_BADGE = {
  free:       'bg-gray-100 text-gray-600',
  starter:    'bg-indigo-100 text-indigo-700',
  plus:       'bg-violet-100 text-violet-700',
  enterprise: 'bg-amber-100 text-amber-700',
}

function fmt(n) {
  if (!n) return '—'
  return '$' + Number(n).toLocaleString('en-CA', { maximumFractionDigits: 0 })
}

function ScoreDot({ score }) {
  const colour = score >= 60 ? 'bg-red-500' : score >= 35 ? 'bg-amber-400' : 'bg-gray-300'
  return <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${colour}`} title={`Lead score: ${score}`} />
}

function SortBtn({ field, current, dir, onClick }) {
  const active = current === field
  return (
    <button onClick={() => onClick(field)} className="flex items-center gap-0.5 hover:text-indigo-600 transition-colors">
      {active && dir === 'asc'  && <ChevronUp   size={11} className="text-indigo-500" />}
      {active && dir === 'desc' && <ChevronDown  size={11} className="text-indigo-500" />}
      {!active && <ChevronDown size={11} className="text-gray-300" />}
    </button>
  )
}

export default function AdminSalesPage() {
  const [rows,     setRows]     = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [sortBy,   setSortBy]   = useState('lead_score')
  const [sortDir,  setSortDir]  = useState('desc')
  const [filter,   setFilter]   = useState('all')   // all | free | paid
  const [search,   setSearch]   = useState('')

  async function load() {
    setLoading(true); setError(null)
    try {
      const data = await apiFetch('/api/v1/admin/sales')
      setRows(data.users ?? [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  function toggleSort(field) {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(field); setSortDir('desc') }
  }

  const filtered = useMemo(() => {
    let r = rows
    if (filter === 'free') r = r.filter(u => u.subscription_tier === 'free')
    if (filter === 'paid') r = r.filter(u => u.subscription_tier !== 'free')
    if (search) {
      const q = search.toLowerCase()
      r = r.filter(u =>
        u.email?.toLowerCase().includes(q) ||
        u.full_name?.toLowerCase().includes(q) ||
        u.firm_name?.toLowerCase().includes(q)
      )
    }
    return [...r].sort((a, b) => {
      const av = a[sortBy] ?? 0, bv = b[sortBy] ?? 0
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })
  }, [rows, filter, search, sortBy, sortDir])

  // Summary stats
  const stats = useMemo(() => ({
    total:      rows.length,
    paid:       rows.filter(u => u.subscription_tier !== 'free').length,
    hotLeads:   rows.filter(u => u.lead_score >= 60 && u.subscription_tier === 'free').length,
    totalCredit: rows.reduce((s, u) => s + (u.credit_estimate || 0), 0),
  }), [rows])

  function mailtoLink(u) {
    const credit = u.credit_estimate ? fmt(u.credit_estimate) : 'significant SR&ED credits'
    const sub = encodeURIComponent(`Your TaxLift SR&ED estimate`)
    const body = encodeURIComponent(
      `Hi ${(u.full_name || u.email).split(' ')[0]},\n\n` +
      `I noticed you signed up for TaxLift — based on your profile, you may qualify for ${credit} in SR&ED credits this year.\n\n` +
      `I'd love to walk you through the next steps. Do you have 15 minutes this week?\n\n` +
      `— Prateek\nTaxLift AI\nhello@taxlift.ai`
    )
    return `mailto:${u.email}?subject=${sub}&body=${body}`
  }

  const COLS = [
    { key: 'lead_score',       label: 'Score',    sortable: true  },
    { key: 'email',            label: 'User',     sortable: false },
    { key: 'subscription_tier',label: 'Plan',     sortable: true  },
    { key: 'credit_estimate',  label: 'Est. Credit', sortable: true },
    { key: 'cluster_count',    label: 'Clusters', sortable: true  },
    { key: 'days_since_signup',label: 'Days old', sortable: true  },
    { key: 'action',           label: '',         sortable: false },
  ]

  return (
    <div className="space-y-5">

      {/* Summary strip */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { icon: Users,      label: 'Total users',    value: stats.total },
          { icon: Zap,        label: 'Paid',           value: stats.paid },
          { icon: TrendingUp, label: '🔥 Hot leads',   value: stats.hotLeads },
          { icon: DollarSign, label: 'Pipeline value', value: fmt(stats.totalCredit) },
        ].map(({ icon: Icon, label, value }) => (
          <Card key={label} className="!p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <Icon size={15} className="text-indigo-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-xl font-bold text-gray-900">{value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex items-center gap-4 mb-5">
          <CardHeader title="Sales Pipeline" subtitle="Ranked by lead score — red dots = call today" />
          <div className="ml-auto flex items-center gap-2">
            {/* Filter tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {[['all','All'],['free','Free'],['paid','Paid']].map(([v,l]) => (
                <button
                  key={v}
                  onClick={() => setFilter(v)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    filter === v ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <input
              type="text" placeholder="Search…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-40"
            />
            <button onClick={load} disabled={loading} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                {COLS.map(col => (
                  <th key={col.key} className="text-left px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">
                    <div className="flex items-center gap-1">
                      {col.label}
                      {col.sortable && <SortBtn field={col.key} current={sortBy} dir={sortDir} onClick={toggleSort} />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={COLS.length} className="text-center py-10 text-gray-400">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={COLS.length} className="text-center py-10 text-gray-400">No users found</td></tr>
              ) : filtered.map(u => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  {/* Score */}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <ScoreDot score={u.lead_score} />
                      <span className="font-bold text-gray-800">{u.lead_score}</span>
                    </div>
                  </td>
                  {/* User */}
                  <td className="px-3 py-3 max-w-[220px]">
                    <p className="font-medium text-gray-900 truncate">{u.full_name || u.email}</p>
                    <p className="text-gray-400 truncate">{u.full_name ? u.email : u.firm_name}</p>
                    {u.province && <p className="text-gray-400">{u.industry_domain} · {u.province}</p>}
                  </td>
                  {/* Plan */}
                  <td className="px-3 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${TIER_BADGE[u.subscription_tier] ?? TIER_BADGE.free}`}>
                      {u.subscription_tier ?? 'free'}
                    </span>
                    {u.subscribed_at && (
                      <p className="text-gray-400 mt-0.5">since {new Date(u.subscribed_at).toLocaleDateString('en-CA', { month: 'short', year: 'numeric' })}</p>
                    )}
                  </td>
                  {/* Credit estimate */}
                  <td className="px-3 py-3">
                    <span className={`font-semibold ${u.credit_estimate >= 50000 ? 'text-green-700' : 'text-gray-700'}`}>
                      {fmt(u.credit_estimate)}
                    </span>
                  </td>
                  {/* Clusters */}
                  <td className="px-3 py-3 text-gray-700">
                    {u.cluster_count > 0
                      ? <span>{u.cluster_count} total · <span className="text-green-700">{u.approved_count} approved</span></span>
                      : <span className="text-gray-400">none yet</span>
                    }
                  </td>
                  {/* Days old */}
                  <td className="px-3 py-3 text-gray-500">
                    {u.days_since_signup != null ? `${u.days_since_signup}d` : '—'}
                  </td>
                  {/* Action */}
                  <td className="px-3 py-3">
                    <a
                      href={mailtoLink(u)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-semibold transition-colors"
                    >
                      <Mail size={11} /> Email
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[10px] text-gray-400 mt-4">
          Lead score = credit estimate (40 pts max) + cluster activity (35 pts) + onboarding (10 pts) + upgrade opportunity (5 pts).
          Red dot ≥ 60, amber ≥ 35.
        </p>
      </Card>
    </div>
  )
}

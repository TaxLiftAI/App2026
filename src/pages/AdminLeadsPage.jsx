/**
 * AdminLeadsPage — /admin/leads
 *
 * Sales intelligence view. Shows every captured lead enriched with:
 *   - SR&ED credit estimate from their free scan
 *   - Heat score (🔥 Hot ≥ $150K, Warm $50K–$150K, Cold < $50K / no scan)
 *   - One-click outreach mailto with personalised subject + body
 *   - Summary stats: total leads, scan leads, hot leads ($100K+), top estimate
 *
 * Default sort: credit estimate descending (highest-value leads first).
 */
import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, Download, RefreshCw, Search, Users, Loader2,
  ChevronLeft, ChevronRight, Flame, TrendingUp, Mail,
  BarChart3, Zap, Filter,
} from 'lucide-react'
import { leads as leadsApi, BASE_URL, token } from '../lib/api'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtK(n) {
  const v = Number(n) || 0
  if (!v) return '—'
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `$${Math.round(v / 1_000)}K`
  return `$${Math.round(v).toLocaleString('en-CA')}`
}

function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-CA', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  } catch { return iso }
}

// ── Heat score ────────────────────────────────────────────────────────────────
function heatScore(credit) {
  const v = Number(credit) || 0
  if (v >= 150_000) return 'hot'
  if (v >= 50_000)  return 'warm'
  return 'cold'
}

const HEAT_CONFIG = {
  hot:  { label: 'Hot',  bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    dot: 'bg-red-500'    },
  warm: { label: 'Warm', bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  dot: 'bg-amber-400'  },
  cold: { label: '',     bg: '',              text: 'text-slate-400',  border: '',                  dot: 'bg-slate-200'  },
}

function HeatBadge({ credit }) {
  const heat = heatScore(credit)
  const cfg  = HEAT_CONFIG[heat]
  if (heat === 'cold') return null
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

// ── Plan badge ────────────────────────────────────────────────────────────────
function PlanBadge({ plan }) {
  const colors = {
    starter:    'bg-blue-50   text-blue-700   border-blue-100',
    plus:       'bg-indigo-50 text-indigo-700 border-indigo-100',
    growth:     'bg-indigo-50 text-indigo-700 border-indigo-100',
    enterprise: 'bg-violet-50 text-violet-700 border-violet-100',
    free_scan:  'bg-emerald-50 text-emerald-700 border-emerald-100',
  }
  if (!plan) return <span className="text-slate-400 text-xs">—</span>
  const key = plan.toLowerCase().replace(/\s+/g, '_')
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize border ${colors[key] ?? 'bg-slate-100 text-slate-600 border-slate-100'}`}>
      {plan.replace(/_/g, ' ')}
    </span>
  )
}

// ── Source badge ──────────────────────────────────────────────────────────────
function SourceBadge({ source }) {
  if (source === 'free_scan') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full px-1.5 py-0.5">
        <Zap size={9} /> Scan
      </span>
    )
  }
  return <span className="text-slate-400 text-xs capitalize">{source?.replace(/_/g, ' ') || '—'}</span>
}

// ── Outreach email builder ────────────────────────────────────────────────────
function buildOutreachMailto(row) {
  const name     = row.name || 'there'
  const firstName = name.split(' ')[0]
  const company  = row.company || 'your company'
  const credit   = Number(row.estimated_credit) || 0
  const clusters = Number(row.cluster_count)    || 0

  let subject, body

  if (credit >= 50_000) {
    const low  = fmtK(Math.round(credit * 0.65))
    const high = fmtK(Math.round(credit * 1.35))
    subject = `Your SR&ED scan: ${low}–${high} in estimated credits`
    body = `Hi ${firstName},

I noticed you ran a free SR&ED scan for ${company} on TaxLift — your results showed ${low}–${high} in potential refundable ITC across ${clusters} qualifying activity cluster${clusters !== 1 ? 's' : ''}.

That\u2019s a meaningful amount of cash back, and the process to claim it is simpler than most founders expect: connect GitHub/Jira, review the AI-generated T661 narratives, and hand off to your CPA. The whole thing takes about 2 hours of your time per year.

I\u2019d love to walk you through what the full package looks like for ${company} — 15 minutes, no pitch, just showing you the output. Would any time this week work?

[Your calendar link]

Best,
[Your name]
TaxLift
hello@taxlift.ai`
  } else {
    subject = `Following up on your TaxLift interest`
    body = `Hi ${firstName},

Thanks for your interest in TaxLift — wanted to personally reach out to see if you have questions about how SR&ED works for ${company}.

A lot of Canadian tech companies are leaving significant refundable credits on the table simply because the documentation process feels overwhelming. TaxLift makes it automatic — connect your GitHub/Jira, we generate everything, your CPA files.

Happy to answer any questions or show you a quick demo. Would any time this week work?

Best,
[Your name]
TaxLift
hello@taxlift.ai`
  }

  return `mailto:${row.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

// ── Filter options ────────────────────────────────────────────────────────────
const PLAN_OPTIONS = [
  { value: '',           label: 'All plans'    },
  { value: 'starter',   label: 'Starter'      },
  { value: 'plus',      label: 'Plus'         },
  { value: 'enterprise', label: 'Enterprise'  },
]

const SOURCE_OPTIONS = [
  { value: '',           label: 'All sources'  },
  { value: 'free_scan',  label: 'Free scan'    },
  { value: 'hero',       label: 'Hero'         },
  { value: 'navbar',     label: 'Navbar'       },
  { value: 'pricing',    label: 'Pricing'      },
  { value: 'cpa_section', label: 'CPA section' },
  { value: 'cta_band',   label: 'CTA band'     },
  { value: 'cancel_page', label: 'Cancel page' },
  { value: 'marketing',  label: 'Marketing'    },
]

const MIN_CREDIT_OPTIONS = [
  { value: '',       label: 'Any credit'  },
  { value: '50000',  label: '$50K+'       },
  { value: '100000', label: '$100K+'      },
  { value: '200000', label: '$200K+'      },
  { value: '500000', label: '$500K+'      },
]

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = 'indigo' }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600',
    red:    'bg-red-50    text-red-600',
    emerald:'bg-emerald-50 text-emerald-600',
    amber:  'bg-amber-50  text-amber-600',
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-slate-900 leading-none">{value}</p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminLeadsPage() {
  const [rows,    setRows]    = useState([])
  const [total,   setTotal]   = useState(0)
  const [stats,   setStats]   = useState(null)
  const [page,    setPage]    = useState(1)
  const [pages,   setPages]   = useState(1)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const [search,    setSearch]    = useState('')
  const [plan,      setPlan]      = useState('')
  const [source,    setSource]    = useState('')
  const [minCredit, setMinCredit] = useState('')
  const [sort,      setSort]      = useState('credit')

  const limit = 25

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await leadsApi.list({
        page,
        limit,
        search:     search     || undefined,
        plan:       plan       || undefined,
        source:     source     || undefined,
        min_credit: minCredit  || undefined,
        sort,
      })
      setRows(data.leads   ?? [])
      setTotal(data.total  ?? 0)
      setPages(data.pages  ?? 1)
      setStats(data.stats  ?? null)
    } catch (err) {
      setError(err?.message ?? 'Failed to load leads')
    } finally {
      setLoading(false)
    }
  }, [page, search, plan, source, minCredit, sort])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  function applyFilter(setter) {
    return (val) => { setter(val); setPage(1) }
  }

  function handleExport() {
    const tok = token.get()
    const url = `${BASE_URL}/api/leads/export`
    setLoading(true)
    fetch(url, { headers: tok ? { Authorization: `Bearer ${tok}` } : {} })
      .then(r => r.blob())
      .then(blob => {
        const href = URL.createObjectURL(blob)
        const a    = document.createElement('a')
        a.href     = href
        a.download = `taxlift-leads-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(href)
      })
      .catch(() => setError('CSV export failed'))
      .finally(() => setLoading(false))
  }

  const hotLeads  = stats?.hot_leads  ?? 0
  const scanLeads = stats?.scan_leads ?? 0
  const topCredit = stats?.top_credit ?? 0

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Users size={18} className="text-indigo-500" />
                Lead Intelligence
              </h1>
              <p className="text-xs text-slate-400">Sorted by SR&ED credit estimate — highest value first</p>
            </div>
            <Link to="/admin/funnel" className="ml-2 text-xs text-slate-400 hover:text-indigo-600 hover:underline hidden sm:block">
              ← Sales Funnel
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 font-medium">{total.toLocaleString()} leads</span>
            <button
              onClick={fetchLeads}
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
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">

        {/* ── Stats row ───────────────────────────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={Users}     label="Total leads"        value={total.toLocaleString()}  color="indigo" />
            <StatCard icon={Zap}       label="Free scan leads"    value={scanLeads.toLocaleString()} sub="connected GitHub"  color="emerald" />
            <StatCard icon={Flame}     label="Hot leads ($100K+)" value={hotLeads.toLocaleString()} sub="priority outreach" color="red" />
            <StatCard icon={TrendingUp} label="Top estimate"      value={fmtK(topCredit)}         sub="single lead"       color="amber" />
          </div>
        )}

        {/* ── Filters ─────────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="flex-1 min-w-48 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search email, name, company…"
              value={search}
              onChange={e => applyFilter(setSearch)(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
            />
          </div>
          <select value={minCredit} onChange={e => applyFilter(setMinCredit)(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-indigo-400 bg-white">
            {MIN_CREDIT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={plan} onChange={e => applyFilter(setPlan)(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-indigo-400 bg-white">
            {PLAN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={source} onChange={e => applyFilter(setSource)(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-indigo-400 bg-white">
            {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div className="flex items-center gap-1 border border-slate-200 rounded-lg overflow-hidden text-sm">
            <span className="pl-3 text-slate-400 flex items-center gap-1 text-xs whitespace-nowrap"><Filter size={11} /> Sort:</span>
            <button onClick={() => applyFilter(setSort)('credit')}
              className={`px-3 py-2 font-medium transition-colors ${sort === 'credit' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
              Credit ↓
            </button>
            <button onClick={() => applyFilter(setSort)('date')}
              className={`px-3 py-2 font-medium transition-colors ${sort === 'date' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
              Date ↓
            </button>
          </div>
        </div>

        {/* ── Error ───────────────────────────────────────────────────────────── */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ── Table ───────────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading && rows.length === 0 ? (
            <div className="flex items-center justify-center py-20 gap-2 text-slate-400">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading leads…</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <Users size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">No leads match your filters</p>
              <p className="text-xs mt-1">Try adjusting the credit filter or search query.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left bg-slate-50">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Lead</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <span className="flex items-center gap-1"><BarChart3 size={11} /> Credit Est.</span>
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Plan</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Source</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Captured</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Outreach</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map(row => {
                  const heat   = heatScore(row.estimated_credit)
                  const hasCredit = Number(row.estimated_credit) > 0
                  const rowHighlight = heat === 'hot'
                    ? 'bg-red-50/30 hover:bg-red-50/60'
                    : heat === 'warm'
                      ? 'hover:bg-amber-50/40'
                      : 'hover:bg-slate-50'

                  return (
                    <tr key={row.id} className={`transition-colors ${rowHighlight}`}>

                      {/* Lead identity */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {heat === 'hot' && <Flame size={13} className="text-red-500 flex-shrink-0" />}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium text-slate-900 text-sm">
                                {row.name || <span className="text-slate-400 font-normal italic text-xs">No name</span>}
                              </span>
                              <HeatBadge credit={row.estimated_credit} />
                            </div>
                            <a
                              href={`mailto:${row.email}`}
                              className="text-xs text-indigo-600 hover:underline block truncate max-w-xs"
                            >
                              {row.email}
                            </a>
                            {row.company && (
                              <p className="text-[11px] text-slate-400 truncate max-w-xs">{row.company}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Credit estimate */}
                      <td className="px-4 py-3">
                        {hasCredit ? (
                          <div>
                            <p className={`font-bold tabular-nums text-sm ${heat === 'hot' ? 'text-red-700' : heat === 'warm' ? 'text-amber-700' : 'text-slate-700'}`}>
                              {fmtK(row.estimated_credit)}
                            </p>
                            {row.cluster_count > 0 && (
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {row.cluster_count} cluster{row.cluster_count !== 1 ? 's' : ''}
                                {row.commit_count > 0 ? ` · ${row.commit_count} commits` : ''}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 text-sm">—</span>
                        )}
                      </td>

                      {/* Plan */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        <PlanBadge plan={row.plan_interest} />
                      </td>

                      {/* Source */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <SourceBadge source={row.source} />
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell whitespace-nowrap">
                        {formatDate(row.created_at)}
                        {row.scanned_at && row.scanned_at !== row.created_at && (
                          <p className="text-[10px] text-indigo-400 mt-0.5">
                            Scanned {formatDate(row.scanned_at)}
                          </p>
                        )}
                      </td>

                      {/* Outreach */}
                      <td className="px-4 py-3">
                        <a
                          href={buildOutreachMailto(row)}
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                            heat === 'hot'
                              ? 'bg-red-600 hover:bg-red-700 text-white'
                              : heat === 'warm'
                                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                                : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                          title={`Send personalised outreach to ${row.email}`}
                        >
                          <Mail size={12} />
                          {heat === 'hot' ? 'Reach out now' : heat === 'warm' ? 'Follow up' : 'Email'}
                        </a>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Pagination ──────────────────────────────────────────────────────── */}
        {pages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Page {page} of {pages} · {total} leads
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(pages, p + 1))}
                disabled={page >= pages || loading}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

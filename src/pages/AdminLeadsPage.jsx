/**
 * AdminLeadsPage — admin-only view of captured marketing leads.
 * Route: /admin/leads  (protected, role = 'admin')
 *
 * Features:
 *  - Searchable / filterable table (plan, source)
 *  - Pagination
 *  - CSV export button (direct link to server endpoint)
 */
import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, Download, RefreshCw, Search, Users, Loader2,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { leads as leadsApi, BASE_URL, token } from '../lib/api'

const PLAN_OPTIONS = [
  { value: '',           label: 'All plans'    },
  { value: 'starter',   label: 'Starter'      },
  { value: 'growth',    label: 'Growth'       },
  { value: 'enterprise', label: 'Enterprise'  },
]

const SOURCE_OPTIONS = [
  { value: '',          label: 'All sources' },
  { value: 'hero',      label: 'Hero'        },
  { value: 'navbar',    label: 'Navbar'      },
  { value: 'pricing',   label: 'Pricing'     },
  { value: 'cpa_section', label: 'CPA section' },
  { value: 'cta_band',  label: 'CTA band'    },
  { value: 'cancel_page', label: 'Cancel page' },
  { value: 'marketing', label: 'Marketing'   },
]

function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-CA', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function PlanBadge({ plan }) {
  const colors = {
    starter:    'bg-blue-50   text-blue-700',
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

export default function AdminLeadsPage() {
  const [rows,    setRows]    = useState([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [pages,   setPages]   = useState(1)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const [search, setSearch]   = useState('')
  const [plan,   setPlan]     = useState('')
  const [source, setSource]   = useState('')

  const limit = 25

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await leadsApi.list({ page, limit, search: search || undefined, plan: plan || undefined, source: source || undefined })
      setRows(data.leads ?? [])
      setTotal(data.total ?? 0)
      setPages(data.pages ?? 1)
    } catch (err) {
      setError(err?.message ?? 'Failed to load leads')
    } finally {
      setLoading(false)
    }
  }, [page, search, plan, source])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  // Reset page when filters change
  function applyFilter(setter) {
    return (val) => {
      setter(val)
      setPage(1)
    }
  }

  // CSV export URL with auth header won't work natively — use a form POST trick
  function handleExport() {
    const tok = token.get()
    const url = `${BASE_URL}/api/leads/export`
    // Build a temporary anchor with Authorization injected via a fetch → blob → object URL
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

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Users size={18} className="text-indigo-500" />
                Lead Capture
              </h1>
              <p className="text-xs text-slate-400">Marketing leads from the TaxLift website</p>
            </div>
            <Link
              to="/admin/funnel"
              className="ml-2 text-xs text-slate-400 hover:text-indigo-600 hover:underline"
            >
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
              <Download size={14} />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search email, name, company…"
              value={search}
              onChange={e => applyFilter(setSearch)(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
            />
          </div>
          <select
            value={plan}
            onChange={e => applyFilter(setPlan)(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-indigo-400 bg-white"
          >
            {PLAN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            value={source}
            onChange={e => applyFilter(setSource)(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-indigo-400 bg-white"
          >
            {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading && rows.length === 0 ? (
            <div className="flex items-center justify-center py-20 gap-2 text-slate-400">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading leads…</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <Users size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">No leads yet</p>
              <p className="text-xs mt-1">Leads will appear here when people submit the waitlist form.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left bg-slate-50">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Company</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Plan</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Source</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map(row => (
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
                      {formatDate(row.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-slate-400">
              Page {page} of {pages} · {total} total leads
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

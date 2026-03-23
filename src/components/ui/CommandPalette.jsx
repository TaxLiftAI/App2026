import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, LayoutDashboard, GitMerge, BarChart3, Users, ScrollText,
  Plug, DollarSign, UserCircle2, SlidersHorizontal, TrendingUp,
  Activity, ShieldAlert, Vault, FileText, File, FileSpreadsheet,
  Image, FileCode, Archive, ArrowRight, Clock, X, HelpCircle,
} from 'lucide-react'
import { CLUSTERS, DOCUMENTS, USERS } from '../../data/mockData'
import { useAuth } from '../../context/AuthContext'
import { canDo } from '../../lib/utils'

// ─── Nav pages searchable ─────────────────────────────────────────────────────
const PAGES = [
  { label: 'Dashboard',          href: '/dashboard',       icon: LayoutDashboard, action: null             },
  { label: 'Activity Clusters',  href: '/clusters',        icon: GitMerge,        action: 'viewClusters'   },
  { label: 'Financial Reports',  href: '/reports',         icon: BarChart3,       action: 'viewReports'    },
  { label: 'User Management',    href: '/users',           icon: Users,           action: 'viewUsers'      },
  { label: 'Audit Log',          href: '/audit-log',       icon: ScrollText,      action: 'viewAuditLog'   },
  { label: 'Integrations',       href: '/integrations',    icon: Plug,            action: 'viewIntegrations'},
  { label: 'Rate Card',          href: '/rate-card',       icon: DollarSign,      action: 'viewRateCard'   },
  { label: 'My Portal',          href: '/dev-portal',      icon: UserCircle2,     action: 'viewDevPortal'  },
  { label: 'Heuristics',         href: '/heuristics',      icon: SlidersHorizontal,action: 'viewHeuristics'},
  { label: 'Analytics',          href: '/analytics',       icon: TrendingUp,      action: 'viewAnalytics'  },
  { label: 'Activity Log',       href: '/activity',        icon: Activity,        action: 'viewActivity'   },
  { label: 'Audit Readiness',    href: '/audit-readiness', icon: ShieldAlert,     action: 'viewAuditReadiness'},
  { label: 'Document Vault',     href: '/vault',           icon: Vault,           action: 'viewVault'      },
  { label: 'SR&ED Eligibility Quiz', href: '/quiz',        icon: HelpCircle,      action: null             },
]

// ─── File type icons ──────────────────────────────────────────────────────────
const FILE_ICONS = {
  pdf: FileText, docx: FileText, xlsx: FileSpreadsheet,
  png: Image, csv: FileText, zip: Archive, json: FileCode,
}
const FILE_COLORS = {
  pdf: 'text-red-400', docx: 'text-blue-400', xlsx: 'text-green-400',
  png: 'text-purple-400', csv: 'text-teal-400', zip: 'text-gray-400', json: 'text-orange-400',
}

// ─── Status dot colors ────────────────────────────────────────────────────────
const STATUS_DOT = {
  New: 'bg-gray-400', Interviewed: 'bg-blue-400', Drafted: 'bg-amber-400',
  Approved: 'bg-green-400', Rejected: 'bg-red-400', Merged: 'bg-slate-400',
}

// ─── Highlight matching text ──────────────────────────────────────────────────
function Highlight({ text, query }) {
  if (!query || !text) return <span>{text}</span>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <span>{text}</span>
  return (
    <span>
      {text.slice(0, idx)}
      <mark className="bg-indigo-100 text-indigo-700 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </span>
  )
}

// ─── Result item ──────────────────────────────────────────────────────────────
function ResultItem({ icon: Icon, iconClass = 'text-gray-400', title, subtitle, badge, badgeDot, active, onClick }) {
  const ref = useRef(null)
  useEffect(() => { if (active) ref.current?.scrollIntoView({ block: 'nearest' }) }, [active])
  return (
    <div
      ref={ref}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${active ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
    >
      <div className={`flex-shrink-0 ${iconClass}`}>
        <Icon size={15} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${active ? 'text-indigo-700 font-medium' : 'text-gray-800'}`}>{title}</p>
        {subtitle && <p className="text-[11px] text-gray-400 truncate mt-0.5">{subtitle}</p>}
      </div>
      {badge && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {badgeDot && <span className={`w-1.5 h-1.5 rounded-full ${badgeDot}`} />}
          <span className="text-[10px] text-gray-400">{badge}</span>
        </div>
      )}
      {active && <ArrowRight size={12} className="text-indigo-400 flex-shrink-0" />}
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ label, count }) {
  return (
    <div className="flex items-center justify-between px-4 py-1.5 bg-gray-50 border-y border-gray-100">
      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
      <span className="text-[10px] text-gray-300">{count}</span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CommandPalette({ open, onClose }) {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [query, setQuery]   = useState('')
  const [cursor, setCursor] = useState(0)

  // Focus input on open, reset query
  useEffect(() => {
    if (open) {
      setQuery('')
      setCursor(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  // Build result sections
  const { pages, clusters, documents, users, total } = useMemo(() => {
    const q = query.toLowerCase().trim()

    const pages = PAGES
      .filter(p => p.action === null || canDo(p.action, currentUser?.role))
      .filter(p => !q || p.label.toLowerCase().includes(q))
      .slice(0, 5)

    const clusters = CLUSTERS
      .filter(c => !q || c.name.toLowerCase().includes(q) ||
                   c.tech_stack?.some(t => t.toLowerCase().includes(q)) ||
                   c.status.toLowerCase().includes(q))
      .slice(0, 6)

    const documents = DOCUMENTS
      .filter(d => !q || d.name.toLowerCase().includes(q) ||
                   d.tag.toLowerCase().includes(q) ||
                   (d.cluster_name ?? '').toLowerCase().includes(q))
      .slice(0, 4)

    const users = canDo('viewUsers', currentUser?.role)
      ? USERS.filter(u => !q || u.display_name.toLowerCase().includes(q) ||
                           u.email.toLowerCase().includes(q) ||
                           u.role.toLowerCase().includes(q)).slice(0, 3)
      : []

    const total = pages.length + clusters.length + documents.length + users.length
    return { pages, clusters, documents, users, total }
  }, [query, currentUser])

  // Flatten for keyboard nav
  const flat = useMemo(() => [
    ...pages.map(p => ({ type: 'page', data: p })),
    ...clusters.map(c => ({ type: 'cluster', data: c })),
    ...documents.map(d => ({ type: 'doc', data: d })),
    ...users.map(u => ({ type: 'user', data: u })),
  ], [pages, clusters, documents, users])

  const clampedCursor = Math.min(cursor, Math.max(0, flat.length - 1))

  function navigate_to(href) {
    onClose()
    navigate(href)
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor(c => Math.min(c + 1, flat.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor(c => Math.max(c - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = flat[clampedCursor]
      if (!item) return
      if (item.type === 'page')    navigate_to(item.data.href)
      if (item.type === 'cluster') navigate_to(`/clusters/${item.data.id}`)
      if (item.type === 'doc')     navigate_to(item.data.cluster_id ? `/clusters/${item.data.cluster_id}` : '/vault')
      if (item.type === 'user')    navigate_to('/users')
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  // Reset cursor on query change
  useEffect(() => { setCursor(0) }, [query])

  if (!open) return null

  // Global cursor offset helpers
  let offset = 0
  const pageOffset = offset; offset += pages.length
  const clusterOffset = offset; offset += clusters.length
  const docOffset = offset; offset += documents.length
  const userOffset = offset

  const isEmpty = total === 0

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-xl mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
          <Search size={16} className="text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, clusters, files, users…"
            className="flex-1 text-sm text-gray-900 placeholder-gray-400 bg-transparent outline-none"
          />
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {query && (
              <button onClick={() => setQuery('')} className="p-1 rounded hover:bg-gray-100 text-gray-400">
                <X size={12} />
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-100 text-gray-400 text-[10px] rounded font-mono">
              esc
            </kbd>
          </div>
        </div>

        {/* Results */}
        <div className="overflow-y-auto" style={{ maxHeight: '60vh' }}>
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Search size={24} className="text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">No results for <span className="font-medium text-gray-600">"{query}"</span></p>
              <p className="text-xs text-gray-300 mt-1">Try a cluster name, file, or page</p>
            </div>
          ) : (
            <>
              {/* Pages */}
              {pages.length > 0 && (
                <>
                  <SectionHeader label="Pages" count={pages.length} />
                  {pages.map((p, i) => (
                    <ResultItem
                      key={p.href}
                      icon={p.icon}
                      iconClass="text-gray-400"
                      title={<Highlight text={p.label} query={query} />}
                      active={clampedCursor === pageOffset + i}
                      onClick={() => navigate_to(p.href)}
                    />
                  ))}
                </>
              )}

              {/* Clusters */}
              {clusters.length > 0 && (
                <>
                  <SectionHeader label="Clusters" count={clusters.length} />
                  {clusters.map((c, i) => (
                    <ResultItem
                      key={c.id}
                      icon={GitMerge}
                      iconClass="text-indigo-400"
                      title={<Highlight text={c.name} query={query} />}
                      subtitle={c.tech_stack?.slice(0, 3).join(' · ')}
                      badge={c.status}
                      badgeDot={STATUS_DOT[c.status]}
                      active={clampedCursor === clusterOffset + i}
                      onClick={() => navigate_to(`/clusters/${c.id}`)}
                    />
                  ))}
                </>
              )}

              {/* Documents */}
              {documents.length > 0 && (
                <>
                  <SectionHeader label="Documents" count={documents.length} />
                  {documents.map((d, i) => {
                    const Icon = FILE_ICONS[d.type] ?? File
                    return (
                      <ResultItem
                        key={d.id}
                        icon={Icon}
                        iconClass={FILE_COLORS[d.type] ?? 'text-gray-400'}
                        title={<Highlight text={d.name} query={query} />}
                        subtitle={d.cluster_name ?? 'Unlinked'}
                        badge={`v${d.version} · ${d.type.toUpperCase()}`}
                        active={clampedCursor === docOffset + i}
                        onClick={() => navigate_to(d.cluster_id ? `/clusters/${d.cluster_id}` : '/vault')}
                      />
                    )
                  })}
                </>
              )}

              {/* Users */}
              {users.length > 0 && (
                <>
                  <SectionHeader label="Users" count={users.length} />
                  {users.map((u, i) => (
                    <ResultItem
                      key={u.id}
                      icon={Users}
                      iconClass="text-purple-400"
                      title={<Highlight text={u.display_name} query={query} />}
                      subtitle={u.email}
                      badge={u.role}
                      active={clampedCursor === userOffset + i}
                      onClick={() => navigate_to('/users')}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 bg-gray-50/60">
          <div className="flex items-center gap-3 text-[10px] text-gray-400">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-gray-200 rounded text-gray-500 font-mono">↑↓</kbd> navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-gray-200 rounded text-gray-500 font-mono">↵</kbd> open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-gray-200 rounded text-gray-500 font-mono">esc</kbd> close
            </span>
          </div>
          {total > 0 && (
            <span className="text-[10px] text-gray-400">{total} result{total !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>
    </div>
  )
}

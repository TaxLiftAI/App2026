import { useState, useMemo } from 'react'
import {
  Shield, Search, Download, Filter, GitMerge, FileText,
  UserCheck, AlertCircle, Database, Key, BarChart2, Settings,
  CheckCircle2, XCircle, Upload, Cpu, Eye,
} from 'lucide-react'
import { AUDIT_LOG, USERS } from '../data/mockData'
import { formatDateTime, formatDate } from '../lib/utils'
import Card from '../components/ui/Card'

// ── Extended activity entries ─────────────────────────────────────────────────
const EXTRA_LOG = [
  { id: 'al-021', tenant_id: 'tenant-acme', user_id: 'u-001', action_type: 'HEURISTIC_CONFIG_SAVED', resource_type: 'heuristic_config', resource_id: 'rule-v2.1', old_value: { version: 'rule-v2.0' }, new_value: { version: 'rule-v2.1', note: 'Added CrossTeamDependency heuristic' }, ip_address: '203.0.113.10', user_agent: 'Mozilla/5.0', timestamp: '2026-03-01T10:30:00Z', signature: 'hmac-021' },
  { id: 'al-022', tenant_id: 'tenant-acme', user_id: 'u-002', action_type: 'CLUSTER_STATUS_CHANGED', resource_type: 'cluster', resource_id: 'clus-005', old_value: { status: 'New' }, new_value: { status: 'Interviewed' }, ip_address: '203.0.113.42', user_agent: 'Mozilla/5.0', timestamp: '2026-03-02T09:15:00Z', signature: 'hmac-022' },
  { id: 'al-023', tenant_id: 'tenant-acme', user_id: 'u-003', action_type: 'DEV_INTERVIEW_SUBMITTED', resource_type: 'interview', resource_id: 'clus-005', old_value: null, new_value: { quality_tag: 'High', word_count: 412 }, ip_address: '198.51.100.22', user_agent: 'Slack/4.35', timestamp: '2026-03-02T11:35:00Z', signature: 'hmac-023' },
  { id: 'al-024', tenant_id: 'tenant-acme', user_id: 'u-001', action_type: 'INTEGRATION_AUTHORIZED', resource_type: 'integration', resource_id: 'slack', old_value: { status: 'degraded' }, new_value: { status: 'healthy' }, ip_address: '203.0.113.10', user_agent: 'Mozilla/5.0', timestamp: '2026-03-03T08:00:00Z', signature: 'hmac-024' },
  { id: 'al-025', tenant_id: 'tenant-acme', user_id: null, action_type: 'CLUSTER_CREATED', resource_type: 'cluster', resource_id: 'clus-012', old_value: null, new_value: { status: 'New', risk_score: 0.88 }, ip_address: '10.0.1.3', user_agent: null, timestamp: '2026-03-03T07:45:00Z', signature: 'hmac-025' },
  { id: 'al-026', tenant_id: 'tenant-acme', user_id: 'u-002', action_type: 'DATA_EXPORT', resource_type: 'report', resource_id: 'report-q1-2026', old_value: null, new_value: { format: 'pdf', period: 'Q1 2026' }, ip_address: '203.0.113.42', user_agent: 'Mozilla/5.0', timestamp: '2026-03-03T14:22:00Z', signature: 'hmac-026' },
  { id: 'al-027', tenant_id: 'tenant-acme', user_id: 'u-004', action_type: 'DEV_OPT_OUT', resource_type: 'user', resource_id: 'u-004', old_value: { opt_out_until: null }, new_value: { opt_out_until: '2026-03-25T00:00:00Z' }, ip_address: '198.51.100.33', user_agent: 'Mozilla/5.0', timestamp: '2026-02-28T16:44:00Z', signature: 'hmac-027' },
]

const ALL_LOG = [...AUDIT_LOG, ...EXTRA_LOG]

// ── Event metadata ─────────────────────────────────────────────────────────────
const EVENT_META = {
  CLUSTER_CREATED:          { icon: GitMerge,    color: 'bg-gray-100 text-gray-600',    label: 'Cluster Created' },
  CLUSTER_STATUS_CHANGED:   { icon: CheckCircle2, color: 'bg-blue-100 text-blue-600',   label: 'Status Changed' },
  NARRATIVE_GENERATED:      { icon: Cpu,          color: 'bg-violet-100 text-violet-600', label: 'Narrative Generated' },
  NARRATIVE_APPROVED:       { icon: CheckCircle2, color: 'bg-green-100 text-green-600', label: 'Narrative Approved' },
  NARRATIVE_EDITED:         { icon: FileText,     color: 'bg-amber-100 text-amber-600', label: 'Narrative Edited' },
  NARRATIVE_REJECTED:       { icon: XCircle,      color: 'bg-red-100 text-red-600',     label: 'Narrative Rejected' },
  CALCULATION_COMPLETED:    { icon: BarChart2,    color: 'bg-emerald-100 text-emerald-600', label: 'Credit Calculated' },
  ELIGIBILITY_OVERRIDE:     { icon: AlertCircle,  color: 'bg-orange-100 text-orange-600', label: 'Eligibility Override' },
  RULE_VERSION_ACTIVATED:   { icon: Settings,     color: 'bg-purple-100 text-purple-600', label: 'Rule Version Activated' },
  HEURISTIC_CONFIG_SAVED:   { icon: Settings,     color: 'bg-purple-100 text-purple-600', label: 'Heuristic Config Saved' },
  USER_ROLE_CHANGED:        { icon: UserCheck,    color: 'bg-indigo-100 text-indigo-600', label: 'Role Changed' },
  EVIDENCE_SNAPSHOT_CREATED:{ icon: Database,     color: 'bg-cyan-100 text-cyan-600',   label: 'Snapshot Created' },
  EVIDENCE_ACCESS:          { icon: Eye,          color: 'bg-slate-100 text-slate-600', label: 'Evidence Accessed' },
  INTEGRATION_AUTHORIZED:   { icon: Key,          color: 'bg-teal-100 text-teal-600',   label: 'Integration Authorized' },
  INTEGRATION_REVOKED:      { icon: Key,          color: 'bg-red-100 text-red-600',     label: 'Integration Revoked' },
  DATA_EXPORT:              { icon: Download,     color: 'bg-indigo-100 text-indigo-600', label: 'Data Exported' },
  DEV_INTERVIEW_SUBMITTED:  { icon: UserCheck,    color: 'bg-blue-100 text-blue-600',   label: 'Interview Submitted' },
  DEV_OPT_OUT:              { icon: XCircle,      color: 'bg-orange-100 text-orange-600', label: 'Interview Opt-Out' },
}

const CATEGORIES = {
  All: null,
  'Clusters':    ['CLUSTER_CREATED', 'CLUSTER_STATUS_CHANGED'],
  'Narratives':  ['NARRATIVE_GENERATED', 'NARRATIVE_APPROVED', 'NARRATIVE_EDITED', 'NARRATIVE_REJECTED'],
  'Credits':     ['CALCULATION_COMPLETED', 'ELIGIBILITY_OVERRIDE'],
  'Config':      ['RULE_VERSION_ACTIVATED', 'HEURISTIC_CONFIG_SAVED'],
  'Users':       ['USER_ROLE_CHANGED', 'DEV_INTERVIEW_SUBMITTED', 'DEV_OPT_OUT'],
  'Data':        ['EVIDENCE_SNAPSHOT_CREATED', 'EVIDENCE_ACCESS', 'DATA_EXPORT'],
  'Integrations':['INTEGRATION_AUTHORIZED', 'INTEGRATION_REVOKED'],
}

const userMap = Object.fromEntries(USERS.map(u => [u.id, u]))

function diffSummary(entry) {
  if (!entry.old_value && !entry.new_value) return null
  const parts = []
  if (entry.new_value) {
    Object.entries(entry.new_value).forEach(([k, v]) => {
      const old = entry.old_value?.[k]
      if (old !== undefined && old !== v) {
        parts.push(<span key={k} className="text-[10px]"><span className="text-gray-400">{k}:</span> <span className="line-through text-red-400">{String(old)}</span> → <span className="text-green-600 font-medium">{String(v)}</span></span>)
      } else if (old === undefined) {
        parts.push(<span key={k} className="text-[10px]"><span className="text-gray-400">{k}:</span> <span className="text-green-600 font-medium">{String(v)}</span></span>)
      }
    })
  }
  return parts.length > 0 ? parts : null
}

// ── Download helper ────────────────────────────────────────────────────────────
function downloadCSV(entries) {
  const header = 'timestamp,actor,action,resource_type,resource_id,ip_address'
  const rows = entries.map(e => [
    e.timestamp,
    e.user_id ? (userMap[e.user_id]?.display_name ?? e.user_id) : 'System',
    e.action_type,
    e.resource_type,
    e.resource_id,
    e.ip_address ?? '',
  ].join(','))
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'taxlift-activity-log.csv'; a.click()
  URL.revokeObjectURL(url)
}

export default function ActivityLogPage() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [actorFilter, setActorFilter] = useState('All')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const filtered = useMemo(() => {
    let list = [...ALL_LOG].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

    if (category !== 'All' && CATEGORIES[category]) {
      list = list.filter(e => CATEGORIES[category].includes(e.action_type))
    }
    if (actorFilter !== 'All') {
      list = list.filter(e =>
        actorFilter === 'system' ? !e.user_id : e.user_id === actorFilter
      )
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(e =>
        e.action_type.toLowerCase().includes(q) ||
        e.resource_id.toLowerCase().includes(q) ||
        (e.user_id && (userMap[e.user_id]?.display_name ?? '').toLowerCase().includes(q))
      )
    }
    if (dateFrom) list = list.filter(e => new Date(e.timestamp) >= new Date(dateFrom))
    if (dateTo)   list = list.filter(e => new Date(e.timestamp) <= new Date(dateTo + 'T23:59:59Z'))
    return list
  }, [search, category, actorFilter, dateFrom, dateTo])

  // Group by date
  const grouped = useMemo(() => {
    const groups = {}
    filtered.forEach(e => {
      const day = formatDate(e.timestamp)
      if (!groups[day]) groups[day] = []
      groups[day].push(e)
    })
    return Object.entries(groups)
  }, [filtered])

  return (
    <div className="space-y-4">

      {/* Filter bar */}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search actions, resources, users…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Category tabs */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 flex-wrap">
            {Object.keys(CATEGORIES).map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  category === cat ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Actor */}
          <div className="flex items-center gap-2">
            <Filter size={13} className="text-gray-400" />
            <select
              value={actorFilter}
              onChange={e => setActorFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="All">All actors</option>
              <option value="system">System (agent)</option>
              {USERS.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
            </select>
          </div>

          {/* Date range */}
          <div className="flex items-center gap-1.5">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <span className="text-xs text-gray-400">to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          {/* Export */}
          <button
            onClick={() => downloadCSV(filtered)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors ml-auto"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>

        <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
          <Shield size={11} />
          <span>{filtered.length} events · read-only, append-only, HMAC-signed</span>
        </div>
      </Card>

      {/* Timeline */}
      {grouped.length === 0 ? (
        <Card>
          <div className="py-12 text-center text-sm text-gray-400">No activity matches the current filters.</div>
        </Card>
      ) : grouped.map(([day, entries]) => (
        <div key={day}>
          {/* Day header */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{day}</span>
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">{entries.length} event{entries.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200" />

            <div className="space-y-2">
              {entries.map(entry => {
                const meta = EVENT_META[entry.action_type] ?? { icon: AlertCircle, color: 'bg-gray-100 text-gray-500', label: entry.action_type }
                const Icon = meta.icon
                const user = entry.user_id ? userMap[entry.user_id] : null
                const diff = diffSummary(entry)

                return (
                  <div key={entry.id} className="flex items-start gap-4 pl-1">
                    {/* Icon bubble */}
                    <div className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                      <Icon size={14} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-gray-900">{meta.label}</span>
                            <span className="text-[10px] font-mono text-gray-400 bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded">
                              {entry.resource_type} · {entry.resource_id.slice(0, 12)}
                            </span>
                          </div>

                          {/* Actor */}
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                            {user ? (
                              <>
                                <div className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center text-[9px] font-bold text-indigo-700">
                                  {user.display_name.charAt(0)}
                                </div>
                                <span className="font-medium text-gray-700">{user.display_name}</span>
                                <span className="text-gray-300">·</span>
                                <span>{user.role}</span>
                              </>
                            ) : (
                              <>
                                <Shield size={11} className="text-gray-400" />
                                <span className="font-medium text-gray-500">TaxLift System Agent</span>
                              </>
                            )}
                            {entry.ip_address && (
                              <>
                                <span className="text-gray-300">·</span>
                                <span className="font-mono text-gray-400">{entry.ip_address}</span>
                              </>
                            )}
                          </div>

                          {/* Diff */}
                          {diff && (
                            <div className="mt-2 flex flex-wrap gap-3">
                              {diff}
                            </div>
                          )}
                        </div>

                        {/* Timestamp + sig */}
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-gray-400 tabular-nums whitespace-nowrap">
                            {new Date(entry.timestamp).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          {entry.signature && (
                            <p className="text-[9px] font-mono text-gray-300 mt-0.5">
                              ✓ {entry.signature.slice(0, 10)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="mb-4" />
        </div>
      ))}
    </div>
  )
}

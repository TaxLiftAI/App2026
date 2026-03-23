import { useState, useMemo } from 'react'
import { Shield, Filter } from 'lucide-react'
import { AUDIT_LOG, USERS } from '../data/mockData'
import { formatDateTime } from '../lib/utils'
import Card from '../components/ui/Card'

const ACTION_COLORS = {
  CLUSTER_CREATED:          'bg-gray-100 text-gray-700',
  NARRATIVE_GENERATED:      'bg-blue-100 text-blue-700',
  NARRATIVE_APPROVED:       'bg-green-100 text-green-700',
  NARRATIVE_EDITED:         'bg-amber-100 text-amber-700',
  NARRATIVE_REJECTED:       'bg-red-100 text-red-700',
  CALCULATION_COMPLETED:    'bg-emerald-100 text-emerald-700',
  ELIGIBILITY_OVERRIDE:     'bg-orange-100 text-orange-700',
  RULE_VERSION_ACTIVATED:   'bg-purple-100 text-purple-700',
  USER_ROLE_CHANGED:        'bg-indigo-100 text-indigo-700',
  EVIDENCE_SNAPSHOT_CREATED:'bg-cyan-100 text-cyan-700',
  EVIDENCE_ACCESS:          'bg-slate-100 text-slate-700',
  INTEGRATION_AUTHORIZED:   'bg-teal-100 text-teal-700',
  INTEGRATION_REVOKED:      'bg-red-100 text-red-700',
  DATA_EXPORT:              'bg-violet-100 text-violet-700',
}

const ACTION_TYPES = ['All', ...Object.keys(ACTION_COLORS)]
const userMap = Object.fromEntries(USERS.map(u => [u.id, u.display_name]))

export default function AuditLogPage() {
  const [actionFilter, setActionFilter] = useState('All')
  const [userFilter, setUserFilter] = useState('All')

  const filtered = useMemo(() => {
    let list = [...AUDIT_LOG].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    if (actionFilter !== 'All') list = list.filter(e => e.action_type === actionFilter)
    if (userFilter !== 'All') list = list.filter(e => e.user_id === userFilter || (userFilter === 'system' && !e.user_id))
    return list
  }, [actionFilter, userFilter])

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <Filter size={13} className="text-gray-400" />
          <div>
            <label className="text-xs text-gray-500 font-medium mr-1.5">Action</label>
            <select
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {ACTION_TYPES.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium mr-1.5">Actor</label>
            <select
              value={userFilter}
              onChange={e => setUserFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="All">All</option>
              <option value="system">System (agent)</option>
              {USERS.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
            </select>
          </div>
          <p className="ml-auto text-xs text-gray-400">{filtered.length} entries · read-only, append-only</p>
        </div>
      </Card>

      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Timestamp', 'Actor', 'Action', 'Resource', 'Details', 'IP'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-400">No log entries match filters.</td></tr>
              ) : filtered.map(entry => (
                <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap tabular-nums">{formatDateTime(entry.timestamp)}</td>
                  <td className="px-5 py-3">
                    {entry.user_id ? (
                      <span className="text-xs font-medium text-gray-700">{userMap[entry.user_id] ?? entry.user_id}</span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-gray-400"><Shield size={11} /> System</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wide ${ACTION_COLORS[entry.action_type] ?? 'bg-gray-100 text-gray-600'}`}>
                      {entry.action_type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="text-xs">
                      <span className="text-gray-400 capitalize">{entry.resource_type}</span>
                      <br />
                      <code className="text-[10px] text-gray-400 font-mono">{entry.resource_id.slice(0, 12)}…</code>
                    </div>
                  </td>
                  <td className="px-5 py-3 max-w-xs">
                    {entry.new_value && (
                      <div className="text-[10px] font-mono text-gray-400 truncate">
                        {JSON.stringify(entry.new_value).slice(0, 60)}{JSON.stringify(entry.new_value).length > 60 ? '…' : ''}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-400 font-mono">{entry.ip_address}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

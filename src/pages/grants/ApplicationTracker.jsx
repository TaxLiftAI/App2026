/**
 * S7 — Application Tracker
 * Running log of all applications: draft / submitted / in review / approved / rejected.
 * Shows funding applied vs awarded. Primary retention surface.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, ChevronRight, Clock, CheckCircle2, XCircle,
  AlertCircle, FileText, TrendingUp, DollarSign, Loader2,
  BarChart2
} from 'lucide-react'
import { grants as grantsApi } from '../../lib/api'
import Card from '../../components/ui/Card'

const STATUS_META = {
  draft:           { label: 'Draft',       bg: 'bg-gray-100',    text: 'text-gray-600',   icon: FileText },
  generating:      { label: 'Generating',  bg: 'bg-blue-100',    text: 'text-blue-600',   icon: Loader2 },
  needs_review:    { label: 'In Review',   bg: 'bg-yellow-100',  text: 'text-yellow-700', icon: AlertCircle },
  ready:           { label: 'Ready',       bg: 'bg-indigo-100',  text: 'text-indigo-700', icon: CheckCircle2 },
  ready_to_export: { label: 'Ready to Export', bg: 'bg-purple-100', text: 'text-purple-700', icon: CheckCircle2 },
  submitted:       { label: 'Submitted',   bg: 'bg-blue-100',    text: 'text-blue-700',   icon: Clock },
  in_review:       { label: 'In Review',   bg: 'bg-amber-100',   text: 'text-amber-700',  icon: AlertCircle },
  approved:        { label: 'Approved',    bg: 'bg-green-100',   text: 'text-green-700',  icon: CheckCircle2 },
  rejected:        { label: 'Rejected',    bg: 'bg-red-100',     text: 'text-red-600',    icon: XCircle },
  error:           { label: 'Error',       bg: 'bg-red-100',     text: 'text-red-600',    icon: XCircle },
}

const EDITABLE_STATUSES = ['submitted', 'in_review', 'approved', 'rejected']

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.draft
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.bg} ${meta.text}`}>
      <Icon size={10} className={status === 'generating' ? 'animate-spin' : ''} />
      {meta.label}
    </span>
  )
}

export default function ApplicationTracker() {
  const navigate = useNavigate()
  const [applications, setApplications] = useState([])
  const [loading, setLoading]           = useState(true)
  const [editingStatus, setEditingStatus] = useState({})
  const [editValues, setEditValues]       = useState({})

  async function load() {
    try {
      const data = await grantsApi.listApplications()
      setApplications(data.applications || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function updateStatus(appId, updates) {
    try {
      await grantsApi.updateApplication(appId, updates)
      setApplications(prev => prev.map(a => a.id === appId ? { ...a, ...updates } : a))
      setEditingStatus(p => ({ ...p, [appId]: false }))
    } catch (err) {
      alert('Update failed: ' + err.message)
    }
  }

  function getActionLabel(app) {
    if (app.status === 'draft') return 'Continue'
    if (app.status === 'generating') return 'View Progress'
    if (app.status === 'ready' || app.status === 'needs_review') return 'Review Sections'
    if (app.status === 'ready_to_export') return 'Export PDF'
    return 'View'
  }

  function getActionRoute(app) {
    if (app.status === 'draft') return `/grants/applications/${app.id}/review`
    if (app.status === 'generating') return `/grants/applications/${app.id}/generating`
    if (app.status === 'ready' || app.status === 'needs_review') return `/grants/applications/${app.id}/review`
    if (app.status === 'ready_to_export') return `/grants/applications/${app.id}/export`
    return `/grants/applications/${app.id}/review`
  }

  // Summary stats
  const totalApplied  = applications.filter(a => a.status === 'submitted' || a.status === 'in_review' || a.status === 'approved' || a.status === 'rejected')
    .reduce((sum, a) => sum + (a.amount_requested || 0), 0)
  const totalAwarded  = applications.filter(a => a.status === 'approved')
    .reduce((sum, a) => sum + (a.amount_awarded || 0), 0)
  const inFlight      = applications.filter(a => ['submitted', 'in_review'].includes(a.status)).length
  const approvedCount = applications.filter(a => a.status === 'approved').length

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-indigo-500" size={28} />
    </div>
  )

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Application Tracker</h1>
          <p className="text-sm text-gray-500 mt-1">{applications.length} total applications</p>
        </div>
        <button
          onClick={() => navigate('/grants')}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          <Plus size={14} /> New Application
        </button>
      </div>

      {/* Summary stats */}
      {applications.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="!p-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <TrendingUp size={15} className="text-blue-600" />
              </div>
              <div>
                <p className="text-[11px] text-gray-400">Total Applied</p>
                <p className="text-base font-bold text-gray-900">${(totalApplied / 1000).toFixed(0)}K</p>
              </div>
            </div>
          </Card>
          <Card className="!p-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign size={15} className="text-green-600" />
              </div>
              <div>
                <p className="text-[11px] text-gray-400">Total Awarded</p>
                <p className="text-base font-bold text-gray-900">${(totalAwarded / 1000).toFixed(0)}K</p>
              </div>
            </div>
          </Card>
          <Card className="!p-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                <Clock size={15} className="text-amber-600" />
              </div>
              <div>
                <p className="text-[11px] text-gray-400">In Flight</p>
                <p className="text-base font-bold text-gray-900">{inFlight}</p>
              </div>
            </div>
          </Card>
          <Card className="!p-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <BarChart2 size={15} className="text-purple-600" />
              </div>
              <div>
                <p className="text-[11px] text-gray-400">Approved</p>
                <p className="text-base font-bold text-gray-900">{approvedCount}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Applications list */}
      {applications.length === 0 ? (
        <div className="text-center py-16">
          <FileText size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No applications yet</p>
          <p className="text-sm text-gray-400 mt-1">Start by browsing eligible grant programs.</p>
          <button
            onClick={() => navigate('/grants')}
            className="mt-4 px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            Browse Grants
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map(app => {
            const isEditing = editingStatus[app.id]
            const ev = editValues[app.id] || {}

            return (
              <Card key={app.id} padding={false} className="!p-0">
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{app.grant_name}</span>
                        <StatusBadge status={app.status} />
                        {app.section_count > 0 && (
                          <span className="text-xs text-gray-400">
                            {app.approved_count}/{app.section_count} sections approved
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                        <span>Created {new Date(app.created_at).toLocaleDateString('en-CA')}</span>
                        {app.submitted_at && (
                          <span>Submitted {new Date(app.submitted_at).toLocaleDateString('en-CA')}</span>
                        )}
                        {app.amount_requested && (
                          <span>Applied: ${app.amount_requested.toLocaleString()}</span>
                        )}
                        {app.amount_awarded && (
                          <span className="text-green-600 font-medium">Awarded: ${app.amount_awarded.toLocaleString()}</span>
                        )}
                      </div>
                      {app.notes && (
                        <p className="text-xs text-gray-500 mt-1 italic">{app.notes}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setEditingStatus(p => ({ ...p, [app.id]: !p[app.id] }))}
                        className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded border border-gray-200 hover:bg-gray-50"
                      >
                        Update
                      </button>
                      <button
                        onClick={() => navigate(getActionRoute(app))}
                        className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700"
                      >
                        {getActionLabel(app)} <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Inline status update form */}
                  {isEditing && (
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                      <p className="text-xs font-semibold text-gray-600">Update Application Status</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <label className="text-[11px] text-gray-500 block mb-1">Status</label>
                          <select
                            value={ev.status || app.status}
                            onChange={e => setEditValues(p => ({ ...p, [app.id]: { ...p[app.id], status: e.target.value } }))}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            {EDITABLE_STATUSES.map(s => (
                              <option key={s} value={s}>{STATUS_META[s]?.label || s}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] text-gray-500 block mb-1">Submitted Date</label>
                          <input
                            type="date"
                            value={ev.submitted_at?.slice(0, 10) || app.submitted_at?.slice(0, 10) || ''}
                            onChange={e => setEditValues(p => ({ ...p, [app.id]: { ...p[app.id], submitted_at: e.target.value } }))}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-gray-500 block mb-1">Amount Requested</label>
                          <input
                            type="number"
                            value={ev.amount_requested ?? app.amount_requested ?? ''}
                            onChange={e => setEditValues(p => ({ ...p, [app.id]: { ...p[app.id], amount_requested: e.target.value } }))}
                            placeholder="250000"
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-gray-500 block mb-1">Amount Awarded</label>
                          <input
                            type="number"
                            value={ev.amount_awarded ?? app.amount_awarded ?? ''}
                            onChange={e => setEditValues(p => ({ ...p, [app.id]: { ...p[app.id], amount_awarded: e.target.value } }))}
                            placeholder="If approved"
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-500 block mb-1">Notes</label>
                        <input
                          value={ev.notes ?? app.notes ?? ''}
                          onChange={e => setEditValues(p => ({ ...p, [app.id]: { ...p[app.id], notes: e.target.value } }))}
                          placeholder="Add notes about the application outcome…"
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateStatus(app.id, {
                            status: ev.status || app.status,
                            submitted_at: ev.submitted_at ? new Date(ev.submitted_at).toISOString() : undefined,
                            amount_requested: ev.amount_requested ? parseFloat(ev.amount_requested) : undefined,
                            amount_awarded:   ev.amount_awarded  ? parseFloat(ev.amount_awarded)   : undefined,
                            notes: ev.notes !== undefined ? ev.notes : app.notes,
                          })}
                          className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700"
                        >
                          Save Changes
                        </button>
                        <button
                          onClick={() => setEditingStatus(p => ({ ...p, [app.id]: false }))}
                          className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

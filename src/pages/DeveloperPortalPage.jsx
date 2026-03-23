import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  GitCommit, Clock, MessageSquare, BellOff, BellRing,
  ChevronRight, Star, User, BarChart2, CheckCircle2, XCircle,
  AlertCircle,
} from 'lucide-react'
import { CLUSTERS, EVIDENCE_SNAPSHOTS, DEVELOPER_INTERVIEWS, RATE_CARDS, USERS } from '../data/mockData'
import { formatDate, formatDateTime, formatHours, formatCurrency, canDo } from '../lib/utils'
import { useAuth } from '../context/AuthContext'
import { StatusBadge, RoleBadge } from '../components/ui/Badge'
import Card, { CardHeader } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'

// ── Derive a developer's attributed clusters ────────────────────────────────
function getContributedClusters(githubUserId) {
  if (!githubUserId) return []
  return CLUSTERS.filter(cluster => {
    if (cluster.merged_into_cluster_id) return false
    const snap = EVIDENCE_SNAPSHOTS[cluster.evidence_snapshot_id]
    if (!snap?.git_commits?.length) return false
    return snap.git_commits.some(c => c.author === githubUserId)
  })
}

// ── Compute attributed hours for a developer in a cluster ──────────────────
function getAttributedHours(cluster, githubUserId) {
  if (!cluster.aggregate_time_hours) return null
  const snap = EVIDENCE_SNAPSHOTS[cluster.evidence_snapshot_id]
  if (!snap?.git_commits?.length) return null
  const total = snap.git_commits.length
  const mine  = snap.git_commits.filter(c => c.author === githubUserId).length
  if (total === 0) return null
  return Math.round((mine / total) * cluster.aggregate_time_hours * 10) / 10
}

// ── Quality badge ──────────────────────────────────────────────────────────
function QualityTag({ tag }) {
  const map = {
    High:   'bg-green-100 text-green-700',
    Medium: 'bg-amber-100 text-amber-700',
    Low:    'bg-red-100 text-red-700',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${map[tag] ?? 'bg-gray-100 text-gray-600'}`}>
      <Star size={9} />
      {tag}
    </span>
  )
}

// ── Stat card ──────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = 'indigo' }) {
  const ring = {
    indigo: 'bg-indigo-50 text-indigo-600',
    green:  'bg-green-50  text-green-600',
    amber:  'bg-amber-50  text-amber-600',
    blue:   'bg-blue-50   text-blue-600',
  }[color]
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${ring}`}>
        <Icon size={16} />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Opt-out modal ──────────────────────────────────────────────────────────
function OptOutModal({ isOpen, onClose, user, onSave }) {
  const [duration, setDuration] = useState('30')
  const [reason, setReason] = useState('')

  const isActive = user?.interview_opt_out_until
    ? new Date(user.interview_opt_out_until) > new Date()
    : false

  function handleSave() {
    const until = new Date()
    until.setDate(until.getDate() + parseInt(duration, 10))
    onSave(until.toISOString())
    onClose()
  }

  function handleClearOptOut() {
    onSave(null)
    onClose()
  }

  if (!isOpen) return null
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Interview Opt-Out Settings">
      {isActive ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <BellOff size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">Opt-out is active</p>
              <p className="text-xs text-amber-700 mt-0.5">
                You will not receive Slack interview requests until <strong>{formatDate(user.interview_opt_out_until)}</strong>.
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-600">
            Opting back in means you may receive interview requests for clusters you contributed to.
            Your responses help strengthen the SR&D narrative for your team.
          </p>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={handleClearOptOut}>
              <BellRing size={14} />
              Opt Back In
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            You can pause interview requests if you're on leave, heads-down, or otherwise unavailable.
            Your clusters will still be reviewed, but no Slack messages will be sent to you during this period.
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Opt-out duration</label>
            <select
              value={duration}
              onChange={e => setDuration(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days (max)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Reason (optional)</label>
            <input
              type="text"
              placeholder="e.g. Parental leave, off-site, vacation"
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={handleSave}>
              <BellOff size={14} />
              Opt Out for {duration} Days
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function DeveloperPortalPage() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [optOutOpen, setOptOutOpen] = useState(false)
  const [userState, setUserState] = useState(
    USERS.find(u => u.id === currentUser?.id) ?? currentUser
  )

  const githubId = userState?.github_user_id
  const contributed = getContributedClusters(githubId)

  // Compute total attributed hours and eligible credit
  const rateCard = RATE_CARDS[userState?.id]
  const effectiveRate = rateCard
    ? rateCard.hourly_rate_cad * (1 + rateCard.overhead_pct / 100)
    : null

  let totalAttributedHours = 0
  let totalAttributedCredit = 0
  contributed.forEach(c => {
    const h = getAttributedHours(c, githubId)
    if (h) {
      totalAttributedHours += h
      if (effectiveRate && c.eligibility_percentage) {
        totalAttributedCredit += h * effectiveRate * (c.eligibility_percentage / 100)
      }
    }
  })

  // Interview history: clusters where this user was the interviewee
  const interviewHistory = Object.values(DEVELOPER_INTERVIEWS).filter(
    iv => iv.developer_id === userState?.id
  )

  const isOptedOut = userState?.interview_opt_out_until
    ? new Date(userState.interview_opt_out_until) > new Date()
    : false

  function handleOptOutSave(newDate) {
    setUserState(prev => ({ ...prev, interview_opt_out_until: newDate }))
  }

  const approvedClusters   = contributed.filter(c => c.status === 'Approved').length
  const pendingClusters    = contributed.filter(c => ['New','Interviewed','Drafted'].includes(c.status)).length

  return (
    <div className="p-6 space-y-6 max-w-5xl">

      {/* Profile header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center text-lg font-bold text-white">
            {userState?.display_name?.charAt(0) ?? '?'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-gray-900">{userState?.display_name}</h2>
              <RoleBadge role={userState?.role} />
            </div>
            <p className="text-sm text-gray-500">{userState?.email}</p>
            {githubId && (
              <p className="text-xs text-gray-400 mt-0.5 font-mono">@{githubId}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isOptedOut && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
              <BellOff size={13} />
              Opted out until {formatDate(userState.interview_opt_out_until)}
            </div>
          )}
          <Button variant="secondary" onClick={() => setOptOutOpen(true)}>
            {isOptedOut ? <BellRing size={14} /> : <BellOff size={14} />}
            {isOptedOut ? 'Manage Opt-Out' : 'Opt Out of Interviews'}
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={GitCommit}
          label="Clusters Contributed"
          value={contributed.length}
          sub={`${approvedClusters} approved`}
          color="indigo"
        />
        <StatCard
          icon={Clock}
          label="Hours Attributed"
          value={totalAttributedHours > 0 ? `${totalAttributedHours.toFixed(0)}h` : '—'}
          sub={rateCard ? `@ ${formatCurrency(rateCard.hourly_rate_cad)}/hr` : 'No rate card'}
          color="blue"
        />
        <StatCard
          icon={BarChart2}
          label="Est. Eligible Credit"
          value={totalAttributedCredit > 0 ? formatCurrency(totalAttributedCredit) : '—'}
          sub="across approved clusters"
          color="green"
        />
        <StatCard
          icon={MessageSquare}
          label="Interviews Completed"
          value={interviewHistory.length}
          sub={interviewHistory.filter(i => i.quality_tag === 'High').length + ' High quality'}
          color="amber"
        />
      </div>

      {/* Contributed clusters table */}
      <Card>
        <CardHeader title="My Clusters" subtitle={`${contributed.length} clusters where your commits were detected`} />
        {contributed.length === 0 ? (
          <div className="p-8 text-center">
            <GitCommit size={28} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No clusters attributed to your GitHub account yet.</p>
            {!githubId && (
              <p className="text-xs text-gray-400 mt-1">
                Your GitHub account is not linked. Ask your Admin to connect it in User Management.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Business Component</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">My Hours</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Est. Credit</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Detected</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {contributed.map(c => {
                  const myHours = getAttributedHours(c, githubId)
                  const myCredit = (myHours && effectiveRate && c.eligibility_percentage)
                    ? myHours * effectiveRate * (c.eligibility_percentage / 100)
                    : null
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900 text-xs">{c.business_component}</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-gray-700">
                        {myHours != null ? `${myHours}h` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-gray-700">
                        {myCredit != null ? formatCurrency(myCredit) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{formatDate(c.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        {canDo('viewClusters', currentUser?.role) && (
                          <button
                            onClick={() => navigate(`/clusters/${c.id}`)}
                            className="text-indigo-600 hover:text-indigo-800 text-xs flex items-center gap-1 ml-auto"
                          >
                            View <ChevronRight size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Interview history */}
      <Card>
        <CardHeader
          title="My Interview History"
          subtitle="Slack interviews sent by the TaxLift Interviewer agent"
        />
        {interviewHistory.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare size={28} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No interview requests have been sent to you yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {interviewHistory.map(iv => {
              const cluster = CLUSTERS.find(c => c.id === iv.cluster_id)
              return (
                <div key={iv.cluster_id} className="px-4 py-4 flex gap-4">
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                      <MessageSquare size={14} className="text-blue-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {cluster?.business_component ?? iv.cluster_id}
                      </p>
                      <QualityTag tag={iv.quality_tag} />
                    </div>
                    <blockquote className="text-xs text-gray-600 border-l-2 border-indigo-200 pl-2.5 italic line-clamp-2">
                      "{iv.response_excerpt}"
                    </blockquote>
                    <div className="flex items-center gap-4 text-xs text-gray-400 pt-0.5">
                      <span>Sent {formatDateTime(iv.slack_sent_at)}</span>
                      <span>·</span>
                      <span>Responded {formatDateTime(iv.responded_at)}</span>
                      <span>·</span>
                      <span>{iv.response_word_count} words</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* No GitHub warning */}
      {!githubId && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertCircle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">GitHub account not linked</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Your profile doesn't have a GitHub username. Cluster attribution relies on commit authorship.
              Ask your Admin to link your GitHub account in User Management.
            </p>
          </div>
        </div>
      )}

      <OptOutModal
        isOpen={optOutOpen}
        onClose={() => setOptOutOpen(false)}
        user={userState}
        onSave={handleOptOutSave}
      />
    </div>
  )
}

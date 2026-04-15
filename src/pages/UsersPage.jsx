import { useState } from 'react'
import { UserPlus, BanIcon, CheckCircle2, FlaskConical } from 'lucide-react'
import { formatDateTime } from '../lib/utils'
import { useUsers } from '../hooks'
import { RoleBadge } from '../components/ui/Badge'
import Card, { CardHeader } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'

const ROLES = ['Developer', 'Reviewer', 'Admin', 'Auditor', 'Support']

export default function UsersPage() {
  const { data: apiUsers, usingMock } = useUsers()
  const [localAdditions, setLocalAdditions] = useState([])
  const [userOverrides, setUserOverrides]   = useState({}) // id → partial changes
  // Merge API users with overrides + local additions
  const users = [
    ...(apiUsers ?? []).map(u => ({ ...u, ...(userOverrides[u.id] ?? {}) })),
    ...localAdditions,
  ]
  function patchUser(userId, changes) {
    setUserOverrides(prev => ({ ...prev, [userId]: { ...(prev[userId] ?? {}), ...changes } }))
  }
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('Developer')
  const [inviteName, setInviteName] = useState('')
  const [toast, setToast] = useState(null)

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  function handleInvite() {
    const newUser = {
      id: `u-${Date.now()}`,
      tenant_id: 'tenant-acme',
      role: inviteRole,
      display_name: inviteName || inviteEmail.split('@')[0],
      email: inviteEmail,
      github_user_id: null,
      jira_account_id: null,
      slack_user_id: null,
      interview_opt_out_until: null,
      last_active_at: null,
      created_at: new Date().toISOString(),
    }
    setLocalAdditions(u => [...u, newUser])
    setShowInvite(false)
    setInviteEmail('')
    setInviteRole('Developer')
    setInviteName('')
    showToast(`Invitation sent to ${inviteEmail}`)
  }

  function changeRole(userId, newRole) {
    patchUser(userId, { role: newRole })
    showToast('Role updated successfully')
  }

  function toggleOptOut(userId) {
    const u = users.find(x => x.id === userId)
    patchUser(userId, {
      interview_opt_out_until: u?.interview_opt_out_until
        ? null
        : new Date(Date.now() + 30*86400*1000).toISOString()
    })
  }

  return (
    <div className="space-y-4">
      {/* Demo mode banner */}
      {usingMock && (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-indigo-600 rounded-xl text-xs text-white">
          <FlaskConical size={13} className="text-indigo-200 flex-shrink-0" />
          <span className="font-medium">Demo mode — user data is not live. Connect a data source to see real accounts.</span>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          <CheckCircle2 size={15} />
          {toast.msg}
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Team Members</h3>
            <p className="text-xs text-gray-500 mt-0.5">{users.length} users in this workspace</p>
          </div>
          <Button size="sm" icon={UserPlus} onClick={() => setShowInvite(true)}>Invite User</Button>
        </div>
      </Card>

      <Card padding={false}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Name', 'Email', 'Role', 'GitHub', 'Interview Opt-Out', 'Last Active', 'Actions'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 flex-shrink-0">
                      {user.display_name?.charAt(0)?.toUpperCase() ?? '?'}
                    </div>
                    <span className="text-sm font-medium text-gray-900">{user.display_name}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-sm text-gray-500">{user.email}</td>
                <td className="px-5 py-3.5">
                  <select
                    value={user.role}
                    onChange={e => changeRole(user.id, e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="px-5 py-3.5 text-sm text-gray-500 font-mono text-xs">{user.github_user_id ?? '—'}</td>
                <td className="px-5 py-3.5">
                  {user.interview_opt_out_until ? (
                    <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                      Until {new Date(user.interview_opt_out_until).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">Active</span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-xs text-gray-400">{user.last_active_at ? formatDateTime(user.last_active_at) : <span className="text-gray-300">Never</span>}</td>
                <td className="px-5 py-3.5">
                  {user.role === 'Developer' && (
                    <button
                      onClick={() => toggleOptOut(user.id)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      {user.interview_opt_out_until ? 'Remove opt-out' : 'Set opt-out'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Invite modal */}
      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Invite Team Member">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email address *</label>
            <input
              type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Display name</label>
            <input
              type="text" value={inviteName} onChange={e => setInviteName(e.target.value)}
              placeholder="Jane Smith"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Role *</label>
            <select
              value={inviteRole} onChange={e => setInviteRole(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <p className="text-xs text-gray-400">An invitation email will be sent. The user appears in the list immediately.</p>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" onClick={() => setShowInvite(false)}>Cancel</Button>
            <Button icon={UserPlus} disabled={!inviteEmail} onClick={handleInvite}>Send Invitation</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

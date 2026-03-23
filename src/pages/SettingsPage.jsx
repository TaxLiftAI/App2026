import { useState } from 'react'
import {
  User, Mail, Shield, Bell, Key, Copy, Eye, EyeOff,
  CheckCircle2, Save, RefreshCw, Globe, Calendar, Keyboard,
  ChevronRight, Lock, AlertCircle,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { ROLE_COLORS } from '../lib/utils'

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ icon: Icon, title, subtitle, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon size={15} className="text-indigo-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="px-6 py-5 space-y-5">
        {children}
      </div>
    </div>
  )
}

// ─── Field row ────────────────────────────────────────────────────────────────
function FieldRow({ label, hint, children }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="flex-shrink-0 w-44">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {hint && <p className="text-xs text-gray-400 mt-0.5 leading-snug">{hint}</p>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
        checked ? 'bg-indigo-500' : 'bg-gray-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4.5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function SaveToast({ msg }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg">
      <CheckCircle2 size={14} className="text-green-400" />
      {msg}
    </div>
  )
}

// ─── Notification preferences ─────────────────────────────────────────────────
const NOTIF_PREFS = [
  { id: 'pending_approval',    label: 'Pending approvals',      hint: 'Clusters waiting for your review'         },
  { id: 'mention',             label: 'Mentions',               hint: 'When someone @mentions you in a comment'  },
  { id: 'readiness_warning',   label: 'Audit readiness alerts', hint: 'When a cluster drops below 60/100'        },
  { id: 'stale_context',       label: 'Stale context warnings', hint: 'Context older than 30 days'               },
  { id: 'new_comment',         label: 'New comments',           hint: 'Comments on clusters you own or follow'   },
  { id: 'audit_risk',          label: 'High risk flags',        hint: 'Risk score above 0.80'                    },
  { id: 'narrative_ready',     label: 'Narrative ready',        hint: 'When an AI narrative draft is generated'  },
  { id: 'interview_scheduled', label: 'Interviews',             hint: 'Upcoming developer interviews'            },
  { id: 'credit_milestone',    label: 'Credit milestones',      hint: 'When total credit crosses a threshold'    },
  { id: 'cluster_overdue',     label: 'Overdue clusters',       hint: 'Clusters inactive for more than 14 days'  },
]

const JURISDICTIONS = [
  { value: 'ca_sred',  label: 'Canada — SR&ED (CRA)' },
  { value: 'us_41',    label: 'United States — IRC §41 (IRS)' },
  { value: 'uk_rdtax', label: 'United Kingdom — R&D Tax Credit (HMRC)' },
]

const FISCAL_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// ─── Mock API key ─────────────────────────────────────────────────────────────
const MOCK_API_KEY = 'cred_live_sk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'

export default function SettingsPage() {
  const { currentUser } = useAuth()
  const role = currentUser?.role ?? 'Admin'
  const roleStyle = ROLE_COLORS[role] ?? { bg: 'bg-gray-100', text: 'text-gray-700' }

  // Profile state
  const [displayName, setDisplayName] = useState(currentUser?.display_name ?? '')
  const [nameEditing, setNameEditing]  = useState(false)
  const [nameDraft, setNameDraft]      = useState(displayName)

  // Notification toggles
  const [notifPrefs, setNotifPrefs] = useState(
    Object.fromEntries(NOTIF_PREFS.map(p => [p.id, true]))
  )

  // Preferences
  const [jurisdiction, setJurisdiction] = useState('ca_sred')
  const [fiscalMonth, setFiscalMonth]   = useState('December')
  const [timezone, setTimezone]         = useState('America/Toronto')

  // Security
  const [apiKeyVisible, setApiKeyVisible] = useState(false)
  const [apiKeyCopied, setApiKeyCopied]   = useState(false)
  const [apiKeyRegenerated, setApiKeyRegenerated] = useState(false)

  // Toast
  const [toast, setToast] = useState(null)

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 2800)
  }

  function saveName() {
    setDisplayName(nameDraft.trim() || displayName)
    setNameEditing(false)
    showToast('Display name updated')
  }

  function toggleNotif(id) {
    setNotifPrefs(prev => {
      const next = { ...prev, [id]: !prev[id] }
      return next
    })
  }

  function copyApiKey() {
    navigator.clipboard?.writeText(MOCK_API_KEY).catch(() => {})
    setApiKeyCopied(true)
    setTimeout(() => setApiKeyCopied(false), 2000)
  }

  function regenerateKey() {
    setApiKeyRegenerated(true)
    showToast('API key regenerated — copy it now, it won\'t be shown again')
  }

  function savePreferences() {
    showToast('Preferences saved')
  }

  const maskedKey = MOCK_API_KEY.slice(0, 12) + '•'.repeat(24) + MOCK_API_KEY.slice(-4)

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">

      {/* Page header */}
      <div>
        <h2 className="text-lg font-bold text-gray-900">Settings</h2>
        <p className="text-sm text-gray-500 mt-0.5">Manage your account, preferences, and security.</p>
      </div>

      {/* ── Profile ── */}
      <Section icon={User} title="Profile" subtitle="Your name and role in this workspace">
        {/* Avatar + name */}
        <FieldRow label="Display name" hint="Shown in comments and activity logs">
          {nameEditing ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={nameDraft}
                onChange={e => setNameDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setNameEditing(false) }}
                className="flex-1 px-3 py-1.5 text-sm border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <button onClick={saveName} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors">
                <Save size={12} /> Save
              </button>
              <button onClick={() => setNameEditing(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {displayName.charAt(0)}
              </div>
              <span className="text-sm font-medium text-gray-900">{displayName}</span>
              <button
                onClick={() => { setNameDraft(displayName); setNameEditing(true) }}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium ml-1"
              >
                Edit
              </button>
            </div>
          )}
        </FieldRow>

        <div className="border-t border-gray-100" />

        <FieldRow label="Email address" hint="Linked to your login">
          <div className="flex items-center gap-2">
            <Mail size={14} className="text-gray-400 flex-shrink-0" />
            <span className="text-sm text-gray-600">{currentUser?.email ?? 'sarah.chen@acmecorp.com'}</span>
            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">read-only</span>
          </div>
        </FieldRow>

        <div className="border-t border-gray-100" />

        <FieldRow label="Role" hint="Assigned by your workspace admin">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${roleStyle.bg} ${roleStyle.text}`}>
            <Shield size={10} />
            {role}
          </span>
        </FieldRow>

        <div className="border-t border-gray-100" />

        <FieldRow label="Tenant" hint="Your organisation's workspace">
          <span className="text-sm text-gray-600">Acme Corp <span className="text-gray-400 text-xs ml-1">/ tenant-acme</span></span>
        </FieldRow>
      </Section>

      {/* ── Notification preferences ── */}
      <Section icon={Bell} title="Notifications" subtitle="Choose which events trigger in-app notifications">
        <div className="space-y-3">
          {NOTIF_PREFS.map((pref, i) => (
            <div key={pref.id}>
              {i > 0 && <div className="border-t border-gray-50" />}
              <div className="flex items-center justify-between pt-3 first:pt-0">
                <div>
                  <p className="text-sm font-medium text-gray-800">{pref.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{pref.hint}</p>
                </div>
                <Toggle
                  checked={notifPrefs[pref.id]}
                  onChange={() => toggleNotif(pref.id)}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="pt-2">
          <button
            onClick={() => showToast('Notification preferences saved')}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Save size={13} /> Save preferences
          </button>
        </div>
      </Section>

      {/* ── Filing preferences ── */}
      <Section icon={Globe} title="Filing Preferences" subtitle="Jurisdiction and fiscal year settings for your SR&ED filing">
        <FieldRow label="Jurisdiction" hint="The tax credit program you are filing under">
          <select
            value={jurisdiction}
            onChange={e => setJurisdiction(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white text-gray-700"
          >
            {JURISDICTIONS.map(j => (
              <option key={j.value} value={j.value}>{j.label}</option>
            ))}
          </select>
        </FieldRow>

        <div className="border-t border-gray-100" />

        <FieldRow label="Fiscal year end" hint="The last month of your company's fiscal year">
          <select
            value={fiscalMonth}
            onChange={e => setFiscalMonth(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white text-gray-700"
          >
            {FISCAL_MONTHS.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </FieldRow>

        <div className="border-t border-gray-100" />

        <FieldRow label="Timezone" hint="Used for deadline calculations and timestamps">
          <select
            value={timezone}
            onChange={e => setTimezone(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white text-gray-700"
          >
            <option value="America/Toronto">America/Toronto (ET)</option>
            <option value="America/Vancouver">America/Vancouver (PT)</option>
            <option value="America/Edmonton">America/Edmonton (MT)</option>
            <option value="America/Winnipeg">America/Winnipeg (CT)</option>
            <option value="America/Halifax">America/Halifax (AT)</option>
            <option value="America/St_Johns">America/St_Johns (NT)</option>
          </select>
        </FieldRow>

        <div className="pt-1">
          <button
            onClick={savePreferences}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Save size={13} /> Save preferences
          </button>
        </div>
      </Section>

      {/* ── Security / API key ── */}
      <Section icon={Key} title="API Key" subtitle="Use this key to authenticate with the TaxLift API from external tools or scripts">
        <FieldRow label="Secret key" hint="Treat this like a password — never share it publicly">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-xs text-gray-600 overflow-hidden">
                <Lock size={11} className="text-gray-400 flex-shrink-0" />
                <span className="truncate">{apiKeyVisible ? MOCK_API_KEY : maskedKey}</span>
              </div>
              <button
                onClick={() => setApiKeyVisible(v => !v)}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors"
                title={apiKeyVisible ? 'Hide key' : 'Reveal key'}
              >
                {apiKeyVisible ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button
                onClick={copyApiKey}
                className={`p-2 rounded-lg border transition-colors ${
                  apiKeyCopied
                    ? 'border-green-300 bg-green-50 text-green-600'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-400 hover:text-gray-600'
                }`}
                title="Copy API key"
              >
                {apiKeyCopied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={regenerateKey}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
              >
                <RefreshCw size={11} /> Regenerate key
              </button>
              {apiKeyRegenerated && (
                <span className="flex items-center gap-1 text-xs text-amber-600">
                  <AlertCircle size={11} /> New key generated — copy it now
                </span>
              )}
            </div>
          </div>
        </FieldRow>

        <div className="border-t border-gray-100" />

        <FieldRow label="API documentation" hint="View integration guides and endpoint reference">
          <a
            href="#"
            className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
            onClick={e => e.preventDefault()}
          >
            Open API docs <ChevronRight size={13} />
          </a>
        </FieldRow>
      </Section>

      {/* ── Keyboard shortcuts hint ── */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
        <div className="flex items-center gap-3">
          <Keyboard size={15} className="text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-700">Keyboard shortcuts</p>
            <p className="text-xs text-gray-400">Press <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-[10px] font-mono mx-0.5">?</kbd> anywhere in the app to view all shortcuts</p>
          </div>
        </div>
      </div>

      {toast && <SaveToast msg={toast} />}
    </div>
  )
}

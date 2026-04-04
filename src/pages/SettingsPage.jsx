import { useState, useEffect } from 'react'
import {
  User, Mail, Shield, Bell, Key, Copy, Eye, EyeOff,
  CheckCircle2, Save, RefreshCw, Globe, Calendar, Keyboard,
  ChevronRight, Lock, AlertCircle, CreditCard, Building2,
  Loader2, Zap, Crown,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { auth as authApi, billing as billingApi } from '../lib/api'
import { redirectToCheckout, PLANS } from '../lib/stripe'
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

const CANADIAN_PROVINCES = [
  { value: 'AB', label: 'Alberta' },
  { value: 'BC', label: 'British Columbia' },
  { value: 'MB', label: 'Manitoba' },
  { value: 'NB', label: 'New Brunswick' },
  { value: 'NL', label: 'Newfoundland and Labrador' },
  { value: 'NS', label: 'Nova Scotia' },
  { value: 'NT', label: 'Northwest Territories' },
  { value: 'NU', label: 'Nunavut' },
  { value: 'ON', label: 'Ontario' },
  { value: 'PE', label: 'Prince Edward Island' },
  { value: 'QC', label: 'Quebec' },
  { value: 'SK', label: 'Saskatchewan' },
  { value: 'YT', label: 'Yukon' },
]

const INDUSTRY_DOMAINS = [
  { value: 'software',        label: 'Software / SaaS' },
  { value: 'ai_ml',           label: 'AI / Machine Learning' },
  { value: 'biotech',         label: 'Biotech / Life Sciences' },
  { value: 'cleantech',       label: 'Clean Technology / Sustainability' },
  { value: 'advanced_mfg',   label: 'Advanced Manufacturing' },
  { value: 'agritech',        label: 'Agriculture Technology' },
  { value: 'fintech',         label: 'Fintech / Financial Services' },
  { value: 'medtech',         label: 'Medical Devices / Health Tech' },
  { value: 'materials',       label: 'Materials Science' },
  { value: 'aerospace',       label: 'Aerospace / Defence' },
  { value: 'other',           label: 'Other' },
]

// ─── Mock API key ─────────────────────────────────────────────────────────────
const MOCK_API_KEY = 'cred_live_sk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'

const TIER_CONFIG = {
  free:       { label: 'Free',       badge: 'bg-gray-100 text-gray-600',    icon: null },
  starter:    { label: 'Starter',    badge: 'bg-blue-100 text-blue-700',    icon: Zap  },
  plus:       { label: 'Plus',       badge: 'bg-indigo-100 text-indigo-700', icon: Crown },
  pro:        { label: 'Pro',        badge: 'bg-purple-100 text-purple-700', icon: Crown },
  enterprise: { label: 'Enterprise', badge: 'bg-amber-100 text-amber-700',  icon: Crown },
}

export default function SettingsPage() {
  const { currentUser, refreshUser } = useAuth()
  const role = currentUser?.role ?? 'Admin'
  const roleStyle = ROLE_COLORS[role] ?? { bg: 'bg-gray-100', text: 'text-gray-700' }

  // Profile state
  const [displayName, setDisplayName] = useState(currentUser?.name ?? currentUser?.display_name ?? '')
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

  // Company profile
  const [province, setProvince]         = useState('ON')
  const [industry, setIndustry]         = useState('')
  const [employeeCount, setEmployeeCount] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)

  // Billing
  const [subscription, setSubscription] = useState(null)
  const [upgrading, setUpgrading]       = useState(false)
  const [upgradeError, setUpgradeError] = useState(null)

  // Toast
  const [toast, setToast] = useState(null)

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 2800)
  }

  // Load company profile + subscription on mount
  useEffect(() => {
    authApi.getProfile().then(p => {
      if (p?.province)        setProvince(p.province)
      if (p?.industry_domain) setIndustry(p.industry_domain)
      if (p?.employee_count)  setEmployeeCount(String(p.employee_count))
    }).catch(() => {})

    billingApi.subscription().then(s => setSubscription(s)).catch(() => {})
  }, [])

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

  async function saveCompanyProfile() {
    setProfileSaving(true)
    try {
      await authApi.updateProfile({
        province,
        industry_domain: industry,
        employee_count:  employeeCount ? parseInt(employeeCount, 10) : undefined,
      })
      showToast('Company profile saved — grant eligibility updated')
    } catch {
      showToast('Could not save profile')
    } finally {
      setProfileSaving(false)
    }
  }

  async function handleUpgrade(planId) {
    setUpgrading(true)
    setUpgradeError(null)
    const result = await redirectToCheckout(planId)
    if (!result.ok) {
      setUpgradeError(result.message ?? 'Checkout failed — please try again')
      setUpgrading(false)
    }
    // On success, browser redirects to Stripe — no further state needed
  }

  const maskedKey = MOCK_API_KEY.slice(0, 12) + '•'.repeat(24) + MOCK_API_KEY.slice(-4)

  const currentTier  = subscription?.tier ?? currentUser?.subscription_tier ?? 'free'
  const tierCfg      = TIER_CONFIG[currentTier] ?? TIER_CONFIG.free
  const TierIcon     = tierCfg.icon
  const isFreeTier   = currentTier === 'free'
  const isStarterTier = currentTier === 'starter'
  const isPlusTier   = ['plus', 'pro', 'enterprise'].includes(currentTier)

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
          <span className="text-sm text-gray-600">
            {currentUser?.firm_name ?? 'Your company'}
            {currentUser?.tenant_id && (
              <span className="text-gray-400 text-xs ml-1">/ {currentUser.tenant_id}</span>
            )}
          </span>
        </FieldRow>
      </Section>

      {/* ── Billing & Plan ── */}
      <Section icon={CreditCard} title="Plan & Billing" subtitle="Your current subscription and upgrade options">

        {/* Current plan status */}
        <FieldRow label="Current plan" hint="Your active TaxLift subscription">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${tierCfg.badge}`}>
              {TierIcon && <TierIcon size={10} />}
              {tierCfg.label}
            </span>
            {subscription?.subscribedAt && (
              <span className="text-xs text-gray-400">
                since {new Date(subscription.subscribedAt).toLocaleDateString('en-CA', { year: 'numeric', month: 'short' })}
              </span>
            )}
          </div>
        </FieldRow>

        {/* Upgrade CTA — only shown to non-Plus users */}
        {!isPlusTier && (
          <>
            <div className="border-t border-gray-100" />
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Crown size={14} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Upgrade to Plus — $599/mo</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Unlock the Grants module — AI-matched against 9 Canadian programs (IRAP, SDTC, Mitacs, RDA + provincial).
                    Average client finds <strong>$700K+</strong> in additional funding.
                  </p>
                </div>
              </div>

              <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
                {PLANS.plus.features.slice(1, 5).map((f, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-xs text-indigo-700">
                    <CheckCircle2 size={11} className="text-indigo-500 flex-shrink-0" />
                    {f.replace('✦ ', '')}
                  </li>
                ))}
              </ul>

              {upgradeError && (
                <p className="text-xs text-red-600 flex items-center gap-1.5">
                  <AlertCircle size={11} /> {upgradeError}
                </p>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={() => handleUpgrade('plus')}
                  disabled={upgrading || !subscription?.stripeConfigured}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  {upgrading ? <Loader2 size={14} className="animate-spin" /> : <Crown size={14} />}
                  {upgrading ? 'Redirecting…' : 'Upgrade to Plus'}
                </button>

                {isFreeTier && (
                  <button
                    onClick={() => handleUpgrade('starter')}
                    disabled={upgrading || !subscription?.stripeConfigured}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 text-gray-700 text-sm font-medium rounded-xl transition-colors"
                  >
                    {upgrading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                    Start with Starter ($299/mo)
                  </button>
                )}
              </div>

              {!subscription?.stripeConfigured && (
                <p className="text-xs text-amber-600 flex items-center gap-1.5">
                  <AlertCircle size={11} /> Stripe is not configured — set STRIPE_SECRET_KEY on the server to enable billing.
                </p>
              )}
            </div>
          </>
        )}

        {/* Already on Plus — manage subscription */}
        {isPlusTier && (
          <>
            <div className="border-t border-gray-100" />
            <FieldRow label="Manage subscription" hint="Update payment method or cancel">
              <a
                href="https://billing.stripe.com/p/login"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
              >
                Open billing portal <ChevronRight size={13} />
              </a>
            </FieldRow>
          </>
        )}
      </Section>

      {/* ── Company Profile ── */}
      <Section icon={Building2} title="Company Profile" subtitle="Used to match grant eligibility — takes 30 seconds to fill in">
        <FieldRow label="Province / Territory" hint="Determines provincial grants like BC Ignite, AB Innovates, OITC">
          <select
            value={province}
            onChange={e => setProvince(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white text-gray-700"
          >
            {CANADIAN_PROVINCES.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </FieldRow>

        <div className="border-t border-gray-100" />

        <FieldRow label="Industry" hint="Used to score IRAP, NGen, SDTC, and sector-specific grants">
          <select
            value={industry}
            onChange={e => setIndustry(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white text-gray-700"
          >
            <option value="">— Select your primary industry —</option>
            {INDUSTRY_DOMAINS.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </FieldRow>

        <div className="border-t border-gray-100" />

        <FieldRow label="Employees (FTEs)" hint="Full-time equivalents — affects IRAP and Mitacs eligibility bands">
          <input
            type="number"
            min="1"
            max="9999"
            value={employeeCount}
            onChange={e => setEmployeeCount(e.target.value)}
            placeholder="e.g. 25"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white text-gray-700"
          />
        </FieldRow>

        <div className="pt-1">
          <button
            onClick={saveCompanyProfile}
            disabled={profileSaving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {profileSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {profileSaving ? 'Saving…' : 'Save profile'}
          </button>
        </div>
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

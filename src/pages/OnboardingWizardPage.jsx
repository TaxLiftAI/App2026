import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Check, ChevronRight, ChevronLeft, Lock,
  GitBranch, ArrowRight, Loader2,
  Webhook, Settings2, CheckCircle2, SlidersHorizontal,
} from 'lucide-react'
import Button from '../components/ui/Button'
import TaxLiftLogo from '../components/TaxLiftLogo'

// ── Provider catalogue ────────────────────────────────────────────────────────
const PROVIDERS = {
  github: {
    id: 'github',
    name: 'GitHub',
    emoji: '⚙️',
    tagline: 'Commit activity · Pull requests · CI runs',
    description: 'TaxLift monitors push events, PR merge patterns, build results, and branch naming to detect R&D signal clusters.',
    scopes: [
      { label: 'repo (read-only)', detail: 'Read commit history, file diffs, and branch structure' },
      { label: 'checks:read', detail: 'Read CI/CD run results for build experimentation signals' },
      { label: 'pull_requests:read', detail: 'Analyse PR review cycles for complexity signals' },
    ],
    events: ['push', 'pull_request', 'check_run', 'create'],
    color: 'bg-gray-900',
    estimated_objects: { '3m': '~1 100 commits', '6m': '~2 800 commits', '1y': '~5 400 commits', '2y': '~9 200 commits' },
  },
  jira: {
    id: 'jira',
    name: 'Jira Cloud',
    emoji: '📋',
    tagline: 'Issue tracking · Worklogs · Blocked tickets',
    description: 'TaxLift reads issue status transitions, worklog hours, and blocked ticket durations to detect R&D indicators in your project data.',
    scopes: [
      { label: 'read:jira-work', detail: 'Access issues, worklogs, and sprint data' },
      { label: 'read:jira-user', detail: 'Read account IDs for developer attribution' },
      { label: 'offline_access', detail: 'Refresh tokens to maintain continuous sync' },
    ],
    events: ['issue_updated', 'worklog_created', 'sprint_closed'],
    color: 'bg-blue-700',
    estimated_objects: { '3m': '~340 tickets', '6m': '~780 tickets', '1y': '~1 500 tickets', '2y': '~2 700 tickets' },
  },
  slack: {
    id: 'slack',
    name: 'Slack',
    emoji: '💬',
    tagline: 'Developer interviews · Async context responses',
    description: 'TaxLift uses Slack to send structured interview prompts to developers and collect context that strengthens SR&ED narratives.',
    scopes: [
      { label: 'chat:write', detail: 'Send direct messages to developers for interview prompts' },
      { label: 'users:read', detail: 'Match Slack accounts to GitHub identities' },
      { label: 'im:history', detail: 'Read interview thread responses' },
    ],
    events: ['message', 'app_mention'],
    color: 'bg-purple-700',
    estimated_objects: { '3m': 'N/A', '6m': 'N/A', '1y': 'N/A', '2y': 'N/A' },
  },
}

// ── Step indicator ────────────────────────────────────────────────────────────
// Backfill (6m) and Sensitivity (balanced) are auto-applied — no need to
// interrupt non-technical users with technical configuration steps.
const STEPS = ['Connect', 'Authorize', 'All set!']

function StepIndicator({ current }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((label, i) => {
        const done    = i < current
        const active  = i === current
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all ${
                done   ? 'bg-indigo-600 border-indigo-600 text-white' :
                active ? 'bg-white border-indigo-600 text-indigo-600' :
                         'bg-white border-gray-300 text-gray-400'
              }`}>
                {done ? <Check size={14} /> : i + 1}
              </div>
              <span className={`text-[10px] font-medium whitespace-nowrap ${active ? 'text-indigo-700' : done ? 'text-gray-600' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-12 h-0.5 mb-4 ${i < current ? 'bg-indigo-600' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Step 1: Provider ──────────────────────────────────────────────────────────
function StepProvider({ selected, onSelect, onNext }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Connect a data source</h2>
        <p className="text-sm text-gray-500 mt-1">
          Choose the integration you want to set up. You can add more later from the Integrations page.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {Object.values(PROVIDERS).map(p => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={`w-full text-left border-2 rounded-xl p-4 transition-all ${
              selected === p.id
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-lg ${p.color} flex items-center justify-center text-xl flex-shrink-0`}>
                {p.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-gray-900">{p.name}</span>
                  {selected === p.id && (
                    <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                      <Check size={11} className="text-white" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-indigo-600 font-medium mt-0.5">{p.tagline}</p>
                <p className="text-xs text-gray-500 mt-1">{p.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex justify-end pt-2">
        <Button variant="primary" onClick={onNext} disabled={!selected}>
          Continue <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  )
}

// ── Step 2: Authorize ─────────────────────────────────────────────────────────
function StepAuthorize({ provider, onNext, onBack }) {
  const p = PROVIDERS[provider]
  const [status, setStatus] = useState('idle') // idle | connecting | success

  function handleConnect() {
    setStatus('connecting')
    setTimeout(() => setStatus('success'), 2200)
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Authorize {p?.name}</h2>
        <p className="text-sm text-gray-500 mt-1">
          TaxLift uses read-only OAuth 2.0 access. We never write to your tools.
        </p>
      </div>

      {/* Scopes */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Permissions requested
          </p>
        </div>
        <div className="divide-y divide-gray-100">
          {p?.scopes.map(s => (
            <div key={s.label} className="flex items-start gap-3 px-4 py-3">
              <Lock size={13} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-xs font-mono font-semibold text-indigo-700">{s.label}</span>
                <p className="text-xs text-gray-500 mt-0.5">{s.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Vault security note */}
      <div className="flex items-start gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
        <ShieldCheck size={15} className="text-green-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-green-800">
          Tokens are encrypted at rest using AES-256 and stored in HashiCorp Vault.
          They are never logged and rotate automatically before expiry.
        </p>
      </div>

      {/* Connect button + state */}
      {status === 'idle' && (
        <button
          onClick={handleConnect}
          className="w-full flex items-center justify-center gap-3 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-semibold text-sm transition-colors"
        >
          <span className="text-base">{p?.emoji}</span>
          Connect with {p?.name}
          <ArrowRight size={15} />
        </button>
      )}

      {status === 'connecting' && (
        <div className="w-full flex items-center justify-center gap-3 py-3 bg-indigo-50 border border-indigo-200 rounded-xl">
          <Loader2 size={16} className="text-indigo-600 animate-spin" />
          <span className="text-sm font-medium text-indigo-700">Completing OAuth handshake…</span>
        </div>
      )}

      {status === 'success' && (
        <div className="space-y-3">
          <div className="w-full flex items-center justify-center gap-3 py-3 bg-green-50 border border-green-300 rounded-xl">
            <CheckCircle2 size={16} className="text-green-600" />
            <span className="text-sm font-semibold text-green-700">Connected — token secured in Vault</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { label: 'Webhook registered', val: `/${provider}/events` },
              { label: 'Token expiry', val: '90 days' },
              { label: 'Events subscribed', val: p?.events.join(', ') },
              { label: 'Encryption', val: 'AES-256 / Vault' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <Check size={11} className="text-green-500 flex-shrink-0" />
                <span className="text-gray-500">{item.label}:</span>
                <span className="font-medium text-gray-700 truncate">{item.val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="secondary" onClick={onBack}><ChevronLeft size={14} /> Back</Button>
        <Button variant="primary" onClick={onNext} disabled={status !== 'success'}>
          Continue <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  )
}

// ── Step 3: All Set ───────────────────────────────────────────────────────────
// Backfill and sensitivity are auto-applied with recommended defaults.
// No need to ask non-technical users to configure thresholds.
function StepComplete({ provider, onDone }) {
  const p = PROVIDERS[provider]

  return (
    <div className="space-y-5 text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 size={32} className="text-green-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">{p?.name} is connected!</h2>
          <p className="text-sm text-gray-500 mt-1">
            TaxLift is scanning your commit history in the background.
            First SR&ED clusters typically appear within <strong>2–4 hours</strong>.
          </p>
        </div>
      </div>

      {/* Compact auto-configured summary */}
      <div className="text-left border border-gray-200 rounded-xl overflow-hidden">
        <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Auto-configured for you</p>
          <button
            onClick={() => onDone('/heuristics')}
            className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-medium"
          >
            <SlidersHorizontal size={11} /> Advanced settings
          </button>
        </div>
        <div className="divide-y divide-gray-100">
          {[
            { icon: Webhook,     label: 'Webhook + OAuth secured',  val: 'Vault-encrypted · 90-day rotation' },
            { icon: GitBranch,   label: 'Backfill window',          val: '6 months of history — best for first claims' },
            { icon: Settings2,   label: 'Detection sensitivity',    val: 'Balanced — 8–14 estimated clusters' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3 px-4 py-3">
              <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                <item.icon size={13} className="text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700">{item.label}</p>
                <p className="text-[11px] text-gray-500">{item.val}</p>
              </div>
              <Check size={14} className="text-green-500 flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* What happens next */}
      <div className="text-left bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 space-y-2">
        <p className="text-xs font-semibold text-indigo-800">What happens next</p>
        {[
          'We scan 6 months of your commit history for CRA-eligible R&D signals',
          'SR&ED activity clusters appear on your dashboard as they\'re detected',
          'AI drafts T661 narratives — you review and approve each one',
          'Download your CPA handoff package when you\'re ready to file',
        ].map((step, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="w-4 h-4 rounded-full bg-indigo-200 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[9px] font-bold text-indigo-700">{i + 1}</span>
            </div>
            <p className="text-xs text-indigo-700">{step}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 pt-2">
        <Button variant="primary" onClick={() => onDone('/dashboard')}>
          Go to your dashboard <ArrowRight size={14} />
        </Button>
        <Button variant="secondary" onClick={() => onDone('/welcome')}>
          See your credit estimate first
        </Button>
      </div>
    </div>
  )
}

// ── Main wizard page ──────────────────────────────────────────────────────────
export default function OnboardingWizardPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [step, setStep]         = useState(0)
  const [provider, setProvider] = useState(searchParams.get('provider') ?? '')

  // If a provider was pre-selected via query param, jump straight to Authorize
  useEffect(() => {
    const p = searchParams.get('provider')
    if (p && PROVIDERS[p]) {
      setProvider(p)
      setStep(1)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start py-10 px-4">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center mb-4">
          <TaxLiftLogo variant="light" size="sm" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Connect your first data source</h1>
        <p className="text-sm text-gray-500 mt-1">Takes about 2 minutes. We handle the rest automatically.</p>
      </div>

      {/* Step indicator */}
      <div className="mb-8">
        <StepIndicator current={step} />
      </div>

      {/* Step content */}
      <div className="w-full max-w-lg bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        {step === 0 && (
          <StepProvider
            selected={provider}
            onSelect={setProvider}
            onNext={() => setStep(1)}
          />
        )}
        {step === 1 && (
          <StepAuthorize
            provider={provider}
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && (
          <StepComplete
            provider={provider}
            onDone={path => {
              const ALLOWED = ['/welcome', '/integrations', '/dashboard', '/heuristics']
              navigate(ALLOWED.includes(path) ? path : '/dashboard')
            }}
          />
        )}
      </div>
    </div>
  )
}

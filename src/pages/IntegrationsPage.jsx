import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Github, ExternalLink, RefreshCw, AlertTriangle, CheckCircle2,
  XCircle, Plus, Terminal, Copy, Check, Key, Zap, Clock,
  GitBranch, Activity
} from 'lucide-react'
import { useIntegrations } from '../hooks'
import { BASE_URL, apiFetch } from '../lib/api'
import { formatDateTime } from '../lib/utils'
import { IntegrationBadge } from '../components/ui/Badge'
import Card, { CardHeader } from '../components/ui/Card'
import Button from '../components/ui/Button'

const INTEGRATION_META = {
  github: {
    name: 'GitHub',
    description: 'Monitors push events, pull requests, and commit activity for R&D signal detection.',
    icon: '⚙️',
    events: ['push', 'pull_request', 'check_run'],
  },
  jira: {
    name: 'Jira Cloud',
    description: 'Captures issue updates, status transitions, worklogs, and blocked ticket patterns.',
    icon: '📋',
    events: ['issue_updated', 'worklog_created'],
  },
  slack: {
    name: 'Slack',
    description: 'Sends developer interview prompts and receives async context responses.',
    icon: '💬',
    events: ['message'],
  },
}

const STATUS_ICONS = {
  healthy:      <CheckCircle2 size={16} className="text-green-500" />,
  degraded:     <AlertTriangle size={16} className="text-amber-500" />,
  expired:      <XCircle size={16} className="text-red-500" />,
  disconnected: <XCircle size={16} className="text-gray-400" />,
}

// ── Copy-to-clipboard button ─────────────────────────────────────────────────
function CopyButton({ text, className = '' }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={handleCopy}
      className={`p-1.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors ${className}`}
      title="Copy to clipboard"
    >
      {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
    </button>
  )
}

// ── Code block with copy ──────────────────────────────────────────────────────
function CodeBlock({ code, lang = '' }) {
  return (
    <div className="relative group bg-gray-900 rounded-lg overflow-hidden">
      {lang && (
        <span className="absolute top-2 right-8 text-[10px] text-gray-500 font-mono">{lang}</span>
      )}
      <CopyButton text={code} className="absolute top-1.5 right-1.5 !bg-transparent hover:!bg-gray-700 text-gray-500 hover:text-gray-300" />
      <pre className="text-xs font-mono text-green-300 p-4 pr-8 overflow-x-auto leading-relaxed whitespace-pre">{code}</pre>
    </div>
  )
}

// ── Status dot ────────────────────────────────────────────────────────────────
function StatusDot({ status }) {
  const colours = {
    success: 'bg-green-500',
    failure: 'bg-red-500',
    cancelled: 'bg-gray-400',
    unknown: 'bg-gray-300',
  }
  return (
    <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${colours[status] || colours.unknown}`} />
  )
}

export default function IntegrationsPage() {
  const navigate = useNavigate()
  const { data: integrations = [], refetch: refetchIntegrations } = useIntegrations()
  const [refreshing, setRefreshing] = useState(null)

  // CI token state
  const [ciToken, setCiToken]           = useState(null)
  const [ciTokenLoading, setCiTokenLoading] = useState(false)
  const [ciTokenError, setCiTokenError] = useState(null)
  const [tokenVisible, setTokenVisible] = useState(false)

  // Build runs state
  const [buildRuns, setBuildRuns]     = useState([])
  const [runsLoading, setRunsLoading] = useState(false)

  // Active tab for CI/CD setup panel
  const [ciTab, setCiTab] = useState('github-actions')

  const fetchBuildRuns = useCallback(async () => {
    setRunsLoading(true)
    try {
      const data = await apiFetch('/api/v1/webhooks/build-runs?limit=10')
      setBuildRuns(data.runs || [])
    } catch {
      /* silently ignore — not fatal */
    } finally {
      setRunsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBuildRuns()
  }, [fetchBuildRuns])

  function handleRefresh(integration) {
    setRefreshing(integration)
    setTimeout(() => {
      refetchIntegrations()
      setRefreshing(null)
    }, 1800)
  }

  async function handleGenerateCIToken() {
    setCiTokenLoading(true)
    setCiTokenError(null)
    try {
      const data = await apiFetch('/api/v1/webhooks/ci-token', { method: 'POST' })
      setCiToken(data.ci_token)
      setTokenVisible(true)
    } catch (err) {
      setCiTokenError(err.message || 'Failed to generate token')
    } finally {
      setCiTokenLoading(false)
    }
  }

  const apiBase  = BASE_URL || 'https://app2026-production.up.railway.app'
  const ghWebhookUrl = `${apiBase}/api/v1/webhooks/github`
  const ciEndpointUrl = `${apiBase}/api/v1/webhooks/ci`

  const TABS = [
    { id: 'github-actions',  label: 'GitHub Actions' },
    { id: 'gitlab',          label: 'GitLab CI' },
    { id: 'circleci',        label: 'CircleCI' },
    { id: 'jenkins',         label: 'Jenkins' },
    { id: 'other',           label: 'Other CI' },
  ]

  const CLI_SNIPPETS = {
    'github-actions': `# .github/workflows/ci.yml — add after your existing steps:
- name: Record build in TaxLift (SR&ED evidence)
  if: always()          # run even on failure — failed builds = R&D signal
  env:
    TAXLIFT_TOKEN: \${{ secrets.TAXLIFT_TOKEN }}
    TAXLIFT_STATUS: \${{ job.status }}
  run: npx taxlift-ci --optional`,

    'gitlab': `# .gitlab-ci.yml — add as a final stage:
taxlift:
  stage: report
  when: always
  script:
    - TAXLIFT_STATUS=$CI_JOB_STATUS npx taxlift-ci --optional
  variables:
    TAXLIFT_TOKEN: \$TAXLIFT_TOKEN`,

    'circleci': `# .circleci/config.yml — add as a final step in each job:
- run:
    name: Record build in TaxLift
    when: always
    command: |
      TAXLIFT_TOKEN=\${TAXLIFT_TOKEN} npx taxlift-ci --optional`,

    'jenkins': `// Jenkinsfile — add in post section:
post {
  always {
    sh """
      TAXLIFT_TOKEN=\${env.TAXLIFT_TOKEN} \\
      TAXLIFT_STATUS=\${currentBuild.currentResult.toLowerCase()} \\
      npx taxlift-ci --optional
    """
  }
}`,

    'other': `# Any shell-based CI — run after your build:
export TAXLIFT_TOKEN="<your-token>"
export TAXLIFT_STATUS="success"   # or "failure", "cancelled"
export TAXLIFT_BRANCH="\$(git rev-parse --abbrev-ref HEAD)"
export TAXLIFT_COMMIT="\$(git rev-parse HEAD)"
export TAXLIFT_DURATION_SECONDS="420"   # your build duration

npx taxlift-ci --optional`,
  }

  const maskedToken = ciToken
    ? ciToken.slice(0, 8) + '•'.repeat(24) + ciToken.slice(-8)
    : null

  return (
    <div className="space-y-5">

      {/* ── Existing OAuth integrations ── */}
      <Card>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-gray-600">
            Manage OAuth integrations for data source monitoring. TaxLift uses <strong>read-only</strong> access — it never writes to your tools.
          </p>
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => navigate('/onboarding')}
          >
            Connect New
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4">
        {integrations.map(intg => {
          const meta = INTEGRATION_META[intg.integration]
          if (!meta) return null
          return (
            <Card key={intg.integration}>
              <div className="flex items-start gap-5">
                <div className="text-3xl flex-shrink-0 mt-1">{meta.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-base font-semibold text-gray-900">{meta.name}</h3>
                    <IntegrationBadge status={intg.status} />
                    {STATUS_ICONS[intg.status]}
                  </div>
                  <p className="text-sm text-gray-500 mb-3">{meta.description}</p>
                  <div className="flex flex-wrap gap-6 text-xs text-gray-500">
                    <span>
                      <span className="font-medium text-gray-700">Last sync:</span>{' '}
                      {intg.last_sync_at ? formatDateTime(intg.last_sync_at) : 'Never'}
                    </span>
                    {intg.token_expires_at && (
                      <span>
                        <span className="font-medium text-gray-700">Token expires:</span>{' '}
                        {new Date(intg.token_expires_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                    )}
                    <span>
                      <span className="font-medium text-gray-700">Events:</span>{' '}
                      {meta.events.join(', ')}
                    </span>
                  </div>
                  {intg.error_detail && (
                    <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
                      <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-800">{intg.error_detail}</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={RefreshCw}
                    onClick={() => handleRefresh(intg.integration)}
                    disabled={refreshing === intg.integration}
                  >
                    {refreshing === intg.integration ? 'Syncing…' : 'Sync Now'}
                  </Button>
                  {intg.status === 'disconnected' || intg.status === 'expired' ? (
                    <Button size="sm" icon={ExternalLink} onClick={() => navigate(`/onboarding?provider=${intg.integration}`)}>
                      Reconnect
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/onboarding?provider=${intg.integration}`)}>
                      Configure
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* ── CI/CD Pipeline Integration ── */}
      <Card>
        <CardHeader
          title="CI/CD Pipeline Integration"
          subtitle="Capture build runs as SR&ED evidence — one step added to your existing pipeline"
        />

        {/* How it works */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { icon: Terminal, label: '1. Add one step', desc: 'Drop npx taxlift-ci into your pipeline YAML' },
            { icon: Zap,      label: '2. Auto-attributed', desc: 'Builds are matched to SR&ED clusters by branch and commit' },
            { icon: Activity, label: '3. Evidence generated', desc: 'Build duration, failures, and test results feed your T661' },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
              <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Icon size={16} className="text-indigo-600" />
              </div>
              <p className="text-xs font-semibold text-gray-800 mb-1">{label}</p>
              <p className="text-xs text-gray-500">{desc}</p>
            </div>
          ))}
        </div>

        {/* Step 1 — API token */}
        <div className="mb-5">
          <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Key size={14} className="text-indigo-500" />
            Step 1 — Generate your CI token
          </h4>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 font-mono text-xs text-gray-600 overflow-hidden">
              {ciToken
                ? (tokenVisible ? ciToken : maskedToken)
                : <span className="text-gray-400">No token generated yet</span>
              }
            </div>
            {ciToken && (
              <>
                <CopyButton text={ciToken} />
                <button
                  onClick={() => setTokenVisible(v => !v)}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  {tokenVisible ? 'Hide' : 'Show'}
                </button>
              </>
            )}
            <Button
              variant={ciToken ? 'secondary' : 'primary'}
              size="sm"
              icon={Key}
              onClick={handleGenerateCIToken}
              disabled={ciTokenLoading}
            >
              {ciTokenLoading ? 'Generating…' : ciToken ? 'Rotate Token' : 'Generate Token'}
            </Button>
          </div>
          {ciTokenError && (
            <p className="text-xs text-red-600 mt-2">{ciTokenError}</p>
          )}
          {ciToken && (
            <p className="text-xs text-amber-700 mt-2 bg-amber-50 border border-amber-100 rounded px-3 py-1.5">
              ⚠️ Copy this token now — it won't be shown again. Add it as <code className="font-mono">TAXLIFT_TOKEN</code> in your CI secrets.
            </p>
          )}
        </div>

        {/* Step 2 — Add to pipeline */}
        <div className="mb-5">
          <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Terminal size={14} className="text-indigo-500" />
            Step 2 — Add to your pipeline
          </h4>
          {/* Tabs */}
          <div className="flex gap-1 mb-3 border-b border-gray-100">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setCiTab(t.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${
                  ciTab === t.id
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <CodeBlock code={CLI_SNIPPETS[ciTab]} lang="yaml" />
        </div>

        {/* SR&ED eligibility rules */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-indigo-800 mb-2">How builds become SR&ED evidence</p>
          <div className="grid grid-cols-2 gap-2 text-xs text-indigo-700">
            {[
              ['experimental/, spike/, research/, poc/ branches', 'Auto-eligible — signals R&D activity'],
              ['Failed builds', 'Technological uncertainty (core SR&ED criterion)'],
              ['Long builds on feature branches (>12 min)', 'Iterative R&D signal'],
              ['Test failures', 'Systematic investigation indicator'],
            ].map(([rule, reason]) => (
              <div key={rule} className="flex gap-2">
                <CheckCircle2 size={12} className="text-indigo-500 flex-shrink-0 mt-0.5" />
                <span><strong>{rule}</strong> — {reason}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* ── GitHub App webhook (Pattern A) ── */}
      <Card>
        <CardHeader
          title="GitHub App Webhook"
          subtitle="Alternative to the CLI agent — install the TaxLift GitHub App to capture workflow_run events automatically"
        />
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <span className="text-xs font-medium text-gray-700 w-36 flex-shrink-0">Webhook URL</span>
            <code className="text-xs font-mono text-indigo-700 bg-indigo-50 px-2 py-1 rounded flex-1 overflow-x-auto">{ghWebhookUrl}</code>
            <CopyButton text={ghWebhookUrl} />
            <span className="text-[10px] text-gray-400 whitespace-nowrap">HMAC-SHA256</span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <span className="text-xs font-medium text-gray-700 w-36 flex-shrink-0">Content type</span>
            <code className="text-xs font-mono text-gray-600">application/json</code>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <span className="text-xs font-medium text-gray-700 w-36 flex-shrink-0">Events to send</span>
            <code className="text-xs font-mono text-gray-600">Workflow runs</code>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Set <code className="font-mono bg-gray-100 px-1 rounded">GITHUB_WEBHOOK_SECRET</code> in Railway to the same secret you configure in GitHub → Settings → Webhooks.
          </p>
        </div>
      </Card>

      {/* ── Recent build runs ── */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardHeader title="Recent Build Runs" subtitle="Last 10 builds captured across all pipelines" />
          <Button variant="ghost" size="sm" icon={RefreshCw} onClick={fetchBuildRuns} disabled={runsLoading}>
            {runsLoading ? 'Loading…' : 'Refresh'}
          </Button>
        </div>

        {buildRuns.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Terminal size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium text-gray-500">No builds recorded yet</p>
            <p className="text-xs mt-1">Generate a CI token and add <code className="font-mono">npx taxlift-ci</code> to your pipeline to start capturing builds.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {buildRuns.map(run => (
              <div key={run.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                <StatusDot status={run.status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-gray-800 truncate max-w-[200px]">{run.workflow_name || run.repo || 'Build'}</span>
                    {run.branch && (
                      <span className="flex items-center gap-1 text-gray-400">
                        <GitBranch size={10} />
                        <span className="truncate max-w-[120px]">{run.branch}</span>
                      </span>
                    )}
                    {run.sred_eligible ? (
                      <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-[10px] font-semibold">SR&ED</span>
                    ) : (
                      <span className="px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded text-[10px]">Non-eligible</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[10px] text-gray-400">
                    <span className="capitalize">{run.provider}</span>
                    {run.duration_seconds > 0 && (
                      <span className="flex items-center gap-1">
                        <Clock size={9} />
                        {run.duration_seconds >= 60
                          ? `${Math.floor(run.duration_seconds / 60)}m ${run.duration_seconds % 60}s`
                          : `${run.duration_seconds}s`}
                      </span>
                    )}
                    {run.cluster_name && (
                      <span className="text-indigo-500">→ {run.cluster_name}</span>
                    )}
                    <span>{run.started_at ? new Date(run.started_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  </div>
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  run.status === 'success'   ? 'bg-green-50 text-green-700' :
                  run.status === 'failure'   ? 'bg-red-50 text-red-600'    :
                  run.status === 'cancelled' ? 'bg-gray-100 text-gray-500' :
                  'bg-gray-50 text-gray-400'
                }`}>
                  {run.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

    </div>
  )
}

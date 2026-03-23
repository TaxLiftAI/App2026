import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Github, ExternalLink, RefreshCw, AlertTriangle, CheckCircle2, Clock, XCircle, Plus } from 'lucide-react'
import { INTEGRATIONS } from '../data/mockData'
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

export default function IntegrationsPage() {
  const navigate = useNavigate()
  const [integrations, setIntegrations] = useState(INTEGRATIONS)
  const [refreshing, setRefreshing] = useState(null)

  function handleRefresh(integration) {
    setRefreshing(integration)
    setTimeout(() => {
      setIntegrations(prev => prev.map(i =>
        i.integration === integration
          ? { ...i, status: 'healthy', last_sync_at: new Date().toISOString(), error_detail: null }
          : i
      ))
      setRefreshing(null)
    }, 1800)
  }

  return (
    <div className="space-y-5">
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
          return (
            <Card key={intg.integration}>
              <div className="flex items-start gap-5">
                {/* Icon */}
                <div className="text-3xl flex-shrink-0 mt-1">{meta.icon}</div>

                {/* Info */}
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

                {/* Actions */}
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
                    <Button
                      size="sm"
                      icon={ExternalLink}
                      onClick={() => navigate(`/onboarding?provider=${intg.integration}`)}
                    >
                      Reconnect
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/onboarding?provider=${intg.integration}`)}
                    >
                      Configure
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Webhook info */}
      <Card>
        <CardHeader title="Webhook Endpoints" subtitle="Register these URLs in your tools to enable real-time event ingestion" />
        <div className="space-y-3">
          {[
            { label: 'GitHub Webhook', url: 'https://api.taxlift.ai/api/v1/webhooks/github' },
            { label: 'Jira Webhook',   url: 'https://api.taxlift.ai/api/v1/webhooks/jira'   },
          ].map(wh => (
            <div key={wh.label} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <span className="text-xs font-medium text-gray-700 w-32">{wh.label}</span>
              <code className="text-xs font-mono text-indigo-700 bg-indigo-50 px-2 py-1 rounded flex-1">{wh.url}</code>
              <span className="text-[10px] text-gray-400">HMAC-SHA256 signed</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

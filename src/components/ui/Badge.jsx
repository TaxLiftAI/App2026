import { STATUS_COLORS, INTEGRATION_COLORS, ROLE_COLORS } from '../../lib/utils'

export function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] ?? { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {status}
    </span>
  )
}

export function IntegrationBadge({ status }) {
  const c = INTEGRATION_COLORS[status] ?? INTEGRATION_COLORS.disconnected
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text} capitalize`}>
      {status}
    </span>
  )
}

export function RoleBadge({ role }) {
  const c = ROLE_COLORS[role] ?? { bg: 'bg-gray-100', text: 'text-gray-700' }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {role}
    </span>
  )
}

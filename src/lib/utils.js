// ─── Formatting ───────────────────────────────────────────────────────────────
export function formatCurrency(amount, currency = 'CAD') {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(iso, opts = {}) {
  if (!iso) return '—'
  const d = new Date(iso)
  const defaultOpts = { year: 'numeric', month: 'short', day: 'numeric', ...opts }
  return d.toLocaleDateString('en-CA', defaultOpts)
}

export function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function formatHours(h) {
  if (h == null) return '—'
  return `${h.toLocaleString()}h`
}

export function formatPercent(p) {
  if (p == null) return '—'
  return `${p.toFixed(0)}%`
}

export function formatRiskScore(score) {
  return `${(score * 100).toFixed(0)}%`
}

// ─── Status helpers ───────────────────────────────────────────────────────────
export const STATUS_COLORS = {
  New:        { bg: 'bg-gray-100',   text: 'text-gray-700',   dot: 'bg-gray-400'   },
  Interviewed:{ bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500'   },
  Drafted:    { bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500'  },
  Approved:   { bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500'  },
  Rejected:   { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-400'    },
  Merged:     { bg: 'bg-slate-100',  text: 'text-slate-600',  dot: 'bg-slate-400'  },
}

export const INTEGRATION_COLORS = {
  healthy:    { bg: 'bg-green-100',  text: 'text-green-700'  },
  degraded:   { bg: 'bg-amber-100',  text: 'text-amber-700'  },
  expired:    { bg: 'bg-red-100',    text: 'text-red-700'    },
  disconnected:{ bg: 'bg-gray-100', text: 'text-gray-600'   },
}

export const ROLE_COLORS = {
  Admin:    { bg: 'bg-purple-100', text: 'text-purple-700' },
  Reviewer: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  Developer:{ bg: 'bg-blue-100',   text: 'text-blue-700'   },
  Auditor:  { bg: 'bg-teal-100',   text: 'text-teal-700'   },
  Support:  { bg: 'bg-orange-100', text: 'text-orange-700' },
}

export function riskColor(score) {
  if (score >= 0.85) return 'text-green-600'
  if (score >= 0.70) return 'text-amber-600'
  return 'text-red-500'
}

export function riskBarColor(score) {
  if (score >= 0.85) return 'bg-green-500'
  if (score >= 0.70) return 'bg-amber-500'
  return 'bg-red-400'
}

// ─── Route helpers ────────────────────────────────────────────────────────────
export const ROLE_CAN = {
  viewClusters: ['Reviewer', 'Admin', 'Auditor', 'Support'],
  editClusters: ['Reviewer', 'Admin'],
  viewNarratives: ['Reviewer', 'Admin', 'Auditor'],
  editNarratives: ['Reviewer', 'Admin'],
  viewReports: ['Reviewer', 'Admin', 'Auditor'],
  viewUsers: ['Admin'],
  viewAuditLog: ['Admin', 'Auditor', 'Support'],
  viewIntegrations: ['Admin'],
  viewRateCard:     ['Admin'],
  viewDevPortal:    ['Developer', 'Admin', 'Reviewer'],
  viewHeuristics:   ['Admin'],
  editHeuristics:   ['Admin'],
  viewAnalytics:      ['Admin', 'Reviewer', 'Auditor'],
  viewActivity:       ['Admin', 'Auditor'],
  viewAuditReadiness: ['Admin', 'Reviewer', 'Auditor'],
  viewNotifications:  ['Admin', 'Reviewer', 'Auditor', 'Developer', 'Support'],
  viewVault:          ['Admin', 'Reviewer', 'Auditor'],
  uploadVault:        ['Admin', 'Reviewer'],
  viewCPAPortal:      ['Admin', 'Auditor', 'CPA'],
}

export function canDo(action, role) {
  return ROLE_CAN[action]?.includes(role) ?? false
}

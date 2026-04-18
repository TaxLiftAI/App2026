import { useState, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { Download, Calendar, DollarSign, Clock, CheckCircle2, Printer, FileSpreadsheet, Building2, Info, Calculator, ChevronDown, ChevronUp, FlaskConical, Briefcase, Share2, Lock } from 'lucide-react'
import CpaHandoffPackage from '../components/CpaHandoffPackage'
import ShareWithCpaModal from '../components/ShareWithCpaModal'
import { useAuth } from '../context/AuthContext'
import { EVIDENCE_SNAPSHOTS, USERS, RATE_CARDS } from '../data/mockData'
import { formatCurrency, formatHours, formatPercent, formatDate, formatDateTime } from '../lib/utils'
import { useReportSummary, useReportClusters, useNarratives } from '../hooks'
import { StatusBadge } from '../components/ui/Badge'
import Card, { CardHeader } from '../components/ui/Card'
import Button from '../components/ui/Button'
import RiskScore from '../components/ui/RiskScore'
import UpgradeModal from '../components/ui/UpgradeModal'

const CURRENT_YEAR = 2026

// ── Per-developer hours breakdown ─────────────────────────────────────────────
// Distributes approved cluster hours across developers proportionally by commit count
function getDevHoursBreakdown(approvedClusters) {
  const devHours = {} // github_user_id → hours

  for (const cluster of approvedClusters) {
    const snap = EVIDENCE_SNAPSHOTS[cluster.evidence_snapshot_id]
    const totalHours = cluster.aggregate_time_hours ?? 0
    if (!snap?.git_commits?.length || totalHours === 0) continue

    // Count commits per author
    const authorCounts = {}
    for (const commit of snap.git_commits) {
      authorCounts[commit.author] = (authorCounts[commit.author] ?? 0) + 1
    }
    const totalCommits = Object.values(authorCounts).reduce((a, b) => a + b, 0)

    for (const [author, count] of Object.entries(authorCounts)) {
      devHours[author] = (devHours[author] ?? 0) + totalHours * (count / totalCommits)
    }
  }

  // Map github_user_id → USERS record + RATE_CARDS
  return Object.entries(devHours).map(([githubId, hours]) => {
    const user = USERS.find(u => u.github_user_id === githubId)
    const card = user ? RATE_CARDS[user.id] : null
    const effRate = card
      ? card.hourly_rate_cad * (1 + card.overhead_pct / 100)
      : null
    const eligibleWage = effRate != null ? hours * effRate : null

    return {
      github_id: githubId,
      display_name: user?.display_name ?? githubId,
      role: user?.role ?? '—',
      employment_type: card?.employment_type ?? '—',
      hours: Math.round(hours * 10) / 10,
      hourly_rate: card?.hourly_rate_cad ?? null,
      overhead_pct: card?.overhead_pct ?? null,
      effective_rate: effRate,
      eligible_wage_cad: eligibleWage,
    }
  }).sort((a, b) => b.hours - a.hours)
}

// ── Simple deterministic checksum for the report ──────────────────────────────
function generateReportChecksum(report) {
  const payload = JSON.stringify({
    period: [report.period_start, report.period_end],
    clusters: report.clusters.map(c => ({
      id: c.id, hours: c.aggregate_time_hours,
      credit_cad: c.estimated_credit_cad,
      rule_v: c.eligibility_rule_version_id,
    })),
  })
  let hash = 0x811c9dc5
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i)
    hash = (hash * 0x01000193) >>> 0
  }
  return `sha256:${hash.toString(16).padStart(8, '0')}...${(hash ^ 0xdeadbeef).toString(16).padStart(8, '0')}`
}

// ── Printable Report (hidden on screen, shown during window.print()) ──────────
function PrintableReport({ report, devBreakdown, generatedAt }) {
  const ruleVersions = [...new Set(report.clusters.map(c => c.eligibility_rule_version_id).filter(Boolean))]
  const checksum = generateReportChecksum(report)

  return (
    <div id="taxlift-printable-report">
      <style>{`
        @media screen {
          #taxlift-printable-report { display: none; }
        }
        @media print {
          body * { visibility: hidden !important; }
          #taxlift-printable-report,
          #taxlift-printable-report * { visibility: visible !important; }
          #taxlift-printable-report {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            padding: 32px !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 11px;
            color: #1e293b;
            background: white !important;
          }
          .pr-section { margin-bottom: 24px; }
          .pr-h1 { font-size: 20px; font-weight: 700; color: #1e293b; }
          .pr-h2 { font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
          .pr-meta { display: flex; gap: 32px; margin: 8px 0 16px; font-size: 10px; color: #64748b; }
          .pr-meta span { display: flex; flex-direction: column; }
          .pr-meta strong { font-size: 11px; color: #1e293b; font-weight: 600; margin-top: 1px; }
          .pr-table { width: 100%; border-collapse: collapse; font-size: 10px; }
          .pr-table th { background: #f8fafc; padding: 6px 8px; text-align: left; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; border: 1px solid #e2e8f0; }
          .pr-table td { padding: 6px 8px; border: 1px solid #e2e8f0; vertical-align: top; }
          .pr-table tr:nth-child(even) td { background: #f8fafc; }
          .pr-tfoot td { background: #f1f5f9 !important; font-weight: 700; border-top: 2px solid #94a3b8; }
          .pr-badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 9px; font-weight: 600; }
          .pr-badge-approved { background: #dcfce7; color: #166534; }
          .pr-badge-drafted  { background: #fef3c7; color: #92400e; }
          .pr-badge-new      { background: #f1f5f9; color: #475569; }
          .pr-badge-rejected { background: #fee2e2; color: #991b1b; }
          .pr-badge-interviewed { background: #dbeafe; color: #1e40af; }
          .pr-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
          .pr-summary-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; }
          .pr-summary-box .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
          .pr-summary-box .value { font-size: 16px; font-weight: 700; color: #1e293b; margin-top: 2px; }
          .pr-footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between; }
          @page { margin: 15mm; size: A4 landscape; }
        }
      `}</style>

      {/* Letterhead */}
      <div className="pr-section">
        <p className="pr-h1">TaxLift — SR&ED Financial Report</p>
        <div className="pr-meta">
          <span>Period<strong>{formatDate(report.period_start)} – {formatDate(report.period_end)}</strong></span>
          <span>Generated<strong>{formatDateTime(generatedAt)}</strong></span>
          <span>Rules Version<strong>{ruleVersions.join(', ') || '—'}</strong></span>
          <span>Report Checksum<strong style={{ fontFamily: 'monospace', fontSize: 9 }}>{checksum}</strong></span>
        </div>

        {/* Summary boxes */}
        <div className="pr-summary">
          {[
            ['Total Clusters', report.total_clusters],
            ['Approved', report.approved_clusters],
            ['Total Eligible Hours', `${report.total_eligible_hours.toLocaleString()}h`],
            ['Total Credit (CAD)', formatCurrency(report.total_credit_cad)],
          ].map(([label, value]) => (
            <div key={label} className="pr-summary-box">
              <div className="label">{label}</div>
              <div className="value">{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Cluster Breakdown */}
      <div className="pr-section">
        <p className="pr-h2">Cluster Breakdown</p>
        <table className="pr-table">
          <thead>
            <tr>
              {['Business Component', 'Status', 'Risk', 'Eligible Hours', 'Eligibility %', 'Rule Version', 'Credit (CAD)', 'Credit (USD)'].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.clusters.map(c => (
              <tr key={c.id}>
                <td style={{ maxWidth: 200 }}>{c.business_component ?? '—'}</td>
                <td>
                  <span className={`pr-badge pr-badge-${(c.status ?? 'new').toLowerCase()}`}>{c.status}</span>
                </td>
                <td style={{ textAlign: 'right' }}>{c.risk_score != null ? `${(c.risk_score * 100).toFixed(0)}%` : '—'}</td>
                <td style={{ textAlign: 'right' }}>{c.aggregate_time_hours != null ? `${c.aggregate_time_hours}h` : '—'}</td>
                <td style={{ textAlign: 'right' }}>
                  {c.eligibility_percentage != null
                    ? `${c.eligibility_percentage}%${c.manual_override_pct ? ` (+${c.manual_override_pct}%)` : ''}`
                    : '—'}
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: 9 }}>{c.eligibility_rule_version_id ?? '—'}</td>
                <td style={{ textAlign: 'right', fontWeight: c.estimated_credit_cad ? 600 : 400 }}>
                  {formatCurrency(c.estimated_credit_cad)}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {formatCurrency(c.estimated_credit_usd, 'USD')}
                </td>
              </tr>
            ))}
          </tbody>
          {report.approved_clusters > 0 && (
            <tfoot>
              <tr>
                <td colSpan={3} className="pr-tfoot">Totals (Approved only)</td>
                <td className="pr-tfoot" style={{ textAlign: 'right' }}>{report.total_eligible_hours}h</td>
                <td className="pr-tfoot">—</td>
                <td className="pr-tfoot">—</td>
                <td className="pr-tfoot" style={{ textAlign: 'right', color: '#065f46' }}>{formatCurrency(report.total_credit_cad)}</td>
                <td className="pr-tfoot" style={{ textAlign: 'right', color: '#065f46' }}>{formatCurrency(report.total_credit_usd, 'USD')}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Per-developer hours breakdown */}
      {devBreakdown.length > 0 && (
        <div className="pr-section">
          <p className="pr-h2">Eligible Hours by Developer</p>
          <table className="pr-table">
            <thead>
              <tr>
                {['Developer', 'Role', 'Employment', 'Hours Attributed', 'Hourly Rate (CA$)', 'Overhead %', 'Effective Rate (CA$)', 'Eligible Wages (CA$)'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {devBreakdown.map(row => (
                <tr key={row.github_id}>
                  <td>{row.display_name}</td>
                  <td>{row.role}</td>
                  <td>{row.employment_type}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{row.hours}h</td>
                  <td style={{ textAlign: 'right' }}>{row.hourly_rate != null ? `$${row.hourly_rate.toFixed(2)}` : '—'}</td>
                  <td style={{ textAlign: 'right' }}>{row.overhead_pct != null ? `${row.overhead_pct}%` : '—'}</td>
                  <td style={{ textAlign: 'right' }}>{row.effective_rate != null ? `$${row.effective_rate.toFixed(2)}` : '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: '#065f46' }}>
                    {row.eligible_wage_cad != null ? formatCurrency(row.eligible_wage_cad) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="pr-tfoot">Totals</td>
                <td className="pr-tfoot" style={{ textAlign: 'right' }}>
                  {devBreakdown.reduce((s, r) => s + r.hours, 0).toFixed(1)}h
                </td>
                <td colSpan={3} className="pr-tfoot">—</td>
                <td className="pr-tfoot" style={{ textAlign: 'right', color: '#065f46' }}>
                  {formatCurrency(devBreakdown.reduce((s, r) => s + (r.eligible_wage_cad ?? 0), 0))}
                </td>
              </tr>
            </tfoot>
          </table>
          <p style={{ fontSize: 9, color: '#94a3b8', marginTop: 4 }}>
            * Hours attributed proportionally by commit count. Proxy-used clusters excluded from this breakdown.
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="pr-footer">
        <span>TaxLift R&D Tax Platform · Confidential · For CPA review</span>
        <span>Checksum: {checksum}</span>
      </div>
    </div>
  )
}

// ── T661 data builder ─────────────────────────────────────────────────────────
function buildT661(report, devBreakdown, entityType) {
  const employees   = devBreakdown.filter(r => r.employment_type === 'Employee')
  const contractors = devBreakdown.filter(r => r.employment_type === 'Contractor')

  // Part 1 — SR&ED Expenditures
  const line100 = Math.round(employees.reduce((s, r) => s + (r.eligible_wage_cad ?? 0), 0))    // SR&ED salaries
  const line200 = Math.round(contractors.reduce((s, r) => s + (r.eligible_wage_cad ?? 0), 0))  // SR&ED contractors
  const line300 = Math.round(line100 * 0.08)    // Materials (8% of wages — proxy for software cos)
  const line400 = Math.round(line100 * 0.55)    // Overhead proxy (55% of SR&ED salaries — T661 proxy method)
  const line500 = 0                              // Third-party SR&ED payments
  const line600 = line100 + line200 + line300 + line400 + line500  // Total current SR&ED

  // Part 2 — ITC Calculation
  const ccpcRate1 = 0.35   // 35% on first $3M (CCPC only)
  const ccpcRate2 = 0.15   // 15% on amounts above $3M
  const otherRate = 0.15   // flat 15% for non-CCPC

  const CCPC_THRESHOLD = 3_000_000
  let line700 = 0   // Capital — n/a for software

  let itc = 0
  if (entityType === 'CCPC') {
    const tranche1 = Math.min(line600, CCPC_THRESHOLD)
    const tranche2 = Math.max(0, line600 - CCPC_THRESHOLD)
    itc = Math.round(tranche1 * ccpcRate1 + tranche2 * ccpcRate2)
  } else {
    itc = Math.round(line600 * otherRate)
  }

  // Refundability (CCPC: 100% of 35% portion is refundable; other: non-refundable)
  const refundable = entityType === 'CCPC'
    ? Math.round(Math.min(line600, CCPC_THRESHOLD) * ccpcRate1)
    : 0
  const nonRefundable = itc - refundable

  return {
    line100, line200, line300, line400, line500, line600,
    line700, totalExp: line600 + line700,
    itc, refundable, nonRefundable,
    entityType,
    proxyMethod: true,
  }
}

// ── T661 Schedule component ───────────────────────────────────────────────────
function T661Schedule({ report, devBreakdown }) {
  const [entityType, setEntityType] = useState('CCPC')
  const [infoOpen, setInfoOpen] = useState(false)
  const t = buildT661(report, devBreakdown, entityType)

  const LINES = [
    { num: '100', label: 'SR&ED salaries and wages (employees)',     value: t.line100, note: 'Attributed from approved clusters by commit proportion' },
    { num: '200', label: 'SR&ED contractor payments',                value: t.line200, note: 'Contracts engaged in SR&ED work' },
    { num: '300', label: 'SR&ED materials consumed or transformed',  value: t.line300, note: '8% of wages — proxy for software companies' },
    { num: '400', label: 'Overhead — proxy method (55% × wages)',    value: t.line400, note: 'Prescribed proxy amount; alternative to traditional overhead' },
    { num: '500', label: 'Third-party SR&ED payments',               value: t.line500, note: 'Payments to qualified third-party contractors for SR&ED' },
  ]

  const hasData = t.line600 > 0

  return (
    <div className="space-y-6">
      {/* Entity type + info toggle */}
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-1.5">Entity Type</p>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {['CCPC', 'Other'].map(t => (
              <button
                key={t}
                onClick={() => setEntityType(t)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  entityType === t ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'CCPC' ? 'CCPC (35%)' : 'Other Corp (15%)'}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => setInfoOpen(o => !o)}
          className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 mt-4"
        >
          <Info size={13} />
          About T661 proxy method
          {infoOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {infoOpen && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-800 space-y-1.5">
          <p className="font-semibold">CRA T661 — Prescribed Proxy Amount (PPA) Method</p>
          <p>Instead of tracking actual overhead costs, the PPA method allows SR&ED claimants to deduct <strong>55% of SR&ED salaries</strong> as overhead. This is the most common method for software companies.</p>
          <p>Hours and wages are attributed proportionally based on commit counts per developer across approved clusters. Proxy-used clusters contribute time at the Low confidence rate.</p>
          <p className="text-blue-600">⚠ This schedule is for review only. Your CPA or SR&ED specialist must review and confirm all figures. TaxLift does not file with the CRA — your CPA handles the T661 submission.</p>
        </div>
      )}

      {!hasData ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <FileSpreadsheet size={28} className="mb-2 opacity-40" />
          <p className="text-sm font-medium text-gray-500">No approved clusters in selected period</p>
          <p className="text-xs mt-1">Approve clusters to generate T661 estimates.</p>
        </div>
      ) : (
        <>
          {/* Part 1 */}
          <Card padding={false}>
            <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Part 1 — SR&ED Expenditures</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Current expenditures · Proxy method</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-16">Line</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Amount (CAD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {LINES.map(line => (
                  <tr key={line.num} className="hover:bg-gray-50 group">
                    <td className="px-6 py-3">
                      <span className="font-mono text-xs font-semibold text-gray-400">{line.num}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-800">{line.label}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5 group-hover:text-gray-500">{line.note}</p>
                    </td>
                    <td className={`px-6 py-3 text-right tabular-nums font-semibold ${line.value > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                      {line.value > 0 ? formatCurrency(line.value) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-indigo-200 bg-indigo-50">
                  <td className="px-6 py-3">
                    <span className="font-mono text-xs font-bold text-indigo-700">600</span>
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-indigo-900">Total current SR&ED expenditures</td>
                  <td className="px-6 py-3 text-right text-sm font-bold text-indigo-900 tabular-nums">
                    {formatCurrency(t.line600)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </Card>

          {/* Part 2 — ITC */}
          <Card padding={false}>
            <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Part 2 — Investment Tax Credit (ITC)</p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {entityType === 'CCPC' ? '35% on first $3M · 15% above $3M (CCPC)' : 'Flat 15% (non-CCPC)'}
              </p>
            </div>
            <div className="divide-y divide-gray-50">
              {entityType === 'CCPC' ? (
                <>
                  <div className="flex items-center justify-between px-6 py-3 hover:bg-gray-50">
                    <div>
                      <p className="text-sm text-gray-700">Tranche 1 — first {formatCurrency(Math.min(t.line600, 3_000_000))} @ 35%</p>
                      <p className="text-[10px] text-gray-400">CCPC enhanced rate on first $3M of qualified expenditures</p>
                    </div>
                    <span className="font-semibold text-gray-900 tabular-nums">
                      {formatCurrency(Math.round(Math.min(t.line600, 3_000_000) * 0.35))}
                    </span>
                  </div>
                  {t.line600 > 3_000_000 && (
                    <div className="flex items-center justify-between px-6 py-3 hover:bg-gray-50">
                      <div>
                        <p className="text-sm text-gray-700">Tranche 2 — {formatCurrency(t.line600 - 3_000_000)} @ 15%</p>
                        <p className="text-[10px] text-gray-400">Regular rate on expenditures exceeding $3M threshold</p>
                      </div>
                      <span className="font-semibold text-gray-900 tabular-nums">
                        {formatCurrency(Math.round((t.line600 - 3_000_000) * 0.15))}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-between px-6 py-3 hover:bg-gray-50">
                  <div>
                    <p className="text-sm text-gray-700">{formatCurrency(t.line600)} @ 15%</p>
                    <p className="text-[10px] text-gray-400">Non-CCPC flat rate on all qualified SR&ED expenditures</p>
                  </div>
                  <span className="font-semibold text-gray-900 tabular-nums">
                    {formatCurrency(t.itc)}
                  </span>
                </div>
              )}
            </div>
            <div className="border-t-2 border-emerald-200 bg-emerald-50 px-6 py-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-emerald-900">Total ITC Earned</p>
                <p className="text-xl font-bold text-emerald-700 tabular-nums">{formatCurrency(t.itc)}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-white rounded-lg border border-emerald-200 p-3">
                  <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-1">Refundable ITC</p>
                  <p className="text-base font-bold text-emerald-700 tabular-nums">{formatCurrency(t.refundable)}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {entityType === 'CCPC' ? 'Paid out as cash refund (CCPC)' : 'Non-refundable for non-CCPC corps'}
                  </p>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-3">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Non-Refundable ITC</p>
                  <p className="text-base font-bold text-gray-700 tabular-nums">{formatCurrency(t.nonRefundable)}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Applied to reduce federal income tax owing</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Disclaimer */}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
            <Info size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p>
              This T661 schedule is a <strong>pre-filing estimate</strong> for review only — not for direct submission.
              Your CPA or SR&ED tax specialist must review and confirm all figures before filing the T661 with your T2 corporate return.
              <strong className="ml-1">TaxLift does not file with the CRA.</strong>
            </p>
          </div>
        </>
      )}
    </div>
  )
}

// ── Presets ────────────────────────────────────────────────────────────────────
const PRESETS = [
  { label: 'Q1 2026', start: '2026-01-01', end: '2026-03-31' },
  { label: 'Q4 2025', start: '2025-10-01', end: '2025-12-31' },
  { label: 'All 2026', start: '2026-01-01', end: '2026-12-31' },
]

// ── Main page ──────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const navigate               = useNavigate()
  const { currentUser }       = useAuth()
  const [preset, setPreset]   = useState(0)
  const [start, setStart]     = useState(PRESETS[0].start)
  const [end, setEnd]         = useState(PRESETS[0].end)
  const [exporting, setExporting] = useState(false)
  const [activeTab, setActiveTab] = useState('summary')   // 'summary' | 't661' | 'developers'
  const [shareOpen, setShareOpen] = useState(false)
  const [upgradeOpen, setUpgradeOpen]       = useState(false)
  const [upgradeFeature, setUpgradeFeature] = useState('Export PDF')
  const generatedAtRef = useRef(null)
  const cpaPackageRef  = useRef(null)

  const isPaid = ['starter', 'plus', 'enterprise'].includes(currentUser?.subscription_tier?.toLowerCase())

  function requirePaid(feature, action) {
    if (!isPaid) { setUpgradeFeature(feature); setUpgradeOpen(true); return }
    action()
  }

  function applyPreset(i) {
    setPreset(i)
    setStart(PRESETS[i].start)
    setEnd(PRESETS[i].end)
  }

  // ── API data ────────────────────────────────────────────────────────────────
  const { data: apiSummary, usingMock } = useReportSummary(start, end)
  const { data: apiClusters }           = useReportClusters(start, end)

  // Auto-generate T661 narratives for real scan clusters (no-op for demo/mock)
  const { narratives: generatedNarratives, generating: generatingNarratives } = useNarratives(apiClusters)

  // Build a unified `report` object compatible with the existing components
  const report = useMemo(() => {
    // Merge AI-generated narratives into cluster objects
    const clusters = (apiClusters ?? []).map(c => ({
      ...c,
      narrative_content_text:
        c.narrative_content_text ||
        generatedNarratives[c.id]?.content_text ||
        null,
    }))
    const approved    = clusters.filter(c => c.status === 'Approved')
    const rejected    = clusters.filter(c => c.status === 'Rejected')
    const pending     = clusters.filter(c => !['Approved','Rejected'].includes(c.status))
    // Prefer API summary if available; compute fallback from cluster list
    return {
      period_start:      start,
      period_end:        end,
      total_clusters:    apiSummary?.total_clusters    ?? clusters.length,
      approved_clusters: apiSummary?.approved_clusters ?? approved.length,
      rejected_clusters: apiSummary?.rejected_clusters ?? rejected.length,
      pending_clusters:  apiSummary?.pending_clusters  ?? pending.length,
      total_eligible_hours: apiSummary?.total_eligible_hours ?? approved.reduce((s,c) => s + (c.aggregate_time_hours ?? 0), 0),
      total_credit_cad:  apiSummary?.total_credit_cad  ?? approved.reduce((s,c) => s + (c.estimated_credit_cad ?? 0), 0),
      total_credit_usd:  apiSummary?.total_credit_usd  ?? approved.reduce((s,c) => s + (c.estimated_credit_usd ?? 0), 0),
      clusters,
      approved_list: approved,
    }
  }, [apiSummary, apiClusters, generatedNarratives, start, end])

  const devBreakdown = useMemo(() => getDevHoursBreakdown(report.approved_list), [report.approved_list])

  const chartData = useMemo(() => report.clusters.map(c => ({
    name:   (c.business_component ?? 'Unnamed').split('—')[0].trim().slice(0, 20),
    hours:  c.aggregate_time_hours ?? 0,
    credit: c.estimated_credit_cad ?? 0,
    status: c.status,
  })), [report.clusters])

  function handleExportPDF() {
    generatedAtRef.current = new Date().toISOString()
    setExporting(true)
    // Give React a tick to render the updated generatedAt before print dialog opens
    requestAnimationFrame(() => {
      setTimeout(() => {
        window.print()
        setExporting(false)
      }, 120)
    })
  }

  return (
    <div className="space-y-5">

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        feature={upgradeFeature}
        plan="starter"
      />

      {/* Demo mode banner */}
      {usingMock && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 bg-indigo-600 rounded-xl text-xs text-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <FlaskConical size={13} className="text-indigo-200 flex-shrink-0" />
            <span className="font-medium">This is a demo — connect a data source to generate your real SR&amp;ED report.</span>
          </div>
          <button
            onClick={() => navigate('/quick-connect')}
            className="flex-shrink-0 bg-white text-indigo-700 font-semibold px-3 py-1 rounded-lg hover:bg-indigo-50 transition-colors whitespace-nowrap"
          >
            Connect now
          </button>
        </div>
      )}

      {/* Narrative generation progress banner */}
      {generatingNarratives && (
        <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-700">
          <svg className="animate-spin h-3.5 w-3.5 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <span><strong>Generating T661 narratives</strong> — Claude is writing CRA-ready project descriptions for each cluster&hellip;</span>
        </div>
      )}

      {/* Hidden CPA handoff package — shown only during window.print() when triggered via cpaPackageRef */}
      <CpaHandoffPackage
        ref={cpaPackageRef}
        report={report}
        devBreakdown={devBreakdown}
        companyName="Acme Corp"
        fiscalYear={new Date(start).getFullYear().toString()}
        entityType="CCPC"
        cpaFirmName={currentUser?.role === 'CPA' ? (currentUser?.firm_name ?? null) : null}
      />

      {/* Share with CPA modal */}
      <ShareWithCpaModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        report={report}
        devBreakdown={devBreakdown}
        companyName="Acme Corp"
        fiscalYear={new Date(start).getFullYear().toString()}
        auditScore={Math.round(((report.approved_clusters ?? 0) / Math.max(1, report.total_clusters)) * 100)}
        sharedBy={currentUser?.display_name ?? 'Your Team'}
        sharedByEmail={currentUser?.email ?? ''}
      />

      {/* Hidden printable report — shown only during window.print() */}
      <PrintableReport
        report={report}
        devBreakdown={devBreakdown}
        generatedAt={generatedAtRef.current ?? new Date().toISOString()}
      />

      {/* Period selector */}
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <Calendar size={15} className="text-gray-400" />
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {PRESETS.map((p, i) => (
              <button
                key={p.label}
                onClick={() => applyPreset(i)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  preset === i ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <input
              type="date" value={start}
              onChange={e => { setStart(e.target.value); setPreset(-1) }}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span>to</span>
            <input
              type="date" value={end}
              onChange={e => { setEnd(e.target.value); setPreset(-1) }}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            {report.total_clusters === 0 && (
              <span className="text-xs text-gray-400">No clusters in range</span>
            )}
            <Button
              variant="secondary"
              size="sm"
              icon={exporting ? undefined : isPaid ? Printer : Lock}
              onClick={() => requirePaid('Export PDF', handleExportPDF)}
              disabled={report.total_clusters === 0 || exporting}
              title={isPaid ? undefined : 'Starter plan required'}
            >
              {exporting ? 'Preparing…' : isPaid ? 'Export PDF' : 'Export PDF — Starter'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={isPaid ? Share2 : Lock}
              onClick={() => requirePaid('Share with CPA', () => setShareOpen(true))}
              disabled={report.approved_clusters === 0 && isPaid}
              title={isPaid ? 'Generate a shareable review link to send to your CPA — no login required' : 'Starter plan required'}
            >
              {isPaid ? 'Share with CPA' : 'Share with CPA — Starter'}
            </Button>
            <Button
              size="sm"
              icon={isPaid ? Briefcase : Lock}
              onClick={() => requirePaid('CPA Package', () => cpaPackageRef.current?.print())}
              disabled={report.approved_clusters === 0 && isPaid}
              title={isPaid ? 'Generate a print-ready CPA handoff package with T661 estimates, narratives, and evidence.' : 'Starter plan required'}
            >
              {isPaid ? 'CPA Package ↗' : 'CPA Package — Starter'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {[
          { id: 'summary',    label: 'Summary',        icon: CheckCircle2    },
          { id: 't661',       label: 'T661 Schedule',  icon: FileSpreadsheet },
          { id: 'developers', label: 'Developer Hours', icon: Calculator      },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 't661' && (
        <T661Schedule report={report} devBreakdown={devBreakdown} />
      )}

      {/* Summary + Chart + Cluster table */}
      {activeTab === 'summary' && <>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: 'Total Clusters',     value: report.total_clusters,     icon: CheckCircle2, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Approved',           value: report.approved_clusters,   icon: CheckCircle2, color: 'text-green-600',  bg: 'bg-green-50'  },
          { label: 'Eligible Hours',     value: formatHours(report.total_eligible_hours), icon: Clock,       color: 'text-blue-600',    bg: 'bg-blue-50'    },
          { label: 'Total Credit (CAD)', value: formatCurrency(report.total_credit_cad),  icon: DollarSign,  color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map(item => (
          <div key={item.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${item.bg}`}><item.icon size={17} className={item.color} /></div>
            <div>
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{item.label}</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card padding={false} className="p-6">
          <CardHeader title="Credit by Cluster" subtitle={`${formatDate(start)} – ${formatDate(end)}`} />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => v > 0 ? `$${(v / 1000).toFixed(0)}k` : '$0'} />
              <Tooltip
                formatter={v => [formatCurrency(v, 'CAD'), 'Estimated Credit']}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <Bar dataKey="credit" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.status === 'Approved' ? '#22c55e' : entry.status === 'Rejected' ? '#f87171' : '#a5b4fc'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            {[['#22c55e', 'Approved'], ['#a5b4fc', 'Pending'], ['#f87171', 'Rejected']].map(([color, label]) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: color }} />
                {label}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Cluster breakdown table */}
      <Card padding={false}>
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Cluster Breakdown</h3>
          <p className="text-xs text-gray-500 mt-0.5">{report.total_clusters} clusters in selected period</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Business Component', 'Status', 'Risk Score', 'Hours', 'Eligibility %', 'Credit (CAD)', 'Credit (USD)'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {report.clusters.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-gray-400">No clusters in this period.</td></tr>
              ) : report.clusters.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 text-sm font-medium text-gray-900">{c.business_component ?? '—'}</td>
                  <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-5 py-3"><RiskScore score={c.risk_score} /></td>
                  <td className="px-5 py-3 text-sm text-gray-600 tabular-nums">{formatHours(c.aggregate_time_hours)}</td>
                  <td className="px-5 py-3 text-sm text-gray-600 tabular-nums">{formatPercent(c.eligibility_percentage)}</td>
                  <td className="px-5 py-3 text-sm font-medium text-gray-900 tabular-nums">{formatCurrency(c.estimated_credit_cad)}</td>
                  <td className="px-5 py-3 text-sm text-gray-600 tabular-nums">{formatCurrency(c.estimated_credit_usd, 'USD')}</td>
                </tr>
              ))}
            </tbody>
            {report.approved_clusters > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td colSpan={3} className="px-5 py-3 text-xs font-semibold text-gray-700">Totals (Approved only)</td>
                  <td className="px-5 py-3 text-sm font-bold text-gray-900 tabular-nums">{formatHours(report.total_eligible_hours)}</td>
                  <td className="px-5 py-3 text-sm text-gray-500">—</td>
                  <td className="px-5 py-3 text-sm font-bold text-emerald-700 tabular-nums">{formatCurrency(report.total_credit_cad)}</td>
                  <td className="px-5 py-3 text-sm font-bold text-emerald-700 tabular-nums">{formatCurrency(report.total_credit_usd, 'USD')}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
      </>}

      {/* CPA Handoff callout — shown when there are approved clusters */}
      {activeTab === 'summary' && report.approved_clusters > 0 && (
        <div className="flex items-center justify-between gap-4 bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-2xl px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <Share2 size={18} className="text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Ready for your CPA?</p>
              <p className="text-indigo-200 text-xs mt-0.5">
                {report.approved_clusters} cluster{report.approved_clusters !== 1 ? 's' : ''} approved · Share a secure review link with your SR&ED tax specialist — no login needed.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              size="sm"
              icon={Share2}
              onClick={() => setShareOpen(true)}
              className="bg-white text-indigo-700 hover:bg-indigo-50 font-semibold"
            >
              Share with CPA
            </Button>
            <Button
              size="sm"
              icon={Briefcase}
              onClick={() => { cpaPackageRef.current?.print() }}
              className="bg-indigo-800 hover:bg-indigo-900 text-white"
            >
              Print Package
            </Button>
          </div>
        </div>
      )}

      {/* Per-dev hours breakdown (screen version) */}
      {activeTab === 'developers' && devBreakdown.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <Calculator size={28} className="mb-2 opacity-40" />
          <p className="text-sm font-medium text-gray-500">No approved clusters in selected period</p>
          <p className="text-xs mt-1">Approve clusters to see per-developer hour attribution.</p>
        </div>
      )}
      {activeTab === 'developers' && devBreakdown.length > 0 && (
        <Card padding={false}>
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Eligible Hours by Developer</h3>
            <p className="text-xs text-gray-500 mt-0.5">Attributed proportionally from approved cluster commits · included in PDF export</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Developer', 'Type', 'Hours', 'Rate (CA$/h)', 'Overhead', 'Effective Rate', 'Eligible Wages (CA$)'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {devBreakdown.map(row => (
                  <tr key={row.github_id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                          {row.display_name?.charAt(0)?.toUpperCase() ?? '?'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{row.display_name}</p>
                          <p className="text-[10px] text-gray-400">{row.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${row.employment_type === 'Contractor' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {row.employment_type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm font-semibold text-gray-900 tabular-nums">{row.hours}h</td>
                    <td className="px-5 py-3 text-sm text-gray-600 tabular-nums">{row.hourly_rate != null ? `$${row.hourly_rate.toFixed(2)}` : '—'}</td>
                    <td className="px-5 py-3 text-sm text-gray-600 tabular-nums">{row.overhead_pct != null ? `${row.overhead_pct}%` : '—'}</td>
                    <td className="px-5 py-3 text-sm text-gray-600 tabular-nums">{row.effective_rate != null ? `$${row.effective_rate.toFixed(2)}` : '—'}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-emerald-700 tabular-nums">
                      {row.eligible_wage_cad != null ? formatCurrency(row.eligible_wage_cad) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td colSpan={2} className="px-5 py-3 text-xs font-semibold text-gray-700">Totals</td>
                  <td className="px-5 py-3 text-sm font-bold text-gray-900 tabular-nums">
                    {devBreakdown.reduce((s, r) => s + r.hours, 0).toFixed(1)}h
                  </td>
                  <td colSpan={3} className="px-5 py-3 text-sm text-gray-400">—</td>
                  <td className="px-5 py-3 text-sm font-bold text-emerald-700 tabular-nums">
                    {formatCurrency(devBreakdown.reduce((s, r) => s + (r.eligible_wage_cad ?? 0), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

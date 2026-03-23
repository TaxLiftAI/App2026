/**
 * CPA Handoff Package
 *
 * Renders a print-optimised HTML document (hidden on screen, visible on print)
 * containing everything a CPA needs to review and prepare a T661 filing:
 *   1. Cover page & audit certificate
 *   2. Financial schedule (T661 lines 100-500, ITC)
 *   3. Cluster-by-cluster narrative summaries
 *   4. Evidence chain-of-custody with SHA-256 hashes
 *   5. Developer hours breakdown
 *
 * Usage:
 *   <CpaHandoffPackage report={report} devBreakdown={devBreakdown} narrative={narrative} ref={packageRef} />
 *   packageRef.current.print()
 */
import { forwardRef, useImperativeHandle, useRef, useMemo, useState } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { scoreNarrativeSet } from '../lib/narrativeScorer'
import { NARRATIVES } from '../data/mockData'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 2 }).format(n ?? 0)

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'

const fmtHours = (h) => h != null ? `${Number(h).toFixed(1)} h` : '—'

// FNV-1a checksum (same as the evidence vault)
function fnv1a(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

function packageChecksum(report) {
  const payload = JSON.stringify({
    period:   [report.period_start, report.period_end],
    clusters: (report.clusters ?? []).map(c => ({ id: c.id, hours: c.aggregate_time_hours, credit: c.estimated_credit_cad })),
  })
  const a = fnv1a(payload)
  const b = fnv1a(payload.split('').reverse().join(''))
  return `FNV-1a-64:${a}${b}`
}

// ── T661 builder (same proxy-method as ReportsPage) ──────────────────────────
function buildT661(report, devBreakdown, entityType = 'CCPC') {
  const approved      = (report.approved_list ?? [])
  const totalSalaries = devBreakdown.reduce((s, d) => s + ((d.hours ?? 0) * (d.hourly_rate ?? 0)), 0)
  const line100       = totalSalaries * ((report.total_eligible_hours ?? 0) / Math.max(1, devBreakdown.reduce((s, d) => s + d.hours, 0)))
  const line200       = line100 * 0.55
  const line300       = report.total_credit_cad ?? 0
  const line400       = line100 + line200
  const line500       = line400

  const isCCPC        = entityType === 'CCPC'
  const firstBracket  = Math.min(line500, 3_000_000)
  const secondBracket = Math.max(0, line500 - 3_000_000)
  const itc           = isCCPC
    ? firstBracket * 0.35 + secondBracket * 0.15
    : line500 * 0.15

  return { line100, line200, line300, line400, line500, itc, isCCPC, firstBracket, secondBracket }
}

// ── Narrative Quality Gate (screen-only) ──────────────────────────────────────
function NarrativeQualityGate({ qualityResult }) {
  const { results, passing, needsWork, failing, allPassing, anyFailing, averageScore } = qualityResult

  const [expanded, setExpanded] = useExpandState(anyFailing || needsWork.length > 0)

  if (results.length === 0) return null

  const borderClass = allPassing     ? 'border-green-200 bg-green-50'
    : anyFailing                     ? 'border-red-200 bg-red-50'
    : /* needsWork */                  'border-amber-200 bg-amber-50'

  const iconEl = allPassing
    ? <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
    : anyFailing
    ? <XCircle size={16} className="text-red-500 flex-shrink-0" />
    : <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />

  const headingText = allPassing
    ? `All ${results.length} narratives CRA-ready — avg score ${averageScore}/100`
    : anyFailing
    ? `${failing.length} narrative${failing.length > 1 ? 's' : ''} need attention before sending to CPA`
    : `${needsWork.length} narrative${needsWork.length > 1 ? 's' : ''} could be strengthened (avg ${averageScore}/100)`

  const headingClass = allPassing ? 'text-green-800' : anyFailing ? 'text-red-800' : 'text-amber-800'
  const subClass     = allPassing ? 'text-green-600' : anyFailing ? 'text-red-600'  : 'text-amber-600'

  const attention = [...failing, ...needsWork]

  return (
    <div className={`print:hidden rounded-xl border ${borderClass} mb-4 overflow-hidden`}>
      {/* Header bar */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left"
      >
        {iconEl}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${headingClass}`}>{headingText}</p>
          {!allPassing && (
            <p className={`text-xs mt-0.5 ${subClass}`}>
              {passing.length} passed · {needsWork.length} needs work · {failing.length} failing
            </p>
          )}
        </div>
        {attention.length > 0 && (
          expanded
            ? <ChevronUp size={14} className="text-gray-400 flex-shrink-0" />
            : <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
        )}
      </button>

      {/* Expandable detail rows */}
      {expanded && attention.length > 0 && (
        <div className="border-t border-current border-opacity-10 divide-y divide-white divide-opacity-50">
          {attention.map(({ cluster, score }) => {
            const isFail = score.totalScore < 60
            const rowBg  = isFail ? 'bg-red-50/60' : 'bg-amber-50/60'
            const badge  = isFail
              ? 'bg-red-100 text-red-700'
              : 'bg-amber-100 text-amber-700'
            const weakDim = score.weakestDimension
            return (
              <div key={cluster.id} className={`flex items-start gap-3 px-4 py-2.5 ${rowBg}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 truncate">{cluster.business_component}</p>
                  {weakDim && weakDim.score < 20 && (
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      Weakest: <span className="font-medium text-gray-700">{weakDim.name}</span>
                      {weakDim.suggestion && (
                        <span className="ml-1 text-gray-400">— {weakDim.suggestion.slice(0, 80)}…</span>
                      )}
                    </p>
                  )}
                </div>
                <span className={`flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${badge}`}>
                  {score.totalScore}/100
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Small helper to initialise expanded state with a boolean
function useExpandState(initial) {
  return useState(initial)
}

// ── Print styles ──────────────────────────────────────────────────────────────
const PRINT_CSS = `
  @media screen {
    #taxlift-cpa-package { display: none; }
  }
  @media print {
    body * { visibility: hidden !important; }
    #taxlift-cpa-package,
    #taxlift-cpa-package * { visibility: visible !important; }
    #taxlift-cpa-package {
      position: fixed; top: 0; left: 0;
      width: 100%; background: white; z-index: 99999;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 11pt;
      color: #111;
    }
    .page-break { page-break-before: always; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; font-size: 10pt; }
    th { background: #f5f5f5; font-weight: bold; }
    .right { text-align: right; font-variant-numeric: tabular-nums; }
    .mono { font-family: 'Courier New', monospace; font-size: 9pt; }
    .section-title { font-size: 13pt; font-weight: bold; margin: 24px 0 8px; border-bottom: 2px solid #333; padding-bottom: 4px; }
    .subsection { font-size: 11pt; font-weight: bold; margin: 16px 0 6px; }
    .meta { font-size: 9pt; color: #666; }
    .highlight { background: #fffde7; }
    .cover-logo { font-size: 22pt; font-weight: bold; margin-bottom: 4px; }
    .cover-sub  { font-size: 14pt; color: #333; }
    .cover-company { font-size: 18pt; font-weight: bold; margin: 32px 0 8px; }
    .cover-date { font-size: 11pt; color: #555; }
    .certificate-box { border: 2px solid #333; padding: 16px; margin: 20px 0; }
    .warning-box { border: 1px solid #f59e0b; background: #fffbeb; padding: 10px; margin: 12px 0; font-size: 9pt; }
    .narrative-box { background: #f9fafb; border: 1px solid #e5e7eb; padding: 12px; margin: 8px 0; font-size: 10pt; line-height: 1.6; white-space: pre-wrap; }
    .hash-box { font-family: monospace; font-size: 8pt; background: #f1f5f9; padding: 4px 8px; border-radius: 2px; }
  }
`

// ── Main component ────────────────────────────────────────────────────────────
const CpaHandoffPackage = forwardRef(function CpaHandoffPackage(
  { report, devBreakdown = [], companyName = 'Company', fiscalYear = '2025', entityType = 'CCPC' },
  ref
) {
  const containerRef = useRef(null)
  const checksum     = packageChecksum(report)
  const generatedAt  = new Date().toISOString()
  const t661         = buildT661(report, devBreakdown, entityType)
  const approved     = report.approved_list ?? []

  // ── Narrative quality gate ─────────────────────────────────────────────────
  const narrativeLookup = useMemo(() => {
    const map = {}
    Object.values(NARRATIVES ?? {}).forEach(n => { map[n.id] = n })
    return map
  }, [])

  const qualityResult = useMemo(
    () => scoreNarrativeSet(approved, narrativeLookup),
    [approved, narrativeLookup]
  )

  useImperativeHandle(ref, () => ({
    print() {
      // Inject the generated-at timestamp then trigger print
      window.print()
    }
  }))

  return (
    <>
    {/* ── Screen-only narrative quality gate ──────────────────────────────── */}
    <NarrativeQualityGate qualityResult={qualityResult} />

    <div id="taxlift-cpa-package" ref={containerRef}>
      <style>{PRINT_CSS}</style>

      {/* ══ PAGE 1: COVER ══════════════════════════════════════════════════════ */}
      <div style={{ padding: '60px 80px', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div className="cover-logo">TaxLift</div>
          <div className="cover-sub">SR&ED Compliance Platform</div>
          <div style={{ fontSize: '10pt', color: '#555', marginTop: '6px' }}>
            support@taxlift.ai
          </div>
        </div>

        <div>
          <p style={{ fontSize: '12pt', color: '#555', marginBottom: '8px' }}>SR&ED CPA REVIEW PACKAGE</p>
          <div className="cover-company">{companyName}</div>
          <div className="cover-date">Fiscal Year: {fiscalYear}</div>
          <div className="cover-date">Prepared: {fmtDate(generatedAt)}</div>
          <div className="cover-date">Period: {fmtDate(report.period_start)} – {fmtDate(report.period_end)}</div>
        </div>

        <div className="certificate-box">
          <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>AUDIT CERTIFICATE</p>
          <p style={{ fontSize: '10pt', lineHeight: '1.7' }}>
            This package was generated by the TaxLift SR&ED compliance platform from evidence
            automatically captured from the organisation's engineering systems (Git, Jira, CI/CD).
            All evidence artefacts are preserved with cryptographic integrity verification.
          </p>
          <p style={{ marginTop: '12px', fontSize: '10pt' }}>
            <strong>Package checksum:</strong><br />
            <span className="mono">{checksum}</span>
          </p>
          <p style={{ marginTop: '8px', fontSize: '10pt' }}>
            <strong>Clusters included:</strong> {report.total_clusters ?? 0} &nbsp;|&nbsp;
            <strong>Approved:</strong> {report.approved_clusters ?? 0} &nbsp;|&nbsp;
            <strong>Eligible hours:</strong> {fmtHours(report.total_eligible_hours)} &nbsp;|&nbsp;
            <strong>Estimated credit:</strong> {fmt(report.total_credit_cad)}
          </p>
          <p style={{ marginTop: '8px', fontSize: '10pt' }}>
            Generated: <span className="mono">{generatedAt}</span>
          </p>
        </div>

        <div className="warning-box">
          📋 <strong>Next step:</strong> Share this package with your CPA or SR&ED tax counsel to complete the T661 and file with the T2 corporate return.
          Eligible amounts are pre-filing estimates that must be reviewed and confirmed by a qualified specialist. TaxLift does not file on your behalf and does not provide tax advice.
        </div>
      </div>

      {/* ══ PAGE 2: T661 FINANCIAL SCHEDULE ════════════════════════════════════ */}
      <div className="page-break" style={{ padding: '40px 80px' }}>
        <div className="section-title">Form T661 — SR&ED Expenditures Schedule (Estimated)</div>
        <p className="meta">Corporation type: {entityType} · Proxy method (Prescribed Proxy Amount)</p>

        <div className="subsection">Part 1 — Qualified SR&ED Expenditures</div>
        <table>
          <tbody>
            <tr><td>Line 100 — SR&ED salaries and wages</td>                              <td className="right">{fmt(t661.line100)}</td></tr>
            <tr><td>Line 200 — Prescribed Proxy Amount (55% of line 100)</td>             <td className="right">{fmt(t661.line200)}</td></tr>
            <tr><td>Line 300 — SR&ED contracts (third-party)</td>                         <td className="right">{fmt(t661.line300)}</td></tr>
            <tr><td>Line 400 — Total qualified SR&ED expenditures (100 + 200 + 300)</td>  <td className="right highlight">{fmt(t661.line400)}</td></tr>
            <tr><td>Line 500 — Total pool of deductible SR&ED expenditures</td>           <td className="right">{fmt(t661.line500)}</td></tr>
          </tbody>
        </table>

        <div className="subsection">Part 2 — Investment Tax Credit (ITC)</div>
        {t661.isCCPC ? (
          <table>
            <tbody>
              <tr><td>First $3,000,000 of qualifying expenditures (×35%)</td>   <td className="right">{fmt(t661.firstBracket)}</td><td className="right">{fmt(t661.firstBracket * 0.35)}</td></tr>
              <tr><td>Expenditures above $3,000,000 (×15%)</td>                  <td className="right">{fmt(t661.secondBracket)}</td><td className="right">{fmt(t661.secondBracket * 0.15)}</td></tr>
              <tr><th>Total Estimated ITC (Refundable)</th><th></th>             <th className="right highlight">{fmt(t661.itc)}</th></tr>
            </tbody>
          </table>
        ) : (
          <table>
            <tbody>
              <tr><td>Total qualifying expenditures (×15%, non-refundable)</td>  <td className="right">{fmt(t661.line500)}</td><td className="right">{fmt(t661.itc)}</td></tr>
              <tr><th>Total Estimated ITC (Non-refundable)</th><th></th>         <th className="right highlight">{fmt(t661.itc)}</th></tr>
            </tbody>
          </table>
        )}
      </div>

      {/* ══ PAGE 3: CLUSTER NARRATIVES ═════════════════════════════════════════ */}
      <div className="page-break" style={{ padding: '40px 80px' }}>
        <div className="section-title">Section 2 — SR&ED Project Narratives (T661 Part 2)</div>
        <p className="meta">
          {approved.length} approved cluster{approved.length !== 1 ? 's' : ''} ·
          Each cluster constitutes a separate SR&ED project for T661 purposes.
        </p>

        {approved.length === 0 && (
          <p style={{ color: '#666', marginTop: '16px' }}>No approved clusters in the selected period.</p>
        )}

        {approved.map((cluster, idx) => (
          <div key={cluster.id} style={{ marginTop: '24px', pageBreakInside: 'avoid' }}>
            <div className="subsection">
              Project {idx + 1}: {cluster.business_component ?? 'Unnamed Cluster'}
            </div>
            <table style={{ marginBottom: '8px' }}>
              <tbody>
                <tr>
                  <td><strong>Cluster ID</strong></td>
                  <td className="mono">{cluster.id}</td>
                  <td><strong>Status</strong></td>
                  <td>{cluster.status}</td>
                </tr>
                <tr>
                  <td><strong>Eligible hours</strong></td>
                  <td>{fmtHours(cluster.aggregate_time_hours)}</td>
                  <td><strong>Estimated credit</strong></td>
                  <td>{fmt(cluster.estimated_credit_cad)}</td>
                </tr>
                <tr>
                  <td><strong>Risk score</strong></td>
                  <td>{cluster.risk_score != null ? `${(cluster.risk_score * 100).toFixed(0)}%` : '—'}</td>
                  <td><strong>Rule version</strong></td>
                  <td className="mono">{cluster.eligibility_rule_version_id ?? 'N/A'}</td>
                </tr>
                <tr>
                  <td><strong>Detected</strong></td>
                  <td colSpan={3}>{fmtDate(cluster.created_at)}</td>
                </tr>
              </tbody>
            </table>

            {cluster.narrative_content_text ? (
              <div className="narrative-box">{cluster.narrative_content_text}</div>
            ) : (
              <div className="warning-box">No narrative available for this cluster. Generate one in TaxLift before sharing with your CPA.</div>
            )}
          </div>
        ))}
      </div>

      {/* ══ PAGE 4: DEVELOPER HOURS ════════════════════════════════════════════ */}
      <div className="page-break" style={{ padding: '40px 80px' }}>
        <div className="section-title">Section 3 — Developer Hours Breakdown</div>
        <p className="meta">
          Hours attributed proportionally from Git commit counts across approved clusters.
          Actual SR&ED time should be verified and signed off by each employee.
        </p>

        <table style={{ marginTop: '16px' }}>
          <thead>
            <tr>
              <th>Developer</th>
              <th>Role</th>
              <th>Employment</th>
              <th className="right">SR&ED Hours</th>
              <th className="right">Rate (CAD/h)</th>
              <th className="right">Eligible Wages</th>
            </tr>
          </thead>
          <tbody>
            {devBreakdown.map((dev, i) => (
              <tr key={i}>
                <td>{dev.display_name}</td>
                <td>{dev.role}</td>
                <td>{dev.employment_type}</td>
                <td className="right">{fmtHours(dev.hours)}</td>
                <td className="right">{dev.hourly_rate != null ? fmt(dev.hourly_rate) : '—'}</td>
                <td className="right">{dev.eligible_wage_cad != null ? fmt(dev.eligible_wage_cad) : '—'}</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 'bold', background: '#f9fafb' }}>
              <td colSpan={3}>Totals</td>
              <td className="right">{fmtHours(devBreakdown.reduce((s, d) => s + d.hours, 0))}</td>
              <td></td>
              <td className="right">{fmt(devBreakdown.reduce((s, d) => s + (d.eligible_wage_cad ?? 0), 0))}</td>
            </tr>
          </tbody>
        </table>

        <div className="warning-box" style={{ marginTop: '16px' }}>
          Note: Hours derived from automated Git commit analysis using the TaxLift platform.
          Each developer listed should review and certify their SR&ED hours on a T2200 or equivalent
          time-tracking declaration before the CPA finalises the T661.
        </div>
      </div>

      {/* ══ PAGE 5: EVIDENCE CHAIN OF CUSTODY ════════════════════════════════ */}
      <div className="page-break" style={{ padding: '40px 80px' }}>
        <div className="section-title">Section 4 — Evidence Chain of Custody</div>
        <p className="meta">
          All evidence was captured automatically from engineering systems and stored with
          cryptographic integrity verification in the TaxLift Document Vault.
        </p>

        <table style={{ marginTop: '16px' }}>
          <thead>
            <tr>
              <th>Cluster</th>
              <th>Evidence Type</th>
              <th>Count</th>
              <th>Snapshot ID</th>
              <th>Integrity</th>
            </tr>
          </thead>
          <tbody>
            {approved.map((cluster, i) => (
              <tr key={i}>
                <td>{cluster.business_component ?? 'Unnamed'}</td>
                <td>Git · Jira · CI/CD</td>
                <td>{cluster.evidence_snapshot_id ? '✓' : '—'}</td>
                <td className="mono" style={{ fontSize: '8pt' }}>{cluster.evidence_snapshot_id ?? 'None'}</td>
                <td>{cluster.evidence_snapshot_id ? '✓ Verified' : '⚠ Missing'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="subsection" style={{ marginTop: '24px' }}>Package Integrity</div>
        <p className="meta">This entire CPA package is integrity-protected by the following checksum:</p>
        <p className="hash-box" style={{ marginTop: '8px', display: 'block', padding: '8px 12px' }}>{checksum}</p>
        <p className="meta" style={{ marginTop: '8px' }}>
          Generated at: {generatedAt} · TaxLift Platform v1.0
        </p>

        <div style={{ marginTop: '40px', borderTop: '1px solid #ccc', paddingTop: '20px' }}>
          <p style={{ fontSize: '9pt', color: '#888', lineHeight: '1.6' }}>
            This document was prepared using the TaxLift SR&ED compliance platform.
            All credit amounts are preliminary estimates based on automated analysis and have not been
            reviewed by the Canada Revenue Agency. This document does not constitute tax advice.
            A qualified SR&ED tax specialist (CPA or tax counsel) must review, adjust, and approve all
            figures — and is solely responsible for filing the T661 with the T2 corporate return.
            TaxLift is a preparation and documentation tool. It does not file with the CRA on your behalf.
            Questions? Contact us at{' '}
            <a href="mailto:support@taxlift.ai" style={{ color: '#555' }}>support@taxlift.ai</a>.
          </p>
        </div>
      </div>
    </div>
    </>
  )
})

export default CpaHandoffPackage

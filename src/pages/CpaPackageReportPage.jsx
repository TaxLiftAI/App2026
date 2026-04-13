/**
 * CpaPackageReportPage — /cpa-portal/report/:clientId
 *
 * CPA-ready T661 SR&ED package report. Rendered from mock data for demo;
 * in production this would pull from the API by clientId.
 *
 * Shown to CPA users when they click "View T661 Package" from the
 * Client Portfolio page. Printable via window.print().
 */
import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Printer, CheckCircle2, AlertCircle, Clock,
  ChevronDown, ChevronUp, ShieldCheck, Building2, Calendar,
  DollarSign, GitMerge, FileText, Users, Zap, Star,
  Download, CheckSquare, Square,
} from 'lucide-react'
import { CPA_CLIENTS } from '../data/mockData'
import { formatCurrency } from '../lib/utils'

// ── Per-client package data (production: fetched from API) ─────────────────────
const PACKAGE_DATA = {
  'cli-002': {
    client: {
      company_name:          'NovaSystems Inc.',
      industry:              'Cloud Infrastructure',
      fiscal_year:           'FY2025',
      fiscal_year_end:       'June 30, 2025',
      filing_deadline:       'June 30, 2026',
      province:              'Ontario',
      business_number:       '82741 6329 RC0001',
      primary_contact:       'Daniel Park, VP Engineering',
      primary_contact_email: 'd.park@novasystems.ca',
      company_type:          'Canadian-Controlled Private Corporation (CCPC)',
    },
    summary: {
      total_eligible_expenditures_cad: 680_000,
      federal_credit_cad:              136_000,   // 20% ITC (CCPC basic rate)
      provincial_credit_cad:            68_000,   // Ontario 10% refundable
      total_credit_cad:                204_000,
      clusters_total:                  7,
      clusters_approved:               6,
      clusters_pending:                1,
      total_sr_ed_hours:               2_847,
      developers_included:             12,
      prepared_date:                   'April 12, 2026',
      package_version:                 'v2.1',
    },
    expenditure_schedule: [
      { category: 'Salaries & Wages (SR&ED)',          amount: 512_000, note: 'Directly engaged personnel — 12 engineers × eligible portion' },
      { category: 'Materials consumed',                amount:  48_000, note: 'Cloud compute costs consumed in SR&ED experiments' },
      { category: 'Contract payments (third-party)',   amount:  60_000, note: 'External testing lab & security audit (SR&ED portion: 60%)' },
      { category: 'Overhead (proxy method @ 55%)',     amount:  60_000, note: 'Applied to salary base per CRA proxy method election' },
    ],
    clusters: [
      {
        id:                    'ns-001',
        business_component:    'Auto-Scaling Engine — Kubernetes HPA v2',
        status:                'Approved',
        period:                'Jul 1 – Sep 30, 2025',
        hours:                 624,
        eligible_pct:          85,
        eligible_expenditures: 138_000,
        credit_cad:            41_400,
        risk_score:            0.91,
        uncertainty:           'Whether Kubernetes Horizontal Pod Autoscaler could achieve sub-10s scale-out latency under real traffic burst patterns without triggering cascading OOM failures across co-located pods.',
        work_performed:        'Team conducted 14 controlled load-burst experiments across 3 cluster configurations. 9 experiments failed — documented in CloudWatch logs CW-NS-2025-Q1-001 through CW-NS-2025-Q1-009. Root cause isolated to kubelet memory.available eviction thresholds interacting with burst scheduling. Resolution required novel modification of eviction policies combined with custom admission webhook to gate burst scheduling — not solvable from existing documentation.',
        evidence:              ['CloudWatch logs: CW-NS-2025-Q1-001 to CW-NS-2025-Q1-014', 'GitHub PRs #1142, #1198, #1234 with experiment branch history', 'Linear tickets ENG-4821 to ENG-4839 with blocked-status durations', '12 engineers × time-tracking exports (Toggl), total 624 SR&ED hours'],
        developers:            ['Priya Mehta (Lead)', 'James O\'Reilly', 'Anita Sharma', 'Carlos Vega'],
      },
      {
        id:                    'ns-002',
        business_component:    'Zero-Downtime Deployment Pipeline — Blue/Green Orchestration',
        status:                'Approved',
        period:                'Jul 1 – Oct 15, 2025',
        hours:                 518,
        eligible_pct:          80,
        eligible_expenditures: 112_000,
        credit_cad:            33_600,
        risk_score:            0.88,
        uncertainty:           'Whether a fully automated blue/green switchover could be achieved with <500ms user-visible latency impact across microservices with cross-service transactional dependencies, without requiring coordinated service-wide freezes.',
        work_performed:        'Engineering developed a custom traffic-splitting layer built on Envoy proxy with a novel consistency protocol ensuring in-flight requests to the old deployment drained within SLA before cutover. 7 failed iterations documented in CI/CD pipeline logs — each exposing new edge cases in transaction boundary propagation. Final solution required original algorithm not present in Envoy, Istio, or Argo Rollouts documentation.',
        evidence:              ['CI/CD pipeline logs: pipeline IDs P-2025-0781 through P-2025-0822', 'GitHub repo novasystems/deploy-orchestrator, commits July–Oct 2025', 'Jira tickets OPS-2210 to OPS-2251 with experiment outcomes', 'Slack incident channel #deploy-experiments exported logs'],
        developers:            ['Daniel Park (Lead)', 'Sofia Chen', 'Marcus Webb'],
      },
      {
        id:                    'ns-003',
        business_component:    'Distributed Tracing — OpenTelemetry Cross-Service Correlation',
        status:                'Approved',
        period:                'Aug 1 – Nov 30, 2025',
        hours:                 412,
        eligible_pct:          75,
        eligible_expenditures:  88_000,
        credit_cad:             26_400,
        risk_score:             0.85,
        uncertainty:           'Whether trace context could be faithfully propagated across async Kafka event boundaries and gRPC streaming calls without breaking causality when consumers operated at different processing speeds.',
        work_performed:        'Team built a custom trace-context serializer and Kafka interceptor that maintains W3C TraceContext across partition reassignments. 5 prototype iterations — 4 rejected after causality violation detection in test harness. Solution is not achievable using stock OpenTelemetry Kafka or gRPC instrumentation libraries as documented.',
        evidence:              ['Jaeger trace dump files: jaeger-export-2025-08 through jaeger-export-2025-11', 'GitHub PRs #1301 to #1388 with prototype branches', 'Test harness causality-check reports: tracing-test-001 to tracing-test-005'],
        developers:            ['Anita Sharma (Lead)', 'Ravi Patel', 'Ellen Cho'],
      },
      {
        id:                    'ns-004',
        business_component:    'Multi-Region Database Replication — Active-Active Conflict Resolution',
        status:                'Approved',
        period:                'Sep 1 – Dec 31, 2025',
        hours:                 487,
        eligible_pct:          90,
        eligible_expenditures: 132_000,
        credit_cad:             39_600,
        risk_score:             0.93,
        uncertainty:           'Whether an active-active PostgreSQL replication topology could achieve <100ms conflict resolution with deterministic last-writer-wins semantics across Canada and EU regions without sacrificing read consistency guarantees under split-brain conditions.',
        work_performed:        'Team developed a novel CRDT-inspired conflict resolution layer on top of Patroni that tracks vector clocks per table partition. 11 experimental configurations tested — 8 failed under simulated network partition. Successful configuration required original modification to PostgreSQL WAL shipping logic not available in any Patroni, Pglogical, or Citus documentation.',
        evidence:              ['Chaos testing reports: chaos-2025-09-001 to chaos-2025-09-011 (network partition simulations)', 'PostgreSQL WAL logs: wal-archive-2025-09 through wal-archive-2025-12', 'GitHub repo novasystems/pgha-conflictresolver, 94 commits Sep–Dec 2025', 'AWS CloudWatch cross-region replication lag metrics'],
        developers:            ['Carlos Vega (Lead)', 'James O\'Reilly', 'Lena Kowalski', 'Raj Iyer'],
      },
      {
        id:                    'ns-005',
        business_component:    'Service Mesh Security — mTLS Certificate Rotation Zero-Downtime',
        status:                'Approved',
        period:                'Oct 1 – Dec 31, 2025',
        hours:                 384,
        eligible_pct:          80,
        eligible_expenditures:  96_000,
        credit_cad:             28_800,
        risk_score:             0.87,
        uncertainty:           'Whether in-place mTLS certificate rotation across 200+ microservices could be achieved without any service interruption or authentication failure during the rotation window under live traffic.',
        work_performed:        'Engineered a custom Istio sidecar extension implementing a dual-certificate grace period protocol not available in standard Istio cert-manager. 6 lab rotation drills — 4 resulted in partial auth failures logged in Envoy access logs. Solution required modifications to Istio\'s xDS protocol handling to support concurrent old/new certificate acceptance with deterministic switchover.',
        evidence:              ['Istio control-plane logs: istio-pilot-2025-Q4', 'Envoy access logs showing auth failures during prototype rounds: envoy-access-2025-10 to envoy-access-2025-12', 'GitHub PRs #1445, #1502, #1567 with sidecar patch history'],
        developers:            ['Sofia Chen (Lead)', 'Marcus Webb', 'Priya Mehta'],
      },
      {
        id:                    'ns-006',
        business_component:    'API Gateway — Adaptive Rate Limiting with ML-Driven Burst Prediction',
        status:                'Approved',
        period:                'Nov 1, 2025 – Jan 15, 2026',
        hours:                 422,
        eligible_pct:          85,
        eligible_expenditures: 114_000,
        credit_cad:             34_200,
        risk_score:             0.89,
        uncertainty:           'Whether a real-time ML model could predict API burst patterns with sufficient accuracy to pre-emptively adjust rate limits 30 seconds ahead of demand spikes, without generating false-positive throttling events that would disrupt legitimate traffic.',
        work_performed:        'Team trained and deployed a custom LSTM model on 18 months of API call time-series data. 9 model iterations — 6 rejected due to false-positive rates >2%. Final model achieves 94% burst prediction accuracy at 30s horizon with <0.3% false-positive throttling. Model architecture is novel — not replicable from existing MLOps or API gateway documentation.',
        evidence:              ['Model training notebooks: ml-burst-v1 through ml-burst-v9 (MLflow tracking server export)', 'API gateway logs: kong-2025-11 through kong-2026-01 with rate-event audit trail', 'A/B test results: gateway-ab-2025-001 comparing baseline vs ML-driven policies'],
        developers:            ['Ellen Cho (Lead)', 'Ravi Patel', 'Daniel Park'],
      },
    ],
    cpa_checklist: [
      { id: 'chk-1', text: 'Verify business numbers and fiscal year end match T2 corporate return on file',               category: 'Entity' },
      { id: 'chk-2', text: 'Confirm all 6 approved clusters are supported by contemporaneous documentation',             category: 'Evidence' },
      { id: 'chk-3', text: 'Review technical uncertainty statements for each cluster — confirm "standard practice" exclusion is clear', category: 'Technical' },
      { id: 'chk-4', text: 'Validate salary/wage expenditures against T4 slips and payroll records for the 12 included developers', category: 'Financial' },
      { id: 'chk-5', text: 'Confirm proxy method election is appropriate and overhead % matches prior-year election',    category: 'Financial' },
      { id: 'chk-6', text: 'Review contract payment SR&ED portion allocation (60%) for third-party testing lab',        category: 'Financial' },
      { id: 'chk-7', text: 'Confirm Ontario SR&ED provincial credit eligibility and OITC rate (10% refundable)',        category: 'Provincial' },
      { id: 'chk-8', text: 'Cross-reference materials expenditures against cloud provider invoices (AWS/GCP)',          category: 'Financial' },
      { id: 'chk-9', text: 'Verify filing deadline — June 30, 2026 (18-month window from June 30, 2025 FY end)',       category: 'Deadline' },
      { id: 'chk-10', text: 'Sign and date the T661 and T661SCH forms; ensure EFILE authorization from client',        category: 'Filing' },
    ],
  },
}

// Fallback for clients whose package isn't ready yet
const PACKAGE_NOT_READY = null

function StatusPill({ status }) {
  const m = status === 'Approved'
    ? { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' }
    : { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${m.bg} ${m.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {status}
    </span>
  )
}

function ClusterSection({ cluster, index }) {
  const [open, setOpen] = useState(index === 0)

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Header — always visible */}
      <button
        className="w-full flex items-center gap-4 px-5 py-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{cluster.business_component}</p>
          <p className="text-xs text-gray-500 mt-0.5">{cluster.period} · {cluster.hours.toLocaleString()} SR&ED hours · Eligible: {cluster.eligible_pct}%</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <StatusPill status={cluster.status} />
          <span className="text-sm font-bold text-green-700">{formatCurrency(cluster.credit_cad)}</span>
          {open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
        </div>
      </button>

      {/* Body — collapsed by default except first */}
      {open && (
        <div className="px-5 py-5 space-y-4 bg-white">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'SR&ED Hours',           value: cluster.hours.toLocaleString() + ' hrs' },
              { label: 'Eligibility %',          value: cluster.eligible_pct + '%' },
              { label: 'Eligible Expenditures', value: formatCurrency(cluster.eligible_expenditures) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{label}</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Technological Uncertainty (T661 Line 242)</p>
            <p className="text-sm text-gray-700 leading-relaxed bg-blue-50 border border-blue-100 rounded-lg p-3">{cluster.uncertainty}</p>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Work Performed (T661 Line 244)</p>
            <p className="text-sm text-gray-700 leading-relaxed">{cluster.work_performed}</p>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Supporting Evidence</p>
            <div className="space-y-1.5">
              {cluster.evidence.map(e => (
                <div key={e} className="flex items-start gap-2 text-xs text-gray-600">
                  <CheckCircle2 size={12} className="text-green-500 flex-shrink-0 mt-0.5" />
                  <span>{e}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Developers Included</p>
            <div className="flex flex-wrap gap-1.5">
              {cluster.developers.map(d => (
                <span key={d} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full px-2.5 py-0.5 font-medium">
                  {d}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ChecklistSection({ items }) {
  const [checked, setChecked] = useState({})
  const categories = [...new Set(items.map(i => i.category))]
  const doneCount = Object.values(checked).filter(Boolean).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {doneCount} of {items.length} items verified
        </p>
        <div className="w-40 bg-gray-100 rounded-full h-1.5">
          <div
            className="h-1.5 rounded-full bg-indigo-500 transition-all"
            style={{ width: `${(doneCount / items.length) * 100}%` }}
          />
        </div>
      </div>

      {categories.map(cat => (
        <div key={cat}>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{cat}</p>
          <div className="space-y-2">
            {items.filter(i => i.category === cat).map(item => (
              <button
                key={item.id}
                onClick={() => setChecked(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                className="w-full flex items-start gap-3 text-left group"
              >
                {checked[item.id]
                  ? <CheckSquare size={15} className="text-indigo-500 flex-shrink-0 mt-0.5" />
                  : <Square size={15} className="text-gray-300 group-hover:text-gray-400 flex-shrink-0 mt-0.5 transition-colors" />
                }
                <span className={`text-xs leading-relaxed transition-colors ${checked[item.id] ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                  {item.text}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function CpaPackageReportPage() {
  const { clientId } = useParams()
  const navigate     = useNavigate()

  const clientMeta = CPA_CLIENTS.find(c => c.id === clientId)
  const pkg        = PACKAGE_DATA[clientId] ?? PACKAGE_NOT_READY

  if (!clientMeta || !pkg) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 text-gray-400">
        <FileText size={36} className="opacity-30" />
        <p className="text-sm font-medium text-gray-600">CPA package not yet available for this client.</p>
        <p className="text-xs text-gray-400">The T661 package is generated once all clusters are approved and reviewed.</p>
        <button
          onClick={() => navigate('/cpa-portal')}
          className="mt-2 flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
        >
          <ArrowLeft size={14} /> Back to Client Portfolio
        </button>
      </div>
    )
  }

  const { client, summary, expenditure_schedule, clusters, cpa_checklist } = pkg

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-6 print:px-0 print:py-0">

      {/* ── Toolbar (hidden when printing) ── */}
      <div className="flex items-center justify-between print:hidden">
        <button
          onClick={() => navigate('/cpa-portal')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
        >
          <ArrowLeft size={15} /> Back to Client Portfolio
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full font-medium">
            Package {summary.package_version}  ·  Prepared {summary.prepared_date}
          </span>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Printer size={14} /> Print / Export PDF
          </button>
        </div>
      </div>

      {/* ── Cover header ── */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-900 rounded-2xl px-8 py-8 print:rounded-none print:px-0">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck size={18} className="text-indigo-300" />
              <span className="text-indigo-300 text-sm font-semibold tracking-wide">TaxLift SR&ED Package</span>
            </div>
            <h1 className="text-2xl font-bold text-white">{client.company_name}</h1>
            <p className="text-slate-300 mt-1">{client.industry} · {client.fiscal_year} · {client.province}</p>
            <p className="text-slate-400 text-sm mt-0.5">Business No. {client.business_number}</p>
          </div>
          <div className="text-right">
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Estimated Total Credit</p>
            <p className="text-3xl font-bold text-white">{formatCurrency(summary.total_credit_cad)}</p>
            <p className="text-slate-300 text-sm mt-0.5">Federal ${summary.federal_credit_cad.toLocaleString()} + ON ${summary.provincial_credit_cad.toLocaleString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-white/10">
          {[
            { label: 'Clusters Approved', value: `${summary.clusters_approved} / ${summary.clusters_total}` },
            { label: 'Total SR&ED Hours', value: summary.total_sr_ed_hours.toLocaleString() },
            { label: 'Developers',        value: summary.developers_included },
            { label: 'Filing Deadline',   value: client.filing_deadline },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-slate-400 text-[10px] uppercase tracking-wide font-medium">{label}</p>
              <p className="text-white font-bold text-sm mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 1: Entity & contact ── */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Building2 size={15} className="text-indigo-500" /> Entity Information
        </h2>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          {[
            ['Corporation type',    client.company_type],
            ['Fiscal year end',     client.fiscal_year_end],
            ['Province',           client.province],
            ['Business number',    client.business_number],
            ['Primary contact',    client.primary_contact],
            ['Contact email',      client.primary_contact_email],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <span className="text-gray-400 text-xs w-36 flex-shrink-0 pt-0.5">{label}</span>
              <span className="text-gray-800 font-medium text-xs">{value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 2: Financial schedule ── */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
          <DollarSign size={15} className="text-indigo-500" /> SR&ED Expenditure Schedule (T661)
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide pb-2">Category</th>
              <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide pb-2">Note</th>
              <th className="text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide pb-2">Amount (CAD)</th>
            </tr>
          </thead>
          <tbody>
            {expenditure_schedule.map((row, i) => (
              <tr key={i} className="border-b border-gray-50">
                <td className="py-2.5 font-medium text-gray-800 text-xs w-56 pr-4">{row.category}</td>
                <td className="py-2.5 text-gray-500 text-xs pr-4">{row.note}</td>
                <td className="py-2.5 text-right font-semibold text-gray-900 text-xs">{formatCurrency(row.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200">
              <td className="pt-3 font-bold text-gray-900 text-xs">Total Eligible SR&ED Expenditures</td>
              <td />
              <td className="pt-3 text-right font-bold text-gray-900">{formatCurrency(summary.total_eligible_expenditures_cad)}</td>
            </tr>
            <tr>
              <td className="pt-2 text-xs text-gray-500">Federal ITC (20% CCPC basic rate)</td>
              <td />
              <td className="pt-2 text-right text-xs font-semibold text-green-700">{formatCurrency(summary.federal_credit_cad)}</td>
            </tr>
            <tr>
              <td className="pt-1 text-xs text-gray-500">Ontario OITC (10% refundable)</td>
              <td />
              <td className="pt-1 text-right text-xs font-semibold text-green-700">{formatCurrency(summary.provincial_credit_cad)}</td>
            </tr>
            <tr className="bg-green-50 rounded-lg">
              <td className="pt-3 pb-2 pl-2 font-bold text-green-800">Combined SR&ED Credit</td>
              <td />
              <td className="pt-3 pb-2 pr-2 text-right font-bold text-green-800 text-base">{formatCurrency(summary.total_credit_cad)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      {/* ── Section 3: SR&ED Activities ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <GitMerge size={15} className="text-indigo-500" /> SR&ED Activities ({summary.clusters_approved} Approved)
          </h2>
          <span className="text-xs text-gray-400">Click any row to expand technical narrative</span>
        </div>
        <div className="space-y-3">
          {clusters.map((cluster, i) => (
            <ClusterSection key={cluster.id} cluster={cluster} index={i} />
          ))}
        </div>
      </section>

      {/* ── Section 4: CPA review checklist ── */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
          <CheckCircle2 size={15} className="text-indigo-500" /> CPA Pre-Filing Review Checklist
        </h2>
        <ChecklistSection items={cpa_checklist} />
      </section>

      {/* ── Footer ── */}
      <div className="border-t border-gray-200 pt-5 pb-8 flex items-start justify-between gap-6 flex-wrap text-xs text-gray-400">
        <div className="space-y-1">
          <p>Prepared by <span className="font-semibold text-gray-600">TaxLift AI</span> · Package {summary.package_version} · {summary.prepared_date}</p>
          <p>This package is for CPA review purposes. TaxLift is not a tax advisor. The CPA is responsible for T661 accuracy and filing.</p>
        </div>
        <div className="flex items-center gap-2">
          <ShieldCheck size={13} className="text-indigo-400" />
          <span>Audit-ready evidence chain preserved · 18-month retention</span>
        </div>
      </div>
    </div>
  )
}

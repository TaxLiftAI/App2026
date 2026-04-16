/**
 * ScanResultsPage — /scan/results
 *
 * The "money page" of the free scan funnel.
 *
 * Above the fold (FREE, visible to everyone):
 *   • Animated credit range estimate
 *   • 3 stat tiles: clusters / commits / hours
 *   • Top 3 cluster cards with names + individual estimates
 *   • "Your top qualifying activity" callout
 *
 * Below the fold (LOCKED / blurred):
 *   • Blurred T661 narrative preview
 *   • Blurred CPA package preview
 *   • Lock overlay → upgrade CTA
 *
 * Lead capture:
 *   • "Email me my full report" (pre-filled with scan email)
 *   • "Get your complete package →" → /pricing
 *   • "Talk to a human" → Calendly
 *
 * Zero-results state:
 *   • Friendly empty state with suggestions
 */
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheck, Lock, ChevronRight, Check, ArrowRight,
  Sparkles, AlertTriangle, TrendingUp, Clock, BarChart3,
  CheckCircle2, Mail, ExternalLink, RefreshCw, FlaskConical,
  Download, X, Github, Users, Copy, ChevronDown, ChevronUp,
  FileSpreadsheet, DollarSign, CalendarDays, FileText, Shield,
  ToggleLeft, ToggleRight,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import ActivityLogUpload from '../../components/ActivityLogUpload'
import { qualifyCluster } from '../../components/SREDQualificationPanel'

// ── SR&ED qualification criterion labels ─────────────────────────────────────
const CRITERION_LABELS = {
  systematic:  { short: 'Systematic', ref: 'ITA s.248(1)(a)' },
  uncertainty: { short: 'Uncertainty', ref: 'ITA s.248(1)(b)' },
  advancement: { short: 'Advancement', ref: 'ITA s.248(1)(c)' },
}

// ── Scan cluster card with expandable qualification breakdown ─────────────────
function ScanClusterCard({ cluster, theme, meta, qual, commits }) {
  const [expanded, setExpanded] = useState(false)

  function scoreColor(n) {
    if (n >= 75) return { bar: 'bg-emerald-500', text: 'text-emerald-600', pill: 'bg-emerald-50 border-emerald-200 text-emerald-700' }
    if (n >= 50) return { bar: 'bg-amber-400',   text: 'text-amber-600',   pill: 'bg-amber-50 border-amber-200 text-amber-700' }
    return           { bar: 'bg-red-400',         text: 'text-red-500',     pill: 'bg-red-50 border-red-200 text-red-700' }
  }

  const overallC = scoreColor(qual.overall)

  return (
    <div className={`rounded-xl border overflow-hidden ${meta.color}`}>
      {/* Main row */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-lg flex-shrink-0">{meta.icon}</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{cluster.business_component ?? cluster.name}</p>
              <p className="text-[11px] opacity-70 mt-0.5">
                {cluster._commitCount ?? cluster.commit_count ?? 0} commits · {Math.round(cluster.aggregate_time_hours)} hrs
              </p>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-base font-bold tabular-nums">{fmtK(cluster.estimated_credit_cad)}</p>
            <p className="text-[10px] opacity-60">estimated ITC</p>
          </div>
        </div>

        {/* Qualification signal row */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {Object.entries(qual.criteria).map(([key, data]) => {
            const c = scoreColor(data.score)
            return (
              <span key={key} className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${c.pill}`}>
                {CRITERION_LABELS[key].short} {data.score}%
              </span>
            )
          })}
          <button
            onClick={() => setExpanded(v => !v)}
            className="ml-auto flex items-center gap-1 text-[10px] font-semibold opacity-80 hover:opacity-100 transition-opacity"
          >
            {expanded ? 'Hide' : 'Why this qualifies'}
            {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
        </div>
      </div>

      {/* Expandable qualification breakdown */}
      {expanded && (
        <div className="border-t border-current/10 bg-white px-4 py-4 space-y-3">
          {/* 3-criterion breakdown */}
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(qual.criteria).map(([key, data]) => {
              const c    = scoreColor(data.score)
              const meta = CRITERION_LABELS[key]
              return (
                <div key={key} className={`rounded-lg border p-2.5 ${c.pill.includes('emerald') ? 'bg-emerald-50 border-emerald-200' : c.pill.includes('amber') ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className={`text-[10px] font-bold ${c.text}`}>{meta.short}</p>
                    <span className={`text-[10px] font-bold ${c.text}`}>{data.score}%</span>
                  </div>
                  <div className="w-full bg-white/60 rounded-full h-1 mb-1.5">
                    <div className={`h-1 rounded-full ${c.bar}`} style={{ width: `${data.score}%` }} />
                  </div>
                  <p className="text-[9px] text-gray-500 font-mono">{meta.ref}</p>
                </div>
              )
            })}
          </div>

          {/* Top evidence commits */}
          {qual.topEvidenceCommits.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">Qualifying evidence commits</p>
              {qual.topEvidenceCommits.map(cm => (
                <div key={cm.sha} className="flex items-start gap-2 bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100">
                  <span className="font-mono text-[9px] text-gray-400 flex-shrink-0 mt-0.5">{cm.sha?.slice(0, 7)}</span>
                  <p className="text-[11px] text-gray-700 font-mono leading-tight">{cm.message}</p>
                </div>
              ))}
            </div>
          )}

          {/* Talking points */}
          <div className="bg-indigo-50 rounded-xl border border-indigo-100 px-3 py-2.5">
            <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wide mb-1.5">If CRA asks why this qualifies, say:</p>
            <p className="text-xs text-indigo-900 leading-relaxed">
              "This project involved genuine technological uncertainty — we did not know at the outset
              whether <strong>{theme}</strong> could meet our requirements using standard techniques.
              The commit history shows a structured experimental process: hypothesis, implementation,
              measurement, and iteration. Each cycle produced new knowledge that informed the next."
            </p>
          </div>

          {/* Weaknesses */}
          {qual.weaknesses.length > 0 && (
            <div className="flex items-start gap-2 bg-amber-50 rounded-xl border border-amber-100 px-3 py-2.5">
              <AlertTriangle size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-amber-700">Strengthen before filing:</p>
                {qual.weaknesses.map((w, i) => (
                  <p key={i} className="text-[11px] text-amber-700">· {w}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Animated number hook ──────────────────────────────────────────────────────
function useAnimatedNumber(target, duration = 800) {
  const [display, setDisplay] = useState(0)
  const prevRef = useRef(0)
  useEffect(() => {
    const start = prevRef.current
    const delta = target - start
    const steps = Math.ceil(duration / 16)
    let step = 0
    const timer = setInterval(() => {
      step++
      setDisplay(Math.round(start + delta * (1 - Math.pow(1 - step / steps, 3))))
      if (step >= steps) { clearInterval(timer); prevRef.current = target }
    }, 16)
    return () => clearInterval(timer)
  }, [target, duration])
  return display
}

const fmt  = n => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n)
const fmtK = n => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${Math.round(n / 1_000)}K` : fmt(n)

// ── Cluster-aware narrative preview ──────────────────────────────────────────
function buildNarrativePreview(cluster) {
  const theme   = cluster?._theme ?? cluster?.theme ?? 'General R&D Activity'
  const commits = cluster?._commitCount ?? cluster?.commit_count ?? 'several'
  const topMsg  = cluster?._topCommits?.[0]?.msg ?? cluster?.commits?.[0]?.message ?? null
  const hours   = cluster?.aggregate_time_hours ?? cluster?.hours ?? 0
  return [
    `During the fiscal year, the company undertook systematic investigation and development work`,
    ` related to ${theme}.`,
    ` At the outset of the project, there existed technological uncertainty regarding the optimal`,
    ` approach — specifically whether the proposed design could meet the required functional`,
    ` and performance objectives without relying on standard techniques available in the field.`,
    topMsg ? ` Work included iterative experimentation such as: "${topMsg.slice(0, 80)}${topMsg.length > 80 ? '…' : ''}".` : '',
    ` The team conducted ${commits} qualifying development iterations over approximately ${hours} hours,`,
    ` applying hypothesis-driven experimentation to resolve these technical uncertainties.`,
    ` Each iteration produced measurable evidence of advancement — including commit records,`,
    ` build logs, and design documents — that collectively document the SR&ED process.`,
    ` The systematic resolution of these technological uncertainties constitutes SR&ED activity`,
    ` under ITA Section 248(1) and CRA's T4088 guidelines.`,
  ].join('')
}
// ── Theme display metadata ────────────────────────────────────────────────────
const THEME_META = {
  'ML / AI Development':              { icon: '🤖', color: 'text-violet-700 bg-violet-50 border-violet-200' },
  'Algorithm Research & Optimization':{ icon: '⚡', color: 'text-amber-700  bg-amber-50  border-amber-200'  },
  'Distributed Systems Research':     { icon: '🌐', color: 'text-blue-700   bg-blue-50   border-blue-200'   },
  'Security & Cryptography R&D':      { icon: '🔐', color: 'text-red-700    bg-red-50    border-red-200'    },
  'Performance Engineering Research': { icon: '📊', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  'Compiler / Runtime Research':      { icon: '⚙️', color: 'text-orange-700 bg-orange-50 border-orange-200' },
  'Exploratory Prototyping':          { icon: '🔬', color: 'text-teal-700   bg-teal-50   border-teal-200'   },
  'Technical Uncertainty Resolution': { icon: '🎯', color: 'text-indigo-700  bg-indigo-50 border-indigo-200' },
}

export default function ScanResultsPage() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()

  // Paid-plan gate — Starter / Plus / Enterprise unlock the four premium features
  const isPaid = ['starter', 'plus', 'enterprise'].includes(
    currentUser?.subscription_tier?.toLowerCase() ?? ''
  )

  // Read scan results from sessionStorage
  const [results] = useState(() => {
    try {
      const raw = sessionStorage.getItem('taxlift_scan_results')
      if (!raw) return null
      return JSON.parse(raw)
    } catch { return null }
  })

  const [email,     setEmail]     = useState(() => { try { return localStorage.getItem('taxlift_scan_email') ?? '' } catch { return '' } })
  const [emailSent, setEmailSent] = useState(false)
  const [emailBusy, setEmailBusy] = useState(false)
  const [pdfBusy,   setPdfBusy]   = useState(false)
  const [showDemoModal,  setShowDemoModal]  = useState(false)
  const [showCpaPanel,   setShowCpaPanel]   = useState(false)
  const [cpaDraftCopied, setCpaDraftCopied] = useState(false)

  // ── Payroll-based estimator (free — headcount × salary, bypasses commit proxy) ──
  const [showPayrollEst, setShowPayrollEst] = useState(false)
  const [rdDevCount,     setRdDevCount]     = useState(3)
  const [rdAvgSalary,    setRdAvgSalary]    = useState(110000)
  const [rdPct,          setRdPct]          = useState(40)
  // Payroll-based credit = headcount × salary × rd% × combined ITC rate
  const payrollSpend    = rdDevCount * rdAvgSalary * (rdPct / 100)
  const payrollCredit   = Math.round(payrollSpend * totalRate)
  const payrollLow      = Math.round(payrollCredit * 0.65)
  const payrollHigh     = Math.round(payrollCredit * 1.35)

  // ── Feature 1: Payroll rate override ─────────────────────────────────────
  const [showPayroll,    setShowPayroll]    = useState(false)
  const [devRate,        setDevRate]        = useState(72)
  const [senRate,        setSenRate]        = useState(92)
  const [archRate,       setArchRate]       = useState(116)
  // Weighted avg of custom rates (50% dev, 35% senior, 15% arch)
  const customAvgRate   = Math.round(devRate * 0.50 + senRate * 0.35 + archRate * 0.15)
  const defaultAvgRate  = Math.round(72   * 0.50 + 92  * 0.35 + 116  * 0.15)  // 83
  const payrollMultiplier = customAvgRate / defaultAvgRate

  // ── Feature 2: Retroactive lookback ──────────────────────────────────────
  const [showLookback, setShowLookback] = useState(false)
  // Derive claimable fiscal years (CRA FY = Apr 1 – Mar 31, 18-month lookback)
  function getFiscalYear(date = new Date()) {
    const yr = date.getFullYear()
    return date.getMonth() >= 3 ? yr : yr - 1  // Apr onwards = current FY
  }
  const currentFY    = getFiscalYear()
  const lookbackYears = [currentFY, currentFY - 1, currentFY - 2]  // up to 3 prior FYs
  // Rough per-year estimate: current year is baseline, prior years at 90% and 75%
  const fyMultipliers = [1.0, 0.90, 0.75]

  // ── Feature 3: T661 CSV export ────────────────────────────────────────────
  function handleExportT661Csv() {
    const company = (results?.repos ?? []).map(r => r.split('/').pop()).filter(Boolean).join(', ') || 'Company'
    const qualExp = Math.round((credit * payrollMultiplier) / totalRate)
    const rows = [
      ['TaxLift SR&ED Export — T661 Field Mapping'],
      ['Generated', new Date().toLocaleDateString('en-CA')],
      ['Company', company],
      ['Fiscal Year', `FY${currentFY}/${currentFY + 1}`],
      ['CCPC Status', isCcpc ? 'Yes — CCPC' : 'No — Non-CCPC'],
      ['Province', province],
      [],
      ['=== EXPENDITURE SUMMARY ==='],
      ['Field', 'T661 Line', 'Value (CAD)'],
      ['Qualified SR&ED Expenditures', 'Line 205', qualExp],
      ['Investment Tax Credit (estimated)', 'Line 360', Math.round(credit * payrollMultiplier)],
      ['Federal ITC Rate', '', `${(federalRate * 100).toFixed(0)}%`],
      ['Provincial ITC Rate', '', `${(provRate * 100).toFixed(1)}%`],
      ['Combined ITC Rate', '', `${(totalRate * 100).toFixed(1)}%`],
      ['Total Qualifying Hours', '', Math.round(hoursTotal)],
      ['Developer Avg Rate Used', '', `$${customAvgRate}/hr`],
      [],
      ['=== SR&ED PROJECT CLUSTERS ==='],
      ['Project Name (T661 Part 2)', 'Theme', 'Qualifying Hours', 'Estimated Credit', 'Commit Count', 'Evidence Strength %'],
      ...clusters.map(c => [
        c.business_component ?? c._theme ?? c.name ?? 'Unnamed',
        c._theme ?? '',
        Math.round(c.aggregate_time_hours ?? 0),
        Math.round(c.estimated_credit_cad ?? 0),
        c._commitCount ?? c.commit_count ?? 0,
        `${Math.round((c.eligibility_percentage ?? 0.7) * 100)}%`,
      ]),
      [],
      ['=== CRA METHODOLOGY REFERENCES ==='],
      ['Reference', 'Application'],
      ['ITA s.248(1)', 'SR&ED definition — systematic investigation criterion'],
      ['ITA s.127(9)', 'Investment Tax Credit definition'],
      ['ITA s.127(10.1)', 'CCPC enhanced refundable rate (35% on first $3M)'],
      ['CRA T4088', 'Guide to Form T661'],
      ['CRA IT-151R5', 'Scientific Research and Experimental Development Expenditures'],
      [],
      ['DISCLAIMER: This export is an estimate for CPA review. It does not constitute a filed T661 claim. Consult a qualified SR&ED practitioner before filing.'],
    ]
    const csv = rows.map(row =>
      Array.isArray(row)
        ? row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
        : `"${String(row ?? '').replace(/"/g, '')}"`
    ).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `taxlift-t661-export-fy${currentFY}-${new Date().toISOString().slice(0,10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ── Feature 4: Methodology audit trail ───────────────────────────────────
  const [showAuditTrail, setShowAuditTrail] = useState(false)

  // Redirect to landing if no results (e.g. direct URL visit)
  useEffect(() => {
    if (!results) navigate('/scan', { replace: true })
  }, [results, navigate])

  // ── CCPC / methodology state ─────────────────────────────────────────────
  const [isCcpc,           setIsCcpc]           = useState(true)
  const [showMethodology,  setShowMethodology]  = useState(false)
  const [province,         setProvince]         = useState('ON')

  const PROV_RATES = { ON: 0.08, QC: 0.30, BC: 0.10, AB: 0.10, MB: 0.07, SK: 0.075, NS: 0.15 }
  const PROV_NAMES = { ON: 'Ontario', QC: 'Québec', BC: 'British Columbia', AB: 'Alberta', MB: 'Manitoba', SK: 'Saskatchewan', NS: 'Nova Scotia' }
  const federalRate = isCcpc ? 0.35 : 0.15
  const provRate    = PROV_RATES[province] ?? 0.08
  const totalRate   = federalRate + provRate

  // Rebase the raw credit on current rates (scan used 0.35 federal by default)
  const baseCredit  = results?.estimated_credit ?? 0
  const credit      = Math.round(baseCredit * (totalRate / 0.43))  // 0.43 = original assumed 0.35+0.08
  // If paid and custom payroll rates differ from defaults, apply the multiplier
  const creditAdj   = isPaid ? Math.round(credit * payrollMultiplier) : credit
  const creditLow   = Math.round(creditAdj * 0.65)
  const creditHigh  = Math.round(creditAdj * 1.35)

  const animLow  = useAnimatedNumber(creditLow,  900)
  const animHigh = useAnimatedNumber(creditHigh, 1100)

  const clusters     = results?.clusters ?? []
  const topClusters  = [...clusters].sort((a, b) => b.estimated_credit_cad - a.estimated_credit_cad).slice(0, 3)
  const topCluster   = topClusters[0]
  const commitCount  = results?.commit_count  ?? clusters.reduce((s, c) => s + (c._commitCount ?? c.commit_count ?? 0), 0)
  const hoursTotal   = results?.hours_total   ?? clusters.reduce((s, c) => s + (c.aggregate_time_hours ?? 0), 0)
  const isDemoMode   = results?.is_demo
  const eligibleExp  = Math.round((baseCredit / 0.43) * (hoursTotal > 0 ? 1 : 0.7))

  async function handleEmailReport(e) {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return
    setEmailBusy(true)
    localStorage.setItem('taxlift_scan_email', email)
    try {
      await fetch('/api/v1/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          source: 'free_scan',
          plan_interest: 'starter',
          name: '',
          company: (results?.repos ?? []).join(', ').slice(0, 100),
        }),
      })
    } catch { /* backend unreachable */ }
    setEmailSent(true)
    setEmailBusy(false)
  }

  async function handleDownloadPDF() {
    if (isDemoMode) { setShowDemoModal(true); return }
    setPdfBusy(true)
    try {
      const res = await fetch('/api/v1/audit/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repos:        results?.repos            ?? [],
          clusters:     results?.clusters         ?? [],
          credit:       credit,
          creditLow:    creditLow,
          creditHigh:   creditHigh,
          commitCount:  results?.commit_count     ?? 0,
          hoursTotal:   results?.hours_total      ?? 0,
          isCcpc:       isCcpc,
          province:     province,
          email:        email,
        }),
      })
      if (!res.ok) throw new Error('PDF generation failed')
      const blob     = await res.blob()
      const url      = URL.createObjectURL(blob)
      const a        = document.createElement('a')
      a.href         = url
      const company  = (results?.repos?.[0] ?? 'company').split('/')[0]
      a.download     = `taxlift-sred-audit-${company}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[handleDownloadPDF]', err.message)
    } finally {
      setPdfBusy(false)
    }
  }

  // ── CPA share helpers ─────────────────────────────────────────────────────
  function buildCpaDraft() {
    const company     = (results?.repos ?? []).map(r => r.split('/')[0]).filter(Boolean)[0] ?? 'our company'
    const clusterList = topClusters
      .map((c, i) => `  ${i + 1}. ${c._theme ?? c.theme ?? c.business_component ?? c.name} — ${fmtK(c.estimated_credit_cad)} estimated ITC`)
      .join('\n')
    return `Hi,

I've been looking into the SR\u0026ED tax credit program and ran our GitHub commit history through TaxLift's free scanner. The results suggest we may qualify for a significant refundable ITC this year.

Summary for ${company}:
  • Estimated SR\u0026ED credit: ${fmtK(creditLow)} – ${fmtK(creditHigh)} (CCPC refundable ITC)
  • Qualifying activity clusters found: ${clusters.length}
  • Top qualifying themes:
${clusterList}

I've attached a 2-page executive summary with the full cluster breakdown and CRA methodology notes.

I'd like to get your thoughts on whether we should proceed with a formal claim this year. TaxLift can generate the full T661 narratives, evidence chain, and CPA handoff package — you'd review and file.

Would you have 15 minutes this week to review the summary and advise on next steps?

Best,
[Your name]

---
Generated by TaxLift (taxlift.ai) · Free SR\u0026ED scan`
  }

  function handleCopyDraft() {
    navigator.clipboard.writeText(buildCpaDraft()).then(() => {
      setCpaDraftCopied(true)
      setTimeout(() => setCpaDraftCopied(false), 2500)
    })
  }

  function handleMailtoCpa() {
    const company = (results?.repos ?? []).map(r => r.split('/')[0]).filter(Boolean)[0] ?? 'Our Company'
    const subject = encodeURIComponent(`SR\u0026ED Credit Analysis — ${company} — ${fmtK(creditLow)}–${fmtK(creditHigh)} estimated`)
    const body    = encodeURIComponent(buildCpaDraft())
    window.open(`mailto:?subject=${subject}&body=${body}`, '_self')
  }

  if (!results) return null

  // ── Zero-results state ────────────────────────────────────────────────────
  if (clusters.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <AlertTriangle size={24} className="text-amber-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Limited SR&ED signal found</h1>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            The repos you selected didn't have many commit messages that matched CRA SR&ED patterns.
            This doesn't mean you don't qualify — it often just means the R&D work is in a different repo
            or uses different commit message conventions.
          </p>
          <div className="bg-white border border-gray-200 rounded-xl p-5 text-left space-y-3 mb-6">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Try these instead:</p>
            {[
              'Connect your main engineering or ML repo (not the docs or infra repos)',
              'Repos with "experiment", "research", "prototype", or "poc" commit messages qualify most often',
              'AI/ML, algorithm, distributed systems, and compiler work has the highest qualification rate',
            ].map((tip, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                <ChevronRight size={12} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                {tip}
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/scan/repos')}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm py-3 rounded-xl transition-colors"
            >
              <RefreshCw size={14} /> Try different repos
            </button>
            <button
              onClick={() => navigate('/estimate')}
              className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Use the manual estimator instead →
            </button>
          </div>
          {/* Still capture email */}
          <div className="mt-6 border-t border-gray-100 pt-6">
            <p className="text-xs text-gray-500 mb-3">Get tips on what makes strong SR&ED evidence:</p>
            {!emailSent ? (
              <form onSubmit={handleEmailReport} className="flex gap-2">
                <input
                  id="results-email-tips"
                  name="email"
                  type="email" required placeholder="your@email.com" value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button type="submit" disabled={emailBusy}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
                  Send
                </button>
              </form>
            ) : (
              <p className="text-sm text-emerald-600 font-medium">✓ We'll be in touch!</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Nav */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-xl flex items-center justify-center">
              <ShieldCheck size={14} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 tracking-tight text-sm">TaxLift</span>
            {isDemoMode && (
              <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5 ml-2 font-medium">
                Demo results
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/scan/repos')} className="text-xs text-gray-500 hover:text-gray-700 transition-colors">
              ← Scan different repos
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* ── HERO: Credit estimate ────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-8 text-white text-center shadow-xl">
          <div className="inline-flex items-center gap-2 bg-white/10 text-indigo-200 text-xs font-medium px-3 py-1 rounded-full mb-4">
            <Sparkles size={11} /> Estimated SR&ED refundable ITC based on qualifying commits
          </div>
          <div className="flex items-baseline justify-center gap-2 mb-2">
            <span className="text-5xl sm:text-6xl font-bold tabular-nums tracking-tight">
              {fmtK(animLow)}
            </span>
            <span className="text-2xl font-bold text-indigo-300">–</span>
            <span className="text-5xl sm:text-6xl font-bold tabular-nums tracking-tight">
              {fmtK(animHigh)}
            </span>
          </div>
          <p className="text-indigo-200 text-sm">
            Conservative–expected range · Based on {clusters.length} qualifying activity cluster{clusters.length !== 1 ? 's' : ''}
          </p>
          <p className="text-indigo-300 text-xs mt-1">
            Refundable cash · {isCcpc ? 'CCPC' : 'Non-CCPC'} · {(federalRate*100).toFixed(0)}% federal + {(provRate*100).toFixed(1)}% {province} provincial
          </p>

          {/* Stat tiles */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              { label: 'Qualifying clusters', value: clusters.length, Icon: FlaskConical },
              { label: 'Commits analysed',    value: commitCount,     Icon: CheckCircle2 },
              { label: 'Est. R&D hours',      value: `${Math.round(hoursTotal)}h`, Icon: Clock },
            ].map(({ label, value, Icon }) => (
              <div key={label} className="bg-white/10 rounded-xl py-3 px-2">
                <Icon size={16} className="text-indigo-300 mx-auto mb-1.5" />
                <p className="text-xl font-bold">{value}</p>
                <p className="text-[10px] text-indigo-300 leading-tight mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── CCPC toggle + methodology ────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">

            {/* CCPC toggle */}
            <label className="flex items-center gap-3 cursor-pointer select-none flex-1">
              <button
                role="switch"
                aria-checked={isCcpc}
                onClick={() => setIsCcpc(v => !v)}
                className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${isCcpc ? 'bg-indigo-600' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isCcpc ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Canadian-Controlled Private Corporation (CCPC)
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {isCcpc
                    ? '35% federal ITC on first $3M qualifying expenditures'
                    : '15% federal ITC (non-CCPC or expenditures above $3M threshold)'}
                </p>
              </div>
            </label>

            {/* Province selector */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <label className="text-xs text-gray-500 font-medium">Province</label>
              <select
                value={province}
                onChange={e => setProvince(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {Object.entries(PROV_NAMES).map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
            </div>

            {/* Methodology toggle */}
            <button
              onClick={() => setShowMethodology(v => !v)}
              className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium flex-shrink-0"
            >
              {showMethodology ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              How we calculated this
            </button>
          </div>

          {/* Methodology disclosure panel */}
          {showMethodology && (
            <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 text-xs text-gray-600 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="font-semibold text-gray-800 mb-1.5">Federal ITC (SR&ED)</p>
                  <div className="space-y-1">
                    <div className="flex justify-between"><span>Rate ({isCcpc ? 'CCPC' : 'Non-CCPC'})</span><span className="font-mono font-semibold">{(federalRate * 100).toFixed(0)}%</span></div>
                    <div className="flex justify-between"><span>Provincial ({PROV_NAMES[province]})</span><span className="font-mono font-semibold">{(provRate * 100).toFixed(1)}%</span></div>
                    <div className="flex justify-between border-t border-gray-200 pt-1 mt-1"><span className="font-semibold">Combined rate</span><span className="font-mono font-semibold text-indigo-700">{(totalRate * 100).toFixed(1)}%</span></div>
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-gray-800 mb-1.5">Eligible expenditure assumptions</p>
                  <div className="space-y-1">
                    <div className="flex justify-between"><span>Developer</span><span className="font-mono">$72/hr</span></div>
                    <div className="flex justify-between"><span>Senior Developer</span><span className="font-mono">$92/hr</span></div>
                    <div className="flex justify-between"><span>Architect / ML Eng</span><span className="font-mono">$116/hr</span></div>
                    <div className="flex justify-between"><span>Overhead proxy</span><span className="font-mono">20%</span></div>
                  </div>
                </div>
              </div>
              <div className="space-y-1 border-t border-gray-200 pt-3">
                <p className="font-semibold text-gray-800 mb-1">Eligibility weighting</p>
                <div className="flex gap-4">
                  <span><span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />Yes = 100%</span>
                  <span><span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1" />Partial = 50%</span>
                  <span><span className="inline-block w-2 h-2 rounded-full bg-gray-300 mr-1" />No = 0%</span>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 border-t border-gray-200 pt-2">
                References: ITA s.127(9), s.127(10.1), CRA T4088, IT-151R5. CCPC refundable ITC applies to qualified SR&ED expenditures under the traditional method.
                Estimates are illustrative and do not constitute a filed claim. Consult a qualified SR&ED practitioner before filing.
              </p>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            PAYROLL ESTIMATOR — Free for all users
            Commit-based scanning understates credits for repos with terse commit
            messages. This lets users enter real headcount + salary to compute
            the actual eligible expenditure rather than relying on commit hours.
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowPayrollEst(v => !v)}
            className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-violet-50">
                <Users size={15} className="text-violet-600" />
              </div>
              <div className="text-left min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">Payroll-based estimate</p>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5">
                    Free
                  </span>
                  {showPayrollEst && payrollCredit > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-violet-50 text-violet-700 border border-violet-200 rounded-full px-2 py-0.5">
                      {fmtK(payrollLow)}–{fmtK(payrollHigh)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  Terse commit messages understate R&amp;D hours — enter your team size and salary for a truer estimate
                </p>
              </div>
            </div>
            {showPayrollEst ? <ChevronUp size={15} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={15} className="text-gray-400 flex-shrink-0" />}
          </button>

          {showPayrollEst && (
            <div className="border-t border-gray-100 px-5 py-5 space-y-5">

              {/* Why this matters */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 leading-relaxed">
                <strong>Why the commit estimate is low:</strong> The scanner found <strong>{Math.round(hoursTotal)} R&amp;D hours</strong> from commit signals.
                But commit messages like <code className="bg-amber-100 px-1 rounded">feat: add auth</code> or <code className="bg-amber-100 px-1 rounded">fix: billing</code> score 0 even when the underlying work involved real technical uncertainty.
                Enter your actual payroll below to see what CRA would calculate using the <strong>proxy method</strong>.
              </div>

              {/* Three sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {/* R&D dev headcount */}
                <div>
                  <div className="flex justify-between items-baseline mb-1.5">
                    <label className="text-xs font-semibold text-gray-700">R&amp;D developers</label>
                    <span className="text-sm font-bold text-violet-700 tabular-nums">{rdDevCount}</span>
                  </div>
                  <input type="range" min={1} max={50} step={1}
                    value={rdDevCount} onChange={e => setRdDevCount(Number(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer accent-violet-600"
                    style={{ background: `linear-gradient(to right, #7c3aed 0%, #7c3aed ${((rdDevCount-1)/49)*100}%, #e5e7eb ${((rdDevCount-1)/49)*100}%, #e5e7eb 100%)` }}
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-0.5"><span>1</span><span>25</span><span>50</span></div>
                </div>

                {/* Avg annual salary */}
                <div>
                  <div className="flex justify-between items-baseline mb-1.5">
                    <label className="text-xs font-semibold text-gray-700">Avg annual salary</label>
                    <span className="text-sm font-bold text-violet-700 tabular-nums">${(rdAvgSalary/1000).toFixed(0)}K</span>
                  </div>
                  <input type="range" min={60000} max={200000} step={5000}
                    value={rdAvgSalary} onChange={e => setRdAvgSalary(Number(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer accent-violet-600"
                    style={{ background: `linear-gradient(to right, #7c3aed 0%, #7c3aed ${((rdAvgSalary-60000)/140000)*100}%, #e5e7eb ${((rdAvgSalary-60000)/140000)*100}%, #e5e7eb 100%)` }}
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-0.5"><span>$60K</span><span>$130K</span><span>$200K</span></div>
                </div>

                {/* % time on qualifying R&D */}
                <div>
                  <div className="flex justify-between items-baseline mb-1.5">
                    <label className="text-xs font-semibold text-gray-700">% time on R&amp;D</label>
                    <span className="text-sm font-bold text-violet-700 tabular-nums">{rdPct}%</span>
                  </div>
                  <input type="range" min={10} max={90} step={5}
                    value={rdPct} onChange={e => setRdPct(Number(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer accent-violet-600"
                    style={{ background: `linear-gradient(to right, #7c3aed 0%, #7c3aed ${((rdPct-10)/80)*100}%, #e5e7eb ${((rdPct-10)/80)*100}%, #e5e7eb 100%)` }}
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-0.5"><span>10%</span><span>50%</span><span>90%</span></div>
                </div>
              </div>

              {/* Result comparison */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                  <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mb-1">Commit-signal estimate</p>
                  <p className="text-xs text-gray-400 mb-2">{Math.round(hoursTotal)}h detected × proxy rate</p>
                  <p className="text-xl font-bold text-gray-700 tabular-nums">{fmtK(creditLow)}–{fmtK(creditHigh)}</p>
                  <p className="text-[10px] text-gray-400 mt-1">based on keyword matches</p>
                </div>
                <div className="bg-violet-50 border border-violet-300 rounded-xl p-4 text-center">
                  <p className="text-[10px] text-violet-600 font-semibold uppercase tracking-wide mb-1">Payroll-based estimate</p>
                  <p className="text-xs text-violet-400 mb-2">{rdDevCount} devs × ${(rdAvgSalary/1000).toFixed(0)}K × {rdPct}% R&amp;D</p>
                  <p className="text-xl font-bold text-violet-700 tabular-nums">{fmtK(payrollLow)}–{fmtK(payrollHigh)}</p>
                  <p className="text-[10px] text-violet-400 mt-1">CRA proxy method · {(totalRate*100).toFixed(1)}% ITC</p>
                </div>
              </div>

              <p className="text-[10px] text-gray-400 leading-relaxed">
                The payroll estimate uses CRA's <strong>proxy method</strong>: qualifying expenditures = R&amp;D salaries × eligible fraction. Your CPA will refine this with actual T4 data.
                The commit estimate is a conservative lower bound — it only counts work with explicit SR&amp;ED signal keywords in commit messages.
              </p>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            FEATURE 1 — Payroll Rate Override
            Free:  locked panel showing the $72/hr assumption with upgrade CTA
            Paid:  editable salary inputs per role; credit recalculates live
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <button
            onClick={() => isPaid ? setShowPayroll(v => !v) : null}
            className={`w-full flex items-center justify-between gap-3 px-5 py-4 ${isPaid ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'} transition-colors`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isPaid ? 'bg-emerald-50' : 'bg-gray-100'}`}>
                <DollarSign size={15} className={isPaid ? 'text-emerald-600' : 'text-gray-400'} />
              </div>
              <div className="text-left min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">Payroll Rate Override</p>
                  {!isPaid && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-full px-2 py-0.5">
                      <Lock size={9} /> Starter
                    </span>
                  )}
                  {isPaid && payrollMultiplier !== 1 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5">
                      ✓ Custom rates applied
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {isPaid
                    ? `Using $${customAvgRate}/hr weighted avg · Credit ${payrollMultiplier > 1 ? 'increased' : payrollMultiplier < 1 ? 'decreased' : 'unchanged'} from default`
                    : 'Replace $72/hr assumption with your actual T4 salary data — makes the estimate board-ready'}
                </p>
              </div>
            </div>
            {isPaid
              ? (showPayroll ? <ChevronUp size={15} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={15} className="text-gray-400 flex-shrink-0" />)
              : <ArrowRight size={14} className="text-indigo-400 flex-shrink-0" />
            }
          </button>

          {/* Free: teaser locked state */}
          {!isPaid && (
            <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
              <div className="grid grid-cols-3 gap-3 mb-3 opacity-50 pointer-events-none select-none">
                {[
                  { label: 'Developer (avg)', value: '$72/hr', role: '50% of hours' },
                  { label: 'Senior Developer', value: '$92/hr', role: '35% of hours' },
                  { label: 'Architect / ML Eng', value: '$116/hr', role: '15% of hours' },
                ].map(r => (
                  <div key={r.label} className="bg-white border border-gray-200 rounded-xl p-3">
                    <p className="text-[10px] text-gray-400 mb-1">{r.label}</p>
                    <p className="text-base font-bold text-gray-300 font-mono">{r.value}</p>
                    <p className="text-[10px] text-gray-300 mt-0.5">{r.role}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-gray-500 max-w-xs">
                  Your actual developer salaries may be 30–50% higher. Enter real T4 rates to get a number you can take to your board.
                </p>
                <button
                  onClick={() => navigate(`/signup?from=scan&plan=starter&credit=${creditAdj}`)}
                  className="flex-shrink-0 flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors"
                >
                  Unlock <ArrowRight size={11} />
                </button>
              </div>
            </div>
          )}

          {/* Paid: editable rate inputs */}
          {isPaid && showPayroll && (
            <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 space-y-4">
              <p className="text-xs text-gray-500">
                Enter your actual average hourly rates by role. The credit estimate updates live.
                Use gross salary ÷ 1,800 annual hours as a quick conversion.
              </p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Developer', sub: '~50% of SR&ED hours', val: devRate, set: setDevRate, min: 40, max: 200 },
                  { label: 'Senior Developer', sub: '~35% of SR&ED hours', val: senRate, set: setSenRate, min: 50, max: 250 },
                  { label: 'Architect / ML Eng', sub: '~15% of SR&ED hours', val: archRate, set: setArchRate, min: 60, max: 350 },
                ].map(r => (
                  <div key={r.label} className="bg-white border border-gray-200 rounded-xl p-3">
                    <p className="text-[10px] font-medium text-gray-600 mb-2">{r.label}</p>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-sm text-gray-400">$</span>
                      <input
                        type="number"
                        min={r.min}
                        max={r.max}
                        value={r.val}
                        onChange={e => r.set(Math.max(r.min, Math.min(r.max, Number(e.target.value) || r.min)))}
                        className="w-full text-base font-bold text-gray-900 font-mono border-0 bg-transparent focus:outline-none focus:ring-0 p-0"
                      />
                      <span className="text-xs text-gray-400">/hr</span>
                    </div>
                    <input
                      type="range" min={r.min} max={r.max} value={r.val}
                      onChange={e => r.set(Number(e.target.value))}
                      className="w-full h-1.5 accent-emerald-500"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">{r.sub}</p>
                  </div>
                ))}
              </div>
              {/* Live result */}
              <div className={`rounded-xl p-4 flex items-center justify-between gap-4 ${
                payrollMultiplier > 1 ? 'bg-emerald-50 border border-emerald-200'
                  : payrollMultiplier < 1 ? 'bg-amber-50 border border-amber-200'
                  : 'bg-gray-100 border border-gray-200'
              }`}>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Adjusted weighted avg rate</p>
                  <p className="text-sm font-bold text-gray-900 font-mono">${customAvgRate}/hr</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {payrollMultiplier > 1
                      ? `+${((payrollMultiplier - 1) * 100).toFixed(0)}% above default`
                      : payrollMultiplier < 1
                      ? `${((1 - payrollMultiplier) * 100).toFixed(0)}% below default`
                      : 'Same as default'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 mb-0.5">Updated credit estimate</p>
                  <p className="text-xl font-extrabold text-gray-900">
                    {fmtK(creditLow)} – {fmtK(creditHigh)}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {payrollMultiplier !== 1 && `was ${fmtK(Math.round(credit * 0.65))}–${fmtK(Math.round(credit * 1.35))} at default rates`}
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-gray-400">
                Tip: use the employee's T4 Box 14 employment income ÷ 1,800 working hours for the most accurate rate.
                Overhead is already factored in at 20%.
              </p>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            FEATURE 2 — Retroactive 18-Month Lookback
            Free:  locked banner with "FY2024 + FY2023 opportunity detected"
            Paid:  per-year credit estimates with filing deadlines + urgency
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <button
            onClick={() => isPaid ? setShowLookback(v => !v) : null}
            className={`w-full flex items-center justify-between gap-3 px-5 py-4 ${isPaid ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'} transition-colors`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isPaid ? 'bg-violet-50' : 'bg-gray-100'}`}>
                <CalendarDays size={15} className={isPaid ? 'text-violet-600' : 'text-gray-400'} />
              </div>
              <div className="text-left min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">18-Month Retroactive Lookback</p>
                  {!isPaid && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-full px-2 py-0.5">
                      <Lock size={9} /> Starter
                    </span>
                  )}
                  {isPaid && (
                    <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
                      {lookbackYears.length} years claimable
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {isPaid
                    ? `FY${lookbackYears[1]}/${lookbackYears[1]+1} and FY${lookbackYears[2]}/${lookbackYears[2]+1} are still open for amendment`
                    : `FY${currentFY - 1} + FY${currentFY - 2} likely claimable — you may have left money on the table`}
                </p>
              </div>
            </div>
            {isPaid
              ? (showLookback ? <ChevronUp size={15} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={15} className="text-gray-400 flex-shrink-0" />)
              : <ArrowRight size={14} className="text-indigo-400 flex-shrink-0" />
            }
          </button>

          {/* Free: teaser */}
          {!isPaid && (
            <div className="border-t border-gray-100 px-5 py-4 bg-violet-50/40">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {lookbackYears.slice(1).map((fy, i) => (
                      <div key={fy} className="bg-white border border-violet-200 rounded-xl px-4 py-2.5 text-center min-w-[120px]">
                        <p className="text-xs font-bold text-violet-700">FY{fy}/{fy+1}</p>
                        <p className="text-lg font-extrabold text-gray-300 mt-0.5 blur-sm select-none">$???K</p>
                        <p className="text-[10px] text-gray-400">estimated credit</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">
                    CRA allows SR&ED amendments for up to 18 months after your original T2 filing deadline.
                    Prior-year claims are often larger than current-year.
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/signup?from=scan&plan=starter&credit=${creditAdj}`)}
                  className="flex-shrink-0 flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors"
                >
                  See retroactive estimates <ArrowRight size={11} />
                </button>
              </div>
            </div>
          )}

          {/* Paid: full per-year breakdown */}
          {isPaid && showLookback && (
            <div className="border-t border-gray-100 px-5 py-5 space-y-4">
              <p className="text-xs text-gray-500">
                Based on your current-year activity, here are estimated credits for open prior years.
                CRA allows T2 amendments for SR&ED up to 18 months after the filing deadline (ITA s.152(4)(b)).
              </p>
              <div className="space-y-3">
                {lookbackYears.map((fy, i) => {
                  const mult     = fyMultipliers[i]
                  const fyCredit = Math.round(creditAdj * mult)
                  const fyLow    = Math.round(fyCredit * 0.65)
                  const fyHigh   = Math.round(fyCredit * 1.35)
                  // Amendment deadline: 18 months after Corp T2 deadline = 6 months after FY end
                  // FY ends Mar 31 of (fy+1), T2 due Sep 30 of (fy+1), amendment deadline Mar 31 of (fy+2)
                  const amendDeadline = `Mar 31, ${fy + 2}`
                  const isCurrentYear = i === 0
                  const isUrgent = i === 1  // last full year
                  return (
                    <div key={fy} className={`rounded-xl border p-4 ${
                      isCurrentYear ? 'bg-indigo-50 border-indigo-200'
                        : isUrgent   ? 'bg-amber-50 border-amber-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-sm font-bold ${isCurrentYear ? 'text-indigo-700' : isUrgent ? 'text-amber-700' : 'text-gray-700'}`}>
                              FY{fy}/{fy+1}
                            </span>
                            {isCurrentYear && (
                              <span className="text-[10px] bg-indigo-100 text-indigo-600 font-semibold px-2 py-0.5 rounded-full">
                                Current year — this scan
                              </span>
                            )}
                            {isUrgent && (
                              <span className="text-[10px] bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">
                                ⚠ Deadline {amendDeadline}
                              </span>
                            )}
                            {!isCurrentYear && !isUrgent && (
                              <span className="text-[10px] bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded-full">
                                Deadline {amendDeadline}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500">
                            {isCurrentYear
                              ? 'Based on this scan — your current filing year'
                              : `Estimated based on ${Math.round(mult * 100)}% of current year activity. Connect prior-year repos to refine.`}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-lg font-extrabold text-gray-900">{fmtK(fyLow)}–{fmtK(fyHigh)}</p>
                          <p className="text-[10px] text-gray-400">estimated credit</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              {/* Total opportunity */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-700">Total retroactive opportunity (3 years)</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Conservative estimate · subject to CRA review</p>
                </div>
                <p className="text-2xl font-extrabold text-gray-900">
                  {fmtK(Math.round(lookbackYears.reduce((s, _, i) => s + creditAdj * fyMultipliers[i] * 0.65, 0)))}–
                  {fmtK(Math.round(lookbackYears.reduce((s, _, i) => s + creditAdj * fyMultipliers[i] * 1.35, 0)))}
                </p>
              </div>
              <p className="text-[10px] text-gray-400">
                ITA s.152(4)(b) — CRA typically allows SR&ED T2 amendments for 18 months after the
                original assessment. File sooner rather than later to avoid losing prior years.
              </p>
            </div>
          )}
        </div>

        {/* ── Download Proposal PDF ────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 bg-white rounded-2xl shadow-sm border border-indigo-100 px-5 py-3.5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">Download your SR&amp;ED Audit Package</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Cover · executive summary · project descriptions · expenditure schedule · CRA methodology · evidence appendix
            </p>
          </div>
          <button
            onClick={handleDownloadPDF}
            disabled={pdfBusy}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60 font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap flex-shrink-0 shadow-sm"
          >
            {pdfBusy
              ? <><RefreshCw size={14} className="animate-spin" /> Generating…</>
              : <><Download size={14} /> Download Audit Package</>
            }
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            FEATURE 3 — T661 Structured CSV Export
            Free:  locked button with field-name preview
            Paid:  one-click CSV download mapping to T661 schedule fields
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isPaid ? 'bg-teal-50' : 'bg-gray-100'}`}>
                <FileSpreadsheet size={15} className={isPaid ? 'text-teal-600' : 'text-gray-400'} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">T661 Data Export (CPA-Ready CSV)</p>
                  {!isPaid && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-full px-2 py-0.5">
                      <Lock size={9} /> Starter
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {isPaid
                    ? 'Structured CSV mapping to T661 schedule lines — open in Excel or import to TaxCycle / ProFile'
                    : 'Fields: T661 Line 205, Line 360, cluster narratives, hours by role — hand this to your CPA'}
                </p>
              </div>
            </div>
            {isPaid ? (
              <button
                onClick={handleExportT661Csv}
                className="flex-shrink-0 flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap shadow-sm"
              >
                <Download size={14} /> Export CSV
              </button>
            ) : (
              <button
                onClick={() => navigate(`/signup?from=scan&plan=starter&credit=${creditAdj}`)}
                className="flex-shrink-0 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap shadow-sm"
              >
                <Lock size={13} /> Unlock Export
              </button>
            )}
          </div>

          {/* Field preview — always visible, blurred for free users */}
          <div className={`border-t border-gray-100 px-5 py-3 bg-gray-50 ${!isPaid ? 'opacity-40 select-none pointer-events-none blur-[1px]' : ''}`}>
            <div className="flex flex-wrap gap-2">
              {[
                'T661 Line 205 — Qualified SR&ED Expenditures',
                'T661 Line 360 — ITC Claimed',
                'Developer hours by role',
                'Per-cluster project names',
                'Evidence commit counts',
                'ITC rate methodology',
                'CRA reference citations',
              ].map(f => (
                <span key={f} className="text-[10px] bg-white border border-gray-200 text-gray-500 px-2 py-0.5 rounded-md font-mono">
                  {f}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            FEATURE 4 — Methodology Audit Trail
            Free:  locked — shows what's inside but can't expand
            Paid:  full calculation chain — qualified expenditures → ITC rate
                   → credit; plus a CPA-signable methodology statement
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <button
            onClick={() => isPaid ? setShowAuditTrail(v => !v) : navigate(`/signup?from=scan&plan=starter&credit=${creditAdj}`)}
            className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isPaid ? 'bg-slate-100' : 'bg-gray-100'}`}>
                <Shield size={15} className={isPaid ? 'text-slate-600' : 'text-gray-400'} />
              </div>
              <div className="text-left min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">Methodology Audit Trail</p>
                  {!isPaid ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-full px-2 py-0.5">
                      <Lock size={9} /> Starter
                    </span>
                  ) : (
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5 font-semibold">
                      CRA-auditable
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  Full calculation chain — qualified expenditures → ITC rate → credit · includes CPA-signable methodology statement
                </p>
              </div>
            </div>
            {isPaid
              ? (showAuditTrail ? <ChevronUp size={15} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={15} className="text-gray-400 flex-shrink-0" />)
              : <ArrowRight size={14} className="text-indigo-400 flex-shrink-0" />
            }
          </button>

          {isPaid && showAuditTrail && (() => {
            const qualExp    = Math.round(creditAdj / totalRate)
            const overheadAmt= Math.round(qualExp * 0.20)
            const labourAmt  = Math.round(qualExp * 0.80)
            const fedCredit  = Math.round(qualExp * federalRate)
            const provCredit = Math.round(qualExp * provRate)
            return (
              <div className="border-t border-gray-100 px-5 py-5 space-y-5">
                {/* Calculation chain */}
                <div>
                  <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">Calculation Chain</p>
                  <div className="space-y-2">
                    {[
                      { step: '1', label: 'SR&ED qualifying hours identified', value: `~${Math.round(hoursTotal)}h`, note: 'From commit-to-hour proxy across all clusters' },
                      { step: '2', label: `Labour cost at $${customAvgRate}/hr weighted avg`, value: fmtK(labourAmt), note: `${Math.round(devRate * 0.5 + senRate * 0.35 + archRate * 0.15)}/hr × ${Math.round(hoursTotal)}h × 80% labour share` },
                      { step: '3', label: 'Overhead proxy (20% of labour)', value: fmtK(overheadAmt), note: 'CRA traditional method — proxy election not modelled' },
                      { step: '4', label: 'Total qualified SR&ED expenditures', value: fmtK(qualExp), note: 'T661 Line 205 — ITA s.37(1)' },
                      { step: '5', label: `Federal ITC @ ${(federalRate*100).toFixed(0)}% (${isCcpc ? 'CCPC' : 'Non-CCPC'})`, value: fmtK(fedCredit), note: `ITA s.127(9)${isCcpc ? ' + s.127(10.1) refundable' : ''}` },
                      { step: '6', label: `Provincial ITC @ ${(provRate*100).toFixed(1)}% (${province})`, value: fmtK(provCredit), note: `${province} SR&ED provincial credit` },
                      { step: '7', label: 'Total estimated ITC', value: fmtK(creditAdj), note: 'T661 Line 360 — federal + provincial combined', bold: true },
                    ].map(r => (
                      <div key={r.step} className={`flex items-start justify-between gap-4 py-2 border-b border-gray-100 last:border-0 ${r.bold ? 'bg-indigo-50 -mx-5 px-5 rounded-none' : ''}`}>
                        <div className="flex items-start gap-3 min-w-0">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ${r.bold ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'}`}>{r.step}</span>
                          <div className="min-w-0">
                            <p className={`text-xs font-medium ${r.bold ? 'text-indigo-700' : 'text-gray-700'}`}>{r.label}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{r.note}</p>
                          </div>
                        </div>
                        <span className={`text-sm font-bold flex-shrink-0 ${r.bold ? 'text-indigo-700' : 'text-gray-900'}`}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CPA-signable methodology statement */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText size={13} className="text-slate-500" />
                    <p className="text-xs font-bold text-slate-700">Methodology Statement — for CPA Review</p>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    SR&ED credit estimate prepared using the <strong>traditional method</strong> under ITA s.37(1).
                    Qualifying R&D hours were identified via systematic analysis of {commitCount} Git commits
                    across {clusters.length} activity cluster{clusters.length !== 1 ? 's' : ''}, using CRA's
                    three-part test (s.248(1)) to assess systematic investigation, technological uncertainty,
                    and advancement of knowledge. Labour costs calculated at ${customAvgRate}/hr weighted average
                    (Developer ${devRate}/hr · Senior ${senRate}/hr · Architect ${archRate}/hr).
                    Overhead applied at 20% proxy. ITC calculated at {(federalRate*100).toFixed(0)}%
                    federal ({isCcpc ? 'CCPC refundable — ITA s.127(10.1)' : 'non-CCPC — ITA s.127(9)'}) +
                    {(provRate*100).toFixed(1)}% provincial ({province}).
                    Estimate does not account for prior-year ITC recapture, taxable income thresholds,
                    or proxy election vs. traditional method trade-offs. CPA review required before filing.
                  </p>
                  <p className="text-[10px] text-slate-400 mt-2">
                    References: ITA s.37(1), s.127(9), s.127(10.1), s.248(1) · CRA T4088 · CRA IT-151R5
                  </p>
                </div>

                <p className="text-[10px] text-gray-400">
                  This audit trail is exportable via the T661 CSV export above. Provide it to your CPA
                  alongside the PDF audit package to support the T661 filing.
                </p>
              </div>
            )
          })()}
        </div>

        {/* ── Share with CPA ───────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            onClick={() => setShowCpaPanel(v => !v)}
            className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Users size={15} className="text-indigo-600" />
              </div>
              <div className="text-left min-w-0">
                <p className="text-sm font-semibold text-gray-900">Share with your CPA</p>
                <p className="text-xs text-gray-400 mt-0.5">Pre-written email with credit estimate and top qualifying activities</p>
              </div>
            </div>
            {showCpaPanel
              ? <ChevronUp size={15} className="text-gray-400 flex-shrink-0" />
              : <ChevronDown size={15} className="text-gray-400 flex-shrink-0" />
            }
          </button>

          {showCpaPanel && (
            <div className="border-t border-gray-100 px-5 pb-5">
              {/* Action buttons */}
              <div className="flex gap-2 mt-4 mb-4">
                <button
                  onClick={handleMailtoCpa}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors"
                >
                  <Mail size={12} /> Open in email client
                </button>
                <button
                  onClick={handleCopyDraft}
                  className={`flex items-center gap-1.5 border text-xs font-semibold px-4 py-2 rounded-xl transition-colors ${
                    cpaDraftCopied
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {cpaDraftCopied
                    ? <><CheckCircle2 size={12} /> Copied!</>
                    : <><Copy size={12} /> Copy email draft</>
                  }
                </button>
              </div>

              {/* Draft preview */}
              <div className="bg-slate-50 border border-gray-200 rounded-xl p-4">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Preview</p>
                <pre className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed font-sans max-h-48 overflow-y-auto">
                  {buildCpaDraft()}
                </pre>
              </div>

              <p className="text-[11px] text-gray-400 mt-3 flex items-center gap-1">
                <Download size={10} className="flex-shrink-0" />
                Tip: download the Proposal PDF above and attach it to this email for maximum impact.
              </p>
            </div>
          )}
        </div>

        {/* ── Top qualifying activities ─────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-1">
            <TrendingUp size={15} className="text-indigo-600" /> Your qualifying SR&ED activities
          </h2>
          <p className="text-xs text-gray-400 mb-5">
            Detected from commit history using CRA SR&ED signal keywords and file-path patterns.
          </p>

          {topCluster && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4">
              <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wide mb-1">
                Top qualifying activity
              </p>
              <p className="text-sm font-bold text-indigo-900">{topCluster._theme ?? topCluster.theme ?? 'General R&D'}</p>
              <p className="text-xs text-indigo-700 mt-0.5">
                {topCluster._commitCount ?? topCluster.commit_count ?? 0} qualifying commits · {Math.round(topCluster.aggregate_time_hours)} estimated hours
              </p>
              {topCluster._signals?.[0] && (
                <p className="text-[11px] font-mono text-indigo-600 bg-indigo-100/60 rounded-lg px-2.5 py-1.5 mt-2 truncate">
                  &ldquo;{topCluster._signals[0]}&rdquo;
                </p>
              )}
            </div>
          )}

          <div className="space-y-3">
            {topClusters.map((cluster, i) => {
              const theme   = cluster._theme ?? cluster.theme ?? 'General R&D'
              const meta    = THEME_META[theme] ?? { icon: '🔬', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' }
              // Build synthetic commit list from _topCommits for the qualification engine
              const syntheticCommits = (cluster._topCommits ?? []).map((c, ci) => ({
                sha: `sc-${i}-${ci}`,
                message: c.msg ?? c.message ?? '',
              }))
              // Build synthetic trigger_rules from _signals
              const syntheticRules = (cluster._signals ?? []).map(sig => ({
                heuristic: sig.includes('experiment') ? 'ExperimentalBranches'
                  : sig.includes('churn') ? 'HighCodeChurn'
                  : sig.includes('perf') ? 'PerformanceOptimization'
                  : 'ExperimentalBranches',
                weight: 0.25,
                fired_value: 0.80,
                threshold: 0.70,
              }))
              const syntheticCluster = {
                trigger_rules: syntheticRules.length
                  ? syntheticRules
                  : [{ heuristic: 'ExperimentalBranches', weight: 0.35, fired_value: 0.80, threshold: 0.70 }],
              }
              const qual    = qualifyCluster(syntheticCluster, syntheticCommits)
              return (
                <ScanClusterCard
                  key={cluster.id ?? i}
                  cluster={cluster}
                  theme={theme}
                  meta={meta}
                  qual={qual}
                  commits={syntheticCommits}
                />
              )
            })}
          </div>

          {clusters.length > 3 && (
            <p className="text-xs text-gray-400 text-center mt-3">
              + {clusters.length - 3} more qualifying cluster{clusters.length - 3 !== 1 ? 's' : ''} in your full report
            </p>
          )}
        </div>

        {/* ── Blurred section: locked content ──────────────────────────────── */}
        <div className="relative rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
          {/* Blurred content behind the lock */}
          <div className="blur-sm pointer-events-none select-none bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <BarChart3 size={15} className="text-indigo-600" /> T661 Narrative Draft — {topCluster?._theme ?? topCluster?.theme ?? 'ML / AI Development'}
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">{buildNarrativePreview(topCluster)}</p>

            <div className="mt-5 pt-4 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">CPA Handoff Package</h3>
              <div className="grid grid-cols-3 gap-3">
                {['T661 Form Draft', 'Evidence Chain', 'Audit Readiness Score', 'Grants Module', 'Prior Years Analysis', 'CPA Portal Access'].map(item => (
                  <div key={item} className="bg-gray-50 rounded-lg p-3 text-center">
                    <CheckCircle2 size={14} className="text-emerald-500 mx-auto mb-1" />
                    <p className="text-[10px] text-gray-600 font-medium">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Lock overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/80 to-white flex flex-col items-center justify-center p-8">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-7 max-w-sm w-full text-center">
              <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Lock size={20} className="text-indigo-600" />
              </div>

              {/* Urgency banner */}
              <div className="flex items-center justify-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mb-4">
                <Clock size={11} className="text-amber-500 flex-shrink-0" />
                <p className="text-[11px] font-semibold text-amber-700">
                  Your estimate is saved for 24 hours — create a free account to keep it
                </p>
              </div>

              <h3 className="text-base font-bold text-gray-900 mb-1">Your complete package is ready</h3>
              <p className="text-xs text-gray-500 leading-relaxed mb-4">
                Free account unlocks the full T661 narrative, evidence chain, CPA handoff,
                and matched grant programs.
              </p>
              <div className="space-y-1.5 mb-5 text-left">
                {[
                  'Full T661 narrative for every cluster',
                  'Evidence chain of custody for CRA',
                  'CPA-ready handoff package',
                  'Audit readiness score',
                  '7 matched grant programs',
                  'Prior years catch-up analysis',
                ].map(f => (
                  <div key={f} className="flex items-center gap-2 text-xs text-gray-700">
                    <Check size={11} className="text-emerald-500 flex-shrink-0" />{f}
                  </div>
                ))}
              </div>
              <button
                onClick={() => navigate(`/signup?from=scan&scan_id=${results?.scanId ?? ''}&credit=${credit}`)}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm py-3 rounded-xl transition-colors shadow-lg shadow-indigo-900/20 mb-2"
              >
                Create free account — save & unlock <ArrowRight size={14} />
              </button>
              <button
                onClick={() => window.open('https://calendly.com/taxlift/free-review', '_blank')}
                className="w-full text-xs text-gray-500 hover:text-gray-700 py-1.5 transition-colors flex items-center justify-center gap-1"
              >
                <ExternalLink size={11} /> Talk to a specialist first
              </button>
            </div>
          </div>
        </div>

        {/* ── Email capture ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-1">
            <Mail size={14} className="text-indigo-600" /> Email me my full report
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            We'll send a PDF summary of your qualifying clusters, credit estimate, and next steps.
          </p>
          {emailSent ? (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
              <p className="text-sm font-medium text-emerald-800">
                Sent! Check your inbox for your SR&ED summary report.
              </p>
            </div>
          ) : (
            <form onSubmit={handleEmailReport} className="flex gap-2">
              <input
                id="results-email-report"
                name="email"
                type="email" required
                placeholder="your@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="flex-1 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <button
                type="submit"
                disabled={emailBusy}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap"
              >
                {emailBusy ? 'Sending…' : <><Mail size={13} /> Send report</>}
              </button>
            </form>
          )}
        </div>

        {/* ── Activity Log nudge + upload ───────────────────────────────────── */}
        <div className="rounded-2xl border border-violet-200 overflow-hidden">
          {/* Nudge header */}
          <div className="bg-violet-50 px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <FileSpreadsheet size={17} className="text-violet-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">
                This estimate only covers your GitHub commits
              </p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                SR&amp;ED also covers R&amp;D spikes, failed experiments, architecture research, and
                security work — none of which appear in commit history. Log those hours and upload
                below for a complete estimate. Most teams see{' '}
                <strong className="text-violet-700">2–4× higher credits</strong> after adding manual hours.
              </p>
            </div>
            <a
              href="/templates/SRED_Activity_Log_Template.xlsx"
              download="SRED_Activity_Log_Template.xlsx"
              className="flex items-center gap-1.5 flex-shrink-0 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap shadow-sm"
            >
              <Download size={13} /> Download template
            </a>
          </div>

          {/* Upload widget — no top border radius so it merges with the header */}
          <div className="border-t border-violet-100">
            <ActivityLogUpload
              className="!rounded-none !border-0"
              subtitle="Drop your filled-in template here to get a complete SR&amp;ED estimate"
              onEstimate={est => {
                console.log('activity log estimate', est)
              }}
            />
          </div>
        </div>

        {/* ── What you get — tier explainer ────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">What's included in a free account</p>
            <p className="text-xs text-gray-400 mt-0.5">No credit card required · Takes 2 minutes</p>
          </div>
          <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
            {/* Free column */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Free</span>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5 font-medium">You are here</span>
              </div>
              <ul className="space-y-2">
                {[
                  'GitHub commit scan & cluster analysis',
                  'SR&ED credit range estimate',
                  'CCPC / province rate adjustment',
                  'Activity Log upload & credit top-up',
                  'Download full audit PDF package',
                  'Pre-written CPA email draft',
                ].map(item => (
                  <li key={item} className="flex items-start gap-2 text-xs text-gray-600">
                    <Check size={12} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            {/* Starter column */}
            <div className="px-5 py-4 bg-indigo-50/40">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">Starter</span>
                <span className="text-[10px] bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-full px-2 py-0.5 font-medium">$299 / filing year</span>
              </div>
              <ul className="space-y-2">
                {[
                  ['Save & sync your estimate year-over-year',  false],
                  ['Jira sprint + story point SR&ED mapping',   false],
                  ['Full T661 narrative drafts per project',    false],
                  ['CPA review portal — share with your firm',  false],
                  ['Edit & approve technical uncertainty text', false],
                  ['18-month lookback & multi-year claims',     false],
                ].map(([item]) => (
                  <li key={item} className="flex items-start gap-2 text-xs text-gray-500">
                    <ChevronRight size={12} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => navigate(`/signup?from=scan&plan=starter&credit=${credit}`)}
                className="mt-4 w-full flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2 rounded-lg transition-colors"
              >
                Start free account <ArrowRight size={11} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Bottom CTA band ───────────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-2xl p-6 text-white">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="font-bold text-base">
                Claim your {fmtK(creditHigh)} — free account, 2 minutes
              </p>
              <p className="text-slate-400 text-xs mt-1 max-w-xs leading-relaxed">
                Save your estimate, get the full T661 package, and see matched grant programs.
                No credit card required to start.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  `${fmtK(creditLow)}–${fmtK(creditHigh)} estimated refundable`,
                  `${clusters.length} qualifying cluster${clusters.length !== 1 ? 's' : ''} found`,
                  'Free to start — no credit card',
                ].map(t => (
                  <span key={t} className="flex items-center gap-1 text-[10px] text-emerald-300 bg-emerald-900/40 border border-emerald-700/40 px-2.5 py-1 rounded-full">
                    <Check size={10} /> {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0">
              <button
                onClick={() => navigate(`/signup?from=scan&scan_id=${results?.scanId ?? ''}&credit=${credit}`)}
                className="flex items-center gap-1.5 bg-white hover:bg-indigo-50 text-indigo-700 text-sm font-bold px-5 py-2.5 rounded-xl whitespace-nowrap transition-colors shadow-lg"
              >
                Create free account <ArrowRight size={14} />
              </button>
              <button
                onClick={() => window.open('https://calendly.com/taxlift/free-review', '_blank')}
                className="text-xs text-slate-400 hover:text-slate-200 text-center transition-colors flex items-center justify-center gap-1"
              >
                <ExternalLink size={11} /> Talk to a specialist first
              </button>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-gray-400 text-center pb-4">
          Not tax or legal advice. Credit estimates use CRA SR&ED ITC proxy method at simplified rates.
          Actual claims require CPA review and T661 filing. Estimates may vary significantly based on
          eligible salary rates and CRA eligibility review.
        </p>
      </div>

      {/* ── Demo mode modal ──────────────────────────────────────────────────── */}
      {showDemoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-8 max-w-sm w-full relative">
            <button
              onClick={() => setShowDemoModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={18} />
            </button>
            <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center mb-4">
              <Download size={20} className="text-indigo-600" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">
              Connect GitHub to get your personalized proposal
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed mb-5">
              The proposal PDF is generated from your actual commit history. Connect GitHub to scan
              your real repos and download a personalized 2-page PDF you can share with your CFO or board.
            </p>
            <div className="space-y-1.5 mb-5 text-left">
              {[
                'Your company name & repos on the cover',
                'Actual credit estimate from your commits',
                'Real qualifying activity themes',
                'Ready to share in 2 minutes',
              ].map(f => (
                <div key={f} className="flex items-center gap-2 text-xs text-gray-700">
                  <Check size={11} className="text-emerald-500 flex-shrink-0" />{f}
                </div>
              ))}
            </div>
            <button
              onClick={() => { setShowDemoModal(false); navigate('/scan') }}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm py-3 rounded-xl transition-colors"
            >
              <Github size={15} /> Connect GitHub & scan your repos
            </button>
            <button
              onClick={() => setShowDemoModal(false)}
              className="w-full text-xs text-gray-400 hover:text-gray-600 mt-2 py-1.5 transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

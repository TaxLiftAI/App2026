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
} from 'lucide-react'

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

  // Read scan results from sessionStorage
  const [results] = useState(() => {
    try {
      const raw = sessionStorage.getItem('taxlift_scan_results')
      if (!raw) return null
      return JSON.parse(raw)
    } catch { return null }
  })

  const [email,     setEmail]     = useState(() => localStorage.getItem('taxlift_scan_email') ?? '')
  const [emailSent, setEmailSent] = useState(false)
  const [emailBusy, setEmailBusy] = useState(false)
  const [pdfBusy,   setPdfBusy]   = useState(false)
  const [showDemoModal,  setShowDemoModal]  = useState(false)
  const [showCpaPanel,   setShowCpaPanel]   = useState(false)
  const [cpaDraftCopied, setCpaDraftCopied] = useState(false)

  // Redirect to landing if no results (e.g. direct URL visit)
  useEffect(() => {
    if (!results) navigate('/scan', { replace: true })
  }, [results, navigate])

  const credit    = results?.estimated_credit ?? 0
  const creditLow = Math.round(credit * 0.65)
  const creditHigh= Math.round(credit * 1.35)

  const animLow  = useAnimatedNumber(creditLow,  900)
  const animHigh = useAnimatedNumber(creditHigh, 1100)

  const clusters     = results?.clusters ?? []
  const topClusters  = [...clusters].sort((a, b) => b.estimated_credit_cad - a.estimated_credit_cad).slice(0, 3)
  const topCluster   = topClusters[0]
  const commitCount  = results?.commit_count  ?? clusters.reduce((s, c) => s + (c._commitCount ?? c.commit_count ?? 0), 0)
  const hoursTotal   = results?.hours_total   ?? clusters.reduce((s, c) => s + (c.aggregate_time_hours ?? 0), 0)
  const isDemoMode   = results?.is_demo

  async function handleEmailReport(e) {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return
    setEmailBusy(true)
    localStorage.setItem('taxlift_scan_email', email)
    try {
      await fetch('/api/leads', {
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
    const scanId = results?.scanId
    if (scanId) {
      window.open(`/api/proposals/pdf/${scanId}`, '_blank')
      return
    }
    // Fallback: POST scan data directly (backend was unreachable during scan)
    setPdfBusy(true)
    try {
      const res = await fetch('/api/proposals/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repos:            results?.repos            ?? [],
          clusters:         results?.clusters         ?? [],
          estimated_credit: results?.estimated_credit ?? 0,
          commit_count:     results?.commit_count     ?? 0,
          hours_total:      results?.hours_total      ?? 0,
        }),
      })
      if (!res.ok) throw new Error('PDF generation failed')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = 'taxlift-sred-proposal.pdf'
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
            Refundable cash — received even with no tax owing (CCPC rate)
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

        {/* ── Download Proposal PDF ────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 bg-white rounded-2xl shadow-sm border border-indigo-100 px-5 py-3.5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">Share this analysis with your CFO or board</p>
            <p className="text-xs text-gray-400 mt-0.5">2-page executive summary · SR&ED methodology · next steps</p>
          </div>
          <button
            onClick={handleDownloadPDF}
            disabled={pdfBusy}
            className="flex items-center gap-2 border border-indigo-600 text-indigo-600 hover:bg-indigo-50 disabled:opacity-60 font-semibold text-sm px-4 py-2 rounded-xl transition-colors whitespace-nowrap flex-shrink-0"
          >
            {pdfBusy
              ? <><RefreshCw size={14} className="animate-spin" /> Generating…</>
              : <><Download size={14} /> Download Proposal PDF</>
            }
          </button>
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
              const theme = cluster._theme ?? cluster.theme ?? 'General R&D'
              const meta  = THEME_META[theme] ?? { icon: '🔬', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' }
              return (
                <div key={cluster.id ?? i} className={`rounded-xl border p-4 ${meta.color}`}>
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
                  {cluster._signals?.slice(0, 2).map((sig, j) => (
                    <p key={j} className="text-[10px] font-mono opacity-60 mt-1.5 truncate">
                      · {sig}
                    </p>
                  ))}
                </div>
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
              <h3 className="text-base font-bold text-gray-900 mb-1">Your complete package is ready</h3>
              <p className="text-xs text-gray-500 leading-relaxed mb-5">
                Upgrade to unlock the full T661 narrative, evidence chain, CPA handoff package,
                audit readiness score, and grants module.
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
                onClick={() => navigate('/pricing')}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm py-3 rounded-xl transition-colors shadow-lg shadow-indigo-900/20 mb-2"
              >
                Get your complete package → <ChevronRight size={14} />
              </button>
              <button
                onClick={() => window.open('https://calendly.com/taxlift/free-review', '_blank')}
                className="w-full text-xs text-gray-500 hover:text-gray-700 py-1.5 transition-colors flex items-center justify-center gap-1"
              >
                <ExternalLink size={11} /> Talk to a human first
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

        {/* ── Bottom CTA band ───────────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-2xl p-6 text-white">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="font-bold text-base">
                Ready to claim your {fmtK(creditHigh)}?
              </p>
              <p className="text-slate-400 text-xs mt-1 max-w-xs leading-relaxed">
                TaxLift converts your scan into a CPA-ready T661 package, audit evidence, and matched grants — for a flat monthly fee.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  `${fmtK(creditLow)}–${fmtK(creditHigh)} estimated refundable`,
                  `${clusters.length} qualifying cluster${clusters.length !== 1 ? 's' : ''} found`,
                  'Flat fee — no 20% contingency',
                ].map(t => (
                  <span key={t} className="flex items-center gap-1 text-[10px] text-emerald-300 bg-emerald-900/40 border border-emerald-700/40 px-2.5 py-1 rounded-full">
                    <Check size={10} /> {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0">
              <button
                onClick={() => navigate('/pricing')}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl whitespace-nowrap transition-colors"
              >
                Get complete package <ArrowRight size={14} />
              </button>
              <button
                onClick={() => window.open('https://calendly.com/taxlift/free-review', '_blank')}
                className="text-xs text-slate-400 hover:text-slate-200 text-center transition-colors flex items-center justify-center gap-1"
              >
                <ExternalLink size={11} /> Talk to a specialist
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

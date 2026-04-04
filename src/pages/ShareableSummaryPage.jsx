/**
 * ShareableSummaryPage — /share/:token
 *
 * Founder / CFO-facing executive summary. Public, no login required.
 * Designed to be shared with boards, investors, and acquirers.
 * Also exports <ShareButton> used in DashboardPage.
 *
 * Token payload (backward-compatible — new fields added gracefully):
 * {
 *   companyName, industry?, fiscalYear?,
 *   totalCredit, totalCreditUSD?, totalHours, totalClusters,
 *   approved, pending, auditScore,
 *   topActivities?: [{ name, creditCAD }],
 *   sharedBy?, generatedAt, expiresAt
 * }
 */
import { useState, useMemo, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ShieldCheck, CheckCircle2, Clock, DollarSign, GitMerge,
  Lock, Copy, Check, ExternalLink, AlertTriangle,
  BarChart2, Zap, FileText, Shield, TrendingUp,
  ArrowRight, ChevronDown, X, Calendar, Share2,
} from 'lucide-react'

// ── Token encode / decode ─────────────────────────────────────────────────────
// Kept identical to the original for backward-compat with existing shared links.
export function encodeShareToken(payload) {
  return btoa(JSON.stringify(payload))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeShareToken(token) {
  try {
    const b64 = token.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice((token.length * 3) % 4 ? 0 : 4)
    return JSON.parse(atob(b64))
  } catch {
    return null
  }
}

// ── Formatting helpers ────────────────────────────────────────────────────────
const fmtCAD = (n) =>
  n != null
    ? new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n)
    : '—'
const fmtUSD = (n) =>
  n != null
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
    : null
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'
const fmtHours = (h) =>
  h != null ? `${Math.round(h).toLocaleString()} h` : '—'
function daysLeft(isoDate) {
  return Math.ceil((new Date(isoDate) - Date.now()) / 86_400_000)
}

// ── Animated counter ──────────────────────────────────────────────────────────
function AnimatedNumber({ value, prefix = '', suffix = '', duration = 1400 }) {
  const [display, setDisplay] = useState(0)
  const frame = useRef(null)
  useEffect(() => {
    const start  = Date.now()
    const target = value ?? 0
    function tick() {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(target * eased))
      if (progress < 1) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
  }, [value, duration])

  return (
    <span>
      {prefix}
      {display.toLocaleString('en-CA')}
      {suffix}
    </span>
  )
}

// ── Share button (exported — used in DashboardPage) ───────────────────────────
export function ShareButton({ clusters, companyName = 'Acme Corp', industry = 'Technology' }) {
  const [open,        setOpen]        = useState(false)
  const [copied,      setCopied]      = useState(false)
  const [copiedText,  setCopiedText]  = useState(false)
  const popoverRef                    = useRef(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function buildLink() {
    const approved    = (clusters ?? []).filter(c => c.status === 'Approved')
    const pending     = (clusters ?? []).filter(c => !['Approved','Rejected','Merged'].includes(c.status))
    const totalCredit = approved.reduce((s, c) => s + (c.estimated_credit_cad ?? 0), 0)
    const totalHours  = approved.reduce((s, c) => s + (c.aggregate_time_hours ?? 0), 0)
    const readyClusters = (clusters ?? []).filter(c => ['Approved','Drafted'].includes(c.status))
    const auditScore    = (clusters ?? []).length
      ? Math.round((readyClusters.length / clusters.length) * 100)
      : 0
    const topActivities = approved
      .filter(c => c.business_component)
      .sort((a, b) => (b.estimated_credit_cad ?? 0) - (a.estimated_credit_cad ?? 0))
      .slice(0, 4)
      .map(c => ({ name: c.business_component, creditCAD: c.estimated_credit_cad }))

    const payload = {
      companyName,
      industry,
      fiscalYear:     new Date().getFullYear().toString(),
      totalCredit,
      totalCreditUSD: Math.round(totalCredit * 0.74),
      totalHours,
      totalClusters:  (clusters ?? []).length,
      approved:       approved.length,
      pending:        pending.length,
      auditScore,
      topActivities,
      generatedAt: new Date().toISOString(),
      expiresAt:   new Date(Date.now() + 7 * 86_400_000).toISOString(),
    }
    return `${window.location.origin}/share/${encodeShareToken(payload)}`
  }

  function buildLinkedInPost(link) {
    const approved    = (clusters ?? []).filter(c => c.status === 'Approved')
    const totalCredit = approved.reduce((s, c) => s + (c.estimated_credit_cad ?? 0), 0)
    const fmtCredit   = totalCredit > 0
      ? `$${Math.round(totalCredit).toLocaleString('en-CA')} CAD`
      : 'significant SR&ED tax credits'
    return `We just discovered ${companyName} qualifies for ${fmtCredit} in SR&ED tax credits — automatically surfaced from our engineering activity by TaxLift.\n\nNo timesheets. No consultants. Just connected our GitHub and Jira, and TaxLift did the rest.\n\nIf you're building software in Canada and not claiming SR&ED, you're leaving money on the table.\n\n${link}\n\n#SRED #Startup #CanadaTech #TaxCredit`
  }

  function handleCopy() {
    navigator.clipboard.writeText(buildLink()).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  function handleCopyLinkedInText() {
    const link = buildLink()
    navigator.clipboard.writeText(buildLinkedInPost(link)).then(() => {
      setCopiedText(true)
      setTimeout(() => setCopiedText(false), 2500)
    })
  }

  function handleShareLinkedIn() {
    const link = buildLink()
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`,
      '_blank',
      'noopener,noreferrer,width=600,height=600'
    )
  }

  const days = 7

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <ExternalLink size={13} />
        Share summary
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl border border-gray-200 shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 to-indigo-900 px-4 py-3.5 flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-semibold">Share your SR&amp;ED summary</p>
              <p className="text-indigo-200 text-xs mt-0.5">Board-ready · No login needed</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/60 hover:text-white">
              <X size={15} />
            </button>
          </div>

          <div className="p-4 space-y-3">
            {/* Expiry */}
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <Clock size={12} className="flex-shrink-0" />
              <span>Link expires in <strong>{days} days</strong> · read-only, no login required</span>
            </div>

            {/* What they'll see */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Recipient sees</p>
              {[
                'Estimated SR&ED credit (big hero number)',
                'Your top qualifying R&D activities by name',
                'Audit readiness score & evidence checklist',
                'How TaxLift calculated the claim',
              ].map(item => (
                <div key={item} className="flex items-center gap-2 text-xs text-gray-600">
                  <CheckCircle2 size={11} className="text-green-500 flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>

            {/* Copy link button */}
            <button
              onClick={handleCopy}
              className={`w-full flex items-center justify-center gap-2 text-xs font-bold py-2.5 rounded-xl transition-colors ${
                copied ? 'bg-green-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Link copied!' : 'Copy shareable link'}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-[10px] text-gray-400 font-medium">or share on</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            {/* LinkedIn share */}
            <div className="space-y-2">
              <button
                onClick={handleShareLinkedIn}
                className="w-full flex items-center justify-center gap-2 text-xs font-bold py-2.5 rounded-xl border-2 border-[#0A66C2] text-[#0A66C2] hover:bg-[#0A66C2] hover:text-white transition-colors"
              >
                {/* LinkedIn icon */}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                Share on LinkedIn
              </button>

              {/* Copy LinkedIn post text */}
              <button
                onClick={handleCopyLinkedInText}
                className={`w-full flex items-center justify-center gap-2 text-xs py-2 rounded-xl border transition-colors ${
                  copiedText
                    ? 'border-green-300 bg-green-50 text-green-700'
                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {copiedText ? <Check size={12} /> : <Copy size={12} />}
                {copiedText ? 'Post text copied!' : 'Copy suggested LinkedIn post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Audit readiness ring ──────────────────────────────────────────────────────
function AuditScoreRing({ score, size = 112 }) {
  const r    = size * 0.38
  const circ = 2 * Math.PI * r
  const fill = Math.min(1, (score ?? 0) / 100) * circ
  const color = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#f87171'
  const label = score >= 75 ? 'Audit Ready' : score >= 50 ? 'In Progress' : 'Needs Work'
  const cx = size / 2, cy = size / 2
  const sw = size * 0.08

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={sw} />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={color} strokeWidth={sw}
          strokeDasharray={`${fill} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 1.2s ease' }}
        />
        <text x={cx} y={cy + size * 0.07} textAnchor="middle"
          fontSize={size * 0.16} fontWeight={800} fill={color}>{score}</text>
        <text x={cx} y={cy + size * 0.22} textAnchor="middle"
          fontSize={size * 0.09} fill="#94a3b8">/ 100</text>
      </svg>
      <span className="text-xs font-bold" style={{ color }}>{label}</span>
    </div>
  )
}

// ── Activity chip ─────────────────────────────────────────────────────────────
function ActivityChip({ name, creditCAD, index }) {
  // Extract the main label (before the em dash) and subtitle
  const parts   = (name ?? '').split(/\s*[—–-]\s*/)
  const primary = parts[0]?.trim() ?? name
  const detail  = parts.slice(1).join(' — ').trim() || null

  const hues = [
    'bg-indigo-50 border-indigo-100 text-indigo-800',
    'bg-violet-50 border-violet-100 text-violet-800',
    'bg-blue-50  border-blue-100  text-blue-800',
    'bg-teal-50  border-teal-100  text-teal-800',
  ]
  const hue = hues[index % hues.length]

  return (
    <div className={`flex items-start justify-between gap-3 px-4 py-3 border rounded-xl ${hue}`}>
      <div className="flex items-start gap-2.5 min-w-0">
        <div className="w-5 h-5 rounded-full bg-white/70 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold">
          {index + 1}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-snug truncate">{primary}</p>
          {detail && <p className="text-xs opacity-70 mt-0.5 truncate">{detail}</p>}
        </div>
      </div>
      {creditCAD != null && (
        <span className="flex-shrink-0 text-xs font-bold tabular-nums opacity-80">{fmtCAD(creditCAD)}</span>
      )}
    </div>
  )
}

// ── Trust signal grid ─────────────────────────────────────────────────────────
const TRUST_SIGNALS = [
  {
    icon: Shield,
    title: 'Tamper-evident evidence',
    body: 'Every Git commit, Jira ticket, and CI/CD build log is captured and hashed with SHA-256. The audit trail is immutable.',
  },
  {
    icon: FileText,
    title: 'CRA-ready T661 narratives',
    body: 'AI-generated technical narratives map each R&D cluster to CRA\'s eligibility criteria — systematic investigation, technological uncertainty, and qualified work.',
  },
  {
    icon: Zap,
    title: 'Automated from your stack',
    body: 'TaxLift connects to GitHub, Jira, and CI/CD pipelines. R&D activity is detected automatically — no timesheets or manual entry.',
  },
  {
    icon: CheckCircle2,
    title: 'CPA-reviewed & packaged',
    body: 'Once prepared in TaxLift, the full claim package — financials, narratives, and evidence — is shared directly with your SR&ED tax specialist for final review and filing.',
  },
]

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ShareableSummaryPage() {
  const { token } = useParams()
  const navigate  = useNavigate()

  const payload = useMemo(() => decodeShareToken(token ?? ''), [token])
  const expired = payload?.expiresAt ? new Date(payload.expiresAt) < new Date() : false
  const days    = payload?.expiresAt ? daysLeft(payload.expiresAt) : null

  // ── Invalid token ──────────────────────────────────────────────────────────
  if (!payload) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Lock size={28} className="text-gray-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid summary link</h1>
          <p className="text-sm text-gray-500 mb-6">This link is malformed or has been corrupted. Ask the sender to generate a new one.</p>
          <button
            onClick={() => navigate('/estimate')}
            className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Try our SR&ED estimator →
          </button>
        </div>
      </div>
    )
  }

  // ── Expired token ──────────────────────────────────────────────────────────
  if (expired) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <Clock size={28} className="text-amber-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">This summary has expired</h1>
          <p className="text-sm text-gray-500 mb-2">
            Summary links are valid for 7 days. This one expired on {fmtDate(payload.expiresAt)}.
          </p>
          <p className="text-sm text-gray-500 mb-6">Ask {payload.companyName ?? 'the sender'} to generate a new link from TaxLift.</p>
          <button
            onClick={() => navigate('/estimate')}
            className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Get your own SR&ED estimate →
          </button>
        </div>
      </div>
    )
  }

  const {
    companyName, industry, fiscalYear,
    totalCredit, totalCreditUSD, totalHours,
    totalClusters, approved, pending, auditScore,
    topActivities = [],
    sharedBy, generatedAt, expiresAt,
  } = payload

  const usdLine = totalCreditUSD ? `≈ ${fmtUSD(totalCreditUSD)} USD` : null

  const auditChecklist = [
    { label: 'Evidence captured & cryptographically hashed',  done: (auditScore ?? 0) >= 40 },
    { label: 'T661 technical narratives drafted',              done: (auditScore ?? 0) >= 60 },
    { label: 'Developer interviews & time attribution complete', done: (auditScore ?? 0) >= 75 },
    { label: 'CPA review package ready to send',              done: (auditScore ?? 0) >= 90 },
  ]

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900">

      {/* ── Sticky top bar ── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <ShieldCheck size={14} className="text-white" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-gray-900">TaxLift</span>
              <span className="hidden sm:block text-gray-300 text-xs">·</span>
              <span className="hidden sm:block text-gray-500 text-xs">SR&ED Executive Summary</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <Lock size={10} />
              <span className="hidden sm:block">Read-only</span>
            </div>
            {expiresAt && days != null && days > 0 && days <= 3 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 rounded-full text-[10px] font-semibold text-amber-700">
                <Clock size={9} /> expires in {days}d
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-10 pb-12">

          {/* Company identity */}
          <div className="flex items-center gap-2 mb-6">
            {fiscalYear && (
              <span className="px-2.5 py-1 bg-white/10 rounded-full text-xs font-semibold text-indigo-200">
                FY{fiscalYear}
              </span>
            )}
            {industry && (
              <span className="px-2.5 py-1 bg-white/10 rounded-full text-xs font-medium text-slate-300">
                {industry}
              </span>
            )}
          </div>

          <p className="text-slate-400 text-sm mb-1 font-medium">SR&ED Tax Credit Claim</p>
          <h1 className="text-2xl sm:text-3xl font-bold mb-6 leading-tight">{companyName}</h1>

          {/* Big credit number */}
          <div className="mb-2">
            <p className="text-indigo-300 text-xs font-semibold uppercase tracking-widest mb-2">
              Estimated Annual SR&ED Credit
            </p>
            <div className="text-5xl sm:text-6xl font-black tracking-tight tabular-nums text-white leading-none">
              <AnimatedNumber value={totalCredit} prefix="$" />
              <span className="text-3xl sm:text-4xl ml-1 text-indigo-300">CAD</span>
            </div>
            {usdLine && (
              <p className="text-indigo-300 text-sm mt-2 font-medium">{usdLine}</p>
            )}
          </div>

          <p className="text-slate-400 text-sm mt-4 leading-relaxed max-w-lg">
            Based on{' '}
            <span className="text-white font-semibold">{totalClusters} R&D activity cluster{totalClusters !== 1 ? 's' : ''}</span>
            {' '}detected from engineering data —{' '}
            <span className="text-white font-semibold">{fmtHours(totalHours)} eligible</span>{' '}
            of qualified SR&ED work.
          </p>

          {/* Quick stats row */}
          <div className="grid grid-cols-3 gap-3 mt-8">
            {[
              { label: 'Clusters approved', value: approved ?? 0,  icon: CheckCircle2, highlight: true  },
              { label: 'In review',         value: pending ?? 0,   icon: Clock,        highlight: false },
              { label: 'Eligible hours',    value: `${Math.round(totalHours ?? 0).toLocaleString()}h`, icon: BarChart2, highlight: false },
            ].map((item, i) => (
              <div key={i} className="bg-white/10 rounded-2xl p-3 sm:p-4 text-center">
                <item.icon size={15} className={`mx-auto mb-1.5 ${item.highlight ? 'text-green-400' : 'text-indigo-300'}`} />
                <p className={`text-xl sm:text-2xl font-bold tabular-nums ${item.highlight ? 'text-green-400' : 'text-white'}`}>
                  {item.value}
                </p>
                <p className="text-indigo-300 text-[10px] mt-0.5 leading-snug">{item.label}</p>
              </div>
            ))}
          </div>

          {/* Generated by / expiry */}
          <div className="flex items-center gap-4 mt-8 pt-6 border-t border-white/10 flex-wrap">
            {sharedBy && (
              <p className="text-slate-400 text-xs">
                Prepared by <span className="text-white font-medium">{sharedBy}</span>
              </p>
            )}
            <p className="text-slate-500 text-xs">{fmtDate(generatedAt)}</p>
            {expiresAt && (
              <div className="flex items-center gap-1 text-slate-500 text-xs ml-auto">
                <Calendar size={10} />
                <span>Expires {fmtDate(expiresAt)}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ── What R&D qualifies ── */}
        {topActivities.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <GitMerge size={15} className="text-indigo-600" />
                <h2 className="text-sm font-bold text-gray-900">What R&D qualifies</h2>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                These engineering activities meet CRA's SR&ED criteria — systematic investigation under technological uncertainty.
              </p>
            </div>
            <div className="p-4 space-y-2">
              {topActivities.map((activity, i) => (
                <ActivityChip key={i} index={i} name={activity.name} creditCAD={activity.creditCAD} />
              ))}
            </div>
            {approved > topActivities.length && (
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                  <ChevronDown size={12} />
                  {approved - topActivities.length} more approved cluster{approved - topActivities.length !== 1 ? 's' : ''} not shown
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Audit readiness ── */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Shield size={15} className="text-indigo-600" />
              <h2 className="text-sm font-bold text-gray-900">Audit Readiness</h2>
              <span className={`ml-auto text-sm font-bold tabular-nums ${
                (auditScore ?? 0) >= 75 ? 'text-green-600' :
                (auditScore ?? 0) >= 50 ? 'text-amber-600' : 'text-red-500'
              }`}>{auditScore ?? 0}/100</span>
            </div>
          </div>
          <div className="p-5">
            <div className="flex items-start gap-6 sm:gap-8 flex-wrap sm:flex-nowrap">
              <div className="flex-shrink-0 mx-auto sm:mx-0">
                <AuditScoreRing score={auditScore ?? 0} size={108} />
              </div>
              <div className="flex-1 min-w-0 space-y-3">
                {auditChecklist.map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      item.done ? 'bg-green-500' : 'bg-gray-200'
                    }`}>
                      {item.done && (
                        <svg width={8} height={8} viewBox="0 0 8 8" fill="none">
                          <path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <span className={`text-sm leading-snug ${item.done ? 'text-gray-800' : 'text-gray-400'}`}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── How this was calculated ── */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <TrendingUp size={15} className="text-indigo-600" />
              <h2 className="text-sm font-bold text-gray-900">How the credit was calculated</h2>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm text-gray-600 leading-relaxed">
              TaxLift connected to{' '}
              <strong className="text-gray-900">{companyName}</strong>'s engineering systems (Git, Jira, CI/CD pipelines)
              and automatically detected R&D activity clusters using proprietary heuristics —
              high code churn, experimental branches, build failures, blocked sprints, and cross-team dependencies.
            </p>
            <p className="text-sm text-gray-600 leading-relaxed">
              Each qualifying cluster was mapped against CRA's SR&ED eligibility framework:
              technological uncertainty, systematic investigation, and qualified personnel.
              The estimated credit uses the{' '}
              <strong className="text-gray-900">Prescribed Proxy Amount (PPA) method</strong>{' '}
              — 35% refundable ITC for CCPCs on the first $3M of qualifying expenditures.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              {[
                { label: 'Total clusters detected', value: totalClusters },
                { label: 'Clusters approved',        value: approved      },
                { label: 'Eligible hours',           value: fmtHours(totalHours) },
              ].map(item => (
                <div key={item.label} className="bg-gray-50 rounded-xl px-3 py-2.5 text-center">
                  <p className="text-lg font-bold text-indigo-700 tabular-nums">{item.value}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Trust signals ── */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1">
            Built for CRA audit confidence
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TRUST_SIGNALS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-white border border-gray-200 rounded-2xl p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <Icon size={15} className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 leading-snug mb-1">{title}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── CTA ── */}
        <div className="bg-gradient-to-br from-slate-900 to-indigo-900 rounded-2xl overflow-hidden">
          <div className="px-6 py-8">
            <p className="text-indigo-300 text-xs font-semibold uppercase tracking-widest mb-2">
              Don't leave your SR&ED credit unclaimed
            </p>
            <h2 className="text-white text-xl font-bold mb-2 leading-snug">
              Find out how much your company qualifies for
            </h2>
            <p className="text-slate-400 text-sm mb-6 max-w-md leading-relaxed">
              TaxLift connects to your existing engineering tools in minutes and surfaces
              every dollar of R&D credit you've already earned — packaged and ready for your CPA.
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <button
                onClick={() => navigate('/estimate')}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors"
              >
                Try the estimator <ArrowRight size={14} />
              </button>
              <button
                onClick={() => navigate('/login')}
                className="flex items-center gap-2 border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white text-sm px-4 py-2.5 rounded-xl transition-colors"
              >
                Sign in to TaxLift
              </button>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-white/10 bg-black/20 flex items-center gap-4 flex-wrap">
            {[
              'No timesheets required',
              'Connects in minutes',
              'CPA-ready output',
              'SHA-256 evidence trail',
            ].map(tag => (
              <div key={tag} className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <CheckCircle2 size={10} className="text-green-500" />
                {tag}
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="text-center pb-4 space-y-3">
          <div className="flex items-center justify-center gap-2">
            <div className="w-6 h-6 bg-indigo-600 rounded-md flex items-center justify-center">
              <ShieldCheck size={13} className="text-white" />
            </div>
            <span className="text-sm font-bold text-gray-700">TaxLift</span>
            <span className="text-gray-300">·</span>
            <span className="text-xs text-gray-500">SR&ED Compliance Platform</span>
          </div>
          <p className="text-[11px] text-gray-400 max-w-lg mx-auto leading-relaxed">
            This summary was generated on {fmtDate(generatedAt)} and is for informational purposes only.
            Credit amounts are preliminary estimates based on automated analysis of engineering data
            and have not been reviewed by the Canada Revenue Agency. All figures must be confirmed
            by a qualified SR&ED tax specialist before filing. TaxLift does not provide tax advice.
          </p>
          {expiresAt && (
            <p className="text-[10px] text-gray-300">Link expires {fmtDate(expiresAt)}</p>
          )}
        </div>
      </div>
    </div>
  )
}

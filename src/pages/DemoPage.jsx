/**
 * DemoPage.jsx — Public interactive demo for TaxLift
 * Route: /demo — no auth required
 *
 * Shows a fully interactive walkthrough of the product using hardcoded
 * Acme Technologies Inc. sample data. No signup or GitHub connection needed.
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Lock, Sparkles, GitBranch, Clock, CheckCircle2,
  AlertTriangle, FileText, BarChart2, Package, TrendingUp, X,
  Zap, Building2,
} from 'lucide-react'
import {
  DEMO_COMPANY, DEMO_SUMMARY, DEMO_CLUSTERS,
  DEMO_NARRATIVE_QUALITY, DEMO_NARRATIVE_CLUSTER1, DEMO_GRANTS,
} from '../lib/demoData'

// ── Animated counter hook ─────────────────────────────────────────────────────
function useCountUp(target, duration = 1600, start = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!start) return
    let startTime = null
    const step = (ts) => {
      if (!startTime) startTime = ts
      const progress = Math.min((ts - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration, start])
  return count
}

// ── Demo banner (sticky, non-dismissable) ─────────────────────────────────────
function DemoBanner() {
  return (
    <div className="sticky top-0 z-50 bg-indigo-600 text-white px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4 shadow-md">
      <div className="flex items-center gap-2 text-sm font-medium min-w-0">
        <span className="text-base flex-shrink-0">🎯</span>
        <span className="truncate">
          <span className="hidden sm:inline">Demo Mode — You're viewing sample data for </span>
          <span className="font-bold">{DEMO_COMPANY.name}</span>
        </span>
      </div>
      <Link
        to="/scan"
        className="flex-shrink-0 flex items-center gap-1.5 bg-white text-indigo-700 font-semibold text-xs px-3.5 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
      >
        Start your real scan
        <ArrowRight size={12} />
      </Link>
    </div>
  )
}

// ── Upgrade modal ─────────────────────────────────────────────────────────────
function UpgradeModal({ onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Start your real scan"
      >
        <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl p-8">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X size={20} />
          </button>

          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-4">
            <Zap size={22} className="text-indigo-600" />
          </div>

          <h2 className="text-xl font-bold text-slate-900 mb-2">
            You're viewing demo data
          </h2>
          <p className="text-slate-600 text-sm leading-relaxed mb-6">
            Connect your GitHub repos to get your real SR&ED analysis. Takes 2 minutes.
            We scan your commit history and surface every dollar of qualifying R&D work.
          </p>

          <div className="space-y-3">
            <Link
              to="/scan"
              className="flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Start my free scan
              <ArrowRight size={15} />
            </Link>
            <a
              href="/#pricing"
              onClick={onClose}
              className="flex items-center justify-center w-full bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium py-3 rounded-xl transition-colors text-sm"
            >
              View pricing
            </a>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Lock overlay ──────────────────────────────────────────────────────────────
function LockOverlay({ onUnlock, label = 'Upgrade to unlock' }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/85 backdrop-blur-[2px] rounded-xl">
      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center mb-3">
        <Lock size={18} className="text-indigo-600" />
      </div>
      <p className="text-sm font-semibold text-slate-700 mb-2">{label}</p>
      <button
        onClick={onUnlock}
        className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1"
      >
        Connect your GitHub
        <ArrowRight size={11} />
      </button>
    </div>
  )
}

// ── Stat tile ─────────────────────────────────────────────────────────────────
function StatTile({ label, value, sub, icon: Icon, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${color}`}>
        <Icon size={17} className="text-white" />
      </div>
      <div className="text-2xl font-extrabold text-slate-900 leading-none mb-1">{value}</div>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  )
}

// ── Cluster card ──────────────────────────────────────────────────────────────
function ClusterCard({ cluster }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-slate-900 text-sm leading-snug mb-1.5">
            {cluster.name}
          </h4>
          <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${cluster.badge_class}`}>
            {cluster.theme}
          </span>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-lg font-extrabold text-slate-900">
            ${(cluster.estimated_credit / 1000).toFixed(0)}K
          </div>
          <div className="text-[10px] text-slate-400">est. credit</div>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
        <span className="flex items-center gap-1">
          <GitBranch size={11} />
          {cluster.qualifying_commits} commits
        </span>
        <span className="flex items-center gap-1">
          <Clock size={11} />
          {cluster.rd_hours}h R&D
        </span>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-slate-400">Evidence coverage</span>
          <span className="text-[10px] font-semibold text-slate-600">{cluster.progress}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${cluster.color_class}`}
            style={{ width: `${cluster.progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// ── Narrative quality score (static, demo-specific) ───────────────────────────
function NarrativeQualitySection({ onUpgrade }) {
  const { score, label, color, dimensions } = DEMO_NARRATIVE_QUALITY

  const ringColor   = color === 'amber' ? '#d97706' : color === 'green' ? '#16a34a' : '#dc2626'
  const bgColor     = color === 'amber' ? '#fef3c7' : color === 'green' ? '#dcfce7' : '#fee2e2'
  const labelClass  = color === 'amber' ? 'text-amber-700' : color === 'green' ? 'text-green-700' : 'text-red-600'

  const R = 28
  const C = 2 * Math.PI * R
  const dash = (score / 100) * C

  return (
    <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-bold text-slate-900 mb-0.5">Narrative Quality Score</h3>
        <p className="text-xs text-slate-500">Scored against 5 CRA T661 compliance dimensions</p>
      </div>

      <div className="p-5 flex items-start gap-4">
        {/* Score ring */}
        <div className="relative flex-shrink-0" style={{ width: 72, height: 72 }}>
          <svg width={72} height={72} viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={36} cy={36} r={R} fill="none" stroke="#e5e7eb" strokeWidth={6} />
            <circle
              cx={36} cy={36} r={R}
              fill="none"
              stroke={ringColor}
              strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${C}`}
            />
          </svg>
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-full"
            style={{ background: bgColor + '80' }}
          >
            <span className="text-[15px] font-bold leading-none" style={{ color: ringColor }}>
              {score}
            </span>
            <span className="text-[8px] font-medium text-gray-400 leading-none mt-0.5">/100</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className={`text-sm font-bold mb-3 ${labelClass}`}>{label} — CRA Quality</div>
          <div className="space-y-1.5">
            {dimensions.map(d => (
              <div key={d.code} className="flex items-center gap-2">
                {d.status === 'pass'
                  ? <CheckCircle2 size={12} className="text-green-500 flex-shrink-0" />
                  : <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />
                }
                <span className="text-[11px] text-slate-600 flex-1 min-w-0 truncate">{d.name}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                  d.status === 'pass' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {d.score}/20
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={onUpgrade}
            className="mt-3 text-[11px] text-indigo-600 font-semibold hover:underline flex items-center gap-1"
          >
            <Sparkles size={10} />
            Improve with AI suggestions
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1 — SR&ED Overview
// ═══════════════════════════════════════════════════════════════════════════════
function OverviewTab({ onUpgrade }) {
  const [animate, setAnimate] = useState(false)
  const creditLow  = useCountUp(112, 1400, animate)
  const creditHigh = useCountUp(158, 1400, animate)

  useEffect(() => {
    const t = setTimeout(() => setAnimate(true), 120)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="space-y-6">
      {/* Animated credit range hero */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-8 text-white text-center shadow-lg">
        <p className="text-indigo-200 text-sm font-medium mb-2">Estimated SR&ED credit range</p>
        <div className="text-5xl sm:text-6xl font-extrabold tracking-tight mb-2">
          ${creditLow}K – ${creditHigh}K
        </div>
        <p className="text-indigo-200 text-sm">
          Based on {DEMO_SUMMARY.qualifying_commits} qualifying commits across {DEMO_SUMMARY.cluster_count} clusters
        </p>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-4">
        <StatTile
          label="SR&ED Clusters"
          value={DEMO_SUMMARY.cluster_count}
          sub="Across 3 repos"
          icon={Sparkles}
          color="bg-indigo-500"
        />
        <StatTile
          label="Qualifying Commits"
          value={DEMO_SUMMARY.qualifying_commits}
          sub="FY 2025"
          icon={GitBranch}
          color="bg-violet-500"
        />
        <StatTile
          label="R&D Hours"
          value={`~${DEMO_SUMMARY.rd_hours}`}
          sub="Eligible developer time"
          icon={Clock}
          color="bg-blue-500"
        />
      </div>

      {/* Cluster cards */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 mb-3">SR&ED Clusters</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {DEMO_CLUSTERS.map(cluster => (
            <ClusterCard key={cluster.id} cluster={cluster} />
          ))}
        </div>
      </div>

      {/* Quality score + top activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <NarrativeQualitySection onUpgrade={onUpgrade} />

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-indigo-500" />
            <h3 className="text-sm font-bold text-slate-900">Top qualifying activity</h3>
          </div>

          <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 mb-4">
            <div className="text-xs font-semibold text-indigo-600 mb-1">Highest estimated credit</div>
            <h4 className="font-bold text-slate-900 text-sm mb-2">
              {DEMO_CLUSTERS[1].name}
            </h4>
            <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
              <span>{DEMO_CLUSTERS[1].qualifying_commits} qualifying commits</span>
              <span>{DEMO_CLUSTERS[1].rd_hours}h R&D</span>
            </div>
            <div className="text-3xl font-extrabold text-indigo-700">
              ${(DEMO_CLUSTERS[1].estimated_credit / 1000).toFixed(1)}K
            </div>
            <div className="text-xs text-slate-500 mt-0.5">estimated credit</div>
          </div>

          <div className="pt-3 border-t border-gray-100">
            <div className="text-xs text-slate-500 mb-2">Repos analyzed</div>
            <div className="flex flex-wrap gap-2">
              {DEMO_COMPANY.repos.map(repo => (
                <span
                  key={repo}
                  className="text-[11px] font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded-md"
                >
                  {repo}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2 — T661 Narratives
// ═══════════════════════════════════════════════════════════════════════════════
const DIM_LABELS = {
  technological_uncertainty: 'Technological Uncertainty',
  systematic_investigation:  'Systematic Investigation',
  technological_advancement: 'Technological Advancement',
  work_directly_undertaken:  'Work Directly Undertaken',
  qualified_expenditures:    'Qualified Expenditures',
}

function NarrativesTab({ onUpgrade }) {
  return (
    <div className="space-y-6">
      {/* Cluster 1 — fully unlocked */}
      <div className="bg-white rounded-xl border border-green-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 bg-green-50 border-b border-green-100 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <CheckCircle2 size={14} className="text-green-600" />
              <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                Unlocked — Full T661 Narrative
              </span>
            </div>
            <h3 className="font-bold text-slate-900 text-base">
              {DEMO_NARRATIVE_CLUSTER1.cluster_name}
            </h3>
          </div>
          <span className="text-xs font-bold text-green-700 bg-green-100 px-3 py-1 rounded-full flex-shrink-0">
            Sample
          </span>
        </div>

        <div className="p-5 space-y-6">
          {Object.entries(DEMO_NARRATIVE_CLUSTER1.dimensions).map(([key, text]) => (
            <div key={key}>
              <h4 className="text-[11px] font-bold text-indigo-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <FileText size={10} />
                {DIM_LABELS[key]}
              </h4>
              <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Clusters 2–4 — blurred + locked */}
      {DEMO_CLUSTERS.slice(1).map(cluster => (
        <div key={cluster.id} className="relative rounded-xl border border-gray-200 overflow-hidden">
          {/* Blurred preview */}
          <div className="blur-sm select-none pointer-events-none p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-base">{cluster.name}</h3>
              <span className="text-sm font-bold text-slate-700">
                ${(cluster.estimated_credit / 1000).toFixed(0)}K
              </span>
            </div>
            <div className="space-y-4">
              {['Technological Uncertainty', 'Systematic Investigation', 'Technological Advancement'].map(dim => (
                <div key={dim}>
                  <div className="text-[11px] font-bold text-indigo-600 uppercase tracking-wide mb-1.5">
                    {dim}
                  </div>
                  <div className="space-y-1">
                    <div className="h-3 bg-gray-200 rounded w-full" />
                    <div className="h-3 bg-gray-200 rounded w-5/6" />
                    <div className="h-3 bg-gray-200 rounded w-4/6" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <LockOverlay onUnlock={onUpgrade} label="Upgrade to unlock narrative" />
        </div>
      ))}

      {/* Bottom CTA */}
      <div className="bg-indigo-50 rounded-xl border border-indigo-100 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="font-bold text-slate-900 text-sm mb-1">Generate all 4 narratives</h4>
          <p className="text-xs text-slate-500">
            Connect your GitHub to get real T661 narratives built from your commit history.
          </p>
        </div>
        <button
          onClick={onUpgrade}
          className="flex-shrink-0 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
        >
          Generate all 4 narratives
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3 — Grants Eligibility
// ═══════════════════════════════════════════════════════════════════════════════
function GrantsTab({ onUpgrade }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-6 text-white">
        <p className="text-violet-200 text-sm mb-1">Non-dilutive grants potential</p>
        <div className="text-4xl font-extrabold mb-2">Up to $340,000</div>
        <p className="text-violet-200 text-sm">
          You may qualify for up to $340,000 in non-dilutive grants based on your SR&ED data.
        </p>
      </div>

      {/* Grant eligibility scores */}
      <div className="space-y-4">
        {DEMO_GRANTS.map(grant => (
          <div key={grant.name} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="font-bold text-slate-900 text-base">{grant.name}</h4>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide bg-slate-100 px-1.5 py-0.5 rounded">
                    {grant.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{grant.full_name}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <div className={`text-2xl font-extrabold ${grant.is_high ? 'text-green-700' : 'text-amber-700'}`}>
                  {grant.score}%
                </div>
                <div className="text-[10px] text-slate-400">eligibility</div>
              </div>
            </div>

            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
              <div
                className={`h-full rounded-full transition-all duration-700 ${grant.is_high ? 'bg-green-500' : 'bg-amber-500'}`}
                style={{ width: `${grant.score}%` }}
              />
            </div>

            <p className="text-xs text-slate-500 mb-2">{grant.description}</p>
            <div className="text-xs text-slate-400">
              Max amount:{' '}
              <span className="font-semibold text-slate-600">
                ${(grant.max_amount / 1000).toFixed(0)}K
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Locked: generate applications */}
      <div className="relative rounded-xl border border-gray-200 overflow-hidden">
        <div className="blur-sm select-none pointer-events-none p-6">
          <h4 className="font-bold text-slate-900 mb-4">Grant Application Drafts</h4>
          {[
            'NRC-IRAP Application — Section A: Company Profile',
            'NRC-IRAP Application — Section B: Project Description',
            'OINTC — Schedule 566 Preparation',
          ].map(item => (
            <div key={item} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 mb-2">
              <div className="w-8 h-8 bg-gray-200 rounded-lg flex-shrink-0" />
              <div className="flex-1">
                <div className="h-3 bg-gray-200 rounded w-3/4 mb-1.5" />
                <div className="h-2 bg-gray-100 rounded w-1/2" />
              </div>
              <div className="h-6 w-16 bg-gray-200 rounded-full" />
            </div>
          ))}
        </div>
        <LockOverlay
          onUnlock={onUpgrade}
          label="Upgrade to Plus to generate grant applications"
        />
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4 — CPA Package
// ═══════════════════════════════════════════════════════════════════════════════
function CpaTab({ onUpgrade }) {
  return (
    <div className="space-y-6">
      {/* Cover page */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-slate-900 p-8 text-white">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-6 h-6 bg-indigo-500 rounded flex items-center justify-center">
              <Zap size={12} className="text-white" />
            </div>
            <span className="font-bold text-sm">TaxLift</span>
            <span className="text-slate-500 text-sm ml-auto">SR&ED Documentation Package</span>
          </div>

          <div className="border-b border-slate-700 pb-6 mb-6">
            <h2 className="text-2xl font-extrabold mb-1">{DEMO_COMPANY.name}</h2>
            <p className="text-slate-400 text-sm">
              {DEMO_COMPANY.location} · {DEMO_COMPANY.industry} · {DEMO_COMPANY.fiscal_year}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-xl sm:text-2xl font-extrabold text-indigo-400">$112K–$158K</div>
              <div className="text-slate-400 text-xs mt-1">Estimated credit</div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-extrabold text-violet-400">4</div>
              <div className="text-slate-400 text-xs mt-1">SR&ED clusters</div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-extrabold text-blue-400">~840h</div>
              <div className="text-slate-400 text-xs mt-1">R&D hours</div>
            </div>
          </div>
        </div>

        <div className="p-6">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Package contents</h3>
          <div className="space-y-2">
            {[
              { icon: FileText,  label: 'T661 Project Information Schedule' },
              { icon: BarChart2, label: 'Developer Hours Breakdown — All Clusters' },
              { icon: Package,   label: 'Evidence Chain of Custody Report' },
              { icon: FileText,  label: 'T661 Narrative — All 4 Clusters' },
            ].map(item => {
              const Icon = item.icon
              return (
                <div key={item.label} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Icon size={14} className="text-indigo-500 flex-shrink-0" />
                  <span className="text-sm text-slate-700 flex-1">{item.label}</span>
                  <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                    Ready
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Blurred T2 financial schedule */}
      <div className="relative rounded-xl border border-gray-200 overflow-hidden">
        <div className="blur-sm select-none pointer-events-none p-6">
          <h4 className="font-bold text-slate-900 mb-4">T2 Financial Schedule Preview</h4>
          {[
            { label: 'Qualified SR&ED Expenditures',       value: '$238,600' },
            { label: 'Basic Investment Tax Credit (35%)',   value: '$83,510'  },
            { label: 'Refundable ITC Amount',               value: '$54,782'  },
            { label: 'SR&ED Pool Deduction',                value: '$154,090' },
          ].map(row => (
            <div
              key={row.label}
              className="flex justify-between py-2.5 border-b border-gray-100 text-sm"
            >
              <span className="text-slate-600">{row.label}</span>
              <span className="font-semibold text-slate-900">{row.value}</span>
            </div>
          ))}
        </div>
        <LockOverlay
          onUnlock={onUpgrade}
          label="Connect GitHub to generate your package"
        />
      </div>

      {/* Share CTA */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 rounded-xl border border-slate-200 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-slate-900 mb-0.5">Ready to share with your CPA?</p>
          <p className="text-xs text-slate-500">
            Connect your real data first to generate an accurate package.
          </p>
        </div>
        <button
          onClick={onUpgrade}
          className="flex-shrink-0 flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm px-4 py-2.5 rounded-xl transition-colors"
        >
          Share with your CPA
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main DemoPage
// ═══════════════════════════════════════════════════════════════════════════════
const TABS = [
  { id: 'overview',   label: 'SR&ED Overview',    icon: BarChart2 },
  { id: 'narratives', label: 'T661 Narratives',    icon: FileText  },
  { id: 'grants',     label: 'Grants Eligibility', icon: Sparkles  },
  { id: 'cpa',        label: 'CPA Package',        icon: Package   },
]

export default function DemoPage() {
  const [activeTab, setActiveTab]   = useState('overview')
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      <DemoBanner />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Building2 size={14} />
            <span>
              {DEMO_COMPANY.name} · {DEMO_COMPANY.location} · {DEMO_COMPANY.employees} employees
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            SR&amp;ED Analysis — {DEMO_COMPANY.fiscal_year}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {DEMO_COMPANY.repos.length} repositories · {DEMO_SUMMARY.cluster_count} qualifying clusters detected
          </p>
        </div>

        {/* Tab nav */}
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-6 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 flex-shrink-0 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-gray-50 hover:text-slate-900'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        {activeTab === 'overview'   && <OverviewTab   onUpgrade={() => setUpgradeOpen(true)} />}
        {activeTab === 'narratives' && <NarrativesTab onUpgrade={() => setUpgradeOpen(true)} />}
        {activeTab === 'grants'     && <GrantsTab     onUpgrade={() => setUpgradeOpen(true)} />}
        {activeTab === 'cpa'        && <CpaTab        onUpgrade={() => setUpgradeOpen(true)} />}
      </div>

      {upgradeOpen && <UpgradeModal onClose={() => setUpgradeOpen(false)} />}
    </div>
  )
}

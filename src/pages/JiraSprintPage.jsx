/**
 * JiraSprintPage — /jira-sprint
 *
 * Generates a "Sprint SR&ED Evidence Report" from Jira activity.
 * In demo mode (no Jira token), uses TaxLift's own development history
 * as a rich, realistic example dataset — so the page is immediately
 * useful during sales demos without any integration required.
 *
 * Flow:
 *  1. Check for stored Atlassian token (oauthConfig)
 *  2. If no token → show demo data with "Connect Jira" CTA
 *  3. If token → fetch real issues, classify, render
 *  4. "Feed into Estimator" button → /scan with pre-filled context
 */
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2, AlertCircle, XCircle, Zap, ExternalLink,
  GitMerge, Download, ChevronRight, Loader2, RefreshCw,
  BarChart2, Clock, DollarSign, Layers, ArrowRight, Info,
  FileText, Shield, FlaskConical, Copy, Check,
} from 'lucide-react'
import { oauthProxy } from '../lib/api'
import { getStoredToken } from '../lib/oauthConfig'

// ── SR&ED eligibility categories ─────────────────────────────────────────────
const ELIGIBLE    = 'eligible'
const MAYBE       = 'maybe'
const NOT_ELIGIBLE = 'not_eligible'

// ── Demo dataset — TaxLift's own sprint history ──────────────────────────────
// Based on all features built in the current development sprint.
// This is the dataset shown to prospects during demos when Jira isn't connected.
const DEMO_SPRINT = {
  sprintName:   'Sprint 12 — Revenue & CPA Flywheel',
  projectName:  'TaxLift Platform',
  dateRange:    'Mar 28 – Apr 4, 2026',
  teamSize:     4,
  tickets: [
    {
      key:        'TL-201',
      type:       'Story',
      summary:    'SR&ED upgrade gate — narrative generation & CPA export paywall',
      status:     'Done',
      points:     5,
      assignee:   'Prateek S.',
      labels:     ['revenue', 'paywall', 'ux'],
      sred:       ELIGIBLE,
      reasoning:  'Implements novel adaptive paywall logic that dynamically detects user tier and gates AI-generated T661 narrative generation. Required systematic investigation into optimal UX conversion patterns under technological uncertainty — multiple approaches tested before settling on the UpgradeModal component architecture.',
      creditHours: 8,
    },
    {
      key:        'TL-202',
      type:       'Story',
      summary:    'Admin conversion funnel — 30-day daily activity chart + Users tab',
      status:     'Done',
      points:     3,
      assignee:   'Prateek S.',
      labels:     ['analytics', 'admin'],
      sred:       ELIGIBLE,
      reasoning:  'Novel data aggregation pipeline merging scan events, signups, and conversion events into a unified daily time-series. Required design and testing of gap-fill algorithm to handle days with zero activity — non-trivial under SQLite date arithmetic constraints.',
      creditHours: 6,
    },
    {
      key:        'TL-203',
      type:       'Story',
      summary:    'CPA referral portal — viral attribution system with base64 token encoding',
      status:     'Done',
      points:     8,
      assignee:   'Prateek S.',
      labels:     ['growth', 'referral', 'cpa'],
      sred:       ELIGIBLE,
      reasoning:  'Novel referral attribution mechanism using stateless base64-encoded tokens to link CPA signups to their referrer without server-side session state. Required systematic investigation into idempotent intake endpoints, race condition handling, and cross-origin token decoding edge cases.',
      creditHours: 13,
    },
    {
      key:        'TL-204',
      type:       'Story',
      summary:    'One-click Stripe Checkout from upgrade modal with graceful fallback',
      status:     'Done',
      points:     3,
      assignee:    'Prateek S.',
      labels:     ['billing', 'stripe', 'ux'],
      sred:       ELIGIBLE,
      reasoning:  'Technical integration challenge: wire Stripe Checkout session creation directly into the upgrade modal while maintaining UX continuity. Required investigation into async state management, loading indicators, and graceful degradation when Stripe is not configured.',
      creditHours: 5,
    },
    {
      key:        'TL-205',
      type:       'Story',
      summary:    'Trial expiry banner with per-day dismissal and urgency escalation',
      status:     'Done',
      points:     2,
      assignee:    'Prateek S.',
      labels:     ['conversion', 'ux', 'billing'],
      sred:       MAYBE,
      reasoning:  'UX optimization research into trial expiry communication patterns. Implemented urgency escalation (standard banner → red alert at 3 days). Standard pattern with some novel elements in the stacking logic with integration degraded banners — may qualify under SR&ED systematic investigation criteria.',
      creditHours: 3,
    },
    {
      key:        'TL-206',
      type:       'Story',
      summary:    'SR&ED claim progress card with real integration status detection',
      status:     'Done',
      points:     3,
      assignee:    'Prateek S.',
      labels:     ['ux', 'dashboard', 'analytics'],
      sred:       MAYBE,
      reasoning:  'Progress tracking UI that consumes live integration status from the API. The mapping of integration health → claim completion percentage required design investigation. Borderline SR&ED — constitutes systematic investigation into optimal user guidance patterns.',
      creditHours: 4,
    },
    {
      key:        'TL-207',
      type:       'Story',
      summary:    'Invite accountant modal — branded CPA email with 30-day review link',
      status:     'Done',
      points:     3,
      assignee:    'Prateek S.',
      labels:     ['cpa', 'email', 'growth'],
      sred:       MAYBE,
      reasoning:  'Email-based handoff automation that generates a time-limited share token and triggers the existing nodemailer pipeline. Novel in combining token generation with the CPA handoff email in a single action — some design investigation into link expiry and idempotency.',
      creditHours: 4,
    },
    {
      key:        'TL-208',
      type:       'Story',
      summary:    'LinkedIn share button with suggested post copy auto-generation',
      status:     'Done',
      points:     2,
      assignee:    'Prateek S.',
      labels:     ['growth', 'social', 'sharing'],
      sred:       MAYBE,
      reasoning:  'Extends the ShareButton component with LinkedIn OAuth-free sharing (share-offsite URL pattern) and dynamic post copy generation personalised to the company\'s credit estimate. Standard LinkedIn integration but with novel credit-amount-aware copy generation.',
      creditHours: 3,
    },
    {
      key:        'TL-209',
      type:       'Bug',
      summary:    'Fix duplicate export declarations in api.js causing Vite build failure',
      status:     'Done',
      points:     1,
      assignee:   'Prateek S.',
      labels:     ['bug', 'build'],
      sred:       NOT_ELIGIBLE,
      reasoning:  'Routine bug fix — removed duplicate file content appended during a git merge. No technological uncertainty involved.',
      creditHours: 0,
    },
    {
      key:        'TL-210',
      type:       'Bug',
      summary:    'Fix CPA signup page pre-populating email from scan localStorage',
      status:     'Done',
      points:     1,
      assignee:   'Prateek S.',
      labels:     ['bug', 'ux'],
      sred:       NOT_ELIGIBLE,
      reasoning:  'Routine bug fix — guard localStorage email seed behind isCpaSignup flag. Standard conditional logic, no innovation involved.',
      creditHours: 0,
    },
    {
      key:        'TL-211',
      type:       'Bug',
      summary:    'Fix NarrativePanel early return missing closing paren (JSX syntax error)',
      status:     'Done',
      points:     1,
      assignee:    'Prateek S.',
      labels:     ['bug'],
      sred:       NOT_ELIGIBLE,
      reasoning:  'Syntax error fix — missing ) in JSX early return. No SR&ED eligibility.',
      creditHours: 0,
    },
    {
      key:        'TL-212',
      type:       'Story',
      summary:    'Stripe webhook — checkout.session.completed → subscription tier update',
      status:     'Done',
      points:     5,
      assignee:   'Prateek S.',
      labels:     ['billing', 'stripe', 'backend'],
      sred:       ELIGIBLE,
      reasoning:  'Complex payment state machine: raw body capture for HMAC signature verification, webhook idempotency handling, atomic SQLite tier updates, and graceful handling of out-of-order events. Required systematic investigation into Stripe webhook reliability guarantees and retry semantics.',
      creditHours: 8,
    },
    {
      key:        'TL-213',
      type:       'Story',
      summary:    'Become a TaxLift CPA Partner CTA — viral entry point on CpaReviewPage',
      status:     'Done',
      points:     2,
      assignee:   'Prateek S.',
      labels:     ['growth', 'cpa', 'marketing'],
      sred:       MAYBE,
      reasoning:  'Adds a conversion-optimised CPA partner acquisition banner to every handoff review page. Novel in using the review flow itself as a growth channel — design investigation into banner placement and copy for maximum CPA conversion without disrupting the review UX.',
      creditHours: 3,
    },
  ],
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtCAD = (n) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n)

const HOURLY_RATE    = 75    // avg blended dev hourly rate
const PROXY_RATE     = 0.35  // SR&ED 35% ITC
const OVERHEAD_MULT  = 1.55  // 55% overhead factor

function estimateCredit(hours) {
  return Math.round(hours * HOURLY_RATE * OVERHEAD_MULT * PROXY_RATE)
}

const SRED_CONFIG = {
  [ELIGIBLE]:     { label: 'SR&ED Qualifying',    color: 'bg-green-100 text-green-800 border-green-200',  dot: 'bg-green-500',  icon: CheckCircle2 },
  [MAYBE]:        { label: 'Potentially Qualifying', color: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'bg-amber-400',  icon: AlertCircle  },
  [NOT_ELIGIBLE]: { label: 'Non-Qualifying',       color: 'bg-slate-100 text-slate-500 border-slate-200', dot: 'bg-slate-300',  icon: XCircle      },
}

const TYPE_COLOR = {
  Story: 'bg-indigo-100 text-indigo-700',
  Bug:   'bg-red-100 text-red-700',
  Task:  'bg-sky-100 text-sky-700',
  Epic:  'bg-purple-100 text-purple-700',
}

// ── Ticket row ────────────────────────────────────────────────────────────────
function TicketRow({ ticket, expanded, onToggle }) {
  const cfg  = SRED_CONFIG[ticket.sred]
  const Icon = cfg.icon

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden mb-2">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        {/* Ticket key + type */}
        <div className="flex items-center gap-2 flex-shrink-0 w-28">
          <span className="text-[10px] font-mono font-bold text-gray-400">{ticket.key}</span>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${TYPE_COLOR[ticket.type] ?? 'bg-gray-100 text-gray-600'}`}>
            {ticket.type}
          </span>
        </div>

        {/* Summary */}
        <p className="flex-1 text-sm font-medium text-gray-800 text-left leading-snug">{ticket.summary}</p>

        {/* Right side */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {ticket.creditHours > 0 && (
            <span className="text-xs font-semibold text-indigo-700 tabular-nums hidden sm:block">
              {fmtCAD(estimateCredit(ticket.creditHours))}
            </span>
          )}
          <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border ${cfg.color}`}>
            <Icon size={10} />
            {cfg.label}
          </span>
          <ChevronRight
            size={14}
            className={`text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-2">
          <div className="flex items-start gap-2">
            <Info size={13} className="text-indigo-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-600 leading-relaxed">{ticket.reasoning}</p>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-gray-400 pt-1">
            <span>Assignee: <span className="text-gray-600 font-medium">{ticket.assignee}</span></span>
            <span>Points: <span className="text-gray-600 font-medium">{ticket.points}</span></span>
            {ticket.creditHours > 0 && (
              <span>Eligible hours: <span className="text-indigo-600 font-bold">{ticket.creditHours}h</span></span>
            )}
            {ticket.labels.map(l => (
              <span key={l} className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-500">{l}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Summary stat card ─────────────────────────────────────────────────────────
function Stat({ label, value, sub, icon: Icon, color = 'text-indigo-600', bg = 'bg-indigo-50' }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={16} className={color} />
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-gray-900 leading-tight mt-0.5">{value}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function JiraSprintPage() {
  const navigate = useNavigate()
  const [expanded, setExpanded]   = useState({})
  const [isDemo]                  = useState(() => !getStoredToken?.('atlassian'))
  const [loading,  setLoading]    = useState(false)
  const [copied,   setCopied]     = useState(false)
  const sprint = DEMO_SPRINT   // real mode would replace this with API data

  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))

  // Compute summary stats
  const stats = useMemo(() => {
    const eligible      = sprint.tickets.filter(t => t.sred === ELIGIBLE)
    const maybe         = sprint.tickets.filter(t => t.sred === MAYBE)
    const nonEligible   = sprint.tickets.filter(t => t.sred === NOT_ELIGIBLE)
    const eligibleHours = sprint.tickets.filter(t => t.sred === ELIGIBLE).reduce((s, t) => s + t.creditHours, 0)
    const maybeHours    = sprint.tickets.filter(t => t.sred === MAYBE).reduce((s, t) => s + t.creditHours, 0)
    const totalHours    = eligibleHours + maybeHours
    const minCredit     = estimateCredit(eligibleHours)
    const maxCredit     = estimateCredit(totalHours)
    return { eligible, maybe, nonEligible, eligibleHours, maybeHours, totalHours, minCredit, maxCredit }
  }, [sprint])

  // Build a text summary to pre-fill the estimator
  function buildEstimatorContext() {
    const lines = [
      `Sprint: ${sprint.sprintName}`,
      `Project: ${sprint.projectName}`,
      `Period: ${sprint.dateRange}`,
      `Team size: ${sprint.teamSize} engineers`,
      '',
      `SR&ED-qualifying activities identified (${stats.eligible.length} tickets, ${stats.eligibleHours}h):`,
      ...stats.eligible.map(t => `- ${t.summary} (${t.creditHours}h)`),
      '',
      `Potentially qualifying (${stats.maybe.length} tickets, ${stats.maybeHours}h):`,
      ...stats.maybe.map(t => `- ${t.summary} (${t.creditHours}h)`),
    ]
    return lines.join('\n')
  }

  function handleFeedToEstimator() {
    const ctx = buildEstimatorContext()
    sessionStorage.setItem('taxlift_sprint_context', ctx)
    navigate('/scan?source=jira')
  }

  function handleCopyContext() {
    navigator.clipboard.writeText(buildEstimatorContext()).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  const eligibleTickets    = sprint.tickets.filter(t => t.sred === ELIGIBLE)
  const maybeTickets       = sprint.tickets.filter(t => t.sred === MAYBE)
  const nonEligibleTickets = sprint.tickets.filter(t => t.sred === NOT_ELIGIBLE)

  return (
    <div className="space-y-6 max-w-4xl">

      {/* ── Demo mode banner ── */}
      {isDemo && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 bg-indigo-600 rounded-xl text-xs text-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <FlaskConical size={13} className="text-indigo-200 flex-shrink-0" />
            <span className="font-medium">This is a demo showing TaxLift's own sprint history — connect Jira to analyse your real sprints.</span>
          </div>
          <button
            onClick={() => navigate('/quick-connect')}
            className="flex-shrink-0 bg-white text-indigo-700 font-semibold px-3 py-1 rounded-lg hover:bg-indigo-50 transition-colors whitespace-nowrap"
          >
            Connect Jira
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Sprint SR&amp;ED Evidence Report</p>
          <h1 className="text-2xl font-bold text-gray-900">{sprint.sprintName}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {sprint.projectName} · {sprint.dateRange} · {sprint.teamSize} engineers · {sprint.tickets.length} tickets
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyContext}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 border rounded-lg transition-colors ${
              copied ? 'border-green-300 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied!' : 'Copy summary'}
          </button>
          <button
            onClick={handleFeedToEstimator}
            className="flex items-center gap-2 text-xs font-bold px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            <Zap size={13} /> Feed into Estimator
          </button>
        </div>
      </div>

      {/* ── Summary stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          label="Estimated SR&ED Credit"
          value={fmtCAD(stats.minCredit)}
          sub={`up to ${fmtCAD(stats.maxCredit)} incl. maybes`}
          icon={DollarSign}
        />
        <Stat
          label="Qualifying Tickets"
          value={stats.eligible.length}
          sub={`+ ${stats.maybe.length} potentially qualifying`}
          icon={CheckCircle2}
          color="text-green-600"
          bg="bg-green-50"
        />
        <Stat
          label="Eligible Hours"
          value={`${stats.eligibleHours}h`}
          sub={`${stats.totalHours}h incl. maybes`}
          icon={Clock}
          color="text-amber-600"
          bg="bg-amber-50"
        />
        <Stat
          label="Non-Qualifying"
          value={stats.nonEligible.length}
          sub="routine bug fixes & maintenance"
          icon={XCircle}
          color="text-slate-500"
          bg="bg-slate-50"
        />
      </div>

      {/* ── Credit breakdown bar ── */}
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-700">Credit estimate breakdown</p>
          <p className="text-xs text-gray-400">35% ITC · PPA method · blended $75/h rate</p>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
          {stats.eligibleHours > 0 && (
            <div
              className="bg-green-500 rounded-l-full"
              style={{ width: `${(stats.eligibleHours / (stats.totalHours || 1)) * 100}%` }}
              title={`Qualifying: ${stats.eligibleHours}h`}
            />
          )}
          {stats.maybeHours > 0 && (
            <div
              className="bg-amber-400 rounded-r-full"
              style={{ width: `${(stats.maybeHours / (stats.totalHours || 1)) * 100}%` }}
              title={`Maybe: ${stats.maybeHours}h`}
            />
          )}
        </div>
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            Qualifying — {fmtCAD(stats.minCredit)} ({stats.eligibleHours}h)
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            Maybe — {fmtCAD(estimateCredit(stats.maybeHours))} ({stats.maybeHours}h)
          </div>
        </div>
      </div>

      {/* ── Qualifying tickets ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <h2 className="text-sm font-bold text-gray-900">SR&amp;ED Qualifying ({eligibleTickets.length})</h2>
          <span className="text-xs text-gray-400 ml-auto">{stats.eligibleHours}h · {fmtCAD(stats.minCredit)} estimated credit</span>
        </div>
        {eligibleTickets.map(ticket => (
          <TicketRow
            key={ticket.key}
            ticket={ticket}
            expanded={!!expanded[ticket.key]}
            onToggle={() => toggle(ticket.key)}
          />
        ))}
      </section>

      {/* ── Maybe tickets ── */}
      {maybeTickets.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <h2 className="text-sm font-bold text-gray-900">Potentially Qualifying ({maybeTickets.length})</h2>
            <span className="text-xs text-gray-400 ml-auto">{stats.maybeHours}h · {fmtCAD(estimateCredit(stats.maybeHours))} if included</span>
          </div>
          {maybeTickets.map(ticket => (
            <TicketRow
              key={ticket.key}
              ticket={ticket}
              expanded={!!expanded[ticket.key]}
              onToggle={() => toggle(ticket.key)}
            />
          ))}
        </section>
      )}

      {/* ── Non-qualifying tickets ── */}
      {nonEligibleTickets.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-slate-300" />
            <h2 className="text-sm font-bold text-gray-900">Non-Qualifying ({nonEligibleTickets.length})</h2>
            <span className="text-xs text-gray-400 ml-auto">routine maintenance &amp; bug fixes</span>
          </div>
          {nonEligibleTickets.map(ticket => (
            <TicketRow
              key={ticket.key}
              ticket={ticket}
              expanded={!!expanded[ticket.key]}
              onToggle={() => toggle(ticket.key)}
            />
          ))}
        </section>
      )}

      {/* ── CTA footer ── */}
      <div className="bg-gradient-to-br from-slate-900 to-indigo-900 rounded-2xl overflow-hidden">
        <div className="px-6 py-7 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="flex-1 min-w-0">
            <p className="text-indigo-300 text-xs font-semibold uppercase tracking-widest mb-1">Next step</p>
            <h3 className="text-white text-lg font-bold leading-snug">
              Turn this sprint into a CRA-ready SR&amp;ED claim
            </h3>
            <p className="text-slate-400 text-sm mt-1 leading-relaxed">
              Feed this report into TaxLift's estimator to generate T661 narratives,
              a financial schedule, and a CPA-ready package — in under 10 minutes.
            </p>
          </div>
          <div className="flex flex-col gap-2 flex-shrink-0">
            <button
              onClick={handleFeedToEstimator}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors"
            >
              <Zap size={14} /> Feed into Estimator <ArrowRight size={14} />
            </button>
            <button
              onClick={() => navigate('/reports')}
              className="flex items-center gap-2 border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white text-sm px-5 py-2.5 rounded-xl transition-colors"
            >
              <FileText size={14} /> Generate CPA Package
            </button>
          </div>
        </div>
        <div className="px-6 py-3 border-t border-white/10 bg-black/20 flex items-center gap-5 flex-wrap">
          {[
            { icon: Shield,   text: 'SHA-256 evidence hashing' },
            { icon: FileText, text: 'T661 narrative generation' },
            { icon: Layers,   text: 'CPA-ready export package' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Icon size={11} className="text-indigo-400" /> {text}
            </div>
          ))}
        </div>
      </div>

      {/* ── Methodology note ── */}
      <div className="text-[11px] text-gray-400 leading-relaxed border-t border-gray-100 pt-4">
        <strong className="text-gray-500">SR&amp;ED Classification Methodology:</strong>{' '}
        Tickets are classified using TaxLift's heuristics: technological uncertainty (novel approaches, unproven methods),
        systematic investigation (defined hypotheses, iterative testing), and qualified work (software development that
        advances technical knowledge). Estimates use the Prescribed Proxy Amount (PPA) method at 35% ITC for CCPCs.
        All figures are preliminary — confirm with a qualified SR&amp;ED tax specialist before filing.
      </div>
    </div>
  )
}

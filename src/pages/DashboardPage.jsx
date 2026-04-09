import { useMemo, useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { GitMerge, Clock, CheckCircle2, DollarSign, AlertTriangle, TrendingUp, FlaskConical, Zap, Mail, X, Send, Loader2 } from 'lucide-react'
import { getCreditTrend } from '../data/mockData'
import { formatCurrency, formatHours, STATUS_COLORS } from '../lib/utils'
import { useClusters, useIntegrations } from '../hooks'
import { useAuth } from '../context/AuthContext'
import { StatusBadge, IntegrationBadge } from '../components/ui/Badge'
import RiskScore from '../components/ui/RiskScore'
import Card, { CardHeader } from '../components/ui/Card'
import GettingStartedCard from '../components/dashboard/GettingStartedCard'
import { ShareButton, encodeShareToken } from './ShareableSummaryPage'
import { cpa as cpaApi } from '../lib/api'

// ── Invite Accountant Modal ───────────────────────────────────────────────────
function InviteAccountantModal({ open, onClose, clusters, currentUser }) {
  const [cpaName,  setCpaName]  = useState('')
  const [cpaEmail, setCpaEmail] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [success,  setSuccess]  = useState(false)
  const [error,    setError]    = useState('')

  function reset() {
    setCpaName(''); setCpaEmail(''); setLoading(false); setSuccess(false); setError('')
  }

  function handleClose() { reset(); onClose() }

  function buildShareLink() {
    const approved    = (clusters ?? []).filter(c => c.status === 'Approved')
    const pending     = (clusters ?? []).filter(c => !['Approved','Rejected','Merged'].includes(c.status))
    const totalCredit = approved.reduce((s, c) => s + (c.estimated_credit_cad ?? 0), 0)
    const totalHours  = approved.reduce((s, c) => s + (c.aggregate_time_hours ?? 0), 0)
    const readyClusters = (clusters ?? []).filter(c => ['Approved','Drafted'].includes(c.status))
    const auditScore  = clusters?.length
      ? Math.round((readyClusters.length / clusters.length) * 100) : 0
    const topActivities = approved
      .filter(c => c.business_component)
      .sort((a, b) => (b.estimated_credit_cad ?? 0) - (a.estimated_credit_cad ?? 0))
      .slice(0, 4)
      .map(c => ({ name: c.business_component, creditCAD: c.estimated_credit_cad }))

    const payload = {
      companyName:    currentUser?.firm_name ?? currentUser?.company_name ?? 'Your Company',
      industry:       'Technology',
      fiscalYear:     new Date().getFullYear().toString(),
      totalCredit,
      totalCreditUSD: Math.round(totalCredit * 0.74),
      totalHours,
      totalClusters:  (clusters ?? []).length,
      approved:       approved.length,
      pending:        pending.length,
      auditScore,
      topActivities,
      sharedBy:       currentUser?.name ?? currentUser?.email,
      generatedAt:    new Date().toISOString(),
      expiresAt:      new Date(Date.now() + 30 * 86_400_000).toISOString(), // 30 days for accountant links
    }
    return `${window.location.origin}/share/${encodeShareToken(payload)}`
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!cpaEmail) return
    setLoading(true); setError('')
    try {
      const reviewLink  = buildShareLink()
      const companyName = currentUser?.firm_name ?? currentUser?.company_name ?? 'Your Company'
      const fiscalYear  = new Date().getFullYear().toString()
      const approved    = (clusters ?? []).filter(c => c.status === 'Approved')
      const totalCredit = approved.reduce((s, c) => s + (c.estimated_credit_cad ?? 0), 0)
      const readyClusters = (clusters ?? []).filter(c => ['Approved','Drafted'].includes(c.status))
      const auditScore  = clusters?.length ? Math.round((readyClusters.length / clusters.length) * 100) : 0

      await cpaApi.sendHandoff({
        cpaEmail,
        cpaName:      cpaName || undefined,
        companyName,
        fiscalYear,
        sharedBy:     currentUser?.name ?? currentUser?.email ?? 'TaxLift user',
        sharedByEmail: currentUser?.email,
        reviewLink,
        expiresAt:    new Date(Date.now() + 30 * 86_400_000).toISOString(),
        totalCredit,
        clusterCount: approved.length,
        auditScore,
      })
      setSuccess(true)
    } catch (err) {
      setError(err?.message ?? 'Failed to send — please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-900 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white text-sm font-semibold">Invite your accountant</p>
            <p className="text-indigo-200 text-xs mt-0.5">Send them a read-only CPA review package</p>
          </div>
          <button onClick={handleClose} className="text-white/60 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {success ? (
          <div className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 size={22} className="text-green-600" />
            </div>
            <p className="text-sm font-semibold text-gray-900 mb-1">Package sent!</p>
            <p className="text-xs text-gray-500 mb-4">
              Your accountant will receive an email with a link to your SR&amp;ED review package. The link is valid for 30 days.
            </p>
            <button
              onClick={handleClose}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* What they'll receive */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 space-y-1.5">
              <p className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider">What your accountant receives</p>
              {[
                'T661 narrative drafts for every R&D cluster',
                'Financial schedule with proxy method estimate',
                'Evidence chain-of-custody (SHA-256 hashed)',
                'Audit readiness checklist',
              ].map(item => (
                <div key={item} className="flex items-center gap-2 text-xs text-indigo-800">
                  <CheckCircle2 size={11} className="text-indigo-500 flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Accountant's name <span className="font-normal text-gray-400">(optional)</span></label>
                <input
                  type="text"
                  value={cpaName}
                  onChange={e => setCpaName(e.target.value)}
                  placeholder="e.g. Jane Smith"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Accountant's work email <span className="text-red-400">*</span></label>
                <input
                  type="email"
                  required
                  value={cpaEmail}
                  onChange={e => setCpaEmail(e.target.value)}
                  placeholder="accountant@firm.com"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertTriangle size={12} className="flex-shrink-0" /> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !cpaEmail}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {loading ? 'Sending…' : 'Send CPA review package'}
            </button>
            <p className="text-[11px] text-gray-400 text-center">No login required for your accountant · Link valid 30 days</p>
          </form>
        )}
      </div>
    </div>
  )
}

const PIE_COLORS = {
  New: '#94a3b8', Interviewed: '#60a5fa', Drafted: '#f59e0b', Approved: '#22c55e', Rejected: '#f87171',
}

// ── Claim Progress Card ───────────────────────────────────────────────────────
function ClaimProgressCard({ clusters, integrations, navigate }) {
  const cl   = clusters     ?? []
  const ints = integrations ?? []

  const hasIntegration = ints.some(i => i.status === 'healthy')
  const hasClusters    = cl.length > 0
  const hasNarrative   = cl.some(c => ['Drafted','Approved'].includes(c.status))
  const hasApproved    = cl.some(c => c.status === 'Approved')

  const steps = [
    {
      label:  'Connect a data source',
      detail: 'Link GitHub, Jira, or CI/CD so TaxLift auto-detects R&D',
      done:   hasIntegration,
      cta:    'Connect',
      to:     '/integrations',
    },
    {
      label:  'R&D clusters detected',
      detail: 'At least one SR&ED activity cluster identified',
      done:   hasClusters,
      cta:    'View clusters',
      to:     '/clusters',
    },
    {
      label:  'Narratives generated',
      detail: 'AI T661 narrative drafted for at least one cluster',
      done:   hasNarrative,
      cta:    'Generate',
      to:     '/clusters',
    },
    {
      label:  'CPA package ready',
      detail: 'At least one cluster approved and ready to share',
      done:   hasApproved,
      cta:    'Review clusters',
      to:     '/clusters?status=Drafted',
    },
  ]

  const completedCount = steps.filter(s => s.done).length
  const pct            = Math.round((completedCount / steps.length) * 100)
  const nextStep       = steps.find(s => !s.done)
  const allDone        = completedCount === steps.length

  const color = allDone ? 'text-green-600' : pct >= 50 ? 'text-indigo-600' : 'text-amber-600'
  const barColor = allDone ? 'bg-green-500' : pct >= 50 ? 'bg-indigo-500' : 'bg-amber-500'

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          {/* Left: text + bar */}
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">SR&amp;ED Claim Progress</p>
            <h3 className="text-lg font-bold text-gray-900 leading-snug">
              Your claim is{' '}
              <span className={color}>{pct}% complete</span>
            </h3>
            {!allDone && nextStep && (
              <p className="text-xs text-gray-500 mt-1">
                Next: <span className="font-medium text-gray-700">{nextStep.label}</span>
              </p>
            )}
            {allDone && (
              <p className="text-xs text-green-600 font-medium mt-1">All steps complete — your CPA package is ready to send.</p>
            )}

            {/* Progress bar */}
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-700 ${barColor}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className={`text-xs font-bold tabular-nums w-10 text-right ${color}`}>{pct}%</span>
            </div>
          </div>

          {/* Right: step dots */}
          <div className="flex gap-2 flex-shrink-0 pt-1">
            {steps.map((s, i) => (
              <div
                key={i}
                title={s.label}
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-colors ${
                  s.done
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'bg-white border-gray-200 text-gray-400'
                }`}
              >
                {s.done ? (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : i + 1}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step list */}
      {!allDone && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {steps.map((step, i) => (
            <div key={i} className={`flex items-center gap-3 px-5 py-2.5 ${step.done ? 'opacity-50' : ''}`}>
              <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${step.done ? 'bg-green-500' : 'bg-gray-100'}`}>
                {step.done ? (
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <span className="text-[9px] font-bold text-gray-400">{i + 1}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold ${step.done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{step.label}</p>
                <p className="text-[11px] text-gray-400 truncate">{step.detail}</p>
              </div>
              {!step.done && (
                <button
                  onClick={() => navigate(step.to)}
                  className="flex-shrink-0 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors whitespace-nowrap"
                >
                  {step.cta} →
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, sub, icon: Icon, iconColor = 'text-indigo-600', iconBg = 'bg-indigo-50' }) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${iconBg}`}>
          <Icon size={18} className={iconColor} />
        </div>
      </div>
    </Card>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const { data: clusters, usingMock } = useClusters()
  const { data: integrations } = useIntegrations()
  const trend = getCreditTrend()
  const [inviteOpen, setInviteOpen] = useState(false)

  // Derive stats from live cluster data
  const stats = useMemo(() => {
    if (!clusters) return { total: 0, approved: 0, pending: 0, totalHours: 0, totalCreditCAD: 0 }
    const approved = clusters.filter(c => c.status === 'Approved')
    const pipeline = clusters.filter(c => !['Rejected', 'Merged'].includes(c.status))
    return {
      total: clusters.length,
      approved: approved.length,
      pending: clusters.filter(c => !['Approved','Rejected','Merged'].includes(c.status)).length,
      totalHours: pipeline.reduce((s, c) => s + (c.aggregate_time_hours ?? 0), 0),
      totalCreditCAD: pipeline.reduce((s, c) => s + (c.estimated_credit_cad ?? 0), 0),
    }
  }, [clusters])

  // Pending free scan — load from sessionStorage, then auto-associate with account
  const [pendingScan, setPendingScan] = useState(null)
  const associatedRef = useRef(false) // prevent double-fire in StrictMode

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('taxlift_scan_results')
      if (!raw) return
      const scan = JSON.parse(raw)
      if (scan?.clusters?.length > 0) setPendingScan(scan)
    } catch { /* ignore */ }
  }, [])

  // When a real (non-demo) user lands on the dashboard with a pending scan,
  // associate the scan with their account so it appears in the admin view.
  useEffect(() => {
    if (!pendingScan?.scanId) return
    if (!currentUser?.id || !currentUser?._fromApi) return // real API user only
    if (associatedRef.current) return
    associatedRef.current = true

    fetch(`/api/scan/free/${pendingScan.scanId}/associate`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: currentUser.id }),
    }).catch(() => { /* fire-and-forget */ })
  }, [pendingScan, currentUser])

  const breakdown = useMemo(() => {
    if (!clusters) return []
    const counts = {}
    clusters.forEach(c => { counts[c.status] = (counts[c.status] ?? 0) + 1 })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [clusters])

  const recentClusters = useMemo(() =>
    [...(clusters ?? [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 6),
    [clusters]
  )
  const stale = useMemo(() =>
    (clusters ?? []).filter(c => c.stale_context && ['New','Interviewed','Drafted'].includes(c.status)),
    [clusters]
  )
  const needsReview = useMemo(() =>
    (clusters ?? []).filter(c => c.status === 'Drafted'),
    [clusters]
  )

  return (
    <div className="space-y-6">
      {/* Demo mode banner */}
      {usingMock && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
          <FlaskConical size={13} />
          <span>Using demo data — backend not connected.</span>
        </div>
      )}

      {/* Pending free scan banner */}
      {pendingScan && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl">
          <div className="flex items-start gap-3 min-w-0">
            <Zap size={15} className="text-indigo-600 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-indigo-900">
                You have a pending scan — {pendingScan.clusters?.length} qualifying cluster{pendingScan.clusters?.length !== 1 ? 's' : ''} found
              </p>
              <p className="text-[11px] text-indigo-600 mt-0.5 truncate">
                Repos: {(pendingScan.repos ?? []).join(', ') || 'demo repos'} · Complete setup to generate your CPA-ready package
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => navigate('/scan/results')}
              className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 transition-colors whitespace-nowrap"
            >
              View results →
            </button>
            <button
              onClick={() => { sessionStorage.removeItem('taxlift_scan_results'); setPendingScan(null) }}
              className="text-xs text-indigo-400 hover:text-indigo-600 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Invite accountant modal */}
      <InviteAccountantModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        clusters={clusters}
        currentUser={currentUser}
      />

      {/* Page header with action buttons */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-xs text-gray-400 mt-0.5">Welcome back, {currentUser?.name?.split(' ')[0] ?? 'there'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/quick-connect')}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            <Zap size={13} /> Quick Connect
          </button>
          <button
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Mail size={13} /> Invite accountant
          </button>
          <ShareButton
            clusters={clusters}
            companyName={currentUser?.firm_name ?? currentUser?.company_name ?? 'Your Company'}
          />
        </div>
      </div>

      {/* Getting Started checklist */}
      <GettingStartedCard
        clusters={clusters}
        integrations={integrations}
        emailVerified={currentUser?.email_verified}
        email={currentUser?.email}
      />

      {/* Alert banner */}
      {(stale.length > 0 || needsReview.length > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            <strong>{needsReview.length} cluster{needsReview.length !== 1 ? 's' : ''}</strong> awaiting narrative review
            {stale.length > 0 && <> · <strong>{stale.length}</strong> with stale context flags</>}
          </p>
          <button onClick={() => navigate('/clusters?status=Drafted')} className="ml-auto text-xs font-medium text-amber-700 hover:text-amber-900 underline whitespace-nowrap">
            Review now →
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Clusters"
          value={stats.total}
          sub={`${stats.pending} pending review`}
          icon={GitMerge}
        />
        <StatCard
          label="Approved Q1 2026"
          value={stats.approved}
          sub="clusters fully processed"
          icon={CheckCircle2}
          iconColor="text-green-600"
          iconBg="bg-green-50"
        />
        <StatCard
          label="Total Eligible Hours"
          value={formatHours(stats.totalHours)}
          sub="across all pipeline clusters"
          icon={Clock}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <StatCard
          label="Estimated Credit (CAD)"
          value={formatCurrency(stats.totalCreditCAD)}
          sub="pipeline estimate"
          icon={DollarSign}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Credit trend */}
        <Card padding={false} className="col-span-2 p-6">
          <CardHeader
            title="Credit Pipeline (CAD)"
            subtitle="Estimated R&D credits by month, Oct 2025 – Mar 2026"
            action={<TrendingUp size={16} className="text-gray-400" />}
          />
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trend} margin={{ top: 0, right: 0, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="creditGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => v > 0 ? `$${(v/1000).toFixed(0)}k` : '$0'} />
              <Tooltip
                formatter={(v) => [formatCurrency(v, 'CAD'), 'Estimated Credit']}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <Area type="monotone" dataKey="credit" stroke="#6366f1" strokeWidth={2} fill="url(#creditGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Status breakdown */}
        <Card padding={false} className="p-6">
          <CardHeader title="Cluster Status" subtitle="All-time distribution" />
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={breakdown} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={65} strokeWidth={2}>
                {breakdown.map(entry => (
                  <Cell key={entry.name} fill={PIE_COLORS[entry.name]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(v) => <span style={{ fontSize: 11, color: '#64748b' }}>{v}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Claim progress */}
      <ClaimProgressCard clusters={clusters} integrations={integrations} navigate={navigate} />

      {/* Recent clusters */}
      <Card padding={false}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Recent Clusters</h3>
            <p className="text-xs text-gray-500 mt-0.5">Latest detected R&D activity clusters</p>
          </div>
          <button onClick={() => navigate('/clusters')} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
            View all →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Business Component', 'Status', 'Risk Score', 'Hours', 'Est. Credit (CAD)', 'Detected'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentClusters.map(cluster => (
                <tr
                  key={cluster.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/clusters/${cluster.id}`)}
                >
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{cluster.business_component ?? '—'}</span>
                      {cluster.stale_context && (
                        <span title="Stale context" className="px-1.5 py-0.5 bg-orange-100 text-orange-600 text-[10px] font-medium rounded">STALE</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3.5"><StatusBadge status={cluster.status} /></td>
                  <td className="px-6 py-3.5"><RiskScore score={cluster.risk_score} /></td>
                  <td className="px-6 py-3.5 text-sm text-gray-600">{formatHours(cluster.aggregate_time_hours)}</td>
                  <td className="px-6 py-3.5 text-sm font-medium text-gray-900">{formatCurrency(cluster.estimated_credit_cad)}</td>
                  <td className="px-6 py-3.5 text-sm text-gray-500">
                    {new Date(cluster.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Integration health — uses live data; falls back to mock for demo */}
      <Card>
        <CardHeader title="Integration Health" subtitle="Live status of connected data sources" />
        {(integrations ?? []).length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400 mb-3">No integrations connected yet.</p>
            <button
              onClick={() => navigate('/integrations')}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 underline"
            >
              Connect GitHub or Jira →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {(integrations ?? []).map(intg => (
              <div key={intg.integration} className="border border-gray-100 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900 capitalize">{intg.integration}</span>
                  <IntegrationBadge status={intg.status} />
                </div>
                {intg.error_detail && (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2 mt-2">{intg.error_detail}</p>
                )}
                {intg.last_sync_at && (
                  <p className="text-xs text-gray-400 mt-2">
                    Last sync: {new Date(intg.last_sync_at).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

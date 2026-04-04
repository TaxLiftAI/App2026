/**
 * ReferralDashboardPage — /cpa-portal/referrals
 *
 * CPA firm's referral hub. Turns the CPA firm from a passive document recipient
 * into an active pipeline source with a financial incentive to refer clients.
 *
 * Commission model:
 *   TaxLift charges 8% of credit recovered.
 *   CPA earns 10% of TaxLift's fee → 0.8% of credit as referral commission.
 *   e.g. client claims $100K → TaxLift earns $8K → CPA gets $800.
 */
import { useState, useEffect, useMemo } from 'react'
import { useNavigate }                  from 'react-router-dom'
import {
  Building2, DollarSign, Users, TrendingUp, CheckCircle2,
  Clock, Banknote, Link2, Copy, Check, ChevronRight,
  ArrowRight, BarChart3, Mail, MapPin, UserPlus, X, Gift,
  Star, Sparkles, Loader2, AlertTriangle,
} from 'lucide-react'
import { useAuth }              from '../context/AuthContext'
import { referrals as referralsApi } from '../lib/api'
import { formatCurrency }       from '../lib/utils'

const REFERRAL_RATE = 0.008   // 0.8% of credit recovered

// ── Token helper (mirrors server decode: Buffer.from(token,'base64').toString()) ──
function buildReferralToken(userId, firmName) {
  return btoa(`${userId}:${encodeURIComponent(firmName ?? '')}`)
}

// ── Shared portal tab nav ─────────────────────────────────────────────────────
export function CpaPortalTabs({ active }) {
  const navigate = useNavigate()
  return (
    <div className="flex items-center gap-1">
      {[
        { id: 'clients',   label: 'Clients',   path: '/cpa-portal' },
        { id: 'referrals', label: 'Referrals', path: '/cpa-portal/referrals', badge: 'Earn commission' },
      ].map(tab => (
        <button
          key={tab.id}
          onClick={() => navigate(tab.path)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            active === tab.id
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          {tab.label}
          {tab.badge && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${
              active === tab.id ? 'bg-indigo-100 text-indigo-600' : 'bg-indigo-500/40 text-indigo-200'
            }`}>
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_META = {
  scanning:      { label: 'Scanning',      bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-400'   },
  in_review:     { label: 'In Review',     bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500'  },
  package_ready: { label: 'Package Ready', bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  filed:         { label: 'Filed',         bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500'  },
}

const COMMISSION_META = {
  pending:   { label: 'Pending',   bg: 'bg-gray-100',  text: 'text-gray-500',  dot: 'bg-gray-400'  },
  confirmed: { label: 'Confirmed', bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  paid:      { label: 'Paid',      bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
}

function StatusPill({ status, meta }) {
  const m = meta[status] ?? meta[Object.keys(meta)[0]]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${m.bg} ${m.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${m.dot}`} />
      {m.label}
    </span>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, iconColor, iconBg, highlight, accent }) {
  return (
    <div className={`bg-white border rounded-xl px-4 py-3.5 flex items-center gap-3 ${
      highlight ? 'border-indigo-200 ring-1 ring-indigo-100' : accent ? 'border-green-200' : 'border-gray-200'
    }`}>
      <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
        <Icon size={18} className={iconColor} />
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className={`text-xl font-bold leading-tight ${highlight ? 'text-indigo-700' : accent ? 'text-green-700' : 'text-gray-900'}`}>{value}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Refer a client modal ──────────────────────────────────────────────────────
function ReferClientModal({ open, onClose, intakeUrl, firmName, partnerName }) {
  const [copied, setCopied] = useState(false)

  function copyLink() {
    navigator.clipboard.writeText(intakeUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <UserPlus size={18} className="text-indigo-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Refer a client</h3>
              <p className="text-xs text-gray-500 mt-0.5">Co-branded intake link for {firmName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5">
            <X size={18} />
          </button>
        </div>

        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-indigo-800 uppercase tracking-wide">What your client sees</p>
          {[
            `Your firm name ("Referred by ${firmName}") prominently displayed`,
            'Plain-English SR&ED explainer and typical credit ranges',
            '"Get your free SR&ED estimate" CTA → TaxLift estimator with ref code attached',
            'Referral tracked to your firm automatically — no manual follow-up needed',
          ].map(t => (
            <div key={t} className="flex items-start gap-2 text-xs text-indigo-700">
              <CheckCircle2 size={12} className="text-indigo-500 mt-0.5 flex-shrink-0" />
              <span>{t}</span>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-2.5 bg-green-50 border border-green-200 rounded-xl px-3.5 py-3">
          <Gift size={14} className="text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-green-800">
            You earn <strong>0.8% of credits recovered</strong> for every client who signs up through this link.
            On a $200K claim, that's <strong>$1,600</strong> for one referral.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-700">Your co-branded referral link</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-xs text-gray-700 font-mono truncate select-all">
              {intakeUrl}
            </div>
            <button
              onClick={copyLink}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all flex-shrink-0 ${
                copied
                  ? 'bg-green-100 text-green-700 border border-green-200'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy</>}
            </button>
          </div>
          <p className="text-[11px] text-gray-400">
            Share via email, newsletter, LinkedIn, or your client advisory portal. The link never expires.
          </p>
        </div>

        <details className="group">
          <summary className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 cursor-pointer font-medium list-none">
            <Mail size={12} />
            Copy email introduction draft
            <ChevronRight size={12} className="group-open:rotate-90 transition-transform ml-auto" />
          </summary>
          <div className="mt-2.5 bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-700 leading-relaxed whitespace-pre-line font-mono">
{`Subject: You may qualify for Canada's SR&ED tax credit

Hi [Client Name],

I wanted to flag something that could recover meaningful cash for your business — Canada's SR&ED (Scientific Research & Experimental Development) tax credit program.

If your team does any R&D, software development, or solves novel technical problems, you may be eligible for a 35% refundable tax credit on qualifying expenditures.

I've partnered with TaxLift, a tool that automates the documentation and claim preparation. Use the link below to get a free estimate in under 5 minutes:

${intakeUrl}

I'll handle the T661 filing once the package is ready. Let me know if you have questions.

Best,
${partnerName}`}
          </div>
        </details>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 font-medium">Close</button>
          <button
            onClick={copyLink}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl"
          >
            <Link2 size={14} /> {copied ? 'Copied!' : 'Copy referral link'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Commission tracker ────────────────────────────────────────────────────────
function CommissionTracker({ referrals, stats }) {
  const stages = [
    {
      id:          'pending',
      label:       'Pending',
      icon:        Clock,
      iconColor:   'text-gray-500',
      iconBg:      'bg-gray-100',
      borderColor: 'border-gray-200',
      count:       stats.pendingCount   ?? 0,
      credit:      stats.pendingCredit  ?? 0,
      commission:  referrals.filter(r => r.commission_status === 'pending').reduce((s, r) => s + (r.commission_cad ?? 0), 0),
      description: 'Client scanning or in review — credit estimate TBC',
      clients:     referrals.filter(r => r.commission_status === 'pending'),
    },
    {
      id:          'confirmed',
      label:       'Confirmed',
      icon:        CheckCircle2,
      iconColor:   'text-amber-600',
      iconBg:      'bg-amber-50',
      borderColor: 'border-amber-200',
      count:       stats.confirmedCount   ?? 0,
      credit:      stats.confirmedCredit  ?? 0,
      commission:  referrals.filter(r => r.commission_status === 'confirmed').reduce((s, r) => s + (r.commission_cad ?? 0), 0),
      description: 'Package delivered — invoice can be raised now',
      clients:     referrals.filter(r => r.commission_status === 'confirmed'),
    },
    {
      id:          'paid',
      label:       'Paid',
      icon:        Banknote,
      iconColor:   'text-green-600',
      iconBg:      'bg-green-50',
      borderColor: 'border-green-200',
      count:       stats.paidCount  ?? 0,
      credit:      stats.paidCredit ?? 0,
      commission:  stats.totalCommissionEarned ?? 0,
      description: 'T661 filed — TaxLift fee collected and commission paid',
      clients:     referrals.filter(r => r.commission_status === 'paid'),
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {stages.map((stage, i) => {
        const Icon   = stage.icon
        const isLast = i === stages.length - 1
        return (
          <div key={stage.id} className={`relative bg-white border-2 ${stage.borderColor} rounded-2xl p-5`}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className={`w-9 h-9 rounded-xl ${stage.iconBg} flex items-center justify-center flex-shrink-0`}>
                <Icon size={16} className={stage.iconColor} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{stage.label}</p>
                <p className="text-[11px] text-gray-400">{stage.count} client{stage.count !== 1 ? 's' : ''}</p>
              </div>
              {!isLast && (
                <div className="absolute -right-3.5 top-1/2 -translate-y-1/2 z-10 hidden sm:flex w-7 h-7 bg-white border border-gray-200 rounded-full items-center justify-center shadow-sm">
                  <ArrowRight size={12} className="text-gray-400" />
                </div>
              )}
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Credit pipeline</span>
                <span className="font-semibold text-gray-900">{stage.credit > 0 ? formatCurrency(stage.credit) : '—'}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Commission {stage.id === 'pending' ? '(est.)' : ''}</span>
                <span className={`font-bold ${stage.id === 'paid' ? 'text-green-700' : stage.id === 'confirmed' ? 'text-amber-700' : 'text-gray-500'}`}>
                  {stage.commission > 0 ? formatCurrency(stage.commission) : '—'}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              {stage.clients.length === 0 && (
                <p className="text-[11px] text-gray-300 italic">No clients yet</p>
              )}
              {stage.clients.map(c => (
                <div key={c.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5">
                  <Building2 size={11} className="text-gray-400 flex-shrink-0" />
                  <span className="text-[11px] text-gray-700 font-medium truncate flex-1">{c.company_name}</span>
                  {c.commission_cad > 0 && (
                    <span className="text-[10px] text-gray-500 flex-shrink-0">{formatCurrency(c.commission_cad)}</span>
                  )}
                </div>
              ))}
            </div>

            <p className="text-[10px] text-gray-400 mt-3 leading-relaxed">{stage.description}</p>
          </div>
        )
      })}
    </div>
  )
}

// ── Referral pipeline table ───────────────────────────────────────────────────
function ReferralTable({ clients }) {
  const sorted = useMemo(
    () => [...clients].sort((a, b) => new Date(b.date_referred ?? b.created_at) - new Date(a.date_referred ?? a.created_at)),
    [clients]
  )

  function fmtDate(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (sorted.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl py-16 text-center text-gray-400">
        <UserPlus size={32} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm font-medium">No referrals yet</p>
        <p className="text-xs mt-1">Share your referral link to start earning commissions.</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="hidden sm:grid grid-cols-[1fr_110px_120px_120px_110px_110px] gap-4 px-5 py-3 bg-gray-50 border-b border-gray-100 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
        <span>Company</span><span>FY</span><span>Status</span>
        <span className="text-right">Est. Credit</span>
        <span className="text-right">Commission</span>
        <span>Date Referred</span>
      </div>
      {sorted.map((ref, i) => (
        <div
          key={ref.id}
          className={`flex flex-col sm:grid sm:grid-cols-[1fr_110px_120px_120px_110px_110px] sm:gap-4 px-5 py-4 hover:bg-gray-50 transition-colors ${i < sorted.length - 1 ? 'border-b border-gray-100' : ''}`}
        >
          <div className="flex items-center gap-3 mb-2 sm:mb-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
              <Building2 size={14} className="text-indigo-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 leading-snug truncate">{ref.company_name}</p>
              <p className="text-[11px] text-gray-400 truncate">{ref.industry || ref.ref_code}</p>
            </div>
          </div>

          <div className="flex sm:items-center mb-1 sm:mb-0">
            <span className="text-xs text-gray-500 sm:hidden font-medium mr-1">FY:</span>
            <span className="text-sm text-gray-700 font-medium">{ref.fiscal_year || '—'}</span>
          </div>

          <div className="flex items-center gap-2 mb-1 sm:mb-0">
            <StatusPill status={ref.referral_status ?? 'scanning'} meta={STATUS_META} />
          </div>

          <div className="flex sm:items-center sm:justify-end mb-1 sm:mb-0">
            <span className="text-xs text-gray-500 sm:hidden font-medium mr-1">Credit:</span>
            <span className="text-sm font-semibold text-gray-900">
              {(ref.estimated_credit_cad ?? 0) > 0
                ? formatCurrency(ref.estimated_credit_cad)
                : <span className="text-gray-300 font-normal">TBD</span>
              }
            </span>
          </div>

          <div className="flex sm:items-center sm:justify-end mb-1 sm:mb-0 gap-1.5">
            {(ref.commission_cad ?? 0) > 0
              ? <>
                  <span className={`text-sm font-bold ${
                    ref.commission_status === 'paid'      ? 'text-green-700'  :
                    ref.commission_status === 'confirmed' ? 'text-amber-700'  : 'text-gray-500'
                  }`}>{formatCurrency(ref.commission_cad)}</span>
                  <StatusPill status={ref.commission_status} meta={COMMISSION_META} />
                </>
              : <span className="text-[11px] text-gray-300">—</span>
            }
          </div>

          <div className="flex sm:items-center">
            <span className="text-xs text-gray-500 sm:hidden font-medium mr-1">Referred:</span>
            <span className="text-xs text-gray-500">{fmtDate(ref.date_referred ?? ref.created_at)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ReferralDashboardPage() {
  const { currentUser }            = useAuth()
  const [referrals,   setReferrals]   = useState([])
  const [stats,       setStats]       = useState({})
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [referModalOpen, setReferModalOpen] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [statsRes, listRes] = await Promise.all([
          referralsApi.stats(),
          referralsApi.list(),
        ])
        setStats(statsRes)
        setReferrals(listRes.referrals ?? [])
      } catch (err) {
        setError(err?.message ?? 'Failed to load referral data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Build co-branded referral link from real user data
  const firmName    = currentUser?.firm_name || currentUser?.name || 'Your Firm'
  const partnerName = currentUser?.name || currentUser?.email || ''
  const refToken    = currentUser?.id ? buildReferralToken(currentUser.id, firmName) : ''
  const intakeUrl   = `${window.location.origin}/start?ref=${refToken}`

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 gap-2 text-slate-400">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Loading referral data…</span>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={15} className="flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Firm context banner */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-900 rounded-2xl px-6 py-5">
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <Building2 size={22} className="text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-base leading-snug">{firmName}</p>
              <p className="text-slate-300 text-sm mt-0.5">{partnerName}</p>
            </div>
          </div>
          <CpaPortalTabs active="referrals" />
          <div className="hidden lg:flex items-center gap-4 text-sm text-slate-300">
            <span className="flex items-center gap-1.5">
              <Mail size={13} className="text-slate-400" />
              {currentUser?.email ?? ''}
            </span>
          </div>
        </div>
      </div>

      {/* Commission earn banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-2xl px-6 py-5 flex items-center justify-between gap-6 flex-wrap">
        <div className="absolute right-4 top-1/2 -translate-y-1/2 w-40 h-40 rounded-full border-2 border-white/10 pointer-events-none" />
        <div className="absolute right-12 top-1/2 -translate-y-1/2 w-24 h-24 rounded-full border-2 border-white/10 pointer-events-none" />
        <div className="flex items-start gap-4 relative">
          <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <Sparkles size={22} className="text-yellow-300" />
          </div>
          <div>
            <p className="text-white font-bold text-base">Earn 0.8% of every credit you refer</p>
            <p className="text-indigo-200 text-sm mt-1 max-w-lg">
              TaxLift charges 8% of credits recovered. You keep 10% of that as a referral fee.
              On a $200K claim, that's <strong className="text-white">$1,600</strong> — for one email.
            </p>
          </div>
        </div>
        <button
          onClick={() => setReferModalOpen(true)}
          className="relative flex items-center gap-2 bg-white text-indigo-700 hover:bg-indigo-50 text-sm font-bold px-5 py-2.5 rounded-xl transition-colors flex-shrink-0 shadow-sm"
        >
          <UserPlus size={15} />
          Refer a client
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Clients Referred"   value={stats.totalReferred ?? 0}                        sub="All time"                       icon={Users}      iconColor="text-indigo-500" iconBg="bg-indigo-50" />
        <StatCard label="Credit Pipeline"    value={formatCurrency(stats.totalPipelineCredit ?? 0)}  sub="Across all referred clients"    icon={TrendingUp} iconColor="text-blue-600"   iconBg="bg-blue-50"   highlight />
        <StatCard label="Commission Earned"  value={formatCurrency(stats.totalCommissionEarned ?? 0)} sub="Paid out to date"              icon={Banknote}   iconColor="text-green-600"  iconBg="bg-green-50"  accent />
        <StatCard label="Pending Payout"     value={formatCurrency(stats.pendingPayout ?? 0)}         sub="Confirmed, awaiting invoice"   icon={DollarSign} iconColor="text-amber-600"  iconBg="bg-amber-50" />
      </div>

      {/* Commission tracker */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Commission tracker</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Commissions move Pending → Confirmed (package ready) → Paid (after T661 filing)
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
            <BarChart3 size={11} className="text-gray-400" />
            Rate: {(REFERRAL_RATE * 100).toFixed(1)}% of credit
          </div>
        </div>
        <CommissionTracker referrals={referrals} stats={stats} />
      </div>

      {/* Pipeline table */}
      <div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">Referral pipeline</h2>
            <p className="text-xs text-gray-500 mt-0.5">{referrals.length} referred client{referrals.length !== 1 ? 's' : ''} · sorted by most recent</p>
          </div>
          <button
            onClick={() => setReferModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors"
          >
            <UserPlus size={13} /> Refer another client
          </button>
        </div>
        <ReferralTable clients={referrals} />
      </div>

      {/* How it works */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Star size={14} className="text-indigo-500" /> How the referral programme works
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[
            { step: '1', title: 'Share your link',    body: 'Send your co-branded intake link to any client you think qualifies for SR&ED.' },
            { step: '2', title: 'They sign up',       body: 'TaxLift guides them through onboarding and connects their GitHub or Jira.' },
            { step: '3', title: 'Package prepared',   body: 'TaxLift prepares the T661 and cluster documentation. You receive it for review.' },
            { step: '4', title: 'You file, you earn', body: 'Once you file the T661, TaxLift invoices the client and pays your 0.8% commission.' },
          ].map(item => (
            <div key={item.step} className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {item.step}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-900">{item.title}</p>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 mt-4 border-t border-slate-200 pt-3">
          Commission is calculated on credits recovered and confirmed by CRA. TaxLift's success fee is 8% of credits recovered.
          Your referral commission is 10% of that fee (0.8% of credits). Commissions are invoiced after the T661 is filed.
        </p>
      </div>

      <ReferClientModal
        open={referModalOpen}
        onClose={() => setReferModalOpen(false)}
        intakeUrl={intakeUrl}
        firmName={firmName}
        partnerName={partnerName}
      />
    </div>
  )
}

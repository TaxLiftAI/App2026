/**
 * ShareWithCpaModal
 *
 * Opens when a user clicks "Share with CPA". Generates a unique token-encoded
 * URL pointing to /cpa-review/:token and lets the user copy it or grab a
 * pre-drafted email invite.
 *
 * Props:
 *   open          boolean
 *   onClose       () => void
 *   report        object  — from ReportsPage (report, devBreakdown)
 *   devBreakdown  array
 *   companyName   string
 *   fiscalYear    string
 *   filingDeadline string | null
 *   auditScore    number
 *   sharedBy      string
 *   sharedByEmail string
 *
 *  OR pass `clientData` (CPA_CLIENTS row) to generate from CPA portal.
 */
import { useState, useMemo } from 'react'
import {
  X, Copy, Check, Link2, Mail, Clock, Shield,
  FileText, Users, ShieldCheck, ChevronDown, ChevronUp,
  Layers, ExternalLink, Info, Send, Loader2, CheckCircle2, AlertCircle,
} from 'lucide-react'
import { encodeCpaToken, makeExpiresAt } from '../lib/cpaToken'
import { formatCurrency } from '../lib/utils'
import { NARRATIVES } from '../data/mockData'
import { cpa as cpaApi } from '../lib/api'

// Narrative lookup helper — works whether cluster has narrative_content_text
// directly or just a narrative_id reference into the NARRATIVES mock map.
function getNarrativeText(cluster) {
  if (cluster.narrative_content_text) return cluster.narrative_content_text
  if (cluster.narrative_id && NARRATIVES[cluster.narrative_id]) {
    return NARRATIVES[cluster.narrative_id].content_text ?? null
  }
  return null
}

// ── T661 builder (proxy method) ───────────────────────────────────────────────
function buildT661FromReport(report, devBreakdown, entityType = 'CCPC') {
  const totalSalaries = devBreakdown.reduce(
    (s, d) => s + ((d.hours ?? 0) * (d.hourly_rate ?? 0)), 0
  )
  const totalDevHours = Math.max(1, devBreakdown.reduce((s, d) => s + d.hours, 0))
  const line100 = totalSalaries * ((report.total_eligible_hours ?? 0) / totalDevHours)
  const line200 = line100 * 0.55
  const line300 = 0
  const line400 = line100 + line200
  const line500 = line400
  const isCCPC        = entityType === 'CCPC'
  const firstBracket  = Math.min(line500, 3_000_000)
  const secondBracket = Math.max(0, line500 - 3_000_000)
  const itc = isCCPC
    ? firstBracket * 0.35 + secondBracket * 0.15
    : line500 * 0.15
  return { line100, line200, line300, line400, line500, itc, isCCPC, firstBracket, secondBracket, entityType }
}

// ── What's included list ──────────────────────────────────────────────────────
const INCLUDED = [
  { icon: Layers,      text: 'SR&ED cluster list with status and credit estimates' },
  { icon: FileText,    text: 'AI-generated T661 narratives (approved clusters)' },
  { icon: ShieldCheck, text: 'T661 financial schedule (proxy method estimate)' },
  { icon: Shield,      text: 'Evidence chain-of-custody with snapshot IDs' },
  { icon: Users,       text: 'Audit readiness score and checklist' },
]

// ── Email draft builder ────────────────────────────────────────────────────────
function buildEmailDraft({ companyName, fiscalYear, sharedBy, link, expiresAt }) {
  const expDate = new Date(expiresAt).toLocaleDateString('en-CA', {
    month: 'long', day: 'numeric', year: 'numeric'
  })
  return `Subject: SR&ED Review Package — ${companyName} (FY${fiscalYear})

Hi,

Please find the SR&ED CPA review package for ${companyName}'s FY${fiscalYear} claim below.

The package includes our T661 narrative drafts, financial schedule estimates, cluster-by-cluster activity descriptions, and evidence hashes — everything you need to review and prepare the filing.

🔗 Review link (expires ${expDate}):
${link}

This is a read-only view — no login required. Please let me know if you have any questions or need supporting documentation.

Best,
${sharedBy}`
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ShareWithCpaModal({
  open,
  onClose,
  report,
  devBreakdown = [],
  companyName = 'Your Company',
  fiscalYear  = '2025',
  filingDeadline = null,
  auditScore  = 0,
  sharedBy    = 'Your Team',
  sharedByEmail = '',
  // Alternative: pass a CPA_CLIENTS row directly
  clientData  = null,
}) {
  const [copied,      setCopied]      = useState(false)
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [showEmail,   setShowEmail]   = useState(false)

  // Direct send state
  const [cpaEmailInput, setCpaEmailInput] = useState('')
  const [cpaNameInput,  setCpaNameInput]  = useState('')
  const [sending,       setSending]       = useState(false)
  const [sendResult,    setSendResult]    = useState(null) // { ok, message }

  // ── Build token payload ──────────────────────────────────────────────────
  const { link, emailDraft } = useMemo(() => {
    const expiresAt   = makeExpiresAt()
    const generatedAt = new Date().toISOString()

    let payload

    if (clientData) {
      // Coming from CPA Portal — use client summary data
      payload = {
        companyName:    clientData.company_name,
        fiscalYear:     new Date(clientData.filing_deadline).getFullYear().toString(),
        filingDeadline: clientData.filing_deadline,
        auditScore:     clientData.avg_readiness_score,
        totalCredit:    clientData.estimated_credit_cad,
        totalHours:     null,
        sharedBy,
        sharedByEmail,
        generatedAt,
        expiresAt,
        t661: null,
        clusters: Array.from({ length: clientData.clusters_approved }, (_, i) => ({
          id:                  `cluster-${i + 1}`,
          name:                `SR&ED Project ${i + 1}`,
          status:              'Approved',
          hours:               null,
          creditCAD:           Math.round(clientData.estimated_credit_cad / Math.max(1, clientData.clusters_approved)),
          riskScore:           null,
          narrative:           null,
          narrativeApproved:   false,
          evidenceSnapshotId:  null,
        })),
        clusterTotals: {
          total:    clientData.clusters_total,
          approved: clientData.clusters_approved,
          pending:  clientData.clusters_pending_review,
        },
      }
    } else if (report) {
      // Coming from Reports page — use full report data
      const t661     = buildT661FromReport(report, devBreakdown)
      const clusters = (report.approved_list ?? []).map(c => {
        const narrativeText = getNarrativeText(c)
        return {
          id:                 c.id,
          name:               c.business_component ?? 'Unnamed Cluster',
          status:             c.status,
          hours:              c.aggregate_time_hours,
          creditCAD:          c.estimated_credit_cad,
          riskScore:          c.risk_score,
          narrative:          narrativeText,
          narrativeApproved:  !!(narrativeText),
          evidenceSnapshotId: c.evidence_snapshot_id ?? null,
        }
      })

      payload = {
        companyName,
        fiscalYear,
        filingDeadline,
        auditScore,
        totalCredit:  report.total_credit_cad ?? 0,
        totalHours:   report.total_eligible_hours ?? 0,
        sharedBy,
        sharedByEmail,
        generatedAt,
        expiresAt,
        t661,
        clusters,
        clusterTotals: {
          total:    report.total_clusters ?? 0,
          approved: report.approved_clusters ?? 0,
          pending:  (report.total_clusters ?? 0) - (report.approved_clusters ?? 0),
        },
      }
    } else {
      return { link: null, emailDraft: '' }
    }

    const token      = encodeCpaToken(payload)
    const origin     = window.location.origin
    const reviewLink = `${origin}/cpa-review/${token}`

    return {
      link: reviewLink,
      emailDraft: buildEmailDraft({
        companyName:  payload.companyName,
        fiscalYear:   payload.fiscalYear,
        sharedBy,
        link:         reviewLink,
        expiresAt,
      }),
    }
  }, [open]) // Regenerate on each open so timestamp is fresh

  function handleCopyLink() {
    if (!link) return
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  function handleCopyEmail() {
    navigator.clipboard.writeText(emailDraft).then(() => {
      setCopiedEmail(true)
      setTimeout(() => setCopiedEmail(false), 2500)
    })
  }

  async function handleSendEmail() {
    if (!cpaEmailInput || !link) return
    setSending(true)
    setSendResult(null)

    // Derive report metadata from whichever source is active
    const pkg = clientData ?? {}
    const reportPayload = {
      cpaEmail:      cpaEmailInput.trim(),
      cpaName:       cpaNameInput.trim() || undefined,
      companyName:   clientData?.company_name ?? companyName,
      fiscalYear,
      sharedBy,
      sharedByEmail,
      reviewLink:    link,
      expiresAt:     new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      totalCredit:   clientData?.estimated_credit_cad ?? report?.total_credit_cad ?? null,
      clusterCount:  clientData?.clusters_approved ?? report?.approved_clusters ?? null,
      auditScore:    clientData?.avg_readiness_score ?? auditScore ?? null,
    }

    try {
      const result = await cpaApi.sendHandoff(reportPayload)
      setSendResult({ ok: true, message: result.message ?? `Sent to ${cpaEmailInput}` })
      setCpaEmailInput('')
      setCpaNameInput('')
    } catch (err) {
      setSendResult({ ok: false, message: err?.message ?? 'Failed to send email' })
    } finally {
      setSending(false)
    }
  }

  if (!open) return null

  const displayName = clientData?.company_name ?? companyName

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-900 px-6 py-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <Link2 size={18} className="text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-base leading-snug">Share with CPA</p>
              <p className="text-indigo-200 text-xs mt-0.5">{displayName} · Read-only review link</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors mt-0.5 flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Expiry notice */}
          <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5 text-xs text-amber-800">
            <Clock size={13} className="text-amber-500 flex-shrink-0" />
            <span>
              This link expires in <strong>7 days</strong>.
              The CPA can view the package without logging in — read-only access only.
            </span>
          </div>

          {/* What's included */}
          <div>
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2.5">What's included</p>
            <div className="space-y-2">
              {INCLUDED.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2.5 text-sm text-gray-600">
                  <div className="w-5 h-5 rounded-md bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <Icon size={11} className="text-indigo-600" />
                  </div>
                  {text}
                </div>
              ))}
            </div>
          </div>

          {/* Link box */}
          <div>
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Review link</p>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-3">
              <p className="flex-1 text-xs text-gray-500 font-mono truncate min-w-0">
                {link ?? 'Generating…'}
              </p>
              <button
                onClick={handleCopyLink}
                disabled={!link}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex-shrink-0 ${
                  copied
                    ? 'bg-green-600 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5 flex items-center gap-1">
              <Info size={10} className="flex-shrink-0" />
              No login required for the CPA. The link opens a read-only package view.
            </p>
          </div>

          {/* ── Direct email send ── */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-indigo-700 flex items-center gap-1.5">
              <Send size={12} /> Send directly from TaxLift
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="CPA name (optional)"
                value={cpaNameInput}
                onChange={e => setCpaNameInput(e.target.value)}
                className="flex-1 min-w-0 px-3 py-2 text-sm border border-indigo-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder-gray-400"
              />
              <input
                type="email"
                placeholder="CPA email address"
                value={cpaEmailInput}
                onChange={e => { setCpaEmailInput(e.target.value); setSendResult(null) }}
                onKeyDown={e => e.key === 'Enter' && handleSendEmail()}
                className="flex-1 min-w-0 px-3 py-2 text-sm border border-indigo-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder-gray-400"
              />
            </div>

            <button
              onClick={handleSendEmail}
              disabled={!cpaEmailInput || sending || !link}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors"
            >
              {sending
                ? <><Loader2 size={12} className="animate-spin" /> Sending…</>
                : <><Send size={12} /> Send package email</>}
            </button>

            {sendResult && (
              <div className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${
                sendResult.ok
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {sendResult.ok
                  ? <CheckCircle2 size={12} className="flex-shrink-0 mt-0.5" />
                  : <AlertCircle  size={12} className="flex-shrink-0 mt-0.5" />}
                {sendResult.message}
              </div>
            )}
          </div>

          {/* Email draft toggle */}
          <div>
            <button
              onClick={() => setShowEmail(v => !v)}
              className="flex items-center gap-2 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              <Mail size={13} />
              {showEmail ? 'Hide email draft' : 'Or copy email draft to send manually'}
              {showEmail ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {showEmail && (
              <div className="mt-3 relative">
                <pre className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-600 whitespace-pre-wrap leading-relaxed font-sans max-h-52 overflow-y-auto">
                  {emailDraft}
                </pre>
                <button
                  onClick={handleCopyEmail}
                  className={`absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                    copiedEmail
                      ? 'bg-green-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {copiedEmail ? <Check size={11} /> : <Copy size={11} />}
                  {copiedEmail ? 'Copied!' : 'Copy'}
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-4">
          <p className="text-[11px] text-gray-400 leading-relaxed">
            TaxLift prepares the package. Your CPA reviews and files the T661.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors flex-shrink-0"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

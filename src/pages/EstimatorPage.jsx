/**
 * TaxLift Combined Funding Estimator — public-facing, no login required.
 *
 * SR&ED calculation notes:
 *  • PPA (55%) applies ONLY to eligible employee wages, NOT contractors
 *  • Contractor SR&ED: 80% of paid amount eligible (CRA arm's-length rule)
 *  • CCPC enhanced rate (35%) on first $3M QE; 15% above; phaseout at $10M taxable capital
 *  • Ontario 8% provincial = OITC (already in PROVINCES rate — not re-added as a grant)
 *
 * New in this version:
 *  • Net ROI card: TaxLift fee vs 20% traditional consultant — shows prospect the net benefit
 *  • Prior years catch-up: shows cumulative unclaimed credit for 1–3 missed fiscal years
 *  • Fiscal year end + CRA filing deadline + expected refund date
 *  • Urgency banner when window < 6 months
 *  • Eligibility diagnostic quiz (4 questions → suggested eligibility range)
 *  • Time investment comparison: hrs with TaxLift vs traditional prep
 *  • Effort/payoff ratings on every grant card
 */
import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { usePageMeta } from '../hooks/usePageMeta'
import {
  ShieldCheck, ChevronRight, Copy, Check, Building2, MapPin,
  Info, TrendingUp, ArrowRight, Sparkles, FlaskConical,
  Lock, BadgeCheck, CircleDashed, HelpCircle, ChevronDown,
  Calendar, X, GraduationCap, BarChart3, Target, Clock,
  DollarSign, AlertTriangle, Zap, CheckCircle2, Timer,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// STATIC DATA
// ─────────────────────────────────────────────────────────────────────────────

const PROVINCES = [
  { code: 'AB', name: 'Alberta',          rate: 0.10, refundable: false, note: 'Alberta Innovation Employment Grant available separately' },
  { code: 'BC', name: 'British Columbia', rate: 0.10, refundable: true,  note: 'BC SR&ED tax credit — refundable for CCPCs' },
  { code: 'MB', name: 'Manitoba',         rate: 0.15, refundable: true,  note: 'Manitoba SR&ED tax credit' },
  { code: 'NB', name: 'New Brunswick',    rate: 0.15, refundable: false, note: 'NB R&D tax credit' },
  { code: 'NL', name: 'Newfoundland',     rate: 0.15, refundable: true,  note: 'NL R&D tax credit — refundable' },
  { code: 'NS', name: 'Nova Scotia',      rate: 0.15, refundable: false, note: 'NS R&D tax credit' },
  { code: 'ON', name: 'Ontario',          rate: 0.08, refundable: false, note: 'Ontario Innovation Tax Credit (OITC) — 8% on first $3M QE' },
  { code: 'PE', name: 'PEI',              rate: 0.10, refundable: false, note: 'PEI R&D credit' },
  { code: 'QC', name: 'Québec',           rate: 0.14, refundable: true,  note: 'Québec R-D credit — 14% refundable for CCPCs' },
  { code: 'SK', name: 'Saskatchewan',     rate: 0.10, refundable: false, note: 'SK R&D tax credit' },
]

const INDUSTRIES = [
  { id: 'software',      label: 'Software / SaaS' },
  { id: 'ai',            label: 'AI / Machine Learning' },
  { id: 'hardware',      label: 'Hardware / Embedded Systems' },
  { id: 'biotech',       label: 'Biotech / Life Sciences' },
  { id: 'cleantech',     label: 'Clean Technology' },
  { id: 'manufacturing', label: 'Advanced Manufacturing' },
  { id: 'other',         label: 'Other Deep Tech' },
]

const REVENUE_RANGES = [
  { id: 'pre',    label: 'Pre-revenue' },
  { id: 'u1m',    label: 'Under $1M ARR' },
  { id: '1m_5m',  label: '$1M – $5M ARR' },
  { id: '5m_20m', label: '$5M – $20M ARR' },
  { id: '20m',    label: '$20M+ ARR' },
]

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const PRESETS = [
  { label: 'Seed',       icon: '🌱', numDevs: 3,  avgSalary: 100_000, eligibilityPct: 80, isCCPC: true, province: 'ON', industry: 'software',      yearsRD: 1, contractorPct: 15, hasUniversity: false, revenueRange: 'u1m',   fyMonth: 12, fyYear: 2025, yearsMissed: 1 },
  { label: 'Series A',   icon: '🚀', numDevs: 8,  avgSalary: 130_000, eligibilityPct: 70, isCCPC: true, province: 'ON', industry: 'software',      yearsRD: 3, contractorPct: 20, hasUniversity: false, revenueRange: '1m_5m', fyMonth: 12, fyYear: 2025, yearsMissed: 2 },
  { label: 'AI Lab',     icon: '🤖', numDevs: 5,  avgSalary: 160_000, eligibilityPct: 90, isCCPC: true, province: 'BC', industry: 'ai',            yearsRD: 2, contractorPct: 10, hasUniversity: true,  revenueRange: '1m_5m', fyMonth:  3, fyYear: 2025, yearsMissed: 1 },
  { label: 'CleanTech',  icon: '♻️', numDevs: 6,  avgSalary: 120_000, eligibilityPct: 75, isCCPC: true, province: 'AB', industry: 'cleantech',     yearsRD: 4, contractorPct: 25, hasUniversity: false, revenueRange: '5m_20m',fyMonth:  6, fyYear: 2025, yearsMissed: 2 },
  { label: 'Hardware',   icon: '⚙️', numDevs: 4,  avgSalary: 140_000, eligibilityPct: 85, isCCPC: true, province: 'ON', industry: 'hardware',      yearsRD: 3, contractorPct: 30, hasUniversity: true,  revenueRange: '1m_5m', fyMonth:  9, fyYear: 2025, yearsMissed: 0 },
]

// Diagnostic questions → suggested eligibility %
const DIAG_QUESTIONS = [
  { id: 'uncertainty',  pts: 20, text: 'Were there technical problems your team had to solve where the solution wasn\'t obvious at the start — not just implementing known technology?' },
  { id: 'experiments',  pts: 15, text: 'Did your team try multiple approaches, prototypes, or experiments and hit dead-ends before landing on a working solution?' },
  { id: 'advancement',  pts: 20, text: 'Is any of your work in AI/ML model development, algorithm design, compiler / parser tech, custom protocols, or embedded systems?' },
  { id: 'records',      pts: 10, text: 'Do you have any written record of technical decisions, design challenges, sprint retrospectives, or failed approaches — even informally in tickets or Slack?' },
]

// Effort levels for grant cards
const EFFORT = {
  low:    { label: 'Low effort',    color: 'text-emerald-600', desc: 'Under 10 hrs to apply' },
  medium: { label: 'Medium effort', color: 'text-amber-600',   desc: '10–40 hrs to apply'    },
  high:   { label: 'High effort',   color: 'text-rose-600',    desc: '40+ hrs to apply'       },
}

// ─────────────────────────────────────────────────────────────────────────────
// GRANT PROGRAMS
// ─────────────────────────────────────────────────────────────────────────────

const GRANT_PROGRAMS = [
  {
    id: 'irap', name: 'NRC-IRAP', org: 'National Research Council',
    max: 500_000, color: 'blue', icon: '🏛️', effort: 'medium',
    description: 'Salary-subsidy contributions for approved R&D projects.',
    detail: 'NRC IRAP assigns an Industrial Technology Advisor (ITA) to your company and can fund 50–80% of eligible staff costs on approved projects. Non-repayable. Most useful for companies under 500 employees.',
    timeline: '3–6 months', stackable: true,
    match: ({ isCCPC, numDevs, revenueRange }) => {
      if (!isCCPC) return 'low'
      if (revenueRange === '20m') return 'medium'
      return numDevs <= 200 ? 'high' : 'medium'
    },
    estimate: ({ numDevs, avgSalary, revenueRange }) => {
      const base  = Math.min(numDevs * avgSalary * 0.50 * 0.30, 500_000)
      const scale = { pre: 1.0, u1m: 1.0, '1m_5m': 0.85, '5m_20m': 0.70, '20m': 0.50 }
      return Math.round(base * (scale[revenueRange] ?? 0.85) / 5_000) * 5_000
    },
  },
  {
    id: 'sdtc', name: 'ISED SDTC', org: 'Sustainable Dev. Technology Canada',
    max: 3_000_000, color: 'gray', icon: '🌿', effort: 'high',
    paused: true,
    description: 'Large non-repayable contributions for projects with measurable environmental benefit.',
    detail: 'SDTC funds up to 40% of eligible project costs. Requires a clear environmental benefit thesis, commercialization plan, and 2+ years of R&D history. Competitive — ~10–15% acceptance rate.',
    statusCaveat: '⚠ Program intake is currently suspended. SDTC was placed under ISED administration following a 2023 governance review. New applications are not being accepted. Monitor ised.gc.ca for reinstatement updates.',
    timeline: '6–12 months', stackable: true,
    match: () => 'low',
    estimate: () => 0,
  },
  {
    id: 'ngen', name: 'NGen Supercluster', org: 'Next Generation Manufacturing Canada',
    max: 250_000, color: 'orange', icon: '⚙️', effort: 'medium',
    description: 'Co-investment in advanced manufacturing innovation with industry-led consortiums.',
    detail: 'NGen typically requires 50% matching from industry partners. Ideal for hardware or manufacturing companies with prototype-stage innovation.',
    timeline: '3–9 months', stackable: true,
    match: ({ industry, yearsRD }) => {
      if (['hardware','manufacturing'].includes(industry) && yearsRD >= 1) return 'high'
      return industry === 'other' ? 'medium' : 'low'
    },
    estimate: ({ numDevs, avgSalary, contractorPct }) =>
      Math.min(Math.round(numDevs * avgSalary * (1 - contractorPct / 100) * 0.10 / 5_000) * 5_000, 250_000),
  },
  {
    id: 'mitacs', name: 'MITACS Accelerate', org: 'MITACS / Universities Canada',
    max: 60_000, color: 'purple', icon: '🎓', effort: 'low',
    description: 'Federal co-funding for graduate / postdoc interns on your R&D projects.',
    detail: 'MITACS funds 50% of each internship ($15K per 4-month unit). Up to 4 interns = $60K. The university applies — your time investment is minimal. Widely accessible, fast, and highly stackable.',
    timeline: '4–8 weeks', stackable: true, requiresUniversity: true,
    match: ({ hasUniversity }) => hasUniversity ? 'high' : 'low',
    estimate: ({ hasUniversity, numDevs }) => {
      if (!hasUniversity) return 0
      return Math.min(Math.floor(numDevs / 3), 4) * 15_000 || 15_000
    },
  },
  {
    id: 'nserc_engage', name: 'NSERC Engage', org: 'Natural Sciences & Engineering Research Council',
    max: 25_000, color: 'sky', icon: '🔬', effort: 'low',
    description: '$25K fast-start grant for a first-time industry-university research partnership.',
    detail: 'No matching required. 6-month project with a faculty researcher. Decision in ~4–6 weeks. One-time per company-professor pair — ideal entry point before scaling to larger NSERC grants.',
    timeline: '4–6 weeks', stackable: true, requiresUniversity: true,
    match: ({ hasUniversity }) => hasUniversity ? 'high' : 'low',
    estimate: ({ hasUniversity }) => hasUniversity ? 25_000 : 0,
  },
  {
    id: 'oce', name: 'OCE Market Readiness', org: 'Ontario Centres of Excellence',
    max: 150_000, color: 'indigo', icon: '🏙️', effort: 'medium',
    description: 'Ontario co-investment grants for commercializing technology from prototype to market.',
    detail: 'OCE requires 1:1 cash matching. Covers testing, regulatory approval, pilot deployments. Separate from and stackable with the 8% OITC already in your SR&ED calculation.',
    timeline: '3–4 months', stackable: true,
    match: ({ province, isCCPC, revenueRange }) => {
      if (province !== 'ON' || !isCCPC) return null
      if (['1m_5m','5m_20m'].includes(revenueRange)) return 'high'
      return revenueRange === 'u1m' ? 'medium' : 'low'
    },
    estimate: ({ numDevs, avgSalary, revenueRange }) => {
      const base = Math.min(numDevs * avgSalary * 0.06, 150_000)
      return Math.round(base * (['1m_5m','5m_20m'].includes(revenueRange) ? 1 : 0.6) / 5_000) * 5_000
    },
  },
  {
    id: 'regional_dev', name: 'Regional Dev Agency', org: '',
    max: 500_000, color: 'teal', icon: '🗺️', effort: 'medium',
    description: '',
    detail: 'Regional Development Agencies (RDAs) offer non-repayable and repayable contributions for R&D, commercialization, and scale-up. Most eligible tech companies qualify within 12–18 months of applying.',
    timeline: '3–9 months', stackable: true,
    match: ({ province, isCCPC }) => {
      if (!isCCPC) return 'low'
      const covered = ['AB','BC','SK','MB','ON','NB','NS','NL','PE','QC']
      return covered.includes(province) ? 'high' : 'low'
    },
    estimate: ({ numDevs, avgSalary, eligibilityPct, revenueRange, province }) => {
      const max   = ['NB','NS','NL','PE'].includes(province) ? 200_000 : 500_000
      const base  = Math.min(numDevs * avgSalary * (eligibilityPct / 100) * 0.20, max)
      const scale = { pre: 0.80, u1m: 0.90, '1m_5m': 1.0, '5m_20m': 0.85, '20m': 0.60 }
      return Math.round(base * (scale[revenueRange] ?? 0.90) / 5_000) * 5_000
    },
  },
  {
    id: 'bc', name: 'BC Innovate / Ignite', org: 'Innovate BC',
    max: 100_000, color: 'teal', icon: '🌊', effort: 'low',
    description: 'BC technology commercialization grants — Ignite ($10K–$100K), Launchpad, sector programs.',
    detail: 'Open to BC-incorporated companies with an innovative product. Ignite targets scale-ready companies. Fast turnaround (~6–8 weeks) and minimal application burden.',
    timeline: '6–8 weeks', stackable: true,
    match: ({ province }) => province !== 'BC' ? null : 'high',
    estimate: ({ numDevs, avgSalary }) =>
      Math.min(Math.round(numDevs * avgSalary * 0.04 / 5_000) * 5_000, 100_000),
  },
  {
    id: 'ab', name: 'Alberta Innovates', org: 'Alberta Innovates',
    max: 250_000, color: 'amber', icon: '🌾', effort: 'medium',
    description: 'Alberta innovation funding — Scale-Up, Technology, and Clean Energy streams.',
    detail: 'The Technology Innovation and Entrepreneurship (TIE) fund is the most accessible stream for software and hardware companies. Multiple annual intake cycles.',
    timeline: '2–5 months', stackable: true,
    match: ({ province }) => province !== 'AB' ? null : 'high',
    estimate: ({ numDevs, avgSalary }) =>
      Math.min(Math.round(numDevs * avgSalary * 0.07 / 5_000) * 5_000, 250_000),
  },
  {
    id: 'qc', name: 'Investissement Québec R-D', org: 'Investissement Québec',
    max: 300_000, color: 'rose', icon: '⚜️', effort: 'medium',
    description: 'Quebec R-D tax credits (30% combined) plus IQ direct contributions.',
    detail: 'Quebec stacks federal SR&ED + Revenu Québec R-D credit (additional 14%) + IQ direct contributions. One of the most generous innovation funding stacks in Canada.',
    timeline: '3–6 months', stackable: true,
    match: ({ province }) => province !== 'QC' ? null : 'high',
    estimate: ({ numDevs, avgSalary, eligibilityPct }) =>
      Math.min(Math.round(numDevs * avgSalary * (eligibilityPct / 100) * 0.14 / 5_000) * 5_000, 300_000),
  },
]

const RDA_META = {
  ON: { org: 'FedDev Ontario',    description: 'Federal Economic Development Agency for Southern Ontario — non-repayable contributions up to $500K for tech R&D and commercialization.' },
  BC: { org: 'PacifiCan',         description: 'Pacific Economic Development Canada — R&D and scale-up contributions for BC companies.' },
  AB: { org: 'PrairiesCan',       description: 'Prairies Economic Development Canada — supports Alberta tech R&D with non-repayable contributions.' },
  SK: { org: 'PrairiesCan',       description: 'Western Economic Diversification — Saskatchewan R&D contribution programs.' },
  MB: { org: 'PrairiesCan',       description: 'Western Economic Diversification — Manitoba innovation funding programs.' },
  NB: { org: 'ACOA',              description: 'Atlantic Canada Opportunities Agency — New Brunswick tech R&D contributions.' },
  NS: { org: 'ACOA',              description: 'Atlantic Canada Opportunities Agency — Nova Scotia innovation and commercialization funding.' },
  NL: { org: 'ACOA',              description: 'Atlantic Canada Opportunities Agency — Newfoundland tech R&D support programs.' },
  PE: { org: 'ACOA',              description: 'Atlantic Canada Opportunities Agency — PEI innovation funding.' },
  QC: { org: 'CED-Q',             description: 'Canada Economic Development for Quebec Regions — stackable with Investissement Québec programs.' },
}

// ─────────────────────────────────────────────────────────────────────────────
// CALCULATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

function calcSRED({ numDevs, avgSalary, eligibilityPct, isCCPC, province, contractorPct }) {
  const totalSpend    = numDevs * avgSalary
  const empSpend      = totalSpend * (1 - contractorPct / 100)
  const ctorSpend     = totalSpend * (contractorPct / 100)
  const empEligible   = empSpend  * (eligibilityPct / 100)
  const ctorEligible  = ctorSpend * 0.80 * (eligibilityPct / 100)
  const overheadProxy = empEligible * 0.55          // PPA: employee only
  const totalQE       = empEligible + overheadProxy + ctorEligible

  const federalBase   = isCCPC
    ? Math.min(totalQE, 3_000_000) * 0.35 + Math.max(0, totalQE - 3_000_000) * 0.15
    : totalQE * 0.15
  const federalRefund = isCCPC ? federalBase : 0

  const prov           = PROVINCES.find(p => p.code === province) ?? PROVINCES[6]
  const provincialBase = totalQE * prov.rate
  const provRefund     = prov.refundable ? provincialBase : 0

  return {
    totalSpend, empSpend, ctorSpend, empEligible, ctorEligible, overheadProxy, totalQE,
    federalBase, provincialBase,
    totalCredit:     federalBase + provincialBase,
    totalRefund:     federalRefund + provRefund,
    taxOffset:       (federalBase - federalRefund) + (provincialBase - provRefund),
    prov,
    largeCapWarning: isCCPC && totalSpend > 5_000_000,
  }
}

function calcSensitivity(base) {
  const scenarios = [
    { label: 'Conservative', pct: Math.max(10, base.eligibilityPct - 15) },
    { label: 'Your estimate', pct: base.eligibilityPct },
    { label: 'Optimistic',   pct: Math.min(100, base.eligibilityPct + 15) },
  ]
  return scenarios.map(s => ({
    ...s,
    ...calcSRED({ ...base, eligibilityPct: s.pct }),
  }))
}

function matchGrants(inputs) {
  return GRANT_PROGRAMS
    .map(g => {
      const confidence = g.match(inputs)
      if (confidence === null) return null
      let resolved = { ...g }
      if (g.id === 'regional_dev') {
        const meta = RDA_META[inputs.province]
        if (!meta) return null
        resolved.org = meta.org; resolved.description = meta.description
      }
      const estimated    = confidence === 'low' ? 0 : g.estimate(inputs)
      const estimatedLow = Math.round(estimated * 0.50 / 1_000) * 1_000
      const estimatedHigh = Math.min(Math.round(estimated * 1.80 / 1_000) * 1_000, g.max)
      return { ...resolved, confidence, estimated, estimatedLow, estimatedHigh }
    })
    .filter(Boolean)
    .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.confidence] - { high: 0, medium: 1, low: 2 }[b.confidence]))
}

/** Returns CRA filing deadline and expected refund date from fiscal year end */
function calcDeadlines(fyMonth, fyYear) {
  // T2 corporate return due 6 months after FY end
  const fyEnd    = new Date(fyYear, fyMonth - 1, 1)
  const t2Due    = new Date(fyEnd); t2Due.setMonth(t2Due.getMonth() + 6)
  // SR&ED amendment must be filed within 18 months of T2 due date
  const sRedDue  = new Date(t2Due); sRedDue.setMonth(sRedDue.getMonth() + 18)
  // Expected CRA processing: ~90 days from a well-prepared filing
  const refundBy = new Date(t2Due); refundBy.setDate(refundBy.getDate() + 90)

  const today          = new Date(2026, 2, 23) // March 23 2026
  const msPerMonth     = 1000 * 60 * 60 * 24 * 30.44
  const monthsToSRED   = Math.round((sRedDue - today) / msPerMonth)
  const monthsToRefund = Math.round((refundBy  - today) / msPerMonth)

  const fmtDate = d => d.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })
  return {
    fyEnd, t2Due, sRedDue, refundBy,
    monthsToSRED, monthsToRefund,
    sRedDueStr:  fmtDate(sRedDue),
    refundByStr: fmtDate(refundBy),
    expired: monthsToSRED < 0,
    urgent:  monthsToSRED >= 0 && monthsToSRED <= 6,
  }
}

/** Diagnostic quiz → suggested eligibility range */
function diagToEligibility(answers) {
  const base  = 35
  const score = DIAG_QUESTIONS.reduce((s, q, i) => s + (answers[i] ? q.pts : 0), base)
  return { suggested: Math.min(score, 95), low: Math.max(35, score - 8), high: Math.min(100, score + 8) }
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMATTING
// ─────────────────────────────────────────────────────────────────────────────

const fmt  = n => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n)
const fmtK = n => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${Math.round(n / 1_000)}K` : fmt(n)

// ─────────────────────────────────────────────────────────────────────────────
// UI CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const CONF_META = {
  high:   { label: 'Strong match',    Icon: BadgeCheck,   cls: 'text-emerald-600 bg-emerald-50  border-emerald-200' },
  medium: { label: 'Possible match',  Icon: CircleDashed, cls: 'text-amber-600   bg-amber-50    border-amber-200'   },
  low:    { label: 'May not qualify', Icon: HelpCircle,   cls: 'text-gray-400    bg-gray-50     border-gray-200'    },
}
const GRANT_COLORS = {
  blue:'bg-blue-50 border-blue-100 text-blue-700', green:'bg-emerald-50 border-emerald-100 text-emerald-700',
  orange:'bg-orange-50 border-orange-100 text-orange-700', indigo:'bg-indigo-50 border-indigo-100 text-indigo-700',
  teal:'bg-teal-50 border-teal-100 text-teal-700', amber:'bg-amber-50 border-amber-100 text-amber-700',
  rose:'bg-rose-50 border-rose-100 text-rose-700', purple:'bg-purple-50 border-purple-100 text-purple-700',
  sky:'bg-sky-50 border-sky-100 text-sky-700',
}

const TIPS = {
  ccpc:       'Canadian-Controlled Private Corporation. Most early-stage Canadian tech companies qualify. CCPCs get a 35% refundable federal credit — you receive cash even with no tax owing.',
  elig:       'The % of your dev work involving technological uncertainty. Pure maintenance and feature work usually doesn\'t qualify. Pushing into the unknown does.',
  ppa:        'CRA Prescribed Proxy Amount: instead of tracking actual overhead, claim 55% of eligible employee wages as proxy. Applies to employees only — not contractors.',
  contractor: 'CRA allows 80% of arm\'s-length contractor payments as eligible SR&ED costs (vs 100% of employee wages). No overhead proxy on contractor spend.',
  years_rd:   'How long your company has been doing qualifying R&D. Programs like SDTC require 2+ years of documented R&D history.',
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function Tip({ tipKey }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-flex items-center"
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <HelpCircle size={12} className="text-gray-300 hover:text-gray-500 cursor-help ml-1" />
      {show && (
        <span className="absolute left-1/2 -translate-x-1/2 bottom-6 z-20 bg-gray-900 text-white text-[11px] rounded-xl px-3 py-2.5 w-56 leading-relaxed shadow-2xl whitespace-normal pointer-events-none">
          {TIPS[tipKey]}
          <span className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  )
}

function SliderInput({ label, value, min, max, step = 1, onChange, format, hint, tipKey, children }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 flex items-center">
          {label}{tipKey && <Tip tipKey={tipKey} />}
        </label>
        <span className="text-sm font-bold text-indigo-700 tabular-nums">{format ? format(value) : value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>{format ? format(min) : min}</span>
        {hint && <span className="text-gray-500 italic">{hint}</span>}
        <span>{format ? format(max) : max}</span>
      </div>
      {children}
    </div>
  )
}

function GrantCard({ grant, expanded, onToggle }) {
  const conf = CONF_META[grant.confidence]
  const ConfIcon = conf.Icon
  const colorCls = GRANT_COLORS[grant.color] ?? GRANT_COLORS.blue
  const eff = EFFORT[grant.effort]

  return (
    <div className={`rounded-xl border ${grant.paused ? 'border-gray-200 bg-gray-50 opacity-75' : colorCls} transition-all duration-200`}>
      <button className="w-full flex items-center justify-between gap-3 p-3 text-left" onClick={onToggle}>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-base leading-none flex-shrink-0">{grant.icon}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-semibold truncate">{grant.name}</p>
              {grant.paused && (
                <span className="text-[9px] font-bold uppercase tracking-wide bg-gray-200 text-gray-500 rounded px-1.5 py-0.5 flex-shrink-0">
                  Paused
                </span>
              )}
            </div>
            <p className="text-[10px] opacity-60 truncate">{grant.org}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!grant.paused && grant.confidence !== 'low' && grant.estimated > 0 && (
            <span className="text-xs font-bold tabular-nums">{fmtK(grant.estimatedLow)}–{fmtK(grant.estimated)}</span>
          )}
          {!grant.paused && (
            <span className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${conf.cls}`}>
              <ConfIcon size={10} />{conf.label}
            </span>
          )}
          <ChevronDown size={13} className={`opacity-50 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {expanded && (
        <div className="px-3 pb-3 border-t border-current/10 space-y-2">
          {grant.paused && (
            <div className="flex items-start gap-2 bg-gray-100 border border-gray-300 rounded-lg px-2.5 py-2 text-[11px] text-gray-600 mt-2">
              <AlertTriangle size={12} className="mt-0.5 flex-shrink-0 text-gray-500" />
              <span>{grant.statusCaveat}</span>
            </div>
          )}
          <p className={`pt-2 text-[11px] leading-relaxed ${grant.paused ? 'opacity-50' : 'opacity-80'}`}>{grant.description}</p>
          <p className={`text-[11px] leading-relaxed ${grant.paused ? 'opacity-40' : 'opacity-70'}`}>{grant.detail}</p>
          {!grant.paused && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {grant.timeline && <span className="text-[10px] opacity-75 bg-white/60 border border-current/20 rounded-full px-2 py-0.5">⏱ {grant.timeline} to decision</span>}
              {eff && <span className={`text-[10px] font-medium bg-white/60 border border-current/20 rounded-full px-2 py-0.5 ${eff.color}`}>{eff.label} · {eff.desc}</span>}
              {grant.stackable && <span className="text-[10px] opacity-75 bg-white/60 border border-current/20 rounded-full px-2 py-0.5">✅ Stackable with SR&ED</span>}
              {grant.requiresUniversity && <span className="text-[10px] opacity-75 bg-white/60 border border-current/20 rounded-full px-2 py-0.5">🎓 Needs university partner</span>}
              <span className="text-[10px] font-semibold bg-white/60 border border-current/20 rounded-full px-2 py-0.5">Max: {fmt(grant.max)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Eligibility diagnostic quiz
function DiagnosticQuiz({ onResult, onClose }) {
  const [answers, setAnswers] = useState(Array(DIAG_QUESTIONS.length).fill(null))
  const allAnswered = answers.every(a => a !== null)
  const result = allAnswered ? diagToEligibility(answers) : null

  return (
    <div className="border border-indigo-200 bg-indigo-50 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-indigo-800">Eligibility self-assessment</p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
      </div>
      {DIAG_QUESTIONS.map((q, i) => (
        <div key={q.id} className="space-y-1.5">
          <p className="text-[11px] text-gray-700 leading-relaxed">{i + 1}. {q.text}</p>
          <div className="flex gap-2">
            {[true, false].map(val => (
              <button key={String(val)} onClick={() => setAnswers(prev => prev.map((a, j) => j === i ? val : a))}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                  answers[i] === val
                    ? val ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-gray-400 border-gray-400 text-white'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300'
                }`}>
                {val ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
        </div>
      ))}
      {result && (
        <div className="bg-white rounded-lg p-3 border border-indigo-200">
          <p className="text-[11px] font-semibold text-indigo-800 mb-1">Suggested eligibility range</p>
          <p className="text-lg font-bold text-indigo-700">{result.low}% – {result.high}%</p>
          <p className="text-[10px] text-gray-500 mt-0.5 mb-2">Based on your answers, {result.suggested}% is a reasonable starting point. A TaxLift specialist can refine this with your actual commit history.</p>
          <button onClick={() => { onResult(result.suggested); onClose() }}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold py-2 rounded-lg transition-colors">
            Apply {result.suggested}% to my estimate
          </button>
        </div>
      )}
    </div>
  )
}

// Animated counter
function useAnimatedNumber(target, duration = 550) {
  const [display, setDisplay] = useState(target)
  const prevRef = useRef(target)
  useEffect(() => {
    const start = prevRef.current; const delta = target - start
    const steps = Math.ceil(duration / 16); let step = 0
    const timer = setInterval(() => {
      step++
      setDisplay(Math.round(start + delta * (1 - Math.pow(1 - step / steps, 3))))
      if (step >= steps) { clearInterval(timer); prevRef.current = target }
    }, 16)
    return () => clearInterval(timer)
  }, [target, duration])
  return display
}

// Email gate overlay — shown over the results column until email is captured
function EmailGateOverlay({ totalStr, onUnlock }) {
  const [form, setForm]   = useState({ name: '', email: '', company: '' })
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!form.email.includes('@')) { setError('Please enter a valid email.'); return }
    setBusy(true); setError('')
    try {
      await fetch('/api/v1/leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, source: 'estimator_gate', plan: 'plus' }),
      })
    } catch (_) {}
    localStorage.setItem('taxlift_estimator_email', form.email)
    localStorage.setItem('taxlift_estimator_name',  form.name)
    setBusy(false)
    onUnlock(form.email)
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-start pt-10 px-4"
      style={{ backdropFilter: 'blur(8px)', background: 'rgba(15,23,42,0.72)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-7">
        {/* Lock icon + headline */}
        <div className="flex flex-col items-center mb-5 text-center">
          <div className="w-11 h-11 bg-indigo-100 rounded-full flex items-center justify-center mb-3">
            <Lock size={20} className="text-indigo-600" />
          </div>
          <h3 className="text-base font-bold text-gray-900 leading-tight">
            Your estimate is ready
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Enter your email to reveal your full<br />
            <span className="font-semibold text-indigo-700">{totalStr}</span> funding estimate
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {[
            { key: 'name',    label: 'Your name',    type: 'text',  ph: 'Jane Smith'   },
            { key: 'email',   label: 'Work email',   type: 'email', ph: 'jane@acme.com' },
            { key: 'company', label: 'Company name', type: 'text',  ph: 'Acme Inc.'    },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-gray-700 mb-1">{f.label}</label>
              <input type={f.type} required placeholder={f.ph} value={form[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          ))}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button type="submit" disabled={busy}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
            {busy ? 'Unlocking…' : <><span>Reveal my estimate</span><ArrowRight size={14} /></>}
          </button>
          <p className="text-[10px] text-gray-400 text-center">
            No spam. No credit card. A specialist may follow up within 1 business day.
          </p>
        </form>
      </div>

      {/* Teaser stat visible behind the blur */}
      <p className="mt-5 text-indigo-300 text-xs text-center opacity-80">
        Average Canadian tech company recovers <span className="font-bold text-white">$187K</span> in SR&ED credits
      </p>
    </div>
  )
}

// Lead capture modal
function LeadModal({ totalStr, onClose }) {
  const [form, setForm] = useState({ name: '', email: '', company: '' })
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault(); setBusy(true)
    try {
      await fetch('/api/v1/leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, source: 'estimator_cta', plan: 'plus' }),
      })
    } catch (_) {}
    setSent(true); setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={18} /></button>
        {sent ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <Check size={22} className="text-emerald-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">You're on the list!</h3>
            <p className="text-sm text-gray-500">A qualified SR&ED specialist will reach out within one business day.</p>
            <button onClick={onClose} className="mt-2 w-full bg-indigo-600 text-white font-semibold py-2.5 rounded-xl text-sm">Done</button>
          </div>
        ) : (
          <div className="p-8 space-y-5">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full px-3 py-1 mb-3">
                <Sparkles size={11} /> Your estimated funding potential
              </div>
              <h3 className="text-xl font-bold text-gray-900">Claim your {totalStr}</h3>
              <p className="text-sm text-gray-500 mt-1">Free expert review — no commitment.</p>
            </div>
            <form onSubmit={submit} className="space-y-3">
              {[
                { key:'name', label:'Your name', type:'text', ph:'Jane Smith' },
                { key:'email', label:'Work email', type:'email', ph:'jane@acme.com' },
                { key:'company', label:'Company name', type:'text', ph:'Acme Inc.' },
              ].map(f => (
                <div key={f.key}>
                  <label htmlFor={`est-${f.key}`} className="block text-xs font-medium text-gray-700 mb-1">{f.label}</label>
                  <input id={`est-${f.key}`} name={f.key} type={f.type} required placeholder={f.ph} value={form[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              ))}
              <button type="submit" disabled={busy}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2">
                {busy ? 'Sending…' : <><span>Get my free review</span><ArrowRight size={14} /></>}
              </button>
              <p className="text-[10px] text-gray-400 text-center">No credit card. No commitment.</p>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function EstimatorPage() {
  usePageMeta({
    title:       'Free SR&ED Credit Estimator — TaxLift',
    description: 'Calculate how much SR&ED / R&D tax credit your Canadian startup could recover. Enter headcount and salary — get an instant CRA-grade estimate with provincial breakdown.',
    path:        '/estimate',
    breadcrumb:  [
      { name: 'Home',      path: '/'         },
      { name: 'Estimator', path: '/estimate' },
    ],
  })

  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Core inputs
  const [numDevs,        setNumDevs]       = useState(() => Number(searchParams.get('devs'))   || 5)
  const [avgSalary,      setAvgSalary]     = useState(() => Number(searchParams.get('salary')) || 110_000)
  const [eligibilityPct, setEligPct]       = useState(() => Number(searchParams.get('elig'))   || 70)
  const [contractorPct,  setContractorPct] = useState(() => Number(searchParams.get('cpct'))   || 20)
  const [isCCPC,         setIsCCPC]        = useState(() => searchParams.get('ccpc') !== '0')
  const [province,       setProvince]      = useState(() => searchParams.get('province')       || 'ON')
  const [industry,       setIndustry]      = useState(() => searchParams.get('industry')       || 'software')
  const [yearsRD,        setYearsRD]       = useState(() => Number(searchParams.get('years'))  || 2)
  const [hasUniversity,  setHasUniversity] = useState(() => searchParams.get('uni') === '1')
  const [revenueRange,   setRevenueRange]  = useState(() => searchParams.get('rev')            || 'u1m')

  // New: fiscal year + catch-up
  const [fyMonth,     setFyMonth]    = useState(() => Number(searchParams.get('fym'))  || 12)
  const [fyYear,      setFyYear]     = useState(() => Number(searchParams.get('fyy'))  || 2025)
  const [yearsMissed, setYearsMissed]= useState(() => Number(searchParams.get('ym'))   || 1)

  // Email gate — persist across page refreshes
  const [emailGated, setEmailGated] = useState(
    () => !!localStorage.getItem('taxlift_estimator_email')
  )

  // UI state
  const [copied,        setCopied]       = useState(false)
  const [expandedGrant, setExpandedGrant]= useState(null)
  const [showModal,     setShowModal]    = useState(false)
  const [activeTab,     setActiveTab]    = useState('sred')
  const [showDiag,      setShowDiag]     = useState(false)

  // Sync URL
  useEffect(() => {
    setSearchParams({
      devs: numDevs, salary: avgSalary, elig: eligibilityPct, cpct: contractorPct,
      ccpc: isCCPC ? '1' : '0', province, industry, years: yearsRD,
      uni: hasUniversity ? '1' : '0', rev: revenueRange,
      fym: fyMonth, fyy: fyYear, ym: yearsMissed,
    }, { replace: true })
  }, [numDevs, avgSalary, eligibilityPct, contractorPct, isCCPC, province, industry,
      yearsRD, hasUniversity, revenueRange, fyMonth, fyYear, yearsMissed])

  function applyPreset(p) {
    setNumDevs(p.numDevs); setAvgSalary(p.avgSalary); setEligPct(p.eligibilityPct)
    setContractorPct(p.contractorPct); setIsCCPC(p.isCCPC); setProvince(p.province)
    setIndustry(p.industry); setYearsRD(p.yearsRD); setHasUniversity(p.hasUniversity)
    setRevenueRange(p.revenueRange); setFyMonth(p.fyMonth); setFyYear(p.fyYear)
    setYearsMissed(p.yearsMissed)
  }

  const calcInputs = { numDevs, avgSalary, eligibilityPct, contractorPct, isCCPC, province, industry, yearsRD, hasUniversity, revenueRange }

  const sred      = useMemo(() => calcSRED(calcInputs), [numDevs, avgSalary, eligibilityPct, contractorPct, isCCPC, province])
  const grants    = useMemo(() => matchGrants(calcInputs), [numDevs, avgSalary, eligibilityPct, contractorPct, isCCPC, province, industry, yearsRD, hasUniversity, revenueRange])
  const scenarios = useMemo(() => calcSensitivity(calcInputs), [numDevs, avgSalary, eligibilityPct, contractorPct, isCCPC, province])
  const deadlines = useMemo(() => calcDeadlines(fyMonth, fyYear), [fyMonth, fyYear])

  const highGrants   = grants.filter(g => g.confidence === 'high')
  const medGrants    = grants.filter(g => g.confidence === 'medium')
  const lowGrants    = grants.filter(g => g.confidence === 'low')
  const grantsTotal  = grants.filter(g => g.confidence !== 'low').reduce((s, g) => s + g.estimated, 0)
  const grantsLow    = grants.filter(g => g.confidence !== 'low').reduce((s, g) => s + (g.estimatedLow ?? 0), 0)
  const matchedCount = grants.filter(g => g.confidence !== 'low').length
  const combinedTotal = sred.totalCredit + grantsTotal

  // Audit risk score (0–5): higher = more likely to receive CRA attention
  const riskScore = [
    yearsRD <= 1,          // first-time or near-first-time claimant
    contractorPct > 30,    // heavy contractor use (frequently challenged)
    eligibilityPct > 80,   // very high eligibility attracts scrutiny
    industry === 'software', // software claims get closer narrative review
    sred.totalCredit > 200_000, // large claims reviewed more often
  ].filter(Boolean).length

  // Prior years catch-up
  const catchupYears = useMemo(() => Array.from({ length: yearsMissed }, (_, i) => ({
    fyYear: fyYear - i - 1,
    credit: Math.round(sred.totalCredit * (1 - i * 0.05)), // slight decay for older years
    refund: Math.round(sred.totalRefund  * (1 - i * 0.05)),
  })), [yearsMissed, fyYear, sred.totalCredit, sred.totalRefund])
  const totalCatchup = catchupYears.reduce((s, y) => s + y.credit, 0)

  // ROI: TaxLift flat fee vs traditional consultant
  const taxliftAnnualFee   = 999   // flat $999 regardless of credit size
  const traditionalFee     = Math.round(sred.totalCredit * 0.20)   // typical 20% contingency
  const netWithTaxlift     = combinedTotal - taxliftAnnualFee
  const netTraditional     = sred.totalCredit - traditionalFee
  const taxliftSaving      = netWithTaxlift - netTraditional
  const taxliftROI         = Math.round(combinedTotal / taxliftAnnualFee)

  // 3-year SR&ED projection
  const yr2 = useMemo(() => calcSRED({ ...calcInputs, numDevs: Math.round(numDevs * 1.10) }), [sred])
  const yr3 = useMemo(() => calcSRED({ ...calcInputs, numDevs: Math.round(numDevs * 1.21) }), [sred])
  const threeYearSRED = sred.totalCredit + yr2.totalCredit + yr3.totalCredit

  // Animated heroes
  const animCombined  = useAnimatedNumber(Math.round(combinedTotal))
  const animSRED      = useAnimatedNumber(Math.round(sred.totalCredit))
  const animGrants    = useAnimatedNumber(Math.round(grantsTotal))
  const animGrantsLow = useAnimatedNumber(Math.round(grantsLow))

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500) })
  }

  const prov = sred.prov

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <button onClick={() => navigate('/')} className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <ShieldCheck size={16} className="text-white" />
          </div>
          <span className="text-white font-bold tracking-tight">TaxLift</span>
        </button>
        <div className="flex items-center gap-3">
          <button onClick={copyLink} className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white border border-slate-600 hover:border-slate-400 px-3 py-1.5 rounded-lg transition-all">
            {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
            {copied ? 'Copied!' : 'Share estimate'}
          </button>
          <button onClick={() => navigate('/login')} className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg transition-colors font-medium">
            Sign in <ArrowRight size={13} />
          </button>
        </div>
      </nav>

      {/* Urgency banner */}
      {(deadlines.urgent || deadlines.expired) && (
        <div className={`mx-4 sm:mx-6 max-w-6xl lg:mx-auto mb-2 rounded-xl px-4 py-3 flex items-center gap-3 ${
          deadlines.expired ? 'bg-red-900/60 border border-red-700' : 'bg-amber-900/60 border border-amber-600'
        }`}>
          <AlertTriangle size={16} className={deadlines.expired ? 'text-red-400' : 'text-amber-400'} />
          <p className="text-sm text-white">
            {deadlines.expired
              ? <>⚠️ Your FY{fyYear} SR&ED window has closed. Select a more recent fiscal year — or{' '}
                  <a href="mailto:hello@taxlift.ai" className="underline hover:text-indigo-300 transition-colors">contact us</a>
                  {' '}to review what&apos;s still claimable.</>

              : `Your FY${fyYear} SR&ED filing deadline is ${deadlines.sRedDueStr} — ${deadlines.monthsToSRED} month${deadlines.monthsToSRED !== 1 ? 's' : ''} away. Don't leave ${fmtK(sred.totalCredit)} unclaimed.`
            }
          </p>
          <button onClick={() => setShowModal(true)} className="ml-auto flex-shrink-0 bg-white text-gray-900 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            Get started
          </button>
        </div>
      )}

      {/* Hero */}
      <div className="text-center pt-8 pb-6 px-4">
        <div className="inline-flex items-center gap-2 bg-indigo-500/20 text-indigo-300 text-xs font-medium px-3 py-1.5 rounded-full border border-indigo-500/30 mb-4">
          <Sparkles size={12} /> SR&ED + Grants Estimator · CRA 2025/2026 rates
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-3">
          How much Canadian innovation<br className="hidden sm:block" /> funding could you recover?
        </h1>
        <p className="text-slate-400 text-sm max-w-lg mx-auto leading-relaxed">
          Combines SR&ED tax credits with matched grant programs. Includes net ROI after fees, cash timing, and catch-up for missed years.
        </p>
        <div className="flex items-center justify-center gap-3 mt-5 text-xs text-slate-500 flex-wrap">
          <span className="flex items-center gap-2">
            <span className="flex -space-x-1.5">
              {['bg-indigo-400','bg-violet-400','bg-blue-400','bg-emerald-400'].map((c,i) => (
                <span key={i} className={`w-5 h-5 rounded-full ${c} border-2 border-slate-900 inline-block`} />
              ))}
            </span>
            <span>2,400+ companies estimated their claim</span>
          </span>
          <span className="text-slate-700 hidden sm:inline">·</span>
          <span className="hidden sm:inline">Average SR&ED claim: $187K</span>
          <span className="text-slate-700 hidden sm:inline">·</span>
          <span className="hidden sm:inline">Rated 4.9⭐ by SR&ED specialists</span>
        </div>
      </div>

      {/* Quick presets */}
      <div className="max-w-6xl mx-auto px-4 mb-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs text-slate-500 whitespace-nowrap flex-shrink-0">Quick start:</span>
          {PRESETS.map(p => (
            <button key={p.label} onClick={() => applyPreset(p)}
              className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white border border-slate-700 hover:border-indigo-500 hover:bg-indigo-500/10 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap flex-shrink-0">
              <span>{p.icon}</span> {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main grid */}
      <div className="max-w-6xl mx-auto px-4 pb-16 grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── Inputs ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* R&D Team */}
          <div className="bg-white rounded-2xl shadow-xl p-6 space-y-5">
            <h2 className="text-sm font-semibold text-gray-900">R&D team & spend</h2>

            <SliderInput label="R&D Developers" value={numDevs} min={1} max={100} step={1}
              onChange={setNumDevs} format={v => `${v} dev${v !== 1 ? 's' : ''}`} hint="FTE equivalent" />

            <SliderInput label="Average Developer Salary" value={avgSalary} min={60_000} max={300_000} step={5_000}
              onChange={setAvgSalary} format={v => fmtK(v)} hint="CAD / year" />

            <SliderInput label="SR&ED Eligibility" value={eligibilityPct} min={10} max={100} step={5}
              onChange={setEligPct} format={v => `${v}%`} hint="% of dev work qualifying" tipKey="elig">
              {!showDiag && (
                <button onClick={() => setShowDiag(true)}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
                  <HelpCircle size={11} /> Not sure? Answer 4 quick questions →
                </button>
              )}
              {showDiag && (
                <DiagnosticQuiz
                  onResult={v => setEligPct(v)}
                  onClose={() => setShowDiag(false)}
                />
              )}
            </SliderInput>

            <SliderInput label="Contractor / Subcontractor %" value={contractorPct} min={0} max={60} step={5}
              onChange={setContractorPct}
              format={v => v === 0 ? 'All employees' : `${v}% contractors`}
              hint="CRA 80% rule applies" tipKey="contractor" />

            <SliderInput label="Years of R&D Activity" value={yearsRD} min={0} max={10} step={1}
              onChange={setYearsRD}
              format={v => v === 0 ? 'Just starting' : v === 1 ? '1 year' : `${v} years`}
              hint="affects grant eligibility" tipKey="years_rd" />
          </div>

          {/* Company profile */}
          <div className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Company profile</h2>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                <FlaskConical size={13} className="text-gray-400" /> Industry
              </label>
              <select value={industry} onChange={e => setIndustry(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {INDUSTRIES.map(ind => <option key={ind.id} value={ind.id}>{ind.label}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                <MapPin size={13} className="text-gray-400" /> Province
              </label>
              <select value={province} onChange={e => setProvince(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {PROVINCES.map(p => <option key={p.code} value={p.code}>{p.name} ({(p.rate * 100).toFixed(0)}% prov.)</option>)}
              </select>
              {prov && <p className="text-[10px] text-gray-400 leading-relaxed">{prov.note}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                <BarChart3 size={13} className="text-gray-400" /> Annual Revenue
              </label>
              <select value={revenueRange} onChange={e => setRevenueRange(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {REVENUE_RANGES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                <Building2 size={13} className="text-gray-400" /> Corporation type<Tip tipKey="ccpc" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[{ val: true, label:'CCPC', sub:'35% refundable' }, { val: false, label:'Other', sub:'15% non-refund.' }].map(opt => (
                  <button key={String(opt.val)} onClick={() => setIsCCPC(opt.val)}
                    className={`flex flex-col items-center py-2.5 rounded-xl border-2 text-xs font-medium transition-all ${
                      isCCPC === opt.val ? 'border-indigo-600 bg-indigo-50 text-indigo-800' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}>
                    <span className="font-bold text-sm">{opt.label}</span>
                    <span className="text-[10px] mt-0.5 opacity-70">{opt.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                  <GraduationCap size={13} className="text-gray-400" /> University collaboration
                </span>
                <button role="switch" aria-checked={hasUniversity} onClick={() => setHasUniversity(v => !v)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${hasUniversity ? 'bg-indigo-600' : 'bg-gray-200'}`}>
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${hasUniversity ? 'translate-x-4' : 'translate-x-1'}`} />
                </button>
              </label>
              {hasUniversity && <p className="text-[10px] text-indigo-600 mt-1.5 font-medium">✓ Unlocks MITACS + NSERC Engage</p>}
            </div>

            {sred.largeCapWarning && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <Info size={12} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-amber-700 leading-relaxed">At this payroll level, verify combined taxable capital with associated corporations is under $10M to retain the full 35% rate.</p>
              </div>
            )}
          </div>

          {/* Fiscal year & catch-up */}
          <div className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Fiscal year & prior years</h2>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <Calendar size={13} className="text-gray-400" /> Last fiscal year end
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select value={fyMonth} onChange={e => setFyMonth(Number(e.target.value))}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
                <select value={fyYear} onChange={e => setFyYear(Number(e.target.value))}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {[2023,2024,2025].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className={`text-[11px] mt-1 rounded-lg px-3 py-2 flex items-start gap-1.5 ${
                deadlines.expired ? 'bg-red-50 border border-red-200 text-red-700'
                  : deadlines.urgent ? 'bg-amber-50 border border-amber-200 text-amber-700'
                  : 'bg-gray-50 border border-gray-100 text-gray-600'
              }`}>
                <Clock size={11} className="mt-0.5 flex-shrink-0" />
                <span>
                  {deadlines.expired
                    ? `FY${fyYear} SR&ED window closed.`
                    : `SR&ED deadline: ${deadlines.sRedDueStr} · If filed by ${deadlines.t2Due.toLocaleDateString('en-CA',{month:'short',year:'numeric'})}, expect refund ~${deadlines.refundByStr}`
                  }
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <AlertTriangle size={13} className="text-gray-400" /> Prior years never claimed
              </label>
              <div className="flex gap-2">
                {[0,1,2,3].map(n => (
                  <button key={n} onClick={() => setYearsMissed(n)}
                    className={`flex-1 py-2 rounded-xl border-2 text-xs font-semibold transition-all ${
                      yearsMissed === n ? 'border-indigo-600 bg-indigo-50 text-indigo-800' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}>
                    {n === 0 ? 'None' : `${n} yr${n > 1 ? 's' : ''}`}
                  </button>
                ))}
              </div>
              {yearsMissed > 0 && !deadlines.expired && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mt-1">
                  <p className="text-[11px] font-semibold text-emerald-800 mb-1">Potential catch-up claim</p>
                  {catchupYears.map(y => (
                    <div key={y.fyYear} className="flex justify-between text-[11px] text-emerald-700 py-0.5">
                      <span>FY{y.fyYear}</span>
                      <span className="tabular-nums font-medium">{fmtK(y.credit)} ({fmtK(y.refund)} refundable)</span>
                    </div>
                  ))}
                  <div className="border-t border-emerald-200 mt-1.5 pt-1.5 flex justify-between text-xs font-bold text-emerald-900">
                    <span>Total unclaimed</span>
                    <span className="tabular-nums">{fmtK(totalCatchup)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3">
              <Info size={12} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-blue-700 leading-relaxed">
                SR&ED can be claimed retroactively within 18 months of your T2 filing deadline. Catch-up estimates assume similar R&D activity in prior years.
              </p>
            </div>
          </div>
        </div>

        {/* ── Results ── */}
        <div className="lg:col-span-3 relative">
          {/* Email gate overlay */}
          {!emailGated && (
            <EmailGateOverlay
              totalStr={fmtK(animCombined)}
              onUnlock={() => setEmailGated(true)}
            />
          )}

          {/* Results content — blurred until gated */}
          <div className={`space-y-4 transition-all duration-300 ${!emailGated ? 'pointer-events-none select-none blur-sm' : ''}`}>

          {/* Combined hero */}
          <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 text-white shadow-xl">
            <p className="text-indigo-200 text-xs font-medium uppercase tracking-wide mb-1">Total Funding Potential</p>
            <p className="text-5xl font-bold tracking-tight tabular-nums mb-1">{fmtK(animCombined)}</p>
            <p className="text-indigo-200 text-sm">{fmt(sred.totalRefund)} cash refundable · {fmt(sred.taxOffset)} tax offset</p>
            {yearsMissed > 0 && totalCatchup > 0 && (
              <p className="text-indigo-300 text-xs mt-1">+ {fmtK(totalCatchup)} in unclaimed prior years</p>
            )}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-indigo-200 text-[10px] uppercase font-medium mb-1">SR&ED credit</p>
                <p className="text-white font-bold text-xl tabular-nums">{fmtK(animSRED)}</p>
                <p className="text-indigo-300 text-[10px] mt-0.5">{fmt(sred.federalBase)} fed · {fmt(sred.provincialBase)} prov.</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-indigo-200 text-[10px] uppercase font-medium mb-1">Matched grants</p>
                <p className="text-white font-bold text-xl tabular-nums">{fmtK(animGrantsLow)}–{fmtK(animGrants)}</p>
                <p className="text-indigo-300 text-[10px] mt-0.5">conservative–expected · {matchedCount} programs</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-slate-800/60 rounded-xl p-1">
            {[
              { id: 'sred',   label: 'SR&ED',       Icon: TrendingUp },
              { id: 'grants', label: 'Grants',       Icon: Sparkles   },
              { id: 'roi',    label: 'ROI & Timing', Icon: DollarSign },
              { id: 'risk',   label: 'Audit & Risk', Icon: ShieldCheck },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeTab === tab.id ? 'bg-white text-gray-900 shadow' : 'text-slate-400 hover:text-slate-200'
                }`}>
                <tab.Icon size={13} /> {tab.label}
              </button>
            ))}
          </div>

          {/* ── SR&ED Tab ── */}
          {activeTab === 'sred' && (
            <>
              <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
                  <TrendingUp size={15} className="text-indigo-600" /> SR&ED calculation — CRA Proxy Method
                </h3>
                <div className="text-xs divide-y divide-gray-100">
                  {[
                    { label: 'Total developer spend',                                    val: sred.totalSpend,    i: 0 },
                    { label: `  Employee wages (${100 - contractorPct}%)`,               val: sred.empSpend,      i: 1 },
                    { label: `  Contractor payments (${contractorPct}%)`,                val: sred.ctorSpend,     i: 1 },
                    { label: `Eligible employee wages (${eligibilityPct}%)`,             val: sred.empEligible,   i: 0 },
                    { label: `Eligible contractor costs (80% × ${eligibilityPct}%)`,     val: sred.ctorEligible,  i: 0 },
                    { label: 'Prescribed Proxy Amount (55% of eligible employee wages)', val: sred.overheadProxy, i: 1 },
                    { label: 'Total Qualifying Expenditure',                             val: sred.totalQE,       i: 0, bold: true },
                  ].map((row, idx) => (
                    <div key={idx} className={`flex items-center justify-between py-2 ${row.i === 1 ? 'pl-4' : ''}`}>
                      <span className={row.bold ? 'text-gray-900 font-semibold' : row.i === 1 ? 'text-gray-400' : 'text-gray-600'}>{row.label}</span>
                      <span className={`tabular-nums ${row.bold ? 'text-gray-900 font-bold' : row.i === 1 ? 'text-gray-400' : 'text-gray-700'}`}>{fmt(row.val)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                  {[
                    { label: `Federal ITC — ${isCCPC ? '35% CCPC' : '15%'}`, amount: sred.federalBase, color: 'bg-indigo-500',
                      sub: isCCPC ? 'Fully refundable — paid as cash even with no tax owing' : 'Non-refundable — reduces federal tax payable' },
                    { label: `${prov?.name} — ${(prov?.rate * 100).toFixed(0)}% provincial`, amount: sred.provincialBase, color: 'bg-violet-400',
                      sub: prov?.refundable ? 'Refundable provincial credit' : 'Non-refundable — offsets provincial tax' },
                  ].map((bar, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-gray-700">{bar.label}</span>
                        <span className="font-bold text-gray-900 tabular-nums">{fmt(bar.amount)}</span>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${bar.color}`}
                          style={{ width: `${sred.totalCredit > 0 ? (bar.amount / sred.totalCredit) * 100 : 0}%` }} />
                      </div>
                      <p className="text-[10px] text-gray-400">{bar.sub}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-3">
                  {[
                    { label: 'Total credit / dev', val: fmtK(numDevs > 0 ? sred.totalCredit / numDevs : 0) },
                    { label: 'Cash refund / dev',  val: fmtK(numDevs > 0 ? sred.totalRefund  / numDevs : 0) },
                    { label: 'Net dev cost',        val: fmtK(numDevs > 0 ? (sred.totalSpend - sred.totalRefund) / numDevs : 0) },
                  ].map((item, i) => (
                    <div key={i} className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-gray-500 font-medium mb-1">{item.label}</p>
                      <p className="text-sm font-bold text-gray-900 tabular-nums">{item.val}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sensitivity */}
              <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-1">
                  <Target size={15} className="text-indigo-600" /> Eligibility sensitivity
                </h3>
                <p className="text-[11px] text-gray-400 mb-4">SR&ED eligibility % is the most contested variable in a CRA review.</p>
                <div className="overflow-hidden rounded-xl border border-gray-100">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wide">
                      <th className="px-4 py-2.5 text-left font-medium">Scenario</th>
                      <th className="px-4 py-2.5 text-right font-medium">Eligibility</th>
                      <th className="px-4 py-2.5 text-right font-medium">SR&ED Credit</th>
                      <th className="px-4 py-2.5 text-right font-medium">Cash Refund</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {scenarios.map((s, i) => (
                        <tr key={i} className={s.pct === eligibilityPct ? 'bg-indigo-50' : ''}>
                          <td className={`px-4 py-2.5 font-medium ${s.pct === eligibilityPct ? 'text-indigo-700' : 'text-gray-700'}`}>
                            {s.label} {s.pct === eligibilityPct && <span className="text-[10px] opacity-60">← current</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{s.pct}%</td>
                          <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${s.pct === eligibilityPct ? 'text-indigo-700' : 'text-gray-800'}`}>{fmtK(s.totalCredit)}</td>
                          <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${s.pct === eligibilityPct ? 'text-indigo-700' : 'text-gray-800'}`}>{fmtK(s.totalRefund)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-gray-400 mt-2">TaxLift's commit-level evidence helps defend the optimistic scenario at CRA review.</p>
              </div>

              {/* 3-year SR&ED projection */}
              <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-1">
                  <TrendingUp size={15} className="text-indigo-600" /> 3-year SR&ED projection
                </h3>
                <p className="text-[11px] text-gray-400 mb-4">10% annual headcount growth assumed. Grants shown Year 1 only.</p>
                <div className="space-y-3">
                  {[
                    { yr:'Year 1', sred: sred.totalCredit, grants: grantsTotal, devs: numDevs },
                    { yr:'Year 2', sred: yr2.totalCredit,  grants: 0,           devs: Math.round(numDevs * 1.10) },
                    { yr:'Year 3', sred: yr3.totalCredit,  grants: 0,           devs: Math.round(numDevs * 1.21) },
                  ].map((row, i) => {
                    const rowTotal = row.sred + row.grants
                    const maxTotal = sred.totalCredit + yr3.totalCredit + grantsTotal
                    return (
                      <div key={i} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-gray-700">{row.yr} — {row.devs} devs</span>
                          <div className="flex items-center gap-3">
                            {row.grants > 0 && <span className="text-violet-500 tabular-nums">+{fmtK(row.grants)} grants</span>}
                            <span className="font-bold text-gray-900 tabular-nums">{fmtK(rowTotal)}</span>
                          </div>
                        </div>
                        <div className="h-4 bg-gray-100 rounded-full overflow-hidden flex">
                          <div className="h-full bg-indigo-500 transition-all duration-500"
                            style={{ width: `${maxTotal > 0 ? (row.sred / maxTotal) * 100 : 0}%` }} />
                          {row.grants > 0 && <div className="h-full bg-violet-400 transition-all duration-500"
                            style={{ width: `${maxTotal > 0 ? (row.grants / maxTotal) * 100 : 0}%` }} />}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-4 flex items-center gap-4 text-[10px] text-gray-500">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" /> SR&ED</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-violet-400 inline-block" /> Grants</span>
                  <span className="ml-auto font-semibold text-gray-800 text-xs">3-yr total: {fmtK(threeYearSRED + grantsTotal)}</span>
                </div>
              </div>
            </>
          )}

          {/* ── Grants Tab ── */}
          {activeTab === 'grants' && (
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Sparkles size={15} className="text-violet-600" /> Matched grant programs
                </h3>
                {matchedCount > 0 && (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    {matchedCount} matched · {fmtK(grantsTotal)}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {[...highGrants, ...medGrants].map(g => (
                  <GrantCard key={g.id} grant={g} expanded={expandedGrant === g.id}
                    onToggle={() => setExpandedGrant(expandedGrant === g.id ? null : g.id)} />
                ))}
                {lowGrants.length > 0 && (
                  <details className="group">
                    <summary className="text-[11px] text-gray-400 cursor-pointer hover:text-gray-600 py-1.5 list-none flex items-center gap-1">
                      <ChevronDown size={12} className="group-open:rotate-180 transition-transform" />
                      {lowGrants.length} program{lowGrants.length > 1 ? 's' : ''} unlikely with current profile
                    </summary>
                    <div className="mt-2 space-y-2">
                      {lowGrants.map(g => (
                        <GrantCard key={g.id} grant={g} expanded={expandedGrant === g.id}
                          onToggle={() => setExpandedGrant(expandedGrant === g.id ? null : g.id)} />
                      ))}
                    </div>
                  </details>
                )}
                <div className="flex items-start gap-2 bg-violet-50 border border-violet-100 rounded-lg p-3 mt-2">
                  <Lock size={12} className="text-violet-400 mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-violet-700 leading-relaxed">
                    All listed grants stack with SR&ED — they are not double-counted. Estimates are conservative; actuals depend on program competition and project scope.
                  </p>
                </div>
                <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <Info size={12} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    <strong className="text-gray-700">Why we show ranges:</strong> Grant amounts depend on program competition, reviewer discretion, and your specific project narrative. Conservative = ~50% of expected. Expected = based on program averages for qualifying companies. Some programs show "–" when approval is uncertain.
                  </p>
                </div>
                {!hasUniversity && (
                  <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <GraduationCap size={12} className="text-blue-500 mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-blue-700 leading-relaxed">
                      <strong>Unlock MITACS + NSERC Engage:</strong> toggle "University collaboration" on the left to reveal {fmtK(45_000)} in easy-to-obtain grants.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── ROI & Timing Tab ── */}
          {activeTab === 'roi' && (
            <>
              {/* Net ROI card — the #1 question every prospect has */}
              <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
                  <DollarSign size={15} className="text-indigo-600" /> What does TaxLift actually cost?
                </h3>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  {/* TaxLift */}
                  <div className="rounded-xl border-2 border-indigo-500 bg-indigo-50 p-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <ShieldCheck size={14} className="text-indigo-600" />
                      <p className="text-xs font-bold text-indigo-900">TaxLift {taxliftPlan === 'plus' ? 'Plus' : 'Starter'}</p>
                      <span className="text-[9px] bg-indigo-600 text-white rounded px-1.5 py-0.5 font-medium">Recommended</span>
                    </div>
                    <p className="text-2xl font-bold text-indigo-700 tabular-nums">{fmtK(netWithTaxlift)}</p>
                    <p className="text-[10px] text-indigo-600 mt-0.5">net of {fmt(taxliftAnnualFee)} TaxLift fee</p>
                    <div className="mt-3 space-y-1 text-[10px] text-indigo-700">
                      <div className="flex justify-between"><span>SR&ED + grants</span><span className="tabular-nums font-medium">+ {fmtK(combinedTotal)}</span></div>
                      <div className="flex justify-between"><span>TaxLift fee (flat $999)</span><span className="tabular-nums">− {fmt(taxliftAnnualFee)}</span></div>
                      <div className="flex justify-between border-t border-indigo-200 pt-1 font-bold"><span>Net benefit</span><span className="tabular-nums">{fmtK(netWithTaxlift)}</span></div>
                    </div>
                  </div>

                  {/* Traditional consultant */}
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Building2 size={14} className="text-gray-500" />
                      <p className="text-xs font-bold text-gray-700">Traditional SR&ED Firm</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-700 tabular-nums">{fmtK(netTraditional)}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">net of ~20% contingency fee</p>
                    <div className="mt-3 space-y-1 text-[10px] text-gray-600">
                      <div className="flex justify-between"><span>SR&ED only (no grants)</span><span className="tabular-nums font-medium">+ {fmtK(sred.totalCredit)}</span></div>
                      <div className="flex justify-between"><span>20% contingency fee</span><span className="tabular-nums">− {fmt(traditionalFee)}</span></div>
                      <div className="flex justify-between border-t border-gray-200 pt-1 font-bold"><span>Net benefit</span><span className="tabular-nums">{fmtK(netTraditional)}</span></div>
                    </div>
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-emerald-900">You keep {fmtK(taxliftSaving)} more with TaxLift</p>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      {taxliftROI}× ROI on the platform fee · Plus you get grants that a traditional SR&ED firm won't touch
                    </p>
                  </div>
                  <Zap size={24} className="text-emerald-500 flex-shrink-0" />
                </div>
              </div>

              {/* 2-column: Cash timeline + Time investment */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Cash flow timeline */}
                <div className="bg-white rounded-2xl shadow-xl p-5">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
                    <Clock size={15} className="text-indigo-600" /> When you get paid
                  </h3>
                  <div className="space-y-3">
                    {[
                      { icon: Calendar,     color: 'bg-indigo-100 text-indigo-700',   label: `FY${fyYear} end`,          date: MONTHS[fyMonth - 1].slice(0,3) + ' ' + fyYear, urgent: false },
                      { icon: CheckCircle2, color: 'bg-blue-100 text-blue-700',       label: 'T2 return due',            date: deadlines.t2Due.toLocaleDateString('en-CA',{month:'short',year:'numeric'}), urgent: false },
                      { icon: Target,       color: 'bg-violet-100 text-violet-700',   label: 'SR&ED deadline',           date: deadlines.sRedDueStr, urgent: deadlines.urgent || deadlines.expired },
                      { icon: DollarSign,   color: 'bg-emerald-100 text-emerald-700', label: `Refund arrives (~${fmt(sred.totalRefund)})`, date: deadlines.expired ? 'Window closed' : deadlines.refundByStr, urgent: false },
                    ].map((step, i) => {
                      const StepIcon = step.icon
                      return (
                        <div key={i} className="flex items-center gap-2.5">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${step.color}`}>
                            <StepIcon size={11} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium text-gray-700 truncate">{step.label}</p>
                          </div>
                          <p className={`text-[11px] font-bold tabular-nums flex-shrink-0 ${step.urgent ? 'text-amber-600' : 'text-gray-700'}`}>{step.date}</p>
                        </div>
                      )
                    })}
                  </div>
                  {deadlines.urgent && (
                    <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[10px] text-amber-700 font-medium">
                      ⚠️ {deadlines.monthsToSRED} months remaining to file
                    </div>
                  )}
                </div>

                {/* Time investment */}
                <div className="bg-white rounded-2xl shadow-xl p-5">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
                    <Timer size={15} className="text-indigo-600" /> Your time commitment
                  </h3>
                  <div className="space-y-3">
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                      <div className="flex items-baseline gap-1.5 mb-2">
                        <p className="text-2xl font-bold text-indigo-700">4–8</p>
                        <p className="text-xs text-indigo-600 font-medium">hrs · With TaxLift</p>
                      </div>
                      {['30 min — Connect GitHub','2 hrs — Review flagged commits','1 hr — SR&ED interview','1 hr — Review & sign T661'].map(t => (
                        <div key={t} className="flex items-center gap-1.5 text-[10px] text-indigo-700 py-0.5">
                          <Check size={9} className="text-emerald-500 flex-shrink-0" />{t}
                        </div>
                      ))}
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                      <div className="flex items-baseline gap-1.5 mb-2">
                        <p className="text-2xl font-bold text-gray-500">60–80</p>
                        <p className="text-xs text-gray-500 font-medium">hrs · Traditional firm</p>
                      </div>
                      {['10–15 hrs — Document tech work','10 hrs — Consultant interviews','15 hrs — Review narratives','20+ hrs — CRA correspondence'].map(t => (
                        <div key={t} className="flex items-center gap-1.5 text-[10px] text-gray-500 py-0.5">
                          <X size={9} className="text-red-400 flex-shrink-0" />{t}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Prior years catch-up in ROI tab */}
              {yearsMissed > 0 && totalCatchup > 0 && (
                <div className="bg-white rounded-2xl shadow-xl p-6">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-1">
                    <AlertTriangle size={15} className="text-amber-500" /> Prior years catch-up
                  </h3>
                  <p className="text-[11px] text-gray-400 mb-4">Money already earned — just never claimed. Each year's window is still open for the deadlines shown.</p>
                  <div className="space-y-3">
                    {catchupYears.map((y, i) => {
                      const fy      = new Date(y.fyYear, fyMonth - 1, 1)
                      const t2      = new Date(fy); t2.setMonth(t2.getMonth() + 6)
                      const window  = new Date(t2); window.setMonth(window.getMonth() + 18)
                      const today   = new Date(2026, 2, 23)
                      const expired = window < today
                      const moLeft  = Math.round((window - today) / (1000 * 60 * 60 * 24 * 30.44))
                      return (
                        <div key={i} className={`rounded-xl border p-4 ${expired ? 'border-red-200 bg-red-50' : moLeft <= 6 ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-bold text-gray-900">FY{y.fyYear}</p>
                              <p className={`text-[11px] ${expired ? 'text-red-600' : moLeft <= 6 ? 'text-amber-600 font-medium' : 'text-gray-500'}`}>
                                {expired ? '⚠️ Window closed' : `Filing deadline: ${window.toLocaleDateString('en-CA',{month:'long',year:'numeric'})} · ${moLeft} month${moLeft !== 1 ? 's' : ''} left`}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-base font-bold text-gray-900 tabular-nums">{fmtK(y.credit)}</p>
                              <p className="text-[10px] text-gray-500">{fmtK(y.refund)} refundable</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-emerald-900">Total catch-up potential</p>
                      <p className="text-[11px] text-emerald-700">This year's claim + prior years = {fmtK(sred.totalCredit + totalCatchup)}</p>
                    </div>
                    <p className="text-xl font-bold text-emerald-700 tabular-nums">{fmtK(totalCatchup)}</p>
                  </div>
                </div>
              )}

            </>
          )}

          {/* ── Audit & Risk Tab ── */}
          {activeTab === 'risk' && (() => {
            const riskLabel    = riskScore <= 1 ? 'Low' : riskScore <= 3 ? 'Medium' : 'Elevated'
            const riskText     = riskScore <= 1 ? 'text-emerald-700' : riskScore <= 3 ? 'text-amber-700' : 'text-red-700'
            const riskBg       = riskScore <= 1 ? 'bg-emerald-50 border-emerald-200' : riskScore <= 3 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
            const barColor     = riskScore <= 1 ? 'bg-emerald-500' : riskScore <= 3 ? 'bg-amber-500' : 'bg-red-500'
            const factors = [
              { flag: yearsRD <= 1,               label: 'First-time claimant',                    detail: 'CRA reviews first-time claims more closely to verify the R&D program is real and ongoing.' },
              { flag: contractorPct > 30,          label: `High contractor use (${contractorPct}%)`, detail: 'Contractor costs above 30% are frequently challenged. CRA requires arm\u2019s-length invoices and payment records.' },
              { flag: eligibilityPct > 80,         label: `High eligibility % (${eligibilityPct}%)`, detail: 'Very high eligibility claims attract closer narrative scrutiny — reviewers want uncertainty documented in real time.' },
              { flag: industry === 'software',     label: 'Software industry',                      detail: 'Software SR&ED claims require stronger technical narratives than hardware or biotech claims.' },
              { flag: sred.totalCredit > 200_000,  label: `Large claim (${fmtK(sred.totalCredit)})`, detail: 'CRA dedicates more review resources to claims above $200K.' },
            ]
            return (
              <>
                {/* Card 1: Personal risk profile */}
                <div className="bg-white rounded-2xl shadow-xl p-6">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
                    <ShieldCheck size={15} className="text-indigo-600" /> Your CRA audit risk profile
                  </h3>
                  <div className={`rounded-xl border p-4 mb-4 ${riskBg}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-xl font-bold ${riskText}`}>{riskLabel} risk</p>
                        <p className={`text-[11px] mt-0.5 ${riskText} opacity-80`}>{riskScore} of 5 risk factors present</p>
                      </div>
                      <div className="flex gap-1 items-end">
                        {[0,1,2,3,4].map(i => (
                          <div key={i} className={`w-3 rounded-sm transition-all ${i < riskScore ? barColor : 'bg-gray-200'}`}
                            style={{ height: `${14 + i * 6}px` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {factors.map((f, i) => (
                      <div key={i} className={`flex items-start gap-3 rounded-lg px-3 py-2.5 border ${f.flag ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                        <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${f.flag ? 'bg-red-100' : 'bg-emerald-100'}`}>
                          {f.flag
                            ? <AlertTriangle size={9} className="text-red-600" />
                            : <Check size={9} className="text-emerald-600" />
                          }
                        </div>
                        <div className="min-w-0">
                          <p className={`text-[11px] font-semibold ${f.flag ? 'text-red-800' : 'text-gray-600'}`}>{f.label}</p>
                          {f.flag && <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{f.detail}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card 2: CRA review stats */}
                <div className="bg-white rounded-2xl shadow-xl p-6">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
                    <BarChart3 size={15} className="text-indigo-600" /> CRA audit — by the numbers
                  </h3>
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {[
                      { stat: '~15%', label: 'of SR&ED claims receive a detailed CRA review',    color: 'text-amber-600' },
                      { stat: '~40%', label: 'of reviewed claims have credits reduced or denied', color: 'text-red-600'   },
                      { stat: '$31K', label: 'average credits lost per adjusted claim',            color: 'text-gray-800'  },
                    ].map((item, i) => (
                      <div key={i} className="bg-gray-50 rounded-xl p-3 text-center">
                        <p className={`text-xl font-bold ${item.color} tabular-nums`}>{item.stat}</p>
                        <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">{item.label}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs font-semibold text-gray-800 mb-2">What CRA reviewers look for:</p>
                  <div className="space-y-1.5">
                    {[
                      'Proof of technological uncertainty — what was the specific knowledge gap?',
                      'Systematic investigation — experiments, iterations, dead-ends documented in real time',
                      'Contemporaneous records — tickets, commits, design docs (not reconstructed after the fact)',
                      'Clear separation of SR&ED vs. routine commercial work',
                      'Arm\u2019s-length documentation for all contractor and subcontractor costs',
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-2 text-[11px] text-gray-600">
                        <ChevronRight size={10} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card 3: What happens in an audit */}
                <div className="bg-white rounded-2xl shadow-xl p-6">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
                    <Info size={15} className="text-indigo-600" /> What happens if CRA challenges your claim?
                  </h3>
                  <div className="space-y-4">
                    {[
                      { step:'1', color:'bg-blue-100 text-blue-700',   title:'Initial desk review',   desc:'CRA reviews your T661 form and may send a letter requesting clarification — usually 3–6 months after filing. Most claims clear this stage without issue.' },
                      { step:'2', color:'bg-amber-100 text-amber-700', title:'Field review',           desc:'A CRA R&D officer interviews your developers and reviews commit logs, design docs, and test records. Well-documented claims typically resolve here.' },
                      { step:'3', color:'bg-orange-100 text-orange-700',title:'Proposed adjustment',  desc:'CRA may propose reducing or disallowing part of your claim. You have 30 days to provide additional evidence before the adjustment is finalized.' },
                      { step:'4', color:'bg-purple-100 text-purple-700',title:'Notice of Objection',  desc:'File within 90 days of the assessment. ~60% of SR&ED objections are resolved in the taxpayer\u2019s favour with proper documentation and specialist support.' },
                    ].map((s, i) => (
                      <div key={i} className="flex gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[11px] font-bold ${s.color}`}>{s.step}</div>
                        <div>
                          <p className="text-[11px] font-semibold text-gray-900">{s.title}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{s.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card 4: How TaxLift reduces risk */}
                <div className="bg-white rounded-2xl shadow-xl p-6">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-1">
                    <ShieldCheck size={15} className="text-emerald-600" /> How TaxLift reduces your audit risk
                  </h3>
                  <p className="text-[11px] text-gray-400 mb-4">Every TaxLift claim is built to survive a CRA field review from day one.</p>
                  <div className="space-y-2.5">
                    {[
                      { icon:'🔗', title:'Commit-level evidence trail',     desc:'Every claimed hour links to a specific Git commit, PR, or ticket — the gold standard for CRA documentation.' },
                      { icon:'📋', title:'Structured T661 narratives',      desc:'Specialists write claim narratives that pass the four-part CRA test: hypothesis, uncertainty, systematic investigation, technological advancement.' },
                      { icon:'⚖️', title:'Conservative eligibility review', desc:'We flag routine vs. qualifying work before filing — not after a challenge — so you claim confidently without over-reaching.' },
                      { icon:'🛡️', title:'Audit support included',          desc:'If CRA reviews your claim, TaxLift specialists respond to information requests and attend field reviews at no additional cost.' },
                      { icon:'📊', title:'Contractor documentation',         desc:'Arm\u2019s-length contractor evidence (contracts, invoices, payment records) is verified complete before filing — eliminating the most common challenge point.' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-3 bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                        <span className="text-base flex-shrink-0">{item.icon}</span>
                        <div>
                          <p className="text-[11px] font-semibold text-emerald-900">{item.title}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )
          })()}

          {/* CTA */}
          <div className="bg-gradient-to-br from-slate-800 to-indigo-950 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-white font-bold text-base">
                  Ready to claim your {fmtK(combinedTotal + totalCatchup)}?
                </p>
                <p className="text-slate-400 text-xs mt-1 max-w-xs leading-relaxed">
                  {yearsMissed > 0 ? `Includes ${fmtK(totalCatchup)} in unclaimed prior years. ` : ''}
                  TaxLift automates SR&ED evidence, grant matching, T661 narratives, and CPA handoff.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    `${fmtK(sred.totalRefund)} cash refundable`,
                    `${taxliftROI}× ROI on TaxLift fee`,
                    `~${deadlines.monthsToSRED > 0 ? deadlines.monthsToSRED : '?'} months to file`,
                    ...(riskScore >= 2 ? ['Audit protection included'] : []),
                  ].map(t => (
                    <span key={t} className={`flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full border ${
                      t === 'Audit protection included'
                        ? 'text-amber-300 bg-amber-900/40 border-amber-700/40'
                        : 'text-emerald-300 bg-emerald-900/40 border-emerald-700/40'
                    }`}>
                      {t === 'Audit protection included' ? <ShieldCheck size={10} /> : <Check size={10} />} {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                <button onClick={() => setShowModal(true)}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl whitespace-nowrap transition-colors">
                  Get free review <ChevronRight size={14} />
                </button>
                <button onClick={() => navigate('/login')} className="text-xs text-slate-400 hover:text-slate-200 text-center transition-colors">
                  Have an account? Sign in
                </button>
              </div>
            </div>
          </div>
          {/* end results content */}
        </div>
        {/* end results relative wrapper */}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center pb-8 text-[11px] text-slate-500 px-4 max-w-2xl mx-auto">
        Not tax or legal advice. SR&ED estimates use the CRA Prescribed Proxy Amount method (IT-151R5).
        Contractor costs reflect 80% arm's-length rule. Grant amounts are indicative program maximums, not guaranteed.
        Filing deadlines are estimates — confirm exact dates with your accountant.
      </div>

      {showModal && <LeadModal totalStr={fmtK(combinedTotal + totalCatchup)} onClose={() => setShowModal(false)} />}
    </div>
  )
}

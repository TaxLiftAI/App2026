/**
 * stripe.js — client-side Stripe initialisation + plan config
 *
 * Pricing model (performance-based):
 *   PERFORMANCE_RATE      — 3% of the customer's estimated SR&ED credit (Starter)
 *   PERFORMANCE_RATE_PLUS — 5% of the customer's estimated SR&ED credit (Plus)
 *
 * CPA partner referral fees (flat, paid at T661 package delivery — not % contingency):
 *   CPA_REFERRAL_TIERS — tiered flat fees by credit size range
 *   CPA_PLUS_BONUS     — additional $750 when client is on Plus plan
 *   calcCpaFee()       — returns the applicable flat fee for a given credit estimate + plan
 *
 * Two product tracks:
 *   PLANS       — Feature tiers (Starter / Plus / Enterprise)
 *   CLAIM_PLANS — Pay-per-claim (self-serve SMBs, first-time filers)
 *
 * Stripe billing: variable one-time invoice per customer, amount = credit_estimate × rate
 *
 * Usage:
 *   import { PLANS, CLAIM_PLANS, PERFORMANCE_RATE, calcCpaFee, redirectToCheckout } from '../lib/stripe'
 */
import { loadStripe } from '@stripe/stripe-js'
import { billing } from './api'

// ── Performance pricing rates ─────────────────────────────────────────────────
export const PERFORMANCE_RATE      = 0      // legacy — pricing is now $999 flat
export const PERFORMANCE_RATE_PLUS = 0      // legacy — CPA Partner Seat is $4,800/yr
export const FLAT_FEE              = 999    // SR&ED Filing Package flat fee (CAD)
export const CPA_PARTNER_FEE       = 4800   // CPA Partner Seat annual fee (CAD)
export const CPA_REFERRAL_COMMISSION = 300  // per referred client (CAD)

// ── CPA partner referral fees (flat, paid at T661 package delivery) ───────────
// Flat structure avoids CPA Canada Rule 205 independence concerns that arise
// from % contingency fees tied to SR&ED claim outcomes.
//
// Tier thresholds are based on the TaxLift scan estimate of the SR&ED credit.
// Fee is paid when the CPA-ready T661 package is delivered — not on CRA assessment.
export const CPA_REFERRAL_TIERS = [
  { maxCredit:   75_000, fee:   750 },  // $0–$75K credit estimate
  { maxCredit:  150_000, fee: 1_500 },  // $75K–$150K credit estimate
  { maxCredit:  300_000, fee: 3_000 },  // $150K–$300K credit estimate
  { maxCredit:  600_000, fee: 5_500 },  // $300K–$600K credit estimate
  { maxCredit: Infinity, fee: 9_000 },  // $600K+ credit estimate
]

// Additional flat bonus when the referred client is on the Plus plan (SR&ED + Grants)
export const CPA_PLUS_BONUS = 750

/**
 * calcCpaFee — returns the flat CPA referral fee for a given credit estimate + plan.
 *
 * @param {number} creditEstimate — estimated SR&ED credit (CAD) from TaxLift scan
 * @param {string} planId         — 'starter' | 'plus'
 * @returns {number}              — flat referral fee in CAD
 */
export function calcCpaFee(creditEstimate, planId = 'starter') {
  const tier = CPA_REFERRAL_TIERS.find(t => creditEstimate <= t.maxCredit) ?? CPA_REFERRAL_TIERS.at(-1)
  return tier.fee + (planId === 'plus' ? CPA_PLUS_BONUS : 0)
}

// ── Stripe instance (singleton promise) ───────────────────────────────────────
let stripePromise = null

export function getStripe() {
  const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  if (!key || key.startsWith('pk_test_placeholder')) {
    if (import.meta.env.PROD) console.warn('[stripe] VITE_STRIPE_PUBLISHABLE_KEY is not set — Stripe Elements will be unavailable.')
    return null
  }
  if (!stripePromise) stripePromise = loadStripe(key)
  return stripePromise
}

// ── Option A: Subscription plans ──────────────────────────────────────────────
export const PLANS = {
  starter: {
    id:   'starter',
    name: 'SR&ED Filing Package',

    // ── Flat fee: $999 per fiscal year ───────────────────────────────────────
    price:         '$999',
    period:        'per fiscal year',
    priceDetail:   'One-time flat fee — no percentage of your refund',
    priceId:       import.meta.env.VITE_STRIPE_PRICE_STARTER ?? null,

    description:   'Everything you need to file SR&ED — flat fee, keep your full refund.',
    features: [
      'Unlimited SR&ED clusters',
      'AI T661 narrative generation',
      'GitHub & Jira integrations',
      'CPA-ready handoff package PDF',
      'SHA-256 commit evidence chain',
      'Audit vault — 3 years retained',
      'Prior-year catch-up (18 months)',
      'Email support',
    ],
    cta:            'Get started — $999',
    highlighted:    true,
    badge:          'Flat fee',
    grantsIncluded: false,
  },

  plus: {
    id:   'plus',
    name: 'CPA Partner Seat',

    // ── CPA partner: $4,800/yr with $300 referral commission ─────────────────
    price:       '$4,800',
    period:      'per year',
    priceDetail: '$300 referral commission per client you bring on',
    priceId:     import.meta.env.VITE_STRIPE_PRICE_PLUS ?? null,

    description:   'For CPA firms — add SR&ED as a service and earn $300 per client referral.',
    features: [
      'Unlimited client workspaces',
      'White-label CPA handoff experience',
      '$300 commission per referred client',
      'Co-branded intake link',
      'Client pipeline dashboard',
      'Priority support & onboarding',
      '✦ More grants coming soon: NRC-IRAP, SDTC, OITC, Mitacs',
    ],
    cta:            'Apply for partner seat',
    highlighted:    false,
    badge:          'CPA Partners',
    grantsIncluded: false,
  },

  enterprise: {
    id:   'enterprise',
    name: 'Enterprise',

    price:       'Custom',
    period:      '',
    priceDetail: null,
    priceId:     null,

    description: 'White-label deployment, API access, and a dedicated CPA partner for large firms.',
    features: [
      'Everything in CPA Partner',
      'White-label portal with your branding',
      'API access for custom integrations',
      'Dedicated account manager',
      'SSO / SAML + on-prem deployment',
      'Custom volume commission rates',
      'SLA-backed uptime guarantee',
    ],
    cta:            'Contact sales',
    highlighted:    false,
    badge:          null,
    grantsIncluded: false,
  },
}

// ── Legacy exports — kept so stray imports don't break at build time ──────────
export const CLAIM_PLANS = {}

// ── Resolve plan display (billing period toggle no longer applies — kept for compat) ──
export function getPlanForBilling(plan, _billingPeriod) {
  return plan
}

// ── Calculate the fee — now flat $999 regardless of credit estimate ───────────
// Kept for backward compat with any callers that pass a credit estimate.
export function calcFee(_creditEstimate, _planId = 'starter') {
  return 999
}

/**
 * redirectToCheckout — sends the user to Stripe Checkout for annual payment.
 *
 * @param {string} planId         — 'starter' | 'plus'
 * @param {number} creditEstimate — customer's SR&ED credit estimate in CAD
 *                                  Server calculates fee = estimate × rate
 *                                  and validates against DB-stored scan data.
 */
export async function redirectToCheckout(planId, creditEstimate = 0) {
  if (!PLANS[planId] || planId === 'enterprise') {
    return { ok: false, message: 'Invalid plan' }
  }

  try {
    const data = await billing.createCheckoutSession(
      planId,
      `${window.location.origin}/success?plan=${planId}`,
      `${window.location.origin}/cancel?plan=${planId}`,
      creditEstimate,
    )

    if (data?.url) {
      window.location.href = data.url
      return { ok: true }
    }

    return { ok: false, message: data?.message ?? 'No checkout URL returned' }
  } catch (err) {
    console.error('[stripe] redirectToCheckout error:', err)
    return { ok: false, message: err?.message ?? 'Checkout failed' }
  }
}

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
export const PERFORMANCE_RATE      = 0.03   // 3% — Starter plan
export const PERFORMANCE_RATE_PLUS = 0.05   // 5% — Plus plan (includes Grants module)

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
    name: 'Starter',

    // ── Performance pricing: 3% of estimated SR&ED credit ────────────────────
    price:         '3%',
    period:        'of your SR&ED credit',
    priceDetail:   'e.g. $150K credit → $4,500 fee',
    priceId:       import.meta.env.VITE_STRIPE_PRICE_STARTER ?? null,

    // Legacy flat-rate price IDs kept for reference (no longer displayed):
    priceIdSemiAnnual: import.meta.env.VITE_STRIPE_PRICE_STARTER_SEMI    ?? null,
    priceIdMonthly:    import.meta.env.VITE_STRIPE_PRICE_STARTER_MONTHLY ?? null,

    description:   'SR&ED automation for Canadian tech companies making their first claim.',
    features: [
      'Unlimited SR&ED clusters',
      'AI narrative generation',
      'Narrative quality scoring (5 dimensions)',
      'GitHub & Jira integrations',
      'CPA handoff package PDF',
      'Evidence chain of custody',
      'Audit vault — 3 years retained',
      'Email support',
    ],
    cta:            'Start 14-day free trial',
    highlighted:    false,
    badge:          null,
    grantsIncluded: false,
  },

  plus: {
    id:   'plus',
    name: 'Plus',

    // ── Performance pricing: 5% of estimated SR&ED credit ────────────────────
    price:       '5%',
    period:      'of your SR&ED credit',
    priceDetail: 'e.g. $150K credit → $7,500 fee · includes Grants module',
    priceId:     import.meta.env.VITE_STRIPE_PRICE_PLUS ?? null,

    // Legacy flat-rate price IDs kept for reference (no longer displayed):
    priceIdSemiAnnual: import.meta.env.VITE_STRIPE_PRICE_PLUS_SEMI    ?? null,
    priceIdMonthly:    import.meta.env.VITE_STRIPE_PRICE_PLUS_MONTHLY ?? null,

    description:   'SR&ED + Grants module — unlock up to $4M+ in additional Canadian innovation funding.',
    features: [
      'Everything in Starter',
      '✦ Grants module — 9 programs matched automatically',
      '✦ NRC-IRAP, OITC, NGen + provincial programs',
      '✦ Gap-fill interview & AI section drafting',
      '✦ Application tracker with deadline alerts',
      'CPA referral portal & commission tracking',
      'Audit-ready document vault',
      'Priority Slack support',
    ],
    cta:            'Start 14-day free trial',
    highlighted:    true,
    badge:          'Most popular',
    grantsIncluded: true,
  },

  enterprise: {
    id:   'enterprise',
    name: 'Enterprise',

    price:       'Custom',
    period:      '',
    priceDetail: null,
    priceId:     null,

    description: 'Everything in Plus — white-label, API access, and a dedicated CPA partner.',
    features: [
      'Everything in Plus',
      'White-label CPA portal',
      'API access for custom integrations',
      'Dedicated CPA partner & account manager',
      'SSO / SAML + on-prem deployment',
      'Custom AI fine-tuning',
      'SLA-backed uptime guarantee',
      'Volume commission rates',
    ],
    cta:            'Contact sales',
    highlighted:    false,
    badge:          null,
    grantsIncluded: true,
  },
}

// ── Pay-per-claim removed — model is annual 3%/5% of credit estimate ──────────
// Empty export kept so any stray import { CLAIM_PLANS } doesn't break at build time.
export const CLAIM_PLANS = {}

// ── Resolve plan display (billing period no longer changes price — kept for compat) ──
export function getPlanForBilling(plan, _billingPeriod) {
  return plan  // performance pricing: price is always 3% of credit
}

// ── Calculate the fee for a given credit estimate ─────────────────────────────
// Fee is based on the conservative scan estimate (not actual CRA assessment).
// If actual CRA assessment comes in >30% below estimate, partial refund policy applies.
export function calcFee(creditEstimate, planId = 'starter') {
  const rate = planId === 'plus' ? PERFORMANCE_RATE_PLUS : PERFORMANCE_RATE
  return Math.round(creditEstimate * rate)
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

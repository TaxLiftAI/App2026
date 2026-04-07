/**
 * stripe.js — client-side Stripe initialisation + plan config
 *
 * Two pricing tracks:
 *   PLANS       — Option A: Annual subscription (CPA-introduced / committed buyers)
 *   CLAIM_PLANS — Option B: Pay-per-claim (self-serve SMBs, first-time filers)
 *
 * Usage:
 *   import { PLANS, CLAIM_PLANS, redirectToCheckout } from '../lib/stripe'
 */
import { loadStripe } from '@stripe/stripe-js'
import { billing } from './api'

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

// ── Option A: Annual subscription plans ───────────────────────────────────────
// Annual billing locks in the client for 12 months — solving the "file once,
// cancel" problem. Monthly available at a 40%+ premium.
export const PLANS = {
  starter: {
    id:               'starter',
    name:             'Starter',
    // Annual billing (default)
    price:            '$249',
    priceAnnualTotal: '$2,988',
    period:           '/mo · billed annually',
    // Month-to-month (premium)
    priceMonthly:     '$499',
    periodMonthly:    '/mo · cancel anytime',
    // Stripe price IDs
    priceId:          import.meta.env.VITE_STRIPE_PRICE_STARTER ?? null,
    priceIdMonthly:   import.meta.env.VITE_STRIPE_PRICE_STARTER_MONTHLY ?? null,
    description:      'SR&ED automation for Canadian tech companies making their first claim.',
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
    id:               'plus',
    name:             'Plus',
    price:            '$499',
    priceAnnualTotal: '$5,988',
    period:           '/mo · billed annually',
    priceMonthly:     '$899',
    periodMonthly:    '/mo · cancel anytime',
    priceId:          import.meta.env.VITE_STRIPE_PRICE_PLUS ?? null,
    priceIdMonthly:   import.meta.env.VITE_STRIPE_PRICE_PLUS_MONTHLY ?? null,
    description:      'SR&ED + Grants module — unlock up to $4M+ in additional Canadian innovation funding.',
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
    id:          'enterprise',
    name:        'Enterprise',
    price:       'Custom',
    priceAnnualTotal: null,
    period:      '',
    priceMonthly: 'Custom',
    periodMonthly: '',
    priceId:     null,
    priceIdMonthly: null,
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

// ── Option B: Pay-per-claim plans ─────────────────────────────────────────────
// One-time claim preparation fee. No subscription commitment.
// Ideal for SMBs filing their first claim or companies with sporadic R&D.
export const CLAIM_PLANS = {
  claim: {
    id:          'claim',
    name:        'Single Claim',
    price:       '$1,997',
    period:      'one-time · per fiscal year',
    description: 'Everything you need to prepare and file one SR&ED claim — pay once, file once.',
    features: [
      'Full T661 narrative package (one fiscal year)',
      'GitHub & Jira integrations',
      'CPA handoff PDF + evidence chain',
      'Narrative quality scoring',
      'Audit-ready document package',
      '90-day post-filing support window',
    ],
    cta:         'Get started',
    highlighted: false,
    badge:       'First-time filers',
    note:        'No subscription. Come back next year when you need us.',
    priceId:     import.meta.env.VITE_STRIPE_PRICE_CLAIM ?? null,
  },
  claim_always_on: {
    id:          'claim_always_on',
    name:        'Claim + Always-On',
    price:       '$1,997',
    period:      '/yr + $99/mo',
    description: 'Annual claim package plus year-round sync, audit vault, and mid-year SR&ED tracking.',
    features: [
      'Everything in Single Claim',
      '✦ Continuous GitHub/Jira sync year-round',
      '✦ Audit vault — evidence stored & versioned',
      '✦ Mid-year SR&ED activity tracker',
      '✦ Next-year claim prep starts automatically',
      '✦ CRA inquiry response templates',
      'Priority support',
    ],
    cta:         'Get started',
    highlighted: true,
    badge:       'Best value',
    note:        'Pause the $99/mo anytime — claim fee stays fixed.',
    priceId:     import.meta.env.VITE_STRIPE_PRICE_CLAIM_ALWAYS_ON ?? null,
  },
}

// ── Redirect to Stripe Checkout ────────────────────────────────────────────────
export async function redirectToCheckout(planId, billingPeriod = 'annual') {
  const allPlans = { ...PLANS, ...CLAIM_PLANS }
  if (!allPlans[planId] || planId === 'enterprise') {
    return { ok: false, message: 'Invalid plan' }
  }

  // Pick monthly price ID if month-to-month billing selected
  const plan = allPlans[planId]
  const resolvedPriceId = (billingPeriod === 'monthly' && plan.priceIdMonthly)
    ? plan.priceIdMonthly
    : plan.priceId

  try {
    const data = await billing.createCheckoutSession(
      planId,
      `${window.location.origin}/success?plan=${planId}`,
      `${window.location.origin}/cancel?plan=${planId}`,
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

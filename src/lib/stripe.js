/**
 * stripe.js — client-side Stripe initialisation + plan config
 *
 * Usage:
 *   import { PLANS, redirectToCheckout } from '../lib/stripe'
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

// ── Plans config ───────────────────────────────────────────────────────────────
export const PLANS = {
  starter: {
    id:          'starter',
    name:        'Starter',
    price:       '$299',
    period:      '/mo',
    description: 'SR&ED automation for Canadian tech companies making their first claim.',
    features: [
      'Unlimited SR&ED clusters',
      'AI narrative generation',
      'Narrative quality scoring (5 dimensions)',
      'GitHub & Jira integrations',
      'CPA handoff package PDF',
      'Evidence chain of custody',
      'Email support',
    ],
    cta:         'Start free trial',
    highlighted: false,
    badge:       null,
    grantsIncluded: false,
    priceId:     import.meta.env.VITE_STRIPE_PRICE_STARTER ?? null,
  },
  plus: {
    id:          'plus',
    name:        'Plus',
    price:       '$599',
    period:      '/mo',
    description: 'SR&ED + Grants module — unlock up to $4M+ in additional Canadian innovation funding.',
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
    cta:         'Start free trial',
    highlighted: true,
    badge:       'Most popular',
    grantsIncluded: true,
    priceId:     import.meta.env.VITE_STRIPE_PRICE_PLUS ?? null,
  },
  enterprise: {
    id:          'enterprise',
    name:        'Enterprise',
    price:       'Custom',
    period:      '',
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
    cta:         'Contact sales',
    highlighted: false,
    badge:       null,
    grantsIncluded: true,
    priceId:     null,
  },
}

// ── Redirect to Stripe Checkout ────────────────────────────────────────────────
/**
 * Creates a Stripe Checkout session on the server and redirects the browser.
 * Returns { ok: true } on success (redirect happens before resolution).
 * Returns { ok: false, message } on error.
 */
export async function redirectToCheckout(planId) {
  if (!PLANS[planId] || planId === 'enterprise') {
    return { ok: false, message: 'Invalid plan' }
  }

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

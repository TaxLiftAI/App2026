/**
 * Billing routes — Stripe Checkout
 *
 * Pricing model:
 *   starter (end users)  — $999 CAD one-time per fiscal year   (mode: payment)
 *   plus    (CPA seat)   — $4,800 CAD/year recurring            (mode: subscription)
 *
 * CPA referral commission:
 *   When a consumer (starter) pays and metadata includes referred_by (CPA user id),
 *   a $300 CAD commission is recorded in the referrals table for that CPA.
 *
 * Webhook events handled:
 *   checkout.session.completed      — grants access for both plans
 *   invoice.payment_succeeded       — renews paid_until on CPA annual auto-renewal
 *   customer.subscription.deleted   — revokes CPA access on cancellation/non-renewal
 *
 * Endpoints:
 *   POST /api/billing/create-checkout-session
 *   POST /api/billing/webhook
 *   POST /api/billing/portal
 *   GET  /api/billing/subscription
 */
const router = require('express').Router()
const db     = require('../db')
const { requireAuth } = require('../middleware/auth')

// ── DB migrations ─────────────────────────────────────────────────────────────
try { db.exec('ALTER TABLE users ADD COLUMN paid_until TEXT') }           catch { /* exists */ }
try { db.exec('ALTER TABLE users ADD COLUMN referred_by TEXT') }          catch { /* exists */ }
try { db.exec('ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT') } catch { /* exists */ }

// ── Stripe setup ──────────────────────────────────────────────────────────────
let stripe = null
function getStripe() {
  if (stripe) return stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key || key.startsWith('sk_test_placeholder')) return null
  stripe = require('stripe')(key)
  return stripe
}

// ── Plan config ───────────────────────────────────────────────────────────────
const PLANS = {
  starter: {
    mode:          'payment',       // one-time
    amountCAD:     999,
    label:         'SR&ED Filing Package',
    description:   'One-time flat fee per fiscal year. Keep your full SR&ED refund.',
    priceIdEnvKey: 'STRIPE_PRICE_STARTER',
  },
  plus: {
    mode:          'subscription',  // recurring annual — Stripe handles renewal
    amountCAD:     4_800,
    label:         'CPA Partner Seat',
    description:   'White-label SR&ED automation for your client portfolio. Earn $300 per referred client.',
    priceIdEnvKey: 'STRIPE_PRICE_PLUS',
  },
}

const CPA_REFERRAL_COMMISSION_CAD = 300  // flat per paying consumer referral

// ── POST /api/billing/create-checkout-session ─────────────────────────────────
router.post('/create-checkout-session', requireAuth, async (req, res) => {
  const s = getStripe()
  if (!s) {
    return res.status(503).json({
      message: 'Stripe is not configured. Set STRIPE_SECRET_KEY in Railway Variables.',
      configured: false,
    })
  }

  const { plan } = req.body ?? {}
  if (!plan || !PLANS[plan]) {
    return res.status(400).json({ message: `Invalid plan. Choose: ${Object.keys(PLANS).join(', ')}` })
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  if (!user) return res.status(404).json({ message: 'User not found' })

  const { mode, amountCAD, label, description, priceIdEnvKey } = PLANS[plan]
  const origin = req.headers.origin ?? 'https://taxlift.ai'

  // Prefer static Stripe price ID (set via env var) — falls back to inline price_data
  const staticPriceId = process.env[priceIdEnvKey] || null
  const lineItem = staticPriceId
    ? { price: staticPriceId, quantity: 1 }
    : {
        price_data: mode === 'subscription'
          ? { currency: 'cad', unit_amount: amountCAD * 100, recurring: { interval: 'year' }, product_data: { name: label, description } }
          : { currency: 'cad', unit_amount: amountCAD * 100, product_data: { name: label, description } },
        quantity: 1,
      }

  try {
    const session = await s.checkout.sessions.create({
      mode,
      payment_method_types: ['card'],

      line_items: [lineItem],

      customer_email: user.stripe_customer_id ? undefined : user.email,
      customer:       user.stripe_customer_id ?? undefined,
      client_reference_id: user.id,

      metadata: {
        plan,
        user_id:     user.id,
        referred_by: user.referred_by ?? '',
      },

      // Subscription checkout requires payment_method_collection default
      ...(mode === 'subscription' ? {
        subscription_data: {
          metadata: { plan, user_id: user.id },
        },
      } : {}),

      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}&plan=${plan}`,
      cancel_url:  `${origin}/cancel?plan=${plan}`,
    })

    console.log(`[billing] Checkout created — user=${user.email} plan=${plan} mode=${mode} amount=$${amountCAD}`)
    res.json({ url: session.url, sessionId: session.id, amountCAD })

  } catch (err) {
    console.error('[billing] create-checkout-session error:', err.message)
    res.status(502).json({ message: process.env.NODE_ENV !== 'production' ? err.message : 'Service unavailable' })
  }
})

// ── POST /api/billing/webhook ─────────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  const s = getStripe()
  if (!s) return res.status(503).json({ message: 'Stripe not configured' })

  const sig    = req.headers['stripe-signature']
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  if (!secret) {
    console.error('[billing/webhook] STRIPE_WEBHOOK_SECRET not configured')
    return res.status(500).json({ message: 'Webhook endpoint not configured' })
  }
  if (!sig) return res.status(400).json({ message: 'Missing stripe-signature header' })

  let event
  try {
    event = s.webhooks.constructEvent(req.rawBody ?? req.body, sig, secret)
  } catch (err) {
    console.error('[billing/webhook] signature verification failed:', err.message)
    return res.status(400).json({ message: `Webhook signature error: ${err.message}` })
  }

  try {
    await handleWebhookEvent(event)
    res.json({ received: true })
  } catch (err) {
    console.error('[billing/webhook] handler error:', err.message)
    res.status(500).json({ message: process.env.NODE_ENV !== 'production' ? err.message : 'Webhook handler error' })
  }
})

async function handleWebhookEvent(event) {
  switch (event.type) {

    // ── Checkout completed (fires for both payment and subscription) ──────
    case 'checkout.session.completed': {
      const session    = event.data.object
      const userId     = session.client_reference_id ?? session.metadata?.user_id
      const plan       = session.metadata?.plan ?? 'starter'
      const custId     = session.customer
      const referredBy = session.metadata?.referred_by || null

      if (!userId) {
        console.warn('[billing/webhook] checkout.session.completed missing user_id')
        break
      }

      if (plan === 'plus') {
        // Subscription — paid_until comes from Stripe's current_period_end
        // Retrieve the subscription to get the period end date
        const s2 = getStripe()
        const subId = session.subscription
        let paidUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()

        if (subId && s2) {
          try {
            const sub = await s2.subscriptions.retrieve(subId)
            paidUntil = new Date(sub.current_period_end * 1000).toISOString()
          } catch (e) {
            console.warn('[billing/webhook] Could not retrieve subscription period:', e.message)
          }
        }

        db.prepare(`
          UPDATE users SET
            subscription_tier      = 'plus',
            stripe_customer_id     = COALESCE(?, stripe_customer_id),
            stripe_subscription_id = ?,
            subscribed_at          = ?,
            paid_until             = ?
          WHERE id = ?
        `).run(custId, subId, new Date().toISOString(), paidUntil, userId)

        console.log(`[billing] ✓ CPA subscription activated — user=${userId} valid until ${paidUntil.slice(0, 10)}`)

      } else {
        // One-time payment (starter) — access for 1 year from payment date
        if (session.payment_status !== 'paid') break

        const paidUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()

        db.prepare(`
          UPDATE users SET
            subscription_tier  = 'starter',
            stripe_customer_id = COALESCE(?, stripe_customer_id),
            subscribed_at      = ?,
            paid_until         = ?
          WHERE id = ?
        `).run(custId, new Date().toISOString(), paidUntil, userId)

        console.log(`[billing] ✓ Consumer payment complete — user=${userId} valid until ${paidUntil.slice(0, 10)}`)

        // Record $300 CPA referral commission if applicable
        if (referredBy) {
          try {
            const { randomUUID } = require('crypto')
            const paidUser = db.prepare('SELECT email, full_name FROM users WHERE id = ?').get(userId)

            db.prepare(`
              INSERT OR IGNORE INTO referrals
                (id, referrer_user_id, ref_code, company_name, status,
                 commission_cad, commission_amount, commission_status, commission_confirmed,
                 date_referred, created_at)
              VALUES (?, ?, '', ?, 'converted', ?, ?, 'pending', 0, ?, ?)
            `).run(
              randomUUID(),
              referredBy,
              paidUser?.full_name ?? paidUser?.email ?? 'Unknown',
              CPA_REFERRAL_COMMISSION_CAD,
              CPA_REFERRAL_COMMISSION_CAD,
              new Date().toISOString(),
              new Date().toISOString(),
            )

            console.log(`[billing] ✓ $${CPA_REFERRAL_COMMISSION_CAD} commission recorded for CPA ${referredBy}`)
          } catch (err) {
            console.error('[billing] Commission recording failed (non-fatal):', err.message)
          }
        }
      }

      break
    }

    // ── CPA annual auto-renewal — extend paid_until by another year ───────
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object
      // Only care about subscription renewals, not the initial invoice
      if (invoice.billing_reason !== 'subscription_cycle') break

      const subId = invoice.subscription
      if (!subId) break

      try {
        const s2  = getStripe()
        const sub = await s2.subscriptions.retrieve(subId)
        const paidUntil = new Date(sub.current_period_end * 1000).toISOString()

        db.prepare(`
          UPDATE users SET paid_until = ?
          WHERE stripe_subscription_id = ?
        `).run(paidUntil, subId)

        console.log(`[billing] ✓ CPA subscription renewed — sub=${subId} valid until ${paidUntil.slice(0, 10)}`)
      } catch (err) {
        console.error('[billing] Renewal update failed:', err.message)
      }

      break
    }

    // ── CPA subscription cancelled or not renewed — revoke access ─────────
    case 'customer.subscription.deleted': {
      const sub = event.data.object
      db.prepare(`
        UPDATE users SET
          subscription_tier      = 'free',
          stripe_subscription_id = NULL,
          paid_until             = NULL
        WHERE stripe_subscription_id = ?
      `).run(sub.id)

      console.log(`[billing] CPA subscription cancelled — sub=${sub.id}`)
      break
    }

    default:
      break
  }
}

// ── POST /api/billing/portal ──────────────────────────────────────────────────
// Stripe Billing Portal — CPAs can manage/cancel their subscription here.
router.post('/portal', requireAuth, async (req, res) => {
  const s = getStripe()
  if (!s) return res.status(503).json({ message: 'Stripe is not configured on the server.' })

  const user = db.prepare('SELECT stripe_customer_id FROM users WHERE id = ?').get(req.user.id)
  if (!user?.stripe_customer_id) {
    return res.status(400).json({
      message: 'No Stripe customer on file. Contact hello@taxlift.ai to manage your billing.',
      noCustomer: true,
    })
  }

  try {
    const origin  = req.headers.origin ?? 'https://taxlift.ai'
    const session = await s.billingPortal.sessions.create({
      customer:   user.stripe_customer_id,
      return_url: `${origin}/settings`,
    })
    res.json({ url: session.url })
  } catch (err) {
    console.error('[billing/portal] error:', err.message)
    res.status(502).json({ message: process.env.NODE_ENV !== 'production' ? err.message : 'Service unavailable' })
  }
})

// ── GET /api/billing/subscription ─────────────────────────────────────────────
router.get('/subscription', requireAuth, (req, res) => {
  const user = db.prepare(`
    SELECT subscription_tier, stripe_customer_id, stripe_subscription_id, subscribed_at, paid_until
    FROM users WHERE id = ?
  `).get(req.user.id)

  if (!user) return res.status(404).json({ message: 'User not found' })

  const isActive = user.paid_until ? new Date(user.paid_until) > new Date() : false
  const isCpa    = user.subscription_tier === 'plus'

  res.json({
    tier:               user.subscription_tier ?? 'free',
    customerId:         user.stripe_customer_id ?? null,
    subscriptionId:     user.stripe_subscription_id ?? null,
    subscribedAt:       user.subscribed_at ?? null,
    paidUntil:          user.paid_until ?? null,
    isActive,
    isRecurring:        isCpa && !!user.stripe_subscription_id,
    stripeConfigured:   !!getStripe(),
  })
})

module.exports = router

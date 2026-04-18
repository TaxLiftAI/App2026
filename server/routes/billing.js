/**
 * Billing routes — Stripe Checkout (flat-fee pricing)
 *
 * Pricing model:
 *   starter (end users)   — $999 CAD one-time per fiscal year
 *   plus    (CPA seat)    — $4,800 CAD/year white-label partner seat
 *
 * CPA referral commission:
 *   When a consumer (starter) pays and metadata includes referred_by_cpa_id,
 *   a $300 CAD commission is recorded in the referrals table for that CPA.
 *
 * Flow:
 *   1. Frontend sends POST /api/billing/create-checkout-session with { plan }
 *   2. Server creates Stripe Checkout session with fixed price_data amount
 *   3. Stripe redirects to /success — checkout.session.completed webhook fires
 *   4. Webhook sets subscription_tier + paid_until (1 year) on the user record
 *   5. If referred by CPA, records $300 commission in referrals table
 *
 * Endpoints:
 *   POST /api/billing/create-checkout-session
 *   POST /api/billing/webhook
 *   GET  /api/billing/subscription
 */
const router = require('express').Router()
const db     = require('../db')
const { requireAuth } = require('../middleware/auth')

// ── DB migrations ─────────────────────────────────────────────────────────────
try { db.exec('ALTER TABLE users ADD COLUMN paid_until TEXT') }    catch { /* exists */ }
try { db.exec('ALTER TABLE users ADD COLUMN referred_by TEXT') }   catch { /* exists */ }

// ── Stripe setup ──────────────────────────────────────────────────────────────
let stripe = null
function getStripe() {
  if (stripe) return stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key || key.startsWith('sk_test_placeholder')) return null
  stripe = require('stripe')(key)
  return stripe
}

// ── Flat pricing ──────────────────────────────────────────────────────────────
const PLAN_PRICES = {
  starter: { amountCAD: 999,   label: 'SR&ED Filing Package — $999 flat fee',       description: 'One-time flat fee per fiscal year. Keep your full refund.' },
  plus:    { amountCAD: 4_800, label: 'CPA Partner Seat — $4,800/year',             description: 'White-label SR&ED automation for your client portfolio. Earn $300 per referred client.' },
}

const CPA_REFERRAL_COMMISSION_CAD = 300  // flat commission per paying consumer referral

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

  if (!plan || !PLAN_PRICES[plan]) {
    return res.status(400).json({ message: `Invalid plan. Choose: ${Object.keys(PLAN_PRICES).join(', ')}` })
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  if (!user) return res.status(404).json({ message: 'User not found' })

  const { amountCAD, label, description } = PLAN_PRICES[plan]
  const amountCents = amountCAD * 100  // Stripe uses cents

  try {
    const origin = req.headers.origin ?? 'https://taxlift.ai'

    const session = await s.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],

      line_items: [{
        price_data: {
          currency:     'cad',
          unit_amount:  amountCents,
          product_data: { name: label, description },
        },
        quantity: 1,
      }],

      customer_email: user.stripe_customer_id ? undefined : user.email,
      customer:       user.stripe_customer_id ?? undefined,
      client_reference_id: user.id,

      metadata: {
        plan,
        user_id:         user.id,
        fee_cad:         String(amountCAD),
        referred_by:     user.referred_by ?? '',   // CPA user id, if any
      },

      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}&plan=${plan}`,
      cancel_url:  `${origin}/cancel?plan=${plan}`,
    })

    console.log(`[billing] Checkout created — user=${user.email} plan=${plan} amount=$${amountCAD}`)
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
    console.error('[billing/webhook] STRIPE_WEBHOOK_SECRET not configured — rejecting webhook')
    return res.status(500).json({ message: 'Webhook endpoint not configured' })
  }
  if (!sig) {
    return res.status(400).json({ message: 'Missing stripe-signature header' })
  }

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

    // ── Primary: flat-fee checkout completed ─────────────────────────────
    case 'checkout.session.completed': {
      const session = event.data.object
      if (session.payment_status !== 'paid') break

      const userId      = session.client_reference_id ?? session.metadata?.user_id
      const plan        = session.metadata?.plan ?? 'starter'
      const custId      = session.customer
      const referredBy  = session.metadata?.referred_by || null   // CPA user id

      if (!userId) {
        console.warn('[billing/webhook] checkout.session.completed missing user_id in metadata')
        break
      }

      // Access valid for 12 months from payment date (both consumer and CPA seat)
      const paidUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()

      db.prepare(`
        UPDATE users SET
          subscription_tier  = ?,
          stripe_customer_id = COALESCE(?, stripe_customer_id),
          subscribed_at      = ?,
          paid_until         = ?
        WHERE id = ?
      `).run(plan, custId, new Date().toISOString(), paidUntil, userId)

      console.log(`[billing] ✓ Payment complete — user=${userId} plan=${plan} valid until ${paidUntil.slice(0, 10)}`)

      // ── CPA referral commission — $300 flat per paying consumer ──────────
      // Only fires when a consumer (starter) pays and was referred by a CPA.
      if (plan === 'starter' && referredBy) {
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

          console.log(`[billing] ✓ $${CPA_REFERRAL_COMMISSION_CAD} commission recorded for CPA ${referredBy} → client ${userId}`)
        } catch (err) {
          // Commission recording failure must never break the payment confirmation
          console.error('[billing] Commission recording failed (non-fatal):', err.message)
        }
      }

      break
    }

    default:
      break
  }
}

// ── POST /api/billing/portal ──────────────────────────────────────────────────
// Creates a Stripe Billing Portal session for the authenticated user.
// Returns { url } — frontend redirects to it. Stripe hosts the portal UI.
router.post('/portal', requireAuth, async (req, res) => {
  const s = getStripe()
  if (!s) {
    return res.status(503).json({ message: 'Stripe is not configured on the server.' })
  }

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
  const user = db.prepare(
    'SELECT subscription_tier, stripe_customer_id, subscribed_at, paid_until FROM users WHERE id = ?'
  ).get(req.user.id)

  if (!user) return res.status(404).json({ message: 'User not found' })

  const isActive = user.paid_until ? new Date(user.paid_until) > new Date() : false

  res.json({
    tier:             user.subscription_tier ?? 'free',
    customerId:       user.stripe_customer_id ?? null,
    subscribedAt:     user.subscribed_at ?? null,
    paidUntil:        user.paid_until ?? null,
    isActive,
    stripeConfigured: !!getStripe(),
  })
})

module.exports = router

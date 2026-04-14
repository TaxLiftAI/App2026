/**
 * Billing routes — Stripe Checkout (one-time annual payment)
 *
 * Pricing model: performance-based, annual
 *   Starter = 3% of customer's verified credit estimate (CAD)
 *   Plus    = 5% of customer's verified credit estimate (CAD)
 *
 * Flow:
 *   1. Frontend sends POST /api/billing/create-checkout-session with { plan, creditEstimate }
 *   2. Server verifies estimate is within reasonable bounds, creates Stripe Checkout
 *      session in `payment` mode with a dynamic price_data amount
 *   3. Stripe redirects to /success — checkout.session.completed webhook fires
 *   4. Webhook sets subscription_tier + paid_until (1 year) on the user record
 *
 * Endpoints:
 *   POST /api/billing/create-checkout-session
 *   POST /api/billing/webhook
 *   GET  /api/billing/subscription
 */
const router = require('express').Router()
const db     = require('../db')
const { requireAuth } = require('../middleware/auth')

// ── DB migration: add paid_until column ───────────────────────────────────────
try { db.exec('ALTER TABLE users ADD COLUMN paid_until TEXT') } catch { /* already exists */ }

// ── Stripe setup ──────────────────────────────────────────────────────────────
let stripe = null
function getStripe() {
  if (stripe) return stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key || key.startsWith('sk_test_placeholder')) return null
  stripe = require('stripe')(key)
  return stripe
}

// ── Performance fee rates ─────────────────────────────────────────────────────
const RATES = { starter: 0.03, plus: 0.05 }
const PLAN_NAMES = {
  starter: 'TaxLift Starter — SR&ED claim package',
  plus:    'TaxLift Plus — SR&ED + Grants package',
}

// Fee bounds in CAD
const MIN_FEE_CAD =    500
const MAX_FEE_CAD = 75_000

function fmtCAD(n) {
  return '$' + Math.round(n).toLocaleString('en-CA')
}

/**
 * Resolve the best credit estimate we have for this user from the DB.
 * Precedence: (1) most recent free scan, (2) company profile calculation.
 */
function resolveServerCreditEstimate(userId, userEmail) {
  try {
    const scan = db.prepare(`
      SELECT estimated_credit FROM free_scans
      WHERE email = ? AND estimated_credit > 0
      ORDER BY created_at DESC LIMIT 1
    `).get(userEmail)
    if (scan?.estimated_credit) return scan.estimated_credit

    const profile = db.prepare(`
      SELECT employee_count, industry_domain FROM company_profiles WHERE user_id = ?
    `).get(userId)
    if (profile?.employee_count) {
      const rdPcts = { software: 0.40, ai_ml: 0.45, biotech: 0.50, cleantech: 0.40,
                       fintech: 0.35, medtech: 0.40, other: 0.20 }
      const rdPct = rdPcts[profile.industry_domain] ?? 0.25
      return Math.round(profile.employee_count * 105_000 * rdPct * 0.35)
    }
  } catch { /* ignore */ }
  return null
}

// ── POST /api/billing/create-checkout-session ─────────────────────────────────
router.post('/create-checkout-session', requireAuth, async (req, res) => {
  const s = getStripe()
  if (!s) {
    return res.status(503).json({
      message: 'Stripe is not configured. Set STRIPE_SECRET_KEY in Railway Variables.',
      configured: false,
    })
  }

  const { plan, creditEstimate: clientEstimate } = req.body ?? {}

  if (!plan || !RATES[plan]) {
    return res.status(400).json({ message: `Invalid plan. Choose: ${Object.keys(RATES).join(', ')}` })
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  if (!user) return res.status(404).json({ message: 'User not found' })

  // ── Resolve credit estimate ───────────────────────────────────────────────
  // Accept client-supplied estimate but cap it against server-side data so
  // users can't inflate the estimate above what TaxLift has on file.
  const serverEstimate = resolveServerCreditEstimate(user.id, user.email)
  let creditEstimate

  if (serverEstimate && clientEstimate) {
    // Allow up to 20% above server estimate (CRA sometimes exceeds scan estimate)
    creditEstimate = Math.min(Number(clientEstimate), serverEstimate * 1.20)
  } else {
    creditEstimate = serverEstimate ?? Number(clientEstimate) ?? 0
  }

  if (!creditEstimate || creditEstimate < 10_000) {
    return res.status(400).json({
      message: 'A credit estimate is required to calculate your fee. Please run a free scan first.',
      action: 'run_scan',
    })
  }

  // ── Calculate fee ─────────────────────────────────────────────────────────
  const rate     = RATES[plan]
  const feeCAD   = Math.max(MIN_FEE_CAD, Math.min(MAX_FEE_CAD, Math.round(creditEstimate * rate)))
  const feeCents = feeCAD * 100   // Stripe uses smallest currency unit (cents)

  try {
    const origin = req.headers.origin ?? 'https://taxlift.ai'

    const session = await s.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],

      line_items: [{
        price_data: {
          currency:    'cad',
          unit_amount: feeCents,
          product_data: {
            name:        PLAN_NAMES[plan],
            description: `${Math.round(rate * 100)}% of ${fmtCAD(creditEstimate)} credit estimate · valid 12 months from payment`,
          },
        },
        quantity: 1,
      }],

      customer_email: user.stripe_customer_id ? undefined : user.email,
      customer:       user.stripe_customer_id ?? undefined,
      client_reference_id: user.id,

      metadata: {
        plan,
        user_id:         user.id,
        credit_estimate: String(Math.round(creditEstimate)),
        fee_cad:         String(feeCAD),
      },

      custom_text: {
        submit: {
          message: `${Math.round(rate * 100)}% of your ${fmtCAD(creditEstimate)} SR&ED estimate = ${fmtCAD(feeCAD)} CAD · covers this fiscal year's claim`,
        },
      },

      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}&plan=${plan}`,
      cancel_url:  `${origin}/cancel?plan=${plan}`,
    })

    console.log(`[billing] Checkout created — user=${user.email} plan=${plan} credit=${Math.round(creditEstimate)} fee=${feeCAD}`)
    res.json({ url: session.url, sessionId: session.id, feeCAD, creditEstimate: Math.round(creditEstimate) })

  } catch (err) {
    console.error('[billing] create-checkout-session error:', err.message)
    res.status(502).json({ message: err.message })
  }
})

// ── POST /api/billing/webhook ─────────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  const s = getStripe()
  if (!s) return res.status(503).json({ message: 'Stripe not configured' })

  const sig    = req.headers['stripe-signature']
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  if (!secret) {
    console.warn('[billing/webhook] STRIPE_WEBHOOK_SECRET not set — skipping signature verification')
  }

  let event
  try {
    event = secret && sig
      ? s.webhooks.constructEvent(req.rawBody ?? req.body, sig, secret)
      : (typeof req.body === 'object' ? req.body : JSON.parse(req.body))
  } catch (err) {
    console.error('[billing/webhook] signature verification failed:', err.message)
    return res.status(400).json({ message: `Webhook signature error: ${err.message}` })
  }

  try {
    await handleWebhookEvent(event)
    res.json({ received: true })
  } catch (err) {
    console.error('[billing/webhook] handler error:', err.message)
    res.status(500).json({ message: err.message })
  }
})

async function handleWebhookEvent(event) {
  switch (event.type) {

    // ── Primary: one-time payment checkout completed ──────────────────────
    case 'checkout.session.completed': {
      const session = event.data.object
      if (session.payment_status !== 'paid') break

      const userId = session.client_reference_id ?? session.metadata?.user_id
      const plan   = session.metadata?.plan ?? 'starter'
      const custId = session.customer

      if (!userId) {
        console.warn('[billing/webhook] checkout.session.completed missing user_id in metadata')
        break
      }

      // Annual model: access valid for 12 months from payment date
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
      break
    }

    // ── Legacy: subscription cancelled (for any existing monthly subs) ────
    case 'customer.subscription.deleted': {
      const custId = event.data.object.customer
      if (custId) {
        db.prepare(`
          UPDATE users SET subscription_tier = 'free', paid_until = NULL
          WHERE stripe_customer_id = ?
        `).run(custId)
        console.log(`[billing] Legacy subscription cancelled for customer ${custId}`)
      }
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object
      if (sub.status === 'past_due') {
        console.warn(`[billing] Legacy subscription past_due for customer ${sub.customer}`)
      }
      break
    }

    default:
      break
  }
}

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

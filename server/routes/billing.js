/**
 * Billing routes — Stripe Checkout integration
 *
 *   POST /api/billing/create-checkout-session
 *   POST /api/billing/webhook
 *   GET  /api/billing/subscription   — current user's sub status
 */
const router = require('express').Router()
const db     = require('../db')
const { requireAuth } = require('../middleware/auth')

// ── Stripe setup ──────────────────────────────────────────────────────────────
let stripe = null
function getStripe() {
  if (stripe) return stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key || key.startsWith('sk_test_placeholder')) {
    return null   // test-mode not configured; will return 503
  }
  stripe = require('stripe')(key)
  return stripe
}

// ── Price IDs map — override with real Stripe Price IDs in .env ───────────────
const PRICE_IDS = {
  starter: process.env.STRIPE_PRICE_STARTER ?? 'price_starter_placeholder',
  plus:    process.env.STRIPE_PRICE_PLUS    ?? 'price_plus_placeholder',
  // enterprise handled via contact form, no Stripe ID
}

// ── POST /api/billing/create-checkout-session ─────────────────────────────────
router.post('/create-checkout-session', requireAuth, async (req, res) => {
  const s = getStripe()
  if (!s) {
    return res.status(503).json({
      message: 'Stripe is not configured. Set STRIPE_SECRET_KEY in server/.env',
      configured: false,
    })
  }

  const { plan, successUrl, cancelUrl } = req.body ?? {}
  if (!plan || !PRICE_IDS[plan]) {
    return res.status(400).json({ message: `Invalid plan. Choose: ${Object.keys(PRICE_IDS).join(', ')}` })
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  if (!user) return res.status(404).json({ message: 'User not found' })

  try {
    const origin = req.headers.origin ?? 'http://localhost:5173'
    const session = await s.checkout.sessions.create({
      mode:               'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price:    PRICE_IDS[plan],
        quantity: 1,
      }],
      customer_email:    user.stripe_customer_id ? undefined : user.email,
      customer:          user.stripe_customer_id ?? undefined,
      client_reference_id: user.id,
      metadata:          { plan, user_id: user.id },
      success_url:       successUrl ?? `${origin}/success?session_id={CHECKOUT_SESSION_ID}&plan=${plan}`,
      cancel_url:        cancelUrl  ?? `${origin}/cancel?plan=${plan}`,
      subscription_data: {
        metadata: { plan, user_id: user.id },
      },
    })

    res.json({ url: session.url, sessionId: session.id })
  } catch (err) {
    console.error('[billing] create-checkout-session error:', err.message)
    res.status(502).json({ message: err.message })
  }
})

// ── POST /api/billing/webhook ─────────────────────────────────────────────────
// Raw body needed for Stripe signature verification — see index.js for bodyParser bypass
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
    case 'checkout.session.completed': {
      const session  = event.data.object
      const userId   = session.client_reference_id ?? session.metadata?.user_id
      const plan     = session.metadata?.plan ?? 'starter'
      const custId   = session.customer

      if (userId) {
        db.prepare(`
          UPDATE users SET
            subscription_tier  = ?,
            stripe_customer_id = ?,
            subscribed_at      = ?
          WHERE id = ?
        `).run(plan, custId, new Date().toISOString(), userId)
        console.log(`[billing] User ${userId} subscribed to ${plan}`)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub    = event.data.object
      const custId = sub.customer

      if (custId) {
        db.prepare(`
          UPDATE users SET subscription_tier = 'free' WHERE stripe_customer_id = ?
        `).run(custId)
        console.log(`[billing] Subscription cancelled for customer ${custId}`)
      }
      break
    }

    case 'customer.subscription.updated': {
      const sub    = event.data.object
      const custId = sub.customer
      const status = sub.status   // active | past_due | canceled | etc.

      if (custId && status === 'past_due') {
        console.warn(`[billing] Subscription past_due for customer ${custId}`)
      }
      break
    }

    default:
      // Ignore other event types
      break
  }
}

// ── GET /api/billing/subscription ────────────────────────────────────────────
router.get('/subscription', requireAuth, (req, res) => {
  const user = db.prepare(
    'SELECT subscription_tier, stripe_customer_id, subscribed_at FROM users WHERE id = ?'
  ).get(req.user.id)

  if (!user) return res.status(404).json({ message: 'User not found' })

  res.json({
    tier:        user.subscription_tier ?? 'free',
    customerId:  user.stripe_customer_id ?? null,
    subscribedAt: user.subscribed_at ?? null,
    stripeConfigured: !!getStripe(),
  })
})

module.exports = router

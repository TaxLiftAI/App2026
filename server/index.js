/**
 * TaxLift Express API Server
 *
 * Usage:
 *   cd server && node index.js
 *
 * Env vars (copy .env.example → .env):
 *   PORT                  default 3001
 *   JWT_SECRET            required in production
 *   GITHUB_CLIENT_ID      optional — enables real GitHub OAuth
 *   GITHUB_CLIENT_SECRET  optional
 *   ATLASSIAN_CLIENT_ID   optional — enables real Atlassian OAuth
 *   ATLASSIAN_CLIENT_SECRET optional
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') })

const express  = require('express')
const cors     = require('cors')

// ── Security & rate-limiting middleware ───────────────────────────────────────
const { globalLimiter, authLimiter, scanLimiter, leadsLimiter } = require('./middleware/rateLimiter')
const { securityHeaders, botGuard, scoreInternalsScrubber }     = require('./middleware/security')

// ── Bootstrap database (runs migrations + seed on first start) ────────────────
require('./db')

// ── Email drip scheduler ──────────────────────────────────────────────────────
const { startDripScheduler } = require('./lib/emailDrip')

// ── Express app ───────────────────────────────────────────────────────────────
const app = express()

// ── Global security headers (Threat 3) ───────────────────────────────────────
// Must come before any route so headers are set on every response
app.use(securityHeaders)

// ── Global rate limit — baseline for all routes (Threat 1) ───────────────────
app.use(globalLimiter)

// Parse JSON and urlencoded bodies (for OAuth2 form POST compat)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// CORS — allow the Vite dev server and any configured frontend origin
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
  // Production frontend origins
  'https://taxlift.ai',
  'https://www.taxlift.ai',
  'https://app.taxlift.ai',
  // Vercel deployment URL (set FRONTEND_URL in Railway env vars)
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  // Comma-separated extra origins (e.g. Vercel preview deployment URLs)
  ...(process.env.EXTRA_ORIGINS ? process.env.EXTRA_ORIGINS.split(',').map(o => o.trim()) : []),
]

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, Postman, SSR)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
    cb(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
}))

// ── Stripe webhook needs raw body for signature verification ──────────────────
// Must be registered BEFORE express.json() applies to this path.
// We register it here so the raw body is captured correctly.
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  // Stash the raw buffer so billing.js can verify the Stripe signature
  if (Buffer.isBuffer(req.body)) req.rawBody = req.body
  next()
})

// ── Routes ────────────────────────────────────────────────────────────────────

// Auth — tighter rate limit + bot guard (Threats 4, 1)
app.use('/api/auth', authLimiter, botGuard, require('./routes/auth'))

// OAuth — same bot guard, normal rate limit
app.use('/api/oauth', botGuard, require('./routes/oauth'))

// Billing — standard (Stripe webhook already has raw-body middleware above)
app.use('/api/billing', require('./routes/billing'))

// Leads / marketing — spam protection (Threat 4)
app.use('/api/leads', leadsLimiter, require('./routes/leads'))

// Clients — authenticated, standard rate limit
app.use('/api/clients', require('./routes/clients'))

// Clusters — scraping protection + scoring internals scrubber (Threats 1, 3)
app.use('/api/clusters', scanLimiter, scoreInternalsScrubber, require('./routes/clusters'))

app.use('/api/referrals', require('./routes/referrals'))
app.use('/api/grants',    require('./routes/grants'))

// Scan — scraping protection + scoring internals scrubber (Threats 1, 3)
app.use('/api/scan', scanLimiter, scoreInternalsScrubber, require('./routes/scan'))

app.use('/api/proposals',    require('./routes/proposals'))
app.use('/api/integrations', require('./routes/integrations'))
app.use('/api/admin',        require('./routes/admin'))
app.use('/api/cpa',          require('./routes/cpa'))

// ── Health check (both /health and /api/health are valid) ────────────────────
function healthHandler(_req, res) {
  res.json({ status: 'ok', service: 'taxlift-api', version: '1.0.0', timestamp: new Date().toISOString() })
}
app.get('/health',     healthHandler)
app.get('/api/health', healthHandler)

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.path} not found` })
})

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[error]', err.message)
  res.status(err.status ?? 500).json({
    message: err.message ?? 'Internal server error',
  })
})

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? '3001', 10)

app.listen(PORT, () => {
  startDripScheduler()
  console.log(`\n🚀  TaxLift API running on http://localhost:${PORT}`)
  console.log(`    POST /api/auth/login                  → get JWT`)
  console.log(`    GET  /api/auth/me                     → current user`)
  console.log(`    GET  /api/clients                     → CPA client list`)
  console.log(`    GET  /api/referrals                   → referral pipeline`)
  console.log(`    POST /api/billing/create-checkout-session → Stripe checkout`)
  console.log(`    POST /api/billing/webhook             → Stripe webhook`)
  console.log(`    POST /api/leads                       → capture marketing lead`)
  console.log(`    GET  /api/leads                       → admin lead list`)
  console.log(`    GET  /health                          → health check\n`)

  if (!process.env.JWT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ FATAL: JWT_SECRET is not set. Refusing to start without a secure secret — add it to Railway Variables.')
      process.exit(1)
    }
    console.warn('⚠️  JWT_SECRET not set — using insecure default. Set it in server/.env for local dev.')
    process.env.JWT_SECRET = 'taxlift-dev-secret-change-me-in-production'
  }
  if (!process.env.GITHUB_CLIENT_ID) {
    console.info('ℹ️   GITHUB_CLIENT_ID not set — GitHub OAuth will return demo mode response.')
  }
  if (!process.env.ATLASSIAN_CLIENT_ID) {
    console.info('ℹ️   ATLASSIAN_CLIENT_ID not set — Atlassian OAuth will return demo mode response.')
  }
})

module.exports = app

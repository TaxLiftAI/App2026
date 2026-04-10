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

// ── Sentry error tracking (optional — activate by setting SENTRY_DSN) ─────────
// Install: npm install @sentry/node   (in webapp/server/)
// Get DSN: https://sentry.io → New Project → Node.js → copy DSN
// Set in Railway env vars: SENTRY_DSN=https://xxx@oyyy.ingest.sentry.io/zzz
let Sentry = null
if (process.env.SENTRY_DSN) {
  try {
    Sentry = require('@sentry/node')
    Sentry.init({
      dsn:              process.env.SENTRY_DSN,
      environment:      process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.1,    // capture 10% of transactions for performance
    })
    console.log('[sentry] Initialized — error tracking active')
  } catch {
    console.warn('[sentry] @sentry/node not installed — run: npm install @sentry/node')
  }
}

const express  = require('express')
const cors     = require('cors')
// Inline cookie parser — uses the 'cookie' package already bundled with Express.
// Equivalent to cookie-parser without signed-cookie support (not needed here).
const cookieLib = require('cookie')

// ── Security & rate-limiting middleware ───────────────────────────────────────
const { globalLimiter, authLimiter, scanLimiter, leadsLimiter } = require('./middleware/rateLimiter')
const { securityHeaders, botGuard, scoreInternalsScrubber }     = require('./middleware/security')

// ── Bootstrap database (runs migrations + seed on first start) ────────────────
const db = require('./db')

// ── Email drip runs as a separate Railway cron job (server/drip-cron.js) ──────
// Do NOT call startDripScheduler() here — running it in the web process causes
// duplicate sends when Railway scales to multiple replicas.
// Deploy drip-cron.js as a Railway cron service: node server/drip-cron.js

// ── Express app ───────────────────────────────────────────────────────────────
const app = express()

// ── Cookie parsing (populates req.cookies for httpOnly auth cookie) ───────────
app.use((req, _res, next) => {
  req.cookies = cookieLib.parse(req.headers.cookie || '')
  next()
})

// ── Global security headers (Threat 3) ───────────────────────────────────────
// Must come before any route so headers are set on every response
app.use(securityHeaders)

// ── Global rate limit — baseline for all routes (Threat 1) ───────────────────
app.use(globalLimiter)

// Parse JSON and urlencoded bodies (for OAuth2 form POST compat)
// Explicit 100 kb body limit prevents memory exhaustion from oversized payloads
app.use(express.json({ limit: '100kb' }))
app.use(express.urlencoded({ extended: true, limit: '100kb' }))

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

// ── Stripe webhook — raw body BEFORE express.json(), unversioned path ────────
// Stripe's webhook URL is registered externally and cannot change without a
// Stripe dashboard update. Mount at BOTH paths during the transition period.
// Once Stripe webhook URL is updated to /api/v1/billing/webhook, remove the
// unversioned alias below.
const stripeRawBody = express.raw({ type: 'application/json' })
function stripeBodyStash(req, res, next) {
  if (Buffer.isBuffer(req.body)) req.rawBody = req.body
  next()
}
app.use('/api/billing/webhook',    stripeRawBody, stripeBodyStash)  // legacy alias
app.use('/api/v1/billing/webhook', stripeRawBody, stripeBodyStash)  // new path

// ── Routes — all under /api/v1/ ───────────────────────────────────────────────
const V = '/api/v1'

// Auth — tighter rate limit + bot guard (Threats 4, 1)
app.use(`${V}/auth`, authLimiter, botGuard, require('./routes/auth'))

// OAuth — same bot guard, normal rate limit
app.use(`${V}/oauth`, botGuard, require('./routes/oauth'))

// Billing — standard (Stripe webhook raw-body middleware already registered above)
app.use(`${V}/billing`, require('./routes/billing'))

// Leads / marketing — spam protection (Threat 4)
app.use(`${V}/leads`, leadsLimiter, require('./routes/leads'))

// Clients — authenticated, standard rate limit
app.use(`${V}/clients`, require('./routes/clients'))

// Clusters — scraping protection + scoring internals scrubber (Threats 1, 3)
app.use(`${V}/clusters`, scanLimiter, scoreInternalsScrubber, require('./routes/clusters'))

app.use(`${V}/referrals`, require('./routes/referrals'))
app.use(`${V}/grants`,    require('./routes/grants'))

// Scan — scraping protection + scoring internals scrubber (Threats 1, 3)
app.use(`${V}/scan`, scanLimiter, scoreInternalsScrubber, require('./routes/scan'))

app.use(`${V}/proposals`,    require('./routes/proposals'))
app.use(`${V}/integrations`, require('./routes/integrations'))
app.use(`${V}/admin`,        require('./routes/admin'))
app.use(`${V}/cpa`,          require('./routes/cpa'))

// ── Health check (/healthz for Railway liveness probe) ───────────────────────
// Returns 200 when the server and database are both reachable.
// Returns 503 when the database is down — Railway will restart the pod.
function healthHandler(_req, res) {
  try {
    db.prepare('SELECT 1').get()           // fast no-op query — confirms DB is alive
    res.status(200).json({
      status:    'ok',
      db:        'ok',
      service:   'taxlift-api',
      version:   '1.0.0',
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[healthz] DB check failed:', err.message)
    res.status(503).json({
      status:    'degraded',
      db:        'error',
      error:     err.message,
      timestamp: new Date().toISOString(),
    })
  }
}
app.get('/healthz',     healthHandler)   // Railway liveness probe target
app.get('/health',      healthHandler)   // legacy alias
app.get('/api/health',  healthHandler)   // legacy alias

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.path} not found` })
})

// ── Error handler ─────────────────────────────────────────────────────────────
// In production: never expose internal error messages (stack traces, DB errors,
// internal paths) to the client — they're an information leak for attackers.
// Log the full error on the server side and send a generic message to the client.
app.use((err, req, res, _next) => {
  const status = err.status ?? err.statusCode ?? 500
  console.error(`[error] ${req.method} ${req.path} → ${status}:`, err.message)
  if (Sentry) Sentry.captureException(err)

  // Expose the real message only for known client errors (4xx that we set ourselves)
  // or in non-production environments. Never surface 500-level details externally.
  const isClientError = status >= 400 && status < 500
  const isProduction  = process.env.NODE_ENV === 'production'
  const message = (!isProduction || isClientError)
    ? (err.message ?? 'Something went wrong')
    : 'Internal server error'

  res.status(status).json({ message })
})

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? '3001', 10)

// ── JWT_SECRET guard — checked BEFORE listen() so failure is logged clearly ──
// Previously this was inside the listen callback; if JWT_SECRET was missing the
// server would bind, fire the callback, then call process.exit(1) — causing the
// Railway healthcheck to see "service unavailable" with no obvious log reason.
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

app.listen(PORT, () => {
  console.log(`\n🚀  TaxLift API running on http://localhost:${PORT}`)
  console.log(`    POST /api/v1/auth/login                      → get JWT (httpOnly cookie)`)
  console.log(`    POST /api/v1/auth/refresh                    → refresh access token`)
  console.log(`    GET  /api/v1/auth/me                         → current user`)
  console.log(`    GET  /api/v1/clients                         → CPA client list`)
  console.log(`    GET  /api/v1/referrals                       → referral pipeline`)
  console.log(`    POST /api/v1/billing/create-checkout-session → Stripe checkout`)
  console.log(`    POST /api/billing/webhook                    → Stripe webhook (legacy alias)`)
  console.log(`    POST /api/v1/billing/webhook                 → Stripe webhook (new path)`)
  console.log(`    POST /api/v1/leads                           → capture marketing lead`)
  console.log(`    GET  /api/v1/leads                           → admin lead list`)
  console.log(`    GET  /healthz                                → liveness probe (DB-aware)\n`)
})

module.exports = app

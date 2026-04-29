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

// ── Startup guard: fail hard if JWT_SECRET is absent in production ────────────
// A missing secret would cause every signToken() call to throw at runtime,
// leaving users unable to log in. Catch it here so the deploy fails loudly
// rather than silently serving broken auth.
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('[startup] FATAL: JWT_SECRET is not set. Refusing to start in production.')
  process.exit(1)
}

// ── Bootstrap database (runs migrations + seed on first start) ────────────────
const db = require('./db')

// ── SMTP connectivity check at startup ────────────────────────────────────────
// Logs immediately so Railway shows SMTP status without waiting for a scan.
;(function checkSmtp() {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const port = process.env.SMTP_PORT || '(not set — defaults to 587)'
  if (!host || !user || !pass) {
    console.warn(`[startup/smtp] ⚠️  SMTP not configured — emails will NOT be sent.`)
    console.warn(`[startup/smtp]    Set in Railway: SMTP_HOST=${host||'MISSING'} SMTP_USER=${user||'MISSING'} SMTP_PASS=${pass?'set':'MISSING'} SMTP_PORT=${port}`)
    return
  }
  console.log(`[startup/smtp] ✅ SMTP configured — host=${host} port=${port} user=${user}`)
  // Full connection verify (async — result appears in logs a few seconds after boot)
  const nodemailer = require('nodemailer')
  const t = nodemailer.createTransport({
    host, port: parseInt(port, 10) || 587,
    secure: parseInt(port, 10) === 465,
    auth:   { user, pass },
    family: 4,
  })
  t.verify()
    .then(() => console.log(`[startup/smtp] ✅ SMTP connection verified OK`))
    .catch(err => console.error(`[startup/smtp] ❌ SMTP verify FAILED: ${err.message} — check SMTP_HOST/PORT/USER/PASS in Railway`))
})()

// ── Email drip runs as a separate Railway cron job (server/drip-cron.js) ──────
// Do NOT call startDripScheduler() here — running it in the web process causes
// duplicate sends when Railway scales to multiple replicas.
// Deploy drip-cron.js as a Railway cron service: node server/drip-cron.js

// ── Express app ───────────────────────────────────────────────────────────────
const app = express()

// ── Trust Railway's reverse proxy ────────────────────────────────────────────
// Railway (and most PaaS providers) sit behind a load balancer that sets the
// X-Forwarded-For header. Without this, express-rate-limit throws
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR and cannot identify real client IPs.
// '1' means trust exactly one proxy hop (the Railway edge) — safe default.
app.set('trust proxy', 1)

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

// ── Webhook raw-body capture — MUST come before express.json() ───────────────
// Both Stripe and GitHub sign the original raw bytes. express.json() consumes
// the stream and makes re-reading impossible, so we intercept these paths first.
const webhookRawBody = express.raw({ type: 'application/json' })
function rawBodyStash(req, _res, next) {
  if (Buffer.isBuffer(req.body)) req.rawBody = req.body
  next()
}
// Stripe (existing)
app.use('/api/billing/webhook',    webhookRawBody, rawBodyStash)
app.use('/api/v1/billing/webhook', webhookRawBody, rawBodyStash)
// GitHub — HMAC-SHA256 over raw bytes
app.use('/api/v1/webhooks/github', webhookRawBody, rawBodyStash)
// Jira — secret token in Authorization header; raw body for future HMAC support
app.use('/api/v1/webhooks/jira',   webhookRawBody, rawBodyStash)

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

// (raw-body middleware for Stripe + GitHub registered above, before express.json())

// ── Routes — all under /api/v1/ ───────────────────────────────────────────────
const V = '/api/v1'

// Auth — tighter rate limit + bot guard (Threats 4, 1)
app.use(`${V}/auth`, authLimiter, botGuard, require('./routes/auth'))

// OAuth — same bot guard, normal rate limit
app.use(`${V}/oauth`, botGuard, require('./routes/oauth'))

// ── Plan enforcement middleware ───────────────────────────────────────────────
const { requireExportAccess } = require('./middleware/planLimits')

// Billing — standard (Stripe webhook raw-body middleware already registered above)
app.use(`${V}/billing`, require('./routes/billing'))

// Leads / marketing — spam protection (Threat 4)
app.use(`${V}/leads`, leadsLimiter, require('./routes/leads'))

// Clients — authenticated, standard rate limit
app.use(`${V}/clients`, require('./routes/clients'))

// Clusters — scraping protection + scoring internals scrubber (Threats 1, 3)
// requireClusterQuota is applied inside routes/clusters.js on POST /
app.use(`${V}/clusters`, scanLimiter, scoreInternalsScrubber, require('./routes/clusters'))

app.use(`${V}/referrals`, require('./routes/referrals'))
// Grants — requirePlusTier guard is enforced inside routes/grants.js
app.use(`${V}/grants`,    require('./routes/grants'))

// Scan — scraping protection + scoring internals scrubber (Threats 1, 3)
app.use(`${V}/scan`, scanLimiter, scoreInternalsScrubber, require('./routes/scan'))

// Proposals PDF export — starter plan required (free users can view, not download)
app.use(`${V}/proposals`,    require('./routes/proposals'))
// Block authenticated PDF export for free tier (the public /pdf/:scanId route inside
// proposals.js has no auth so it's intentionally exempt — it's for scan leads only)
app.use(`${V}/reports/export`, requireExportAccess)
// Real report data from scan results + AI narrative generation (requires ANTHROPIC_API_KEY)
app.use(`${V}/reports`,  require('./routes/reports'))
app.use(`${V}/agents`,   require('./routes/agents'))

app.use(`${V}/integrations`, require('./routes/integrations'))
app.use(`${V}/narratives`,   require('./routes/narratives'))
app.use(`${V}/users`,        require('./routes/users'))
app.use(`${V}/documents`,    require('./routes/documents'))
app.use(`${V}/admin`,        require('./routes/admin'))
app.use(`${V}/cpa`,          require('./routes/cpa'))
app.use(`${V}/changelog`,    require('./routes/changelog'))
app.use(`${V}/audit`,        require('./routes/audit'))

// CI/CD build run ingestion (Pattern A: GitHub webhook, Pattern C: CLI agent)
// GitHub webhook needs raw body for HMAC — stash it before json parsing runs
app.use(`${V}/webhooks/github`, (req, _res, next) => {
  // Re-attach raw body stash so verifyGitHubSignature can use it.
  // express.json() has already run; JSON.stringify(req.body) is used as fallback
  // in webhooks.js, which is accurate enough for HMAC on typical payloads.
  next()
})
app.use(`${V}/webhooks`, require('./routes/webhooks'))

// ── Health check (/healthz for Railway liveness probe) ───────────────────────
// Returns 200 when the server and database are both reachable.
// Returns 503 when the database is down — Railway will restart the pod.
function healthHandler(_req, res) {
  try {
    db.prepare('SELECT 1').get()           // fast no-op query — confirms DB is alive
    const smtpHost = process.env.SMTP_HOST
    const smtpUser = process.env.SMTP_USER
    const smtpPass = process.env.SMTP_PASS
    const smtpPort = process.env.SMTP_PORT || '587'
    res.status(200).json({
      status:    'ok',
      db:        'ok',
      service:   'taxlift-api',
      version:   '1.0.0',
      timestamp: new Date().toISOString(),
      smtp: {
        configured: !!(smtpHost && smtpUser && smtpPass),
        host:       smtpHost  || 'NOT SET',
        port:       smtpPort,
        user:       smtpUser  || 'NOT SET',
        pass:       smtpPass  ? `${smtpPass.slice(0, 8)}…` : 'NOT SET',
        from:       process.env.EMAIL_FROM    || 'NOT SET',
        alertTo:    process.env.SCAN_ALERT_TO || process.env.ALERT_TO || 'NOT SET',
      },
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

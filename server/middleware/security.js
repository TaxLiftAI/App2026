/**
 * Security Middleware
 *
 * Threat coverage:
 *   Threat 2 — Token theft / session hijacking
 *              → suspiciousActivityDetector: logs multi-IP token reuse, flags anomalies
 *   Threat 3 — Competitor reverse-engineering of scoring algorithm
 *              → scoreInternalsScrubber: strips internal scoring fields from API responses
 *              → securityHeaders: removes X-Powered-By, adds XSS/frame guards
 *   Threat 4 — Credential stuffing / bots
 *              → botGuard: blocks requests with absent or suspicious User-Agent on auth paths
 *
 * Note: Threat 1 (API scraping) is handled by scanLimiter in rateLimiter.js
 */
const db     = require('../db')
const { v4: uuid } = require('../utils/uuid')

// ── Bootstrap security_events table (SQLite, creates once on first start) ────
db.prepare(`
  CREATE TABLE IF NOT EXISTS security_events (
    id         TEXT    PRIMARY KEY,
    user_id    TEXT    NOT NULL,
    event_type TEXT    NOT NULL,
    ip         TEXT,
    user_agent TEXT,
    metadata   TEXT,
    created_at TEXT    DEFAULT (datetime('now'))
  )
`).run()

// Index for fast recent-event lookups
db.prepare(`
  CREATE INDEX IF NOT EXISTS idx_security_events_user_time
  ON security_events (user_id, created_at)
`).run()

// ── Purge events older than 24 hours once per server start ────────────────────
// Keeps the table lean; we only need short-window data for anomaly detection
try {
  const deleted = db.prepare(
    `DELETE FROM security_events WHERE created_at < datetime('now', '-24 hours')`
  ).run()
  if (deleted.changes > 0) {
    console.info(`[security] Purged ${deleted.changes} old security events`)
  }
} catch (err) {
  console.error('[security] Purge error:', err.message)
}

// ── Internal: log a security event row ───────────────────────────────────────
function logSecurityEvent(userId, eventType, ip, userAgent, metadata = {}) {
  try {
    db.prepare(`
      INSERT INTO security_events (id, user_id, event_type, ip, user_agent, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuid(), userId, eventType, ip, userAgent, JSON.stringify(metadata))
  } catch (err) {
    console.error('[security] logSecurityEvent error:', err.message)
  }
}

// ── THREAT 2: Suspicious activity detector ───────────────────────────────────
// Called from requireAuth in middleware/auth.js after token is verified.
// Logs each authenticated request. If the same user_id appears from 4+ distinct
// IPs within 5 minutes, a suspicious_multi_ip event is logged.
// We intentionally don't block — VPN/mobile IP churn causes false positives.
// Future: wire this to email/Slack alert when event_type = suspicious_multi_ip.
function checkSuspiciousActivity(userId, ip, userAgent) {
  try {
    // Log this access
    logSecurityEvent(userId, 'api_access', ip, userAgent)

    // Distinct IPs for this user in the last 5 minutes
    const recentIPs = db.prepare(`
      SELECT DISTINCT ip
      FROM   security_events
      WHERE  user_id    = ?
        AND  event_type = 'api_access'
        AND  created_at > datetime('now', '-5 minutes')
    `).all(userId).map(r => r.ip)

    const uniqueIPCount = new Set(recentIPs).size

    // Threshold: 4 distinct IPs in 5 min is unusual even for VPN users
    if (uniqueIPCount >= 4 && !recentIPs.slice(0, -1).includes(ip)) {
      console.warn(
        `[security] SUSPICIOUS MULTI-IP: user=${userId} distinct_ips=${uniqueIPCount} current_ip=${ip}`
      )
      logSecurityEvent(userId, 'suspicious_multi_ip', ip, userAgent, {
        distinct_ips: uniqueIPCount,
        recent_ips: recentIPs,
      })
    }
  } catch (err) {
    // Never crash a request due to monitoring code
    console.error('[security] checkSuspiciousActivity error:', err.message)
  }
}

// ── THREAT 3: Score internals scrubber ───────────────────────────────────────
// Strips fields from cluster/scan API responses that would reveal internal
// scoring logic to competitors. Only active in production; admins are exempt.
// These fields exist in shapeCluster() but carry no user value — removing them
// from the response doesn't break any frontend functionality.
const INTERNAL_SCORE_FIELDS = [
  'trigger_rules',          // which keyword rules fired
  'proxy_confidence',       // internal PPA proxy confidence value
  'manual_override_pct',    // internal override metadata
  'manual_override_reason', // internal override metadata
  'evidence_snapshot_id',   // internal evidence linkage
]

function _scrubObject(obj) {
  if (Array.isArray(obj)) return obj.map(_scrubObject)
  if (obj !== null && typeof obj === 'object') {
    const clean = { ...obj }
    INTERNAL_SCORE_FIELDS.forEach(f => delete clean[f])
    return clean
  }
  return obj
}

function scoreInternalsScrubber(req, res, next) {
  // Only scrub in production (dev/staging can see internals for debugging)
  if (process.env.NODE_ENV !== 'production') return next()

  // Admin and super_admin roles can see everything
  const role = req.user?.role
  if (role === 'admin' || role === 'super_admin') return next()

  // Monkey-patch res.json for this request only
  const originalJson = res.json.bind(res)
  res.json = function (data) {
    return originalJson(_scrubObject(data))
  }

  next()
}

// ── THREAT 4: Bot guard ───────────────────────────────────────────────────────
// Applied only to auth routes. Blocks requests with no User-Agent header —
// the clearest signal of automated credential stuffing tools, which often
// omit it entirely. Legitimate browsers and apps always send one.
const BOT_UA_PATTERNS = [
  /^python-requests/i,
  /^go-http-client/i,
  /^java\//i,
  /^curl\//i,
  /^wget\//i,
  /^libwww-perl/i,
  /^okhttp/i,
  /^axios\//i,           // direct axios callers outside the app
]

function botGuard(req, res, next) {
  const ua = (req.headers['user-agent'] ?? '').trim()

  if (!ua) {
    console.warn(`[security] botGuard BLOCKED: no User-Agent ip=${req.ip} path=${req.path}`)
    logSecurityEvent('anonymous', 'bot_blocked_no_ua', req.ip, '', { path: req.path })
    return res.status(403).json({ message: 'Request blocked.' })
  }

  if (BOT_UA_PATTERNS.some(p => p.test(ua))) {
    console.warn(`[security] botGuard BLOCKED: bot UA="${ua}" ip=${req.ip} path=${req.path}`)
    logSecurityEvent('anonymous', 'bot_blocked_ua', req.ip, ua, { path: req.path })
    return res.status(403).json({ message: 'Request blocked.' })
  }

  next()
}

// ── THREAT 3: Security response headers ──────────────────────────────────────
// Removes Express fingerprint and adds hardening headers.
// Applied globally in index.js before any route.
function securityHeaders(_req, res, next) {
  res.removeHeader('X-Powered-By')                              // hide "Express"
  res.setHeader('X-Content-Type-Options', 'nosniff')           // prevent MIME sniffing
  res.setHeader('X-Frame-Options', 'DENY')                     // prevent clickjacking
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  // HSTS — tell browsers to only use HTTPS for 2 years (Railway is HTTPS-only)
  // Only set in production; local dev uses HTTP which breaks HSTS
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  }
  next()
}

module.exports = {
  checkSuspiciousActivity,    // called from middleware/auth.js
  scoreInternalsScrubber,     // applied per-route in index.js for /api/clusters, /api/scan
  botGuard,                   // applied to /api/auth in index.js
  securityHeaders,            // applied globally in index.js
  logSecurityEvent,           // utility for auth.js (failed login logging)
}

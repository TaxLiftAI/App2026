/**
 * JWT authentication middleware.
 *
 * Token source priority (httpOnly cookie auth — Fix 3):
 *  1. taxlift_access httpOnly cookie   (set by login/register/refresh endpoints)
 *  2. Authorization: Bearer <token>    (fallback for Postman / direct API testing)
 *
 * Using cookies eliminates localStorage XSS exfiltration — any JS running on
 * the page cannot read an httpOnly cookie.
 *
 * Access tokens are short-lived (15 min). The frontend's api.js intercepts 401s,
 * calls POST /api/v1/auth/refresh (which reads the httpOnly refresh token cookie),
 * and retries the original request once with a fresh access token.
 *
 * Also wires in suspicious-activity monitoring (Threat 2):
 * logs each authenticated request and flags multi-IP token reuse.
 */
const jwt = require('jsonwebtoken')
let _checkSuspicious = null
function getSuspiciousChecker() {
  if (!_checkSuspicious) _checkSuspicious = require('./security').checkSuspiciousActivity
  return _checkSuspicious
}

function getSecret() {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET environment variable is not set')
  return s
}

/**
 * signToken(payload, expiresIn?) — creates a signed JWT.
 * Default expiry: 15 minutes (short-lived access token).
 */
function signToken(payload, expiresIn = '15m') {
  return jwt.sign(payload, getSecret(), { expiresIn })
}

/**
 * cookieOptions — shared options for auth cookies.
 * httpOnly: JS cannot read the cookie (blocks XSS token theft).
 * Secure:   HTTPS-only in production; plain HTTP allowed in dev.
 * SameSite: 'Lax' — cookie sent on same-site navigations + Vite/Vercel proxy requests.
 */
function cookieOptions(maxAgeMs = 15 * 60 * 1000) {
  return {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path:     '/',
    maxAge:   maxAgeMs,
  }
}

/**
 * requireAuth — Express middleware.
 * Attaches req.user = { id, email, role, tenant_id } on success.
 */
function requireAuth(req, res, next) {
  // 1. Prefer httpOnly cookie (browsers send automatically, JS cannot read it)
  const cookieToken = req.cookies?.taxlift_access ?? null

  // 2. Fallback: Authorization header (for Postman / direct API testing / CPA links)
  const header      = req.headers.authorization ?? ''
  const headerToken = header.startsWith('Bearer ') ? header.slice(7) : null

  const t = cookieToken ?? headerToken

  if (!t) return res.status(401).json({ message: 'Authorization required' })

  try {
    req.user = jwt.verify(t, getSecret())

    // Threat 2: log access + flag suspicious multi-IP token reuse (non-blocking)
    try {
      const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown'
      const ua = req.headers['user-agent'] ?? ''
      getSuspiciousChecker()(req.user.id, ip, ua)
    } catch { /* never crash a real request */ }

    next()
  } catch (err) {
    const msg = err.name === 'TokenExpiredError'
      ? 'Access token expired'    // frontend will auto-refresh
      : 'Invalid token'
    return res.status(401).json({ message: msg })
  }
}

/**
 * optionalAuth — attaches req.user if a valid token is present,
 * but does NOT reject requests without one.
 */
function optionalAuth(req, res, next) {
  const header = req.headers.authorization ?? ''
  if (header.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.slice(7), getSecret())
    } catch {
      // swallow — treat as unauthenticated
    }
  }
  next()
}

module.exports = { signToken, requireAuth, optionalAuth }

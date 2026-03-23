/**
 * JWT authentication middleware.
 *
 * Reads the Bearer token from Authorization header, verifies it,
 * and attaches the decoded payload to req.user.
 *
 * Routes that call requireAuth() will respond 401 if the token is
 * missing or invalid.
 */
const jwt = require('jsonwebtoken')

function getSecret() {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET environment variable is not set')
  return s
}

/**
 * signToken(payload) — creates a signed JWT that expires in 7 days.
 */
function signToken(payload) {
  return jwt.sign(payload, getSecret(), { expiresIn: '7d' })
}

/**
 * requireAuth — Express middleware.
 * Attaches req.user = { id, email, role, tenant_id } on success.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? ''
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization token required' })
  }

  const token = header.slice(7)
  try {
    req.user = jwt.verify(token, getSecret())
    next()
  } catch (err) {
    const msg = err.name === 'TokenExpiredError'
      ? 'Token expired — please log in again'
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

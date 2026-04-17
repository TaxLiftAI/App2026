/**
 * cpaReviewToken.js — HMAC-SHA256 signed CPA review link tokens.
 *
 * Replaces the client-side btoa(JSON) encoding with server-signed tokens so
 * payloads cannot be forged or tampered with. The signature covers the entire
 * base64-url payload, so any modification to the data invalidates the token.
 *
 * Token format: <base64url-payload>.<hex-hmac>
 *   payload = URL-safe base64(JSON.stringify({ v:2, ...data }))
 *   hmac    = HMAC-SHA256(payload, REFERRAL_SECRET) as hex
 *
 * Key: process.env.REFERRAL_SECRET (any non-empty string; min 32 chars recommended).
 *   Generate: node -e "require('crypto').randomBytes(32).toString('hex')|console.log()"
 *
 * Compatibility: tokens signed with v:2 are distinct from the old btoa v:1 tokens.
 * decodeCpaToken() in the frontend still decodes the payload portion for display;
 * the backend verifies the HMAC before trusting the data.
 */
const crypto = require('crypto')

function getSecret() {
  const s = process.env.REFERRAL_SECRET
  if (!s) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('REFERRAL_SECRET is not set — cannot sign CPA review tokens in production')
    }
    // Dev fallback — tokens work but are trivially forgeable
    return 'taxlift-dev-referral-secret'
  }
  return s
}

function b64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * sign(payload) → "<b64url-payload>.<hex-hmac>"
 */
function sign(payload) {
  const json    = JSON.stringify({ v: 2, ...payload })
  const encoded = b64url(Buffer.from(json, 'utf8'))
  const hmac    = crypto.createHmac('sha256', getSecret()).update(encoded).digest('hex')
  return `${encoded}.${hmac}`
}

/**
 * verify(token) → decoded payload object, or null if invalid/tampered.
 */
function verify(token) {
  if (!token || typeof token !== 'string') return null

  const lastDot = token.lastIndexOf('.')
  if (lastDot < 1) return null

  const encoded      = token.slice(0, lastDot)
  const providedHmac = token.slice(lastDot + 1)
  const expectedHmac = crypto.createHmac('sha256', getSecret()).update(encoded).digest('hex')

  // Constant-time comparison to prevent timing attacks
  if (!crypto.timingSafeEqual(Buffer.from(providedHmac, 'hex'), Buffer.from(expectedHmac, 'hex'))) {
    return null
  }

  try {
    const b64     = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const padded  = b64 + '=='.slice(0, (4 - b64.length % 4) % 4)
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'))
    if (payload?.v !== 2) return null
    return payload
  } catch {
    return null
  }
}

module.exports = { sign, verify }

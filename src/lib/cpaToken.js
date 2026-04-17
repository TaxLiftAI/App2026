/**
 * CPA Review Link — token encode/decode
 *
 * The token is URL-safe base64(JSON). No encryption; this is a demo convenience.
 * In production this would be a signed, server-issued JWT with per-tenant ACLs.
 *
 * Token payload shape:
 * {
 *   v:            1,                   // schema version
 *   companyName:  string,
 *   fiscalYear:   string,              // e.g. "2025"
 *   filingDeadline: string | null,     // ISO date
 *   auditScore:   number,              // 0-100
 *   totalCredit:  number,              // CAD
 *   totalHours:   number,
 *   sharedBy:     string,
 *   sharedByEmail: string,
 *   generatedAt:  string,              // ISO datetime
 *   expiresAt:    string,              // ISO datetime (+7 days)
 *   t661: {
 *     line100, line200, line300, line400, line500,
 *     itc, isCCPC, firstBracket, secondBracket, entityType
 *   },
 *   clusters: [{
 *     id, name, status, hours, creditCAD, riskScore,
 *     narrative, narrativeApproved, evidenceSnapshotId
 *   }]
 * }
 */

/**
 * encodeCpaToken — async, server-signed (HMAC-SHA256 via /api/v1/cpa/review-token).
 * Falls back to unsigned btoa token when the backend is unreachable (demo/dev mode).
 *
 * Returns a token string: "<b64url-payload>.<hex-hmac>" (v2) or legacy "<b64url>" (v1).
 */
export async function encodeCpaToken(payload) {
  try {
    const res = await fetch('/api/v1/cpa/review-token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      credentials: 'include',
    })
    if (res.ok) {
      const { token } = await res.json()
      return token
    }
  } catch {
    // backend unavailable — fall back to unsigned btoa token (dev / demo mode only)
  }
  // Unsigned fallback (v1) — only used when the backend is unreachable
  const json = JSON.stringify({ v: 1, ...payload })
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeCpaToken(token) {
  try {
    // v2 signed token: "<b64url-payload>.<hex-hmac>" — strip signature before decoding
    const lastDot = token.lastIndexOf('.')
    const encoded = lastDot > 0 ? token.slice(0, lastDot) : token

    const b64     = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const padded  = b64 + '=='.slice(0, (4 - (b64.length % 4)) % 4)
    const payload = JSON.parse(atob(padded))
    if (payload?.v !== 1 && payload?.v !== 2) return null
    return payload
  } catch {
    return null
  }
}

/** Return ISO date 7 days from now */
export function makeExpiresAt() {
  return new Date(Date.now() + 7 * 86_400_000).toISOString()
}

/** True if the token's expiresAt is in the past */
export function isTokenExpired(payload) {
  if (!payload?.expiresAt) return false
  return new Date(payload.expiresAt) < new Date()
}

/** How many days until expiry (negative if past) */
export function daysUntilExpiry(payload) {
  if (!payload?.expiresAt) return null
  return Math.ceil((new Date(payload.expiresAt) - Date.now()) / 86_400_000)
}

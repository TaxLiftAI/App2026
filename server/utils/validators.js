/**
 * validators.js — shared validation helpers
 * Import these instead of duplicating inline regex across route files.
 */

/**
 * RFC-5322-lite email validator. Fast, avoids ReDoS-prone alternatives.
 * Matches: local@domain.tld (no whitespace, two @ signs, or empty parts)
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Returns true if the given string is a syntactically valid email address.
 * @param {string} email
 */
function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_RE.test(email)
}

module.exports = { EMAIL_RE, isValidEmail }
